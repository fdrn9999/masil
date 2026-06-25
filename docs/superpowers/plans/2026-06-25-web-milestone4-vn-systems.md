# 웹 마일스톤 4 — VN 표준 기능 (타이틀 · 세이브/로드 · 스킵/오토/백로그/롤백)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 비주얼노벨 표준 플레이어 기능을 추가한다 — 타이틀/메인메뉴 화면(새로하기·이어하기·불러오기·설정), 세이브/불러오기 메뉴(슬롯+썸네일), 퀵세이브/퀵로드, 이어하기(오토세이브 복원), 게임 중 시스템 메뉴(저장·불러오기·스킵·오토·백로그·타이틀로), 백로그(지난 대사), 롤백(이전으로). 파스텔 코지 UI 유지.

**Architecture:** 엔진은 이미 `state.saveSlot/loadSlot/saveAuto/loadAuto`·`engine.position()/resume(pos)` 보유. 추가: (1) `playback.js`(스킵/오토 모드 + 대사 히스토리 + 롤백 스냅샷), (2) `state.js` 스냅샷에 미리보기 meta + quick 슬롯, (3) stage/chat가 playback을 존중(스킵/오토/히스토리/롤백 스냅샷), (4) 신규 UI: title·saveload·sysmenu·backlog, (5) view_dom 부팅을 타이틀-우선으로 바꾸고 전체 오케스트레이션.

**Tech:** 바닐라 JS ES모듈·빌드 없음·localStorage·`node --test test/*.test.js`·헤드리스 Chrome 그라운딩. 파스텔 `:root` 토큰·escape·safe.

## Global Constraints
- 빌드 없음·외부 의존성 0·localStorage·escape·safe-play. 파스텔 코지 UI 통일(`:root` 토큰, Jua/Pretendard).
- 게이지 숫자 비노출 유지. 도윤 말투·스포 보존(텍스트 표시만 추가, 내용 불변).
- 세이브 키 규약: `masil.save.<n>`(슬롯) · `masil.save.quick`(퀵) · `masil.autosave` · `masil.persistent` · `masil.settings`.
- 새 오버레이(타이틀/세이브로드/백로그/시스템메뉴)는 **엔진 await를 망치지 않게**: 게임 중 메뉴는 비차단 레이어, Escape 리스너 누수 없음(remove-before-add + remove-on-close).
- 롤백은 스토리 상태(vars+position) 복원 방식 — 나레이션 정확, 채팅 시각 복원은 제한(문서화).

## 파일 구조 (신규/수정)
```
web/src/playback.js          (신규) 스킵/오토 모드 + 대사 히스토리 + 롤백 스택
web/src/state.js             (수정) 슬롯 스냅샷에 meta 미리보기 + saveQuick/loadQuick
web/src/ui/title.js          (신규) 타이틀/메인메뉴 화면
web/src/ui/saveload.js       (신규) 세이브/불러오기 슬롯 메뉴(썸네일)
web/src/ui/sysmenu.js        (신규) 게임 중 ≡ 시스템 메뉴 + 스킵/오토 토글
web/src/ui/backlog.js        (신규) 지난 대사 로그 오버레이
web/src/ui/stage.js          (수정) say가 스킵/오토 존중 + 히스토리 + 롤백 스냅샷
web/src/ui/chat.js           (수정) recv/send 히스토리 기록 + 스킵 시 타이핑 단축
web/src/ui/view_dom.js       (수정) 타이틀-우선 부팅 + 전체 배선 + 메뉴로 돌아가기
web/index.html               (수정) #title-layer 등 레이어
web/style.css                (수정) 파스텔 타이틀/세이브로드/백로그/시스템메뉴
```

---

## Task 1: 런타임 — playback 컨트롤러(스킵/오토) + 대사 히스토리 + 롤백 스냅샷 + 세이브 meta

**Files:** `web/src/playback.js`(신규), `web/src/state.js`(수정), `web/src/ui/stage.js`(수정), `web/src/ui/chat.js`(수정), `test/playback.test.js`(신규), `test/state.test.js`(보강).

**Interfaces:**
- `makePlayback()` → `{ mode (getter), setMode(m), isSkip(), isAuto(), autoDelay(text), pushHistory(entry), history(), clearHistory(), pushSnapshot(snap), popSnapshot(), canRollback() }`.
  - mode ∈ `'normal'|'skip'|'auto'`. setMode toggles; any user click cancels skip/auto back to normal (stage/chat call setMode('normal') on real click).
  - history: capped array(예: 200) of `{who, name, text}`.
  - rollback stack: capped(예: 60) of `{vars, pos}` (deep). pushSnapshot before each say-stop; popSnapshot returns previous.
- `state.js`: `saveSlot(n, pos, meta)`/`saveQuick(pos,meta)`/`loadQuick()`; `snapshot(pos, meta)` includes `meta`(미리보기). `listSlots(n)` 헬퍼 또는 loadSlot이 meta 포함 반환. meta 예: `{label, who, name, text, mc_name, time}`.
- `stage.say(a)`: normal=클릭 대기(현재); skip=짧게(예: 0–30ms) auto-resolve 루프; auto=`autoDelay(text)`ms 후 resolve(클릭 시 즉시+normal 복귀). 매 say 시작 시 `playback.pushHistory({who,name,text})` + 호출자가 롤백 스냅샷 push(또는 stage가 콜백). 클릭으로 진행 시 mode가 skip/auto면 normal로.
- `chat.recv/send`: `playback.pushHistory(...)`; 스킵 모드면 타이핑 800ms를 짧게(예: 60ms). recv/send는 클릭 대기가 아니므로 auto엔 영향 적음.

- [ ] **Step 1: 실패 테스트** — `test/playback.test.js`: setMode/isSkip/isAuto; pushHistory caps; pushSnapshot/popSnapshot LIFO + canRollback; autoDelay grows with text length. `test/state.test.js` 보강: saveSlot with meta → loadSlot returns vars+pos+meta; saveQuick/loadQuick round-trip.
- [ ] **Step 2: 실패 확인** `node --test test/playback.test.js test/state.test.js`
- [ ] **Step 3: 구현** playback.js(순수); state.js meta+quick; stage.say 스킵/오토/히스토리/스냅샷; chat 히스토리+스킵. stage/chat는 `playback`을 opt로 받음(없으면 normal 동작 — 기존 테스트 불변).
- [ ] **Step 4: 통과** 전 스위트 green(기존 85 + 신규). node --check 수정 모듈.
- [ ] **Step 5: 커밋** `feat(engine): playback (skip/auto) + dialogue history + rollback snapshots + save meta`

---

## Task 2: 타이틀/메인메뉴 화면 + 타이틀-우선 부팅 + 메뉴로 돌아가기

**Files:** `web/src/ui/title.js`(신규), `web/src/ui/view_dom.js`(수정), `web/index.html`(수정), `web/style.css`(타이틀).

**Interfaces:**
- `makeTitle(root, { hasContinue, onNew, onContinue, onLoad, onSettings })` → `{ show(), hide() }`. 파스텔 타이틀 화면: 로고/제목(`타이틀로고_마실.svg` 또는 Jua 텍스트), 버튼 **새로하기 / 이어하기(autosave 있을 때만 활성) / 불러오기 / 설정**. 배경은 파스텔 그라데이션(+선택적 title bg 색).
- view_dom 부팅: 엔진을 즉시 start하지 않음. `state.loadPersistent()`; autosave 존재 여부 → `makeTitle(...).show()`. 새로하기→ fresh start(`engine.start('episode1_full')`, play_count++); 이어하기→ `engine.resume(state.loadAuto())`; 불러오기→ saveload(load 모드)에서 슬롯 선택 시 resume; 설정→ settings open.
- **메뉴로 돌아가기**: 게임 중 sysmenu(Task 4)에서 호출 → 확인 후 타이틀로(간단히 `location.reload()` 또는 엔진/뷰 리셋 후 title.show()). v1은 `location.reload()` 허용(가장 안전).

- [ ] **Step 1: 구현** title.js + boot 흐름 + index.html #title-layer + CSS. (렌더 아티팩트 — 단위테스트 없음.)
- [ ] **Step 2: 검증** node --check; 스위트 85 green(엔진 로직 불변); 부팅 시 타이틀이 뜨고(자동 시작 안 함) 새로하기로 프롤로그 진입하는 스크린샷(컨트롤러 관찰). 이어하기 버튼은 autosave 있을 때만 활성.
- [ ] **Step 3: 커밋** `feat(ui): title/main-menu screen + title-first boot + return-to-menu`

---

## Task 3: 세이브/불러오기 메뉴 + 퀵세이브/퀵로드 + 단축키

**Files:** `web/src/ui/saveload.js`(신규), `web/src/ui/view_dom.js`(배선), `web/style.css`.

**Interfaces:**
- `makeSaveLoad(root, { state, engine, playback })` → `{ open(mode) }` (mode `'save'|'load'`) → Promise(닫힘/완료). 슬롯 그리드(예: 6) + 퀵 슬롯 표시. 각 슬롯: meta 미리보기(챕터/화자/대사 일부/시간) 또는 "비어있음". save 모드 클릭→ `state.saveSlot(n, engine.position(), buildMeta())` 저장(덮어쓰기 확인). load 모드 클릭→ 채워진 슬롯이면 `engine.resume(state.loadSlot(n))`(현 진행 정리 후) → resolve.
- buildMeta(): 현재 label(챕터 라벨→사람이 읽는 이름 매핑은 간단 사전), 마지막 화자/대사(playback.history 마지막), mc_name, time(부팅 시 주입된 Date 또는 performance — Date.now 사용 가능, 브라우저). 
- **퀵세이브/퀵로드**: `state.saveQuick(pos,meta)`/`engine.resume(state.loadQuick())`. 키보드 단축키: F5=퀵세이브(토스트 "퀵세이브"), F9=퀵로드. sysmenu 버튼으로도.
- load로 인한 재개는 게임 화면(채팅/오버레이/타이틀) 정리 후 수행 — 가장 안전한 v1: 슬롯 로드시 vars/pos 적용 후 `location.reload()`는 부적절(메모리 상태). 대신 현재 진행 중인 `engine`이 await에 묶여 있으므로, **로드는 타이틀 경유**(타이틀에서 불러오기) 또는 게임 중 로드는 `location.reload()` 후 자동 resume 플래그… → v1 단순화: **불러오기는 타이틀 화면에서만**(게임 중 sysmenu의 "불러오기"는 타이틀로 보낸 뒤 로드). 저장은 게임 중 언제나 가능. (이 단순화는 엔진 재진입 복잡도를 피함 — 문서화.)

- [ ] **Step 1: 구현** saveload.js(파스텔 슬롯 그리드 + 미리보기 + 확인), state quick 연동, 단축키(F5/F9), 토스트.
- [ ] **Step 2: 검증** node --check; 스위트 green; 세이브 메뉴(슬롯+미리보기)·퀵세이브 토스트 스크린샷(컨트롤러). 저장→타이틀 "불러오기"→재개 흐름 확인(스크린샷/논리).
- [ ] **Step 3: 커밋** `feat(ui): save/load slot menu + quicksave/quickload + shortcuts`

---

## Task 4: 게임 중 시스템 메뉴(≡) + 스킵/오토 토글 + 백로그

**Files:** `web/src/ui/sysmenu.js`(신규), `web/src/ui/backlog.js`(신규), `web/src/ui/view_dom.js`(배선), `web/style.css`.

**Interfaces:**
- `makeSysMenu(root, { playback, onSave, onLoad, onBacklog, onTitle, onQuickSave, onQuickLoad })` → `{ mountBar() }`. 게임 중 작은 컨트롤바/버튼 묶음(우하단 또는 상단): **스킵(토글) · 오토(토글) · 백로그 · 저장 · 불러오기 · 메뉴(타이틀) · 퀵세이브/퀵로드**. 스킵/오토는 playback.setMode 토글 + 활성 표시. 비차단(엔진 await 불간섭). 파스텔.
- `makeBacklog(root, { playback })` → `{ open() }`. playback.history()를 스크롤 목록으로(화자 색 + 텍스트). 파스텔 카드. Escape/닫기, 누수 없는 리스너.
- 롤백(이전으로): sysmenu 또는 백로그에 "이전으로" — `if (playback.canRollback()) { const snap = playback.popSnapshot(); state.vars = snap.vars; engine.resume(snap.pos); }`. 채팅 열린 상태에선 제한(나레이션 위주) — 비활성 또는 경고. 구현은 view_dom에서 rollback 핸들러 제공.

- [ ] **Step 1: 구현** sysmenu(바+토글), backlog(히스토리 오버레이), 롤백 핸들러, view_dom 배선. 스킵/오토가 실제로 stage.say 진행에 반영되는지(Task 1 연동).
- [ ] **Step 2: 검증** node --check; 스위트 green; 시스템바 + 백로그(샘플 히스토리) 스크린샷(컨트롤러). 스킵/오토 토글 표시. 롤백은 나레이션에서 동작·채팅 제한 문서화.
- [ ] **Step 3: 커밋** `feat(ui): in-game system menu (skip/auto/backlog/save/load/title) + backlog + rollback`

---

## Task 5: 통합 그라운딩 + README

- [ ] **Step 1:** 전체 흐름 헤드리스 Chrome 스크린샷: 타이틀 → 새로하기 → 게임(시스템바) → 세이브 메뉴 → 백로그 → 설정. 컨트롤러 관찰·수정. 모바일 폭 1장.
- [ ] **Step 2:** `node --test test/*.test.js` 전부 green.
- [ ] **Step 3:** README "게임 기능"·로드맵에 타이틀·세이브/로드·퀵세이브·이어하기·스킵·오토·백로그·롤백·메뉴로 반영. 구조도에 신규 모듈.
- [ ] **Step 4: 커밋** `feat(web): VN systems grounding + README`

---

## Self-Review
- 커버리지: playback/히스토리/롤백/세이브meta(T1)·타이틀+부팅(T2)·세이브로드+퀵(T3)·시스템메뉴+백로그+롤백(T4)·그라운딩(T5). 풀세트 매핑.
- 리스크: (a) 롤백 채팅 시각 복원 제한 — 명시·나레이션 우선. (b) 게임 중 로드 재진입 복잡 → v1은 불러오기를 타이틀 경유로 단순화(엔진 재진입 회피). (c) 스킵/오토가 say await와 안전히 상호작용(클릭이 항상 우선·normal 복귀). 각 태스크 리뷰 게이트 + 스크린샷 그라운딩.
- 비차단 오버레이·Escape 누수 없음·escape·파스텔 토큰·게이지 비노출 전부 Global Constraints.
