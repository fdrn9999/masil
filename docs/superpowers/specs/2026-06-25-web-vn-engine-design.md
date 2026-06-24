# 설계: 자체 웹 VN 엔진 ("마실") — Ren'Py → 정적 웹 전환

- **날짜:** 2026-06-25
- **상태:** 승인됨 (브레인스토밍 완료, 구현 계획 작성 단계로 이행)
- **목표:** Ren'Py 프로젝트 *(가제) 오픈챗에서 만나요* 를 Vercel에 쉽게 올릴 수 있는 **빌드 없는 정적 웹앱**으로 전환한다. 이미 써둔 한국어 대사·분기(약 90KB)를 최대한 보존한다.

## 배경 / 동기

Ren'Py 웹 빌드(emscripten)는 무겁고 COOP/COEP 헤더가 필요하며 모바일 이슈가 잦다. 자체 웹앱이면 정적 파일을 폴더째 Vercel에 올리면 끝이라 배포가 단순하고 깨질 일이 적다. 콘텐츠(한국어 산문·분기·채팅)가 이 작품의 핵심 자산이므로 **재타이핑을 최소화**하는 것이 제약 조건이다.

## 핵심 결정 (브레인스토밍 합의)

1. **콘텐츠 이전:** 가벼운 웹 VN **엔진** + `.rpy → JSON` **자동 변환기**. 써둔 글을 거의 그대로 보존.
2. **스택:** **순수 바닐라**(HTML/CSS/JS, 빌드 단계 없음). 툴체인 0, 폴더째 Vercel 업로드.
3. **저장:** `localStorage`만 사용. 서버/DB 없음. (클라우드 세이브 = 향후, 백엔드 필요 시에만 — 이번 스코프 제외)
4. **첫 마일스톤:** **수직 슬라이스** — 엔진+변환기+프롤로그·Ep1을 끝까지 플레이 가능하게.

## 아키텍처

기존 `.rpy`는 원본/참고용으로 보존하고, 웹 결과물은 하위 폴더 `web/`에 만든다.

```
web/
  index.html              # 진입점 (DOM 레이어: 스테이지/채팅/메뉴/오버레이)
  style.css               # 반응형(PC/모바일), 채팅·VN 레이아웃
  src/
    engine.js             # 코어 런타임: 스크립트 노드를 순차 실행하는 상태머신
    state.js              # 게임 상태 + localStorage 세이브/로드(persistent + 슬롯)
    systems.js            # 게이지(like/sincere/doyun_bond)·아이템·엔딩 판정 (systems_*.rpy 포팅)
    eval.js               # set/if 표현식을 상태 스코프에서 안전 평가 (new Function)
    ui/
      stage.js            # 배경·트랜지션·캐릭터 색 대사 렌더
      chat.js             # 마실 채팅 UI(말풍선·타임스탬프·읽음·입력중·프사 이니셜)
      menu.js             # 선택지 메뉴
      consult.js          # 도윤 상담 모달
      phone.js            # (다음 마일스톤) 폰 오버레이 → 친구목록/추억함/갤러리
  data/
    ep1.json              # 변환된 프롤로그+Ep1
    characters.json       # n/mc/d/s 정의(이름·색)
  assets/                 # 배경은 CSS 단색 placeholder, 프사는 선택(없으면 이니셜 동그라미)
tools/
  rpy2json.py             # 변환기: .rpy → data/*.json (PYTHONUTF8, 콘솔 대신 파일 출력)
```

### 단위별 책임 (격리/명확성)

- **engine.js** — 프로그램 카운터(현재 노드 배열 + 인덱스) + `call`/`return` 콜스택 + 라벨 인덱스 맵. `advance()`는 사용자 입력이 필요한 노드(say/menu/input/pause)를 만날 때까지 실행하고 멈춘다. 입력은 모른다(UI가 알림).
- **state.js** — 변수 묶음(`vars`) + `persistent` + 세이브 슬롯. 직렬화/역직렬화. 엔진/시스템이 읽고 쓴다.
- **systems.js** — `add_like`/`add_sincere`/`has_item`/`give_item`/`final_ending` 등 순수 로직. state만 의존.
- **eval.js** — 변환된 표현식 문자열을 state+systems 스코프에서 평가. 다른 곳에서 `eval` 금지.
- **ui/** — 각 화면은 "현재 노드를 받아 그리고, 사용자 입력을 엔진에 콜백"하는 뷰. 엔진 내부를 모른다.

## 스크립트 데이터 포맷 (JSON)

한 화 = **노드(명령) 배열**. 엔진이 위에서 아래로 실행, 입력 필요 노드에서 멈춘다(Ren'Py 흐름 동형). 분기는 라벨/점프.

| op | 필드 | 의미 |
|---|---|---|
| `label` | `name` | 점프 타깃 |
| `scene` | `bg`, `with?` | 배경 교체 + 트랜지션 |
| `say` | `who`, `text`, `color?` | 나레이션/대사 (클릭 진행) |
| `chat_open` | `room` | 마실 채팅 화면 표시 |
| `chat_close` | — | 채팅 화면 숨김 |
| `recv` | `name`, `text` | 상대 말풍선(왼쪽) + 입력중→표시 |
| `send` | `text` | 내 말풍선(오른쪽) |
| `pause` | — | 클릭 대기(채팅 중 진행) |
| `input` | `var`, `prompt`, `default?`, `max?` | 텍스트 입력 → 변수 저장 |
| `menu` | `prompt?`, `choices[]` | 선택지. 각 choice = `{text, body:[nodes]}` |
| `set` | `expr` | `$` 파이썬 한 줄(변환된 식) 실행 |
| `if` | `cond`, `then[]`, `else?[]` | 조건 분기 |
| `call` | `label`, `args?[]` | 라벨 호출(복귀) |
| `jump` | `label` | 라벨 점프 |
| `return` | — | call 복귀 |
| `music`/`sound`/`amb`/`stop` | `file`, `fadein?` | safe-play(파일 없으면 무음 통과) |

- **텍스트 태그 보존:** `{w=0.4}`(딜레이) `{p}`(문단+대기) `{i}{/i}`(이탤릭)는 인라인 마크업으로 그대로 두고 엔진이 해석.
- **이스케이프:** Ren'Py `[[` , `\"` 등은 변환기가 정규화.

## 가장 까다로운 부분 — `$` 파이썬 / `if` 조건

기존 스크립트의 파이썬은 한정된 어휘다(`add_like`, `add_sincere`, `chapter_start`, `consult_doyun`, `has_item`, `give_item`, `was_given`, `persistent.x`, 단순 비교/대입, `.format`).

- 헬퍼는 `systems.js`에 **JS로 1:1 포팅**.
- 변환기가 `$`식·조건을 **가벼운 파이썬→JS 변환**: `and/or/not`→`&&/||/!`, `True/False/None`→`true/false/null`, dict 접근 `like["seoa"]` 유지, `.format()`→템플릿 문자열.
- 엔진은 state+systems를 스코프로 묶어 `eval.js`에서 `new Function`으로 평가(전역 오염/임의 코드 차단).
- 변환기가 **못 옮기는 줄은 `tools/convert_review.log` 에 `REVIEW:` 로 남겨** 수동 처리. → "글 보존 + 로직 명시" 동시 달성.

## 상태 & 세이브 (localStorage)

- `masil.persistent` — `play_count`·엔딩 수집 리스트·갤러리/역 해금. (Ren'Py `persistent` 대체)
- `masil.save.<N>` + `masil.autosave` — 현재 위치(`label`+노드 인덱스+콜스택)+`vars` 스냅샷.
- `vars` — 모든 `default` 변수(`like`/`sincere`/`doyun_bond`/`mc_name`/아이템/플래그…).

## 엔진 실행 루프

1. 라벨 인덱스 맵 구축 후 시작 라벨(`episode1_full`)로 진입.
2. `advance()`: 현재 노드 실행 → `set/if/jump/call/return/scene/recv/send/music…`는 즉시 처리하고 다음으로; `say/menu/input/pause`를 만나면 해당 UI를 그리고 **멈춤**.
3. 사용자 입력(클릭/탭/Enter/선택) → 엔진에 콜백 → 다시 `advance()`.
4. 매 정지 지점에서 오토세이브.

## 변환기 (tools/rpy2json.py)

순수 파이썬(Ren'Py SDK 불필요). 들여쓰기를 존중하며 라인 파싱:
- 선언: `image`(→bg 색 맵), `define`(캐릭터), `default`(초기 변수)
- 제어: `label`, `menu:`(4/8/12 들여쓰기), `if/elif/else`, `call`, `jump`, `return`, `pause`
- 연출: `scene`/`show`/`hide` + `with`
- 대사: `<char> "..."` 및 무명 `"..."`(나레이션)
- 헬퍼: `$ recv/send/chat_reset`, `$ pmusic/psound/pstop/pamb`, 기타 `$` 한 줄
- 출력: `web/data/ep1.json`, `web/data/characters.json` + `convert_review.log`
- 콘솔 cp949 깨짐 방지 → 파일로만 출력.

## 이번 수직 슬라이스 범위 (Definition of Done)

프롤로그+Ep1을 **끝까지 플레이 가능**하게:
- 배경(단색 placeholder)+트랜지션
- 캐릭터 색 대사 + 텍스트 태그(`{w}{p}{i}`) 동작
- 마실 채팅 UI: 말풍선·타임스탬프·읽음·입력중 애니메이션·프사 이니셜
- 선택지 메뉴 (분기 정확)
- 도윤 상담 모달 (챕터당 1회 제한)
- 닉네임 입력
- 게이지 로직 정상 동작하되 **`show_gauges=False` 유지 — 숫자 비노출**
- 세이브/로드(localStorage), 클릭/탭 진행, 반응형(PC/모바일)

### 다음 마일스톤 (이번 제외)
Ep2~4·에필로그 변환, 2호선 맵·친구목록·추억함·갤러리·진단카드, 엔딩 7종 연결, 한글 폰트 내장, 실제 에셋 교체.

## 작품 규칙 준수 (CLAUDE.md)

- **게이지 숫자 비노출**(`show_gauges=False`) — 새 장치도 "정답 하나" 금지.
- **포지셔닝:** 우정·진심(도윤) 이야기. 헷갈리면 주제 편.
- **후반 반전(민결·도윤 과거) 스포 금지** — 플레이어 대면 텍스트.
- **도윤 말투:** 텍스트를 그대로 복사하므로 보존(형 대접 유지).
- Ren'Py SDK 불필요: 변환기는 파이썬, 엔진은 브라우저.

## 검증 전략

- 변환기: `ep1.json` 라운드트립/스키마 점검, `convert_review.log` 0건 목표(남으면 수동 처리).
- 엔진: 노드 op별 단위 점검(분기/세이브/조건).
- **그라운딩 루프(렌더 산출물):** 실제 브라우저에서 프롤로그→Ep1 전 분기 플레이스루 → 관찰 → 수정 → 재실행. 정적 점검은 관찰이 아님.

## 리스크 / 미해결

- 파이썬→JS 식 변환의 엣지케이스 → `REVIEW:` 로그로 가시화 후 수동 처리.
- `renpy.input`/`persistent`/`call_screen` 등 Ren'Py 특수 호출 → 엔진 대응 매핑 필요(변환기에서 인식).
- 채팅과 나레이션 뷰 전환의 자연스러움 → 브라우저 그라운딩으로 조정.
