# 웹 마일스톤 2 — Ep2~4 + 에필로그 + 7엔딩 통합 (구현 계획)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 프롤로그~Ep1만 되던 웹 VN을 **전체 스토리(프롤로그→Ep1→Ep2→Ep3→Ep4→에필로그→7엔딩)** 가 끝까지 플레이되도록 확장한다. 에피소드 간 점프·아이템·게이지가 이어지고, 엔딩 분기 + 최소 result_card(엔딩명+연애유형)까지 동작.

**Architecture:** 변환기를 멀티파일 입력으로 확장해 **하나의 통합 `web/data/story.json`** (모든 에피소드+에필로그, 단일 labels 맵)을 생성 → 에피소드 간 `jump`가 자연히 해소됨. 엔진/시스템에 소폭 추가(엔딩 기록·진단·recv 이름 보간·result_card). UI는 기존 그대로 + result_card 오버레이.

**Tech Stack:** 기존과 동일(바닐라 JS ES모듈/빌드없음, Python stdlib 변환기, `node --test test/*.test.js`, `cd tools && PYTHONUTF8=1 python3 -X utf8 -m unittest test_rpy2json`).

## Global Constraints
- 빌드 없음 / 외부 의존성 0 / localStorage 저장 / safe-play / innerHTML 이스케이프.
- **게이지 숫자 비노출** — ep2 `(도윤 우정 [doyun_bond])`, ep3 `[jiu_like]/[jiu_sinc]`, ep4 `(도윤 우정 [doyun_bond] / 최종 선택:[ep4_choice])` 전부 변환기에서 strip. (원본 .rpy 불변, 통합 데이터에서만 숨김.)
- **후반 반전 스포 금지** — 변환은 대사 원문 복사이므로 보존(민결 이름 노출 없음 확인됨).
- **도윤 말투 보존** — 원문 복사.
- 엔딩 7종 = `final_ending()`(systems_affection) + `decide_ending()` 기준; `ENDING_LIST`(systems_extra) 라벨 순서 유지.
- 테스트 러너: `node --test test/*.test.js` (디렉터리형 `test/` 금지).

## 파일 구조 (신규/수정)
```
tools/rpy2json.py        # 멀티파일 concat, python: 블록, 튜플언팩, gauge-strip 일반화, reply_prompt 인라인, call_screen
web/data/story.json      # 신규 통합 산출물 (ep1+ep2+ep3+ep4+epilogue)
web/src/systems.js       # record_ending, ENDING_LIST, relationship_type, bitter_candidate 추가
web/src/theme.js         # ENDING_LIST 상수
web/src/engine.js        # recv {name} 보간 추가
web/src/ui/overlay.js    # result_card 최소 구현 (callScreen name==='result_card')
web/src/ui/view_dom.js   # story.json 로드 + 전체 defaults
test/playthrough.test.js # story.json 기반 + 엔딩별 도달 테스트
tools/test_rpy2json.py   # 신규 변환 규칙 단위테스트
```

---

## Task 1: 변환기 — 멀티파일 통합 + recv 이름 보간 엔진 패치

**Files:** `tools/rpy2json.py` (main+convert), `web/src/engine.js`, tests.

**Interfaces:**
- `convert_files(paths, var_names, sys_names) -> {nodes, labels, review, defaults, backgrounds}`: 각 파일을 `convert`로 파싱 후 nodes를 순차 concat, labels는 합쳐진 flat 인덱스로 재계산, defaults/backgrounds union, review 합산.
- `main`: argv = 여러 src + `-o story.json`. 모든 src의 declarations로 var_names 보강.
- Engine: `recv` 노드의 `name`도 `this.interp()` 통과 (`[who_n]` 보간).

- [ ] **Step 1: 변환기 통합 테스트(실패)** — `tools/test_rpy2json.py`
```python
from rpy2json import convert_files
class TestMulti(unittest.TestCase):
    def test_concat_labels_offset(self):
        import tempfile, os, io
        a = 'label episode1_full:\n    "a"\n    jump episode2_full\n'
        b = 'label episode2_full:\n    "b"\n    return\n'
        # write temp files, call convert_files([pa,pb])
        # labels['episode2_full'] == flat index of that label node in combined nodes
        # nodes[labels['episode2_full']] == {'op':'label','name':'episode2_full'}
```
(임시파일 2개로 검증; jump 타깃이 합쳐진 맵에서 해소되는지.)

- [ ] **Step 2: 실패 확인** — `cd tools && PYTHONUTF8=1 python3 -X utf8 -m unittest test_rpy2json -v` → FAIL (convert_files 없음)

- [ ] **Step 3: 구현** — `convert_files`: 각 파일 `parse_lines`→`_consume` 루프로 nodes 누적(전부 한 리스트), 끝에 labels=enumerate, defaults/backgrounds union. main이 이를 호출. Engine recv: `name: this.interp(node.name)`.

- [ ] **Step 4: 통과** — 단위테스트 + 기존 전부 green; `node --test test/*.test.js` 영향 없음(엔진 recv 보간은 기존 테스트 불변, 신규 작은 테스트 추가 가능).

- [ ] **Step 5: 커밋** — `feat(converter): multi-file concat + interp recv name`

---

## Task 2: 변환기 — gauge-mirror strip 일반화 + 튜플 언팩 + renpy.call_screen

**Files:** `tools/rpy2json.py`, tests.

**Interfaces:**
- gauge strip: say 텍스트가 `[<name>_like]`/`[<name>_sinc]`/`[doyun_bond]` 를 포함하면 drop; `$ <x>_like = like[...]` / `$ <x>_sinc = sincere[...]` set도 drop. (ep1의 seoa 전용 규칙을 일반 패턴으로.)
- 튜플 언팩: `$ a, b = expr` → `{op:set, expr:"[V.a, V.b] = <scope_prefix(py_to_js(expr))>"}`.
- `renpy.call_screen("X")` (인자 1개, 결과 미사용 형태) → `{op:call_screen, name:"X"}` (현재 REVIEW로 가던 것).

- [ ] **Step 1: 실패 테스트**
```python
def test_gauge_strip_general(self):
    out = convert('label x:\n    $ jiu_like = like["jiu"]\n    n "(지우 — 호감 [jiu_like])"\n    "유지"\n')
    texts=[n.get('text') for n in out['nodes'] if n['op']=='say']
    self.assertNotIn('(지우 — 호감 [jiu_like])', texts); self.assertIn('유지', texts)
    self.assertFalse(any(n['op']=='set' and 'jiu_like' in n.get('expr','') for n in out['nodes']))
def test_tuple_unpack(self):
    out = convert('label x:\n    $ ekind, ewho = final_ending()\n')
    self.assertEqual(out['nodes'][1], {'op':'set','expr':'[V.ekind, V.ewho] = S.final_ending()'})
def test_doyun_bond_display_stripped(self):
    out = convert('label x:\n    n "(도윤 우정 [doyun_bond])"\n')
    self.assertEqual([n for n in out['nodes'] if n['op']=='say'], [])
def test_renpy_call_screen_resultcard(self):
    out = convert('label x:\n    $ renpy.call_screen("result_card")\n')
    self.assertEqual(out['nodes'][1], {'op':'call_screen','name':'result_card'})
```

- [ ] **Step 2: 실패 확인** (위 명령)

- [ ] **Step 3: 구현** — classify의 say 분기 앞에 gauge-mirror 텍스트 검사(정규식 `\[\w+_(?:like|sinc)\]|\[doyun_bond\]`)→None+주석; `_convert_dollar`에서 `<x>_like/_sinc = ` 대입 drop; 콤마 LHS 대입 감지→bracket; `renpy.call_screen("X")`→call_screen op.

- [ ] **Step 4: 통과** — 단위테스트 green.

- [ ] **Step 5: 커밋** — `feat(converter): generalized gauge strip + tuple-unpack + call_screen(result_card)`

---

## Task 3: 변환기 — `python:` 멀티라인 블록 + reply_prompt 인라인 확장

**Files:** `tools/rpy2json.py`, `web/src/systems.js` (bitter_candidate), tests.

**Interfaces:**
- `python:` 블록(라벨 내, `init` 아님): 들여쓰기 블록의 각 줄을 `_convert_dollar`로 변환해 set 노드 나열. 단 lambda/`max(...,key=...)` 같이 번역 불가한 줄은 **시스템 헬퍼로 대체**: 에필로그 `_cand = max(HEROINES, key=lambda k: like[k]+sincere[k]); who_n = hname(_cand)` → `{set: V.who_n = S.bitter_candidate()}` (헬퍼가 이름 문자열 반환). 그 외 패턴이 또 나오면 REVIEW.
- systems.js `bitter_candidate()`: `like[k]+sincere[k]` 최대 히로인의 `hname` 반환. SYS_NAMES에 추가.
- `call reply_prompt("X")` → **인라인 메뉴 노드**: prompt "답장, 어떻게 할까?", choices=[바로 답한다/조금 뜸 들였다 답한다/지금은 못 본 척한다], 각 body=`[{set: V._r = S.apply_timing("X","now"|"wait"|"ignore")},{say n "[_r]"}]`. (현재의 drop을 대체.)

- [ ] **Step 1: 실패 테스트**
```python
def test_reply_prompt_inline(self):
    out = convert('label x:\n    call reply_prompt("jiu")\n')
    m = out['nodes'][1]; self.assertEqual(m['op'],'menu'); self.assertEqual(len(m['choices']),3)
    self.assertIn('S.apply_timing("jiu", "now")', m['choices'][0]['body'][0]['expr'])
    self.assertEqual(m['choices'][0]['body'][1], {'op':'say','who':'n','text':'[_r]'})
def test_python_block_bitter(self):
    src='label epi_bitter:\n    python:\n        _cand = max(HEROINES, key=lambda k: like[k] + sincere[k])\n        who_n = hname(_cand)\n'
    out = convert(src)
    exprs=[n.get('expr') for n in out['nodes'] if n['op']=='set']
    self.assertIn('V.who_n = S.bitter_candidate()', exprs)
    self.assertEqual(out['review'], [])
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현** — `_line_to_node`에 `python:` 핸들러(블록 수집→줄별 변환; bitter 패턴 특수치환); `classify`의 `call reply_prompt(` 특수분기→인라인 메뉴 빌더; systems.js `bitter_candidate` + SYS_NAMES.

- [ ] **Step 4: 통과** — 단위 + (systems 변경 시) `node --test test/*.test.js` green.

- [ ] **Step 5: 커밋** — `feat(converter): python: block + reply_prompt inline + bitter_candidate`

---

## Task 4: 시스템 — record_ending + ENDING_LIST + 연애유형 진단

**Files:** `web/src/theme.js`, `web/src/systems.js`, `test/systems.test.js`.

**Interfaces:**
- theme.js `ENDING_LIST` = systems_extra.rpy 순서/문자열 verbatim: `[["reconcile","용서까지 데려다준 사람"],["doyun","그날 그 손을 끝까지"],["true","끝내 건넨 진심"],["good","서툰 진심"],["fishtank","모두의, 아무도 아닌"],["lonely","못다 준 사람"],["run","다시 혼자"]]`.
- systems.js: `record_ending(kind)` → `persistent.endings_seen` 배열에 중복없이 추가; `ending_title(kind)` → ENDING_LIST에서 제목; `relationship_type()` → systems_extra의 연애유형 진단 로직 포팅(진심파/어장러/도망러/의리파/슬로우버너 — systems_extra.rpy 참조해 verbatim); 모두 SYS_NAMES에 추가. (systems는 state.persistent 접근 필요 → makeSystems가 state.persistent 사용.)

- [ ] **Step 1: 실패 테스트** — record_ending 중복 방지, ending_title("doyun")=="그날 그 손을 끝까지", relationship_type 대표 케이스(진심 높음→진심파 등; systems_extra 실제 분기에 맞춤).
- [ ] **Step 2: 실패 확인** — `node --test test/systems.test.js`
- [ ] **Step 3: 구현** — systems_extra.rpy의 record_ending/진단 로직을 1:1 포팅; theme ENDING_LIST.
- [ ] **Step 4: 통과**
- [ ] **Step 5: 커밋** — `feat(engine): record_ending + ENDING_LIST + relationship_type`

---

## Task 5: result_card 최소 오버레이

**Files:** `web/src/ui/overlay.js`, `web/style.css`(append).

**Interfaces:** `callScreen({name})`에 `name==='result_card'` 분기 추가 → 모달: 큰 엔딩 제목(`S.ending_title(last)`) + 연애유형(`S.relationship_type()`) + 닫기. result_card는 state/systems 접근이 필요하므로 `makeOverlay(root, {sys})`로 sys 주입(또는 view_dom에서 데이터 계산해 `callScreen({name, title, type})`로 전달 — 후자가 더 단순; 채택). 즉 엔진의 call_screen op는 name만 주지만, view_dom의 callScreen 위임에서 result_card면 `sys.ending_title/relationship_type`로 채워 overlay에 전달.

- [ ] **Step 1: CSS append** — `.result-card`(중앙 큰 모달, 제목 28px, 유형 라벨).
- [ ] **Step 2: overlay.callScreen** — result_card 분기(title/type 표시 + 닫기 resolve). escape 적용.
- [ ] **Step 3: node --check overlay.js**; 기존 suite 22/22 영향 없음.
- [ ] **Step 4: 커밋** — `feat(ui): minimal result_card (ending title + relationship type)`

---

## Task 6: 통합 변환 실행 + view_dom 배선 + 엔딩 플레이스루

**Files:** `tools/rpy2json.py`(main 멀티 src), `web/data/story.json`(생성·커밋), `web/src/ui/view_dom.js`, `test/playthrough.test.js`.

- [ ] **Step 1: 통합 변환 실행**
```
cd tools && PYTHONUTF8=1 python3 -X utf8 rpy2json.py "../script_ep1.rpy" "../script_ep2.rpy" "../script_ep3.rpy" "../script_ep4.rpy" "../script_epilogue.rpy" -o "../web/data/story.json"
```
출력 `review: 0` 목표; 남으면 해당 규칙 보강 후 재실행. story.json에 모든 defaults union 포함 확인.

- [ ] **Step 2: view_dom** — `fetch('data/story.json')`로 교체; `state.defineDefaults(story.defaults)` + 보강 defaults(neue: doyun_secret_seen, meet_loc, date3_loc, mingyeol_truth_known, heard_side, seoa_result, ep4_choice, promise_spring 등 — story.defaults에 있으면 자동). `callScreen` result_card 데이터 주입. start('episode1_full') 유지.

- [ ] **Step 3: 엔딩 플레이스루 테스트** — `test/playthrough.test.js`에 story.json 로드로 전환 + 엔딩별 케이스:
  - 헬퍼: 주어진 (menu 선택 전략 + 초기 vars 강제)로 episode1_full→epilogue 끝까지, 크래시 없음 + record_ending 호출 확인.
  - 최소 3 엔딩 경로 직접 검증: (a) ep4_choice='run' 강제→run; (b) doyun_bond≥25 + friend 선택→doyun; (c) 자동판정 fishtank/true 중 하나. menu 인덱스는 생성 story.json을 보고 확정.
  - "전체를 양쪽 선택으로 끝까지(크래시·undefined 없음)" 1개.

- [ ] **Step 4: 통과** — `node --test test/*.test.js` 전부 green; review:0.

- [ ] **Step 5: 커밋** — `feat: convert full story (ep1-epilogue) + endings playthrough`

---

## Task 7: 브라우저 그라운딩 (전체 흐름)

**[render artifact]** 헤드리스 Chrome 스크린샷으로 컨트롤러가 관찰.

- [ ] **Step 1:** story.json으로 부팅 확인(서버 200, 첫 화면 정상).
- [ ] **Step 2:** 컨트롤러가 _grounding.html(필요시 ep2/엔딩 샘플 프레임 추가) + 실제 부팅 + result_card를 스크린샷→관찰→이슈 수정.
- [ ] **Step 3:** README "다음 마일스톤"에서 Ep2~4/엔딩/reply timing 제거(완료 반영), 남은 항목(친구목록/갤러리/추억함 대시보드, 에셋, 폰트는 별도 작업) 갱신.
- [ ] **Step 4:** 커밋 — `feat(web): full-story grounding + README update`

---

## Self-Review
- 스펙 커버리지: 멀티파일 통합(T1), gauge-strip 일반화/튜플/call_screen(T2), python:/reply_prompt(T3), 엔딩 시스템(T4), result_card(T5), 통합+엔딩 검증(T6), 그라운딩(T7). reply timing 복원·게이지 비노출·스포 보존 전부 매핑.
- 미해결/리스크: `python:` 블록의 bitter 패턴 외 미지의 lambda가 또 있으면 REVIEW로 노출됨(T6에서 0 확인); reply_prompt 인라인의 `_r` 임시변수는 default에 없어도 set이 생성하므로 무해; 엔딩 menu 인덱스는 생성 데이터 확인 후 확정.
- 폰트 내장은 별도 병행 작업(web-milestone2 동일 브랜치, 파일 비충돌).
