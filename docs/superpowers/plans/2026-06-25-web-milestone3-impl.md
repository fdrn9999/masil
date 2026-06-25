# 웹 마일스톤 3 구현 계획 — 파스텔 코지 UI 리프레시 + 2호선 맵 + 폰 메타화면

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 전체 UI/UX를 **말랑 파스텔 코지** 비주얼로 통일하고(기존 화면 리프레시 + 신규), 2호선 맵 본구현 + 폰 메타화면(친구목록·추억함·갤러리·진단카드)을 추가한다. 에셋(실제 배경/BGM/CG)은 제외 — UI·로직만.

**두 개의 권위 있는 레퍼런스 (구현자는 반드시 읽을 것):**
- **기능 스펙:** `docs/superpowers/specs/2026-06-25-web-milestone3-map-meta.md` — 7화면 상세·systems 헬퍼·STATIONS/MAP 데이터·와이어링·z-order. (refs의 .rpy에서 verbatim 추출됨)
- **비주얼 소스(파스텔 목업):** `.superpowers/refs/design_pastel.html` — 색·라운드·섀도·Jua·컴포넌트 스타일의 source of truth. 새 CSS는 이걸 모사한다.
- 시스템 원본(verbatim 포팅용): `.superpowers/refs/systems_extra.rpy`, `screens_meta.rpy`, `screens_map.rpy`.

**Architecture:** 기존 바닐라 JS 엔진/UI에 (1) 파스텔 디자인 토큰(CSS 변수)을 깔고 전 컴포넌트 재스타일, (2) `systems.js`/`theme.js`에 관계·맵·갤러리 헬퍼/상수 추가, (3) 신규 `ui/map.js`·`ui/phone.js`, (4) `view_dom`에서 맵=call_screen·폰=비차단 오버레이로 배선.

## Global Constraints
- 빌드 없음·ES 모듈·외부 런타임 의존성 0·localStorage·safe-play·innerHTML escape.
- **게이지 숫자 절대 비노출** — 친구목록은 `rel_subtitle`의 비수치 '결' 라벨만. 갤러리 미해금은 `???`.
- **도윤 말투(형 대접)·후반 반전 스포 금지** — 텍스트 verbatim.
- 색/문자열/역 데이터/관계 라벨은 레퍼런스에서 **verbatim**.
- 테스트: `node --test test/*.test.js`(루트). 렌더 검증=헤드리스 Chrome 스크린샷(관찰).
- Jua 폰트는 **자체 호스팅**(Pretendard처럼, CDN 금지). OFL.
- 파스텔 디자인 토큰은 **CSS 커스텀 프로퍼티**(`:root`)로 한 곳에 — 컴포넌트는 변수만 참조(테마 일관성).

## 디자인 토큰 (목업에서, `:root`에 정의)
`--cream #fff7f0 / #fdeee4` · `--blush #ffd5dd / --blush-deep #ff9eb3` · `--mint #bfeede / --mint-deep #5fd3b0 / track #7fdcc0` · `--lav #d9d2ff / --lav-deep #a99cf2` · `--peach #ffd9b8` · `--ink #5a4a55 / --ink-soft #9a8893` · `--send #9aa6ff / --send-grad #c6ccff` · online `#46d18a`. 라운드 22~36px(말풍선 6/22 비대칭), 섀도 레이어드(`0 18px 40px -18px rgba(180,140,160,.45), 0 4px 0 #ffe6ec inset`). 제목/이름/버튼/이니셜 = **Jua**, 본문 = Pretendard.

---

## Task 1: 디자인 시스템 토대 — Jua 자체호스팅 + 토큰 + 베이스(스테이지/대사창/선택지) 리프레시

**Files:** `web/fonts/` (Jua woff2 + OFL), `web/style.css`(토큰+베이스), `web/src/ui/stage.js`(마크업 최소 조정 시).

- [ ] **Step 1: Jua woff2 자체호스팅.** jsDelivr 등에서 Jua woff2 fetch → `web/fonts/Jua.woff2`(wOF2 매직·크기 검증). `style.css` 상단에 `@font-face{font-family:'Jua';src:url('fonts/Jua.woff2') format('woff2');font-display:swap;}`. `web/fonts/OFL-Jua.txt`(라이선스). README 폰트 항목에 Jua 추가.
- [ ] **Step 2: `:root` 토큰 + 베이스 리프레시.** 위 토큰을 `:root`에 정의. `body/#game` 배경을 파스텔 크림 그라데이션으로. `#textbox`(대사창)=둥근 카드+소프트 섀도, `#name`=Jua+캐릭터색, `#line`=Pretendard 가독 본문. `#choices` 버튼=파스텔 pill(둥근·소프트 섀도·hover lift). `#toast`/오버레이 베이스 변수화. **기존 레이아웃/ID/기능 보존** — 색·라운드·폰트만 교체. 목업 `.hero/.bub/.choice/.card` 스타일을 참고.
- [ ] **Step 3: 렌더 검증.** `node --check`(stage.js 변경 시) + `node --test test/*.test.js`(영향 없음). 로컬 서버 부팅 스크린샷(컨트롤러가 관찰) — 대사창/이름/선택지가 파스텔로, 한글(Jua 제목/Pretendard 본문) 정상.
- [ ] **Step 4: 커밋** `feat(ui): pastel design tokens + Jua font + base refresh`

---

## Task 2: 마실 채팅 UI 파스텔 리프레시

**Files:** `web/src/ui/chat.js`(스타일/마크업), `web/style.css`(채팅 블록 교체).

- [ ] **Step 1:** 목업 `.chatwrap/.bub/.ava/.topbar/.dot` 모사로 채팅 CSS 교체: 받은 말풍선=흰/크림 둥근(6/22 비대칭), 보낸 말풍선=`--send` 그라데이션, 프사=Jua 이니셜+캐릭터색+소프트 섀도, 상단바=파스텔, 온라인 점, 타임스탬프/읽음 톤, 입력중 점 애니메이션. `makeChat` 시그니처·메서드·escape **불변**(스타일만).
- [ ] **Step 2:** `node --check chat.js`; suite green; 채팅이 떠 있는 상태 스크린샷(컨트롤러 관찰) — 말풍선 정렬·프사·타이핑.
- [ ] **Step 3: 커밋** `feat(ui): pastel chat bubbles/avatars/topbar`

---

## Task 3: 오버레이 파스텔 — 상담/입력 모달 · 토스트 · result_card

**Files:** `web/src/ui/overlay.js`(result_card·toast 스타일), `web/src/ui/menu.js`(input·consult 스타일은 menu/overlay 분담 확인), `web/style.css`.

- [ ] **Step 1:** `.modal`(상담/입력)=파스텔 둥근 카드, `.hint`=민트 톤, 닉네임 input=둥근·Jua 라벨, 토스트=목업처럼 둥근 캡슐(아이템=peach, 도윤=mint 보더+📱), result_card=목업 `.card`(큰 Jua 제목 + `--lav` 유형 chip + 설명 + 확인). 모든 동적값 escape 유지.
- [ ] **Step 2:** `node --check` overlay.js/menu.js; suite green; `_grounding.html` 스크린샷(컨트롤러 관찰) — 6컴포넌트가 파스텔로 통일.
- [ ] **Step 3: 커밋** `feat(ui): pastel modals/toast/result_card`

---

## Task 4: systems.js + theme.js 추가 (관계·맵·갤러리 데이터)

**Files:** `web/src/systems.js`, `web/src/theme.js`, `test/systems.test.js`. **레퍼런스:** 스펙 (d) 절 + `.superpowers/refs/systems_extra.rpy`(verbatim).

- [ ] **Step 1: 실패 테스트.** 스펙 (d.2)의 헬퍼별 대표 케이스 + (d.1) defaults. (rel_subtitle 비수치 라벨 verbatim, is_met, endings_seen_count, all_endings_seen, kept_promises, heart_vs_like, who_remained.)
- [ ] **Step 2: 구현.** 스펙 (d) 그대로 1:1 포팅: state defaults 추가(times_ran 등), 7 헬퍼 systems.js에 추가(persistent/vars 접근 정확히), theme.js에 `STATIONS`/`MAP`(역 id·이름·좌표/순서, 색) verbatim 추가. **수치 노출 헬퍼 없음** 확인.
- [ ] **Step 3:** `node --test test/*.test.js` 전부 green.
- [ ] **Step 4: 커밋** `feat(engine): relationship/map/gallery systems + STATIONS constants`

---

## Task 5: 2호선 맵 (map.js) — 파스텔 캔디 루프 + 배선

**Files:** `web/src/ui/map.js`(신규), `web/style.css`(맵), `web/src/ui/view_dom.js`(callScreen 위임), `web/src/ui/overlay.js`(subway_map 스텁 제거). **레퍼런스:** 스펙 C1 + 목업의 2호선 루프 + `refs/screens_map.rpy`.

- [ ] **Step 1:** `makeMap(root, { sys, STATIONS, MAP })` → `show()→Promise`(닫기 resolve). 순환선 캔디 루프(SVG/DOM): 트랙(`--mint` track), 역 점(해금=글로시 민트 / 잠김=회색+🔒 / 현재=`--blush-deep` ♥"지금 여기" 핀), 역 이름(Jua). 해금 상태=`state.vars.__stations`. 목업 스타일 모사. 비차단 없음 — 스토리 call_screen으로 호출되는 모달.
- [ ] **Step 2: 배선.** `view_dom`의 callScreen: `name==='subway_map'` → `map.show()`(overlay 인터스티셜 스텁 대체). overlay.js의 subway_map 분기 제거(또는 map으로 위임).
- [ ] **Step 3:** `node --check map.js`/view_dom; suite green; 맵을 직접 띄운 스크린샷(컨트롤러 관찰 — `_grounding.html`에 맵 프레임 추가하거나 임시 호출) — 루프·역·현위치 핀·잠금.
- [ ] **Step 4: 커밋** `feat(ui): 2호선 candy-loop map + call_screen wiring`

---

## Task 6: 폰 메뉴 + 메타화면 (phone.js) — 버튼·메뉴·친구목록·추억함·갤러리

**Files:** `web/src/ui/phone.js`(신규: 버튼+메뉴+3서브화면), `web/style.css`, `web/index.html`(#phone-layer 추가 시), `web/src/ui/view_dom.js`(마운트). **레퍼런스:** 스펙 C2~C5 + `refs/screens_meta.rpy` + 목업.

- [ ] **Step 1:** `makePhone(root, { sys })` → 우상단 📱 버튼 + 폰 메뉴(친구목록/추억함/갤러리, Jua 라벨+아이콘) + 3 서브화면. **비차단 오버레이**(자체 `#phone-overlay`/레이어, 엔진 await 불간섭 — 아무 때나 열고 닫기). 
  - 친구목록: 히로인별 프사(캐릭터색 이니셜) + **비수치 '결' 라벨**(`sys.rel_subtitle`) + met/unmet(`sys.is_met`). 숫자 금지.
  - 추억함: `state.vars.inventory`×`ITEMS`(아이콘+이름+설명), 선물 상태.
  - 갤러리: `ENDING_LIST` 7칸 그리드, 해금(`persistent.endings_seen`)=제목 / 미해금=`???`.
  - 전부 파스텔 카드.
- [ ] **Step 2: 배선.** `view_dom`에서 `makePhone` 생성 + 버튼 마운트(게임 시작 시 표시). 폰 레이어 z-order는 채팅/대사보다 위, 모달성.
- [ ] **Step 3:** `node --check phone.js`/view_dom; suite green; 폰 메뉴+친구목록+추억함+갤러리 스크린샷(컨트롤러 관찰).
- [ ] **Step 4: 커밋** `feat(ui): phone menu + friends/memory/gallery meta-screens`

---

## Task 7: 통합 그라운딩 + README

**[render artifact]** 헤드리스 Chrome로 전체 흐름 관찰→수정.

- [ ] **Step 1:** 전체 부팅(파스텔) + 채팅 + 선택지 + 상담 + 맵(call_screen) + 폰(친구/추억/갤러리) + 엔딩 result_card + 토스트 스크린샷 일괄 → 컨트롤러 관찰 → 깨진 것 수정. 모바일 폭(390px)도 1장.
- [ ] **Step 2:** `node --test test/*.test.js` 전부 green 확인.
- [ ] **Step 3:** README 로드맵 갱신(2호선 맵·메타화면 ✅로 이동; 남은 건 실제 에셋·타이틀 화면). `_grounding.html`에 신규 컴포넌트 프레임 반영(선택).
- [ ] **Step 4: 커밋** `feat(web): milestone-3 grounding + README`

---

## Self-Review
- 스펙 커버리지: 디자인 토큰/베이스(T1)·채팅(T2)·오버레이(T3)·systems+STATIONS(T4)·맵+배선(T5)·폰 메타(T6)·그라운딩(T7). 7화면 + 7헬퍼 + 파스텔 통일 전부 매핑.
- 게이지 비노출(친구목록 '결' 라벨, 갤러리 ???)·도윤 말투·스포 보존·escape·safe-play 전부 Global Constraints.
- 리스크: 폰 비차단 오버레이가 엔진 await와 충돌하지 않도록 별도 레이어(T6 Step1) — 그라운딩에서 확인. 맵 좌표/역 데이터는 스펙 C1 verbatim 사용.
- 병렬 충돌 회피: style.css 공유 때문에 순차 SDD(태스크별 리뷰 게이트=애더서리얼 검증).
