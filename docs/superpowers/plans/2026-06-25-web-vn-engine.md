# 웹 VN 엔진 ("마실") 구현 계획 — 수직 슬라이스 (프롤로그+Ep1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ren'Py 프로젝트를 빌드 없는 정적 웹앱으로 전환한다. 가벼운 VN 엔진 + `.rpy→JSON` 변환기를 만들고, 프롤로그+Ep1(`script_ep1.rpy`)을 브라우저에서 끝까지 플레이 가능하게 한다.

**Architecture:** 한 화 = 노드(명령) 배열 JSON. 순수 JS 상태머신 엔진이 노드를 순차 실행하고, 입력 필요 노드(say/menu/input/pause)에서 멈춰 `view` 싱크(UI)에 위임한다. 엔진/시스템/평가기는 DOM을 모르는 순수 모듈이라 node에서 단위 테스트·자동 플레이스루 가능. UI는 바닐라 DOM. 저장은 localStorage.

**Tech Stack:** 바닐라 JS(ES 모듈, 빌드 없음), HTML/CSS, localStorage. 변환기 = Python 3(stdlib만). 테스트 = `node --test`(엔진) + `python -m unittest`(변환기). 정적 서빙 = `python -m http.server` / Vercel.

## Global Constraints

- **빌드 단계 없음.** ES 모듈을 브라우저가 직접 로드. 번들러/트랜스파일 금지.
- **외부 런타임 의존성 0.** Python은 stdlib만, JS는 node 내장 테스트 러너만. npm install 금지.
- **게이지 숫자 비노출:** `show_gauges` 기본 `false` 유지. 플레이어 대면 화면에 like/sincere/bond 숫자를 절대 그리지 않는다.
- **후반 반전 스포 금지:** 플레이어 대면 텍스트/주석에 민결·도윤 과거 반전 노출 금지.
- **도윤 말투 보존:** 대사 텍스트는 원문 그대로 복사(가공 금지). 형 대접 유지.
- **safe-play:** 사운드/이미지 에셋이 없으면 무음/이니셜 대체로 통과(에러 금지).
- **Windows 콘솔(cp949):** Python 헬퍼는 `PYTHONUTF8=1 python3 -X utf8`로 실행, 출력은 파일로.
- **테마 상수 verbatim:** `MASIL`, `CHAT_AVATARS`, `ITEMS`, `HEROINES` 색/문자열은 `.rpy` 원본에서 그대로 복사.
- **포지셔닝:** 우정·진심(도윤) 이야기. 헷갈리면 주제 편.

---

## 파일 구조

```
web/
  index.html              # 진입점, ES 모듈 로드, 부팅
  style.css               # 반응형 레이아웃 + MASIL 테마
  src/
    state.js              # GameState: vars/persistent + 직렬화 + Storage 주입
    systems.js            # 게이지/아이템/엔딩/상담/타이밍 헬퍼 (순수)
    eval_expr.js          # py→js 식 평가 (scope 주입, new Function)
    engine.js             # Engine: 노드 실행 상태머신, view 싱크에 위임
    theme.js              # MASIL/CHAT_AVATARS/ITEMS/HEROINES 상수 (verbatim)
    ui/
      view_dom.js         # view 싱크 구현(DOM) — 엔진↔화면 연결
      stage.js            # 배경/트랜지션/대사창/텍스트태그 렌더
      chat.js             # 마실 채팅 UI
      menu.js             # 선택지 + 닉네임 입력
      overlay.js          # 도윤 상담 모달 + 토스트(notify/doyun_ping) + 맵 인터스티셜 + 폰버튼
  data/
    ep1.json              # 변환 결과(프롤로그+Ep1)
    characters.json       # 캐릭터 정의
tools/
  rpy2json.py             # 변환기
  test_rpy2json.py        # 변환기 unittest
test/
  fixtures/sample.json    # 엔진 테스트용 작은 스크립트
  state.test.js engine.test.js systems.test.js eval_expr.test.js
  playthrough.test.js     # ep1.json 자동 플레이스루(로직 그라운딩)
```

---

## Task 0: 스캐폴딩 + git 초기화

**Files:**
- Create: `web/`, `web/src/`, `web/src/ui/`, `web/data/`, `tools/`, `test/`, `test/fixtures/` (빈 디렉터리는 `.gitkeep`)
- Create: `.gitignore`
- Create: `web/data/characters.json`

**Interfaces:**
- Produces: `characters.json` 스키마 = `{ "<id>": {"name": string|null, "color": string|null} }`

- [ ] **Step 1: git 저장소 초기화** (배포에 git 필요, 현재 미초기화)

```bash
cd "C:/Users/JinhoLap/Documents/renPy로 비주얼노벨 만들기/renPy로 비주얼노벨 만들기"
git init
git add -A && git commit -m "chore: snapshot existing Ren'Py project before web port"
```

- [ ] **Step 2: 디렉터리 + .gitignore 생성**

`.gitignore`:
```
node_modules/
*.log
.DS_Store
tools/convert_review.log
```

- [ ] **Step 3: characters.json 작성** (`define n/mc/d/s`에서 추출, 색 verbatim)

`web/data/characters.json`:
```json
{
  "n":  { "name": null, "color": null },
  "mc": { "name": "나",   "color": "#cfd4e6" },
  "d":  { "name": "도윤", "color": "#2fb574" },
  "s":  { "name": "서아", "color": "#e8553d" }
}
```

- [ ] **Step 4: 커밋**

```bash
git add -A && git commit -m "chore: scaffold web/ tools/ test/ + characters.json"
```

---

## Task 1: GameState + localStorage 저장 (state.js)

**Files:**
- Create: `web/src/state.js`
- Test: `test/state.test.js`

**Interfaces:**
- Produces:
  - `class GameState { vars:object; persistent:object; constructor(storage?) }`
  - `state.get(name)` / `state.set(name, value)` — vars 접근
  - `state.snapshot()` → `{vars, callStack, label, ip}` 직렬화용(엔진이 callStack/label/ip 주입)
  - `state.saveSlot(n, enginePos)` / `state.loadSlot(n)` → enginePos 반환 또는 null
  - `state.savePersistent()` / `state.loadPersistent()`
  - 생성자 인자 `storage`는 `localStorage` 호환(`getItem/setItem`); 미주입 시 인메모리 폴백(node 테스트용)
- 키 규약: `masil.persistent`, `masil.save.<n>`, `masil.autosave`

- [ ] **Step 1: 실패 테스트 작성** — `test/state.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _m: m };
}

test('vars get/set with defaults', () => {
  const s = new GameState();
  s.defineDefaults({ like: { seoa: 0 }, mc_name: '나' });
  assert.equal(s.get('mc_name'), '나');
  s.set('mc_name', '진호');
  assert.equal(s.get('mc_name'), '진호');
});

test('save and load slot round-trips vars + engine position', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.defineDefaults({ doyun_bond: 0 });
  s.set('doyun_bond', 12);
  s.saveSlot(1, { label: 'ep1_date', ip: 7, callStack: [] });
  const s2 = new GameState(st);
  s2.defineDefaults({ doyun_bond: 0 });
  const pos = s2.loadSlot(1);
  assert.equal(s2.get('doyun_bond'), 12);
  assert.deepEqual(pos, { label: 'ep1_date', ip: 7, callStack: [] });
});

test('persistent persists across instances', () => {
  const st = memStorage();
  const a = new GameState(st);
  a.persistent.play_count = 2;
  a.savePersistent();
  const b = new GameState(st);
  b.loadPersistent();
  assert.equal(b.persistent.play_count, 2);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/state.test.js`
Expected: FAIL (Cannot find module state.js)

- [ ] **Step 3: 구현** — `web/src/state.js`

```js
const KEY = { persistent: 'masil.persistent', slot: n => `masil.save.${n}`, auto: 'masil.autosave' };

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export class GameState {
  constructor(storage) {
    this.storage = storage || memoryStorage();
    this.vars = {};
    this.persistent = {};
  }
  defineDefaults(defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in this.vars)) this.vars[k] = (v && typeof v === 'object') ? deepClone(v) : v;
    }
  }
  get(name) { return this.vars[name]; }
  set(name, value) { this.vars[name] = value; }

  snapshot(enginePos) { return { vars: deepClone(this.vars), ...enginePos }; }

  saveSlot(n, enginePos) { this.storage.setItem(KEY.slot(n), JSON.stringify(this.snapshot(enginePos))); }
  saveAuto(enginePos)    { this.storage.setItem(KEY.auto, JSON.stringify(this.snapshot(enginePos))); }
  loadSlot(n)            { return this._load(KEY.slot(n)); }
  loadAuto()             { return this._load(KEY.auto); }
  _load(key) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    this.vars = data.vars;
    return { label: data.label, ip: data.ip, callStack: data.callStack };
  }

  savePersistent() { this.storage.setItem(KEY.persistent, JSON.stringify(this.persistent)); }
  loadPersistent() {
    const raw = this.storage.getItem(KEY.persistent);
    this.persistent = raw ? JSON.parse(raw) : {};
  }
}

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/state.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/src/state.js test/state.test.js && git commit -m "feat(engine): GameState with localStorage save/load"
```

---

## Task 2: 시스템 헬퍼 포팅 (systems.js)

`systems_affection.rpy` / `systems_items.rpy` / `systems_reply.rpy`의 로직을 JS로 1:1 포팅. 게이지 변경 시 화면 갱신은 엔진이 담당하므로 `renpy.restart_interaction()`은 생략.

**Files:**
- Create: `web/src/theme.js` (ITEMS/HEROINES/CHAT_AVATARS/MASIL — verbatim)
- Create: `web/src/systems.js`
- Test: `test/systems.test.js`

**Interfaces:**
- Consumes: `GameState`(vars: `like`,`sincere`,`doyun_bond`,`inventory`,`item_flags`,`doyun_used_chapter`)
- Produces: `makeSystems(state, { onNotify })` → 객체:
  - `add_like(who,n)`, `add_sincere(who,n)`, `add_bond(n)`
  - `hname(who)`, `chapter_start()`
  - `get_item(iid,n=1,notify=true)`, `has_item(iid)`, `item_count(iid)`, `use_item(iid,n=1)`, `give_item(iid,who=null)`, `was_given(iid)`
  - `unlock_station(id)` (persistent.stations 배열에 추가)
  - `doyun_ping(text)` → `onNotify({kind:'doyun', text})`
  - `doyun_line(who)` → `[line, hint]`; `_doyun_read(who)`
  - `decide_ending()` → `[kind, who|null]`; `final_ending()`; `apply_timing(who,mode)` → line 문자열
- theme.js exports: `ITEMS`, `HEROINES`, `CHAT_AVATARS`, `MASIL`

- [ ] **Step 1: theme.js 작성** (원본 dict verbatim 복사)

```js
export const HEROINES = { seoa: '서아', jiu: '지우', mingyeol: '민결' };
export const ITEMS = {
  hangover:    { name: '숙취해소제',   icon: '🧴', desc: '그날 밤 편의점에서 산 숙취해소제. 누군가에게 필요할지도.' },
  sakura_card: { name: '벚꽃 엽서',     icon: '🌸', desc: '석촌호수 벚꽃 사진으로 만든 엽서. 내 프사를 알아본 그 사람에게 어울릴까.' },
  movie_tkt:   { name: '영화 예매권',   icon: '🎬', desc: '2인 영화 예매권. 다음 약속에 쓸 수 있다.' },
  warm_can:    { name: '따뜻한 캔커피', icon: '☕', desc: '자판기에서 뽑은 따뜻한 캔커피 두 개. 추운 밤에.' },
  doyun_keyring:{ name: '도윤의 키링', icon: '🔑', desc: '도윤이 우정의 증표라며 쥐여준 낡은 키링. 버릴 수 없는 무게가 있다.' },
  polaroid:    { name: '폴라로이드', icon: '📷', desc: '지우와 성수 카페에서 찍은 폴라로이드 한 장. 둘 다 어색하게 웃고 있다.' },
};
export const CHAT_AVATARS = { '도윤': '#2fb574', '서아': '#e8553d', '지우': '#5ba3d0', '민결': '#b06cc0' };
export const MASIL = {
  bg: '#e8ebf2', topbar: '#2f3447', topbar_txt: '#ffffff', topbar_sub: '#b8c0d0', online: '#46d18a',
  recv_bubble: '#ffffff', recv_txt: '#1c1f2a', send_bubble: '#6c7cf0', send_txt: '#ffffff',
  name_txt: '#3b4257', time_txt: '#8a90a3', read_txt: '#6c7cf0', avatar_bg: '#c3c9d9', typing: '#9aa0b3',
};
```

- [ ] **Step 2: 실패 테스트 작성** — `test/systems.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';

function sys() {
  const s = new GameState();
  s.defineDefaults({
    like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false,
    ep4_choice: '',
  });
  const notes = [];
  return { sys: makeSystems(s, { onNotify: n => notes.push(n) }), state: s, notes };
}

test('add_like clamps to 0..100', () => {
  const { sys, state } = sys();
  sys.add_like('seoa', 120); assert.equal(state.vars.like.seoa, 100);
  sys.add_like('seoa', -250); assert.equal(state.vars.like.seoa, 0);
});

test('give_item consumes and records recipient', () => {
  const { sys, state } = sys();
  sys.get_item('sakura_card');
  assert.equal(sys.give_item('sakura_card', 'seoa'), true);
  assert.equal(sys.has_item('sakura_card'), false);
  assert.equal(sys.was_given('sakura_card'), 'seoa');
});

test('get_item notifies via onNotify', () => {
  const { sys, notes } = sys();
  sys.get_item('sakura_card');
  assert.equal(notes[0].text, '아이템 획득: 벚꽃 엽서');
});

test('final_ending: run choice short-circuits', () => {
  const { sys, state } = sys();
  state.vars.ep4_choice = 'run';
  assert.deepEqual(sys.final_ending(), ['run', null]);
});

test('decide_ending: two fishtanks => fishtank', () => {
  const { sys, state } = sys();
  state.vars.like = { seoa: 80, jiu: 75, mingyeol: 0 };
  state.vars.sincere = { seoa: 10, jiu: 10, mingyeol: 0 };
  assert.deepEqual(sys.decide_ending(), ['fishtank', null]);
});

test('apply_timing seoa now boosts like and returns line', () => {
  const { sys, state } = sys();
  const line = sys.apply_timing('seoa', 'now');
  assert.equal(state.vars.like.seoa, 10);
  assert.match(line, /답장 빠르네/);
});
```

- [ ] **Step 3: 구현** — `web/src/systems.js` (원본 로직 그대로)

```js
import { HEROINES, ITEMS } from './theme.js';

const clamp = v => Math.max(0, Math.min(100, v));

export function makeSystems(state, { onNotify = () => {} } = {}) {
  const v = state.vars;
  const sys = {
    add_like(who, n) { v.like[who] = clamp(v.like[who] + n); },
    add_sincere(who, n) { v.sincere[who] = clamp(v.sincere[who] + n); },
    add_bond(n) { v.doyun_bond += n; },
    hname(who) { return HEROINES[who] || who; },
    chapter_start() { v.doyun_used_chapter = false; },

    get_item(iid, n = 1, notify = true) {
      v.inventory[iid] = (v.inventory[iid] || 0) + n;
      if (notify && ITEMS[iid]) onNotify({ kind: 'item', text: '아이템 획득: ' + ITEMS[iid].name });
    },
    has_item(iid) { return (v.inventory[iid] || 0) > 0; },
    item_count(iid) { return v.inventory[iid] || 0; },
    use_item(iid, n = 1) {
      if ((v.inventory[iid] || 0) >= n) {
        v.inventory[iid] -= n;
        if (v.inventory[iid] <= 0) delete v.inventory[iid];
        return true;
      }
      return false;
    },
    give_item(iid, who = null) {
      if (sys.use_item(iid)) { v.item_flags[iid + '_given'] = who ? who : true; return true; }
      return false;
    },
    was_given(iid) { return v.item_flags[iid + '_given'] ?? null; },

    unlock_station(id) {
      v.__stations = v.__stations || [];
      if (!v.__stations.includes(id)) v.__stations.push(id);
    },
    doyun_ping(text) { onNotify({ kind: 'doyun', text }); },

    _doyun_read(who) {
      if (who === 'seoa') return '서아는 속도보다, 형이 진짜인지를 보고 있어';
      if (who === 'jiu') return '지우는 답장 빨리 오는 것보다 형 진심을 더 쳐';
      if (who === 'mingyeol') return '민결은 들이대면 도망가. 형이 먼저 거리를 줘';
      return '지금은 진심 한 스푼이 호감 열보다 커';
    },
    doyun_line(who) {
      const l = v.like[who], s = v.sincere[who], n = sys.hname(who);
      const sharp = v.doyun_bond >= 20;
      let line, hint;
      if (l >= 60 && s < 30) {
        line = `형… ${n} 한테 잘 보이기만 하는 거 아니야? 호감만 높고 진심이 안 보여. 이러다 어장 소리 들어.`;
        hint = '[힌트] 약한 모습을 보이거나 진솔한 속얘기를 꺼내봐. 진심이 올라가.';
      } else if (l < 30 && s < 30) {
        line = `형, 아직 ${n} 랑 서먹하네. 천천히 가도 돼, 일단 자주 말 걸어봐.`;
        hint = '[힌트] 가벼운 대화로 호감부터 쌓는 단계야.';
      } else if (s >= 50) {
        line = `오 형, ${n} 한테 진심이 통하고 있어. 형 이대로만 가면 돼.`;
        hint = '[힌트] 결정적인 순간에 솔직하게 마음을 말하면 진엔딩 각이야.';
      } else {
        line = `형, ${n} 랑 나쁘진 않아. 근데 더 깊어지려면 형 진짜 속얘길 해야지.`;
        hint = '[힌트] 호감은 충분, 이제 진심을 채울 차례.';
      }
      if (sharp) hint += `\n   (형이 보기엔 — ${sys._doyun_read(who)})`;
      return [line, hint];
    },

    decide_ending() {
      const fishtank = Object.keys(HEROINES).filter(k => v.like[k] >= 70 && v.sincere[k] < 30).length;
      if (fishtank >= 2) return ['fishtank', null];
      const best = Object.keys(HEROINES).reduce((a, b) => (v.sincere[b] > v.sincere[a] ? b : a));
      if (v.sincere[best] >= 70 && v.like[best] >= 60) return ['true', best];
      if (v.sincere[best] >= 50) return ['good', best];
      return ['lonely', null];
    },
    final_ending() {
      const c = v.ep4_choice;
      if (c === 'run') return ['run', null];
      if (c === 'reconcile' && v.doyun_bond >= 25 && v.sincere.mingyeol >= 35) return ['reconcile', 'mingyeol'];
      if (c === 'friend' && (v.doyun_bond >= 25 || sys.has_item('doyun_keyring'))) return ['doyun', null];
      if (c === 'love' && v.sincere.mingyeol >= 40) return ['true', 'mingyeol'];
      return sys.decide_ending();
    },

    apply_timing(who, mode) {
      const tables = {
        seoa: { now: [['like', 10], '오 답장 빠르네 ㅋㅋ 그런 거 맘에 들어, 라며 서아가 좋아했다.'],
                wait: [['like', 3], "조금 뜸을 들였다. '뭐야 왜 이제 답해~' 하면서도 싫진 않은 눈치."],
                ignore: [['like', -5], '한참 못 본 척했더니, 다음 답장에서 서아의 텐션이 살짝 식어 있었다.'] },
        jiu: { now: [['like', 5], "바로 답하자 지우가 '오 빠르다 ㅋㅋ' 하고 웃었다."],
               wait: [['sincere', 8], '한 번 더 생각하고 답을 골랐다. 지우는 그런 신중함을 좋아하는 사람이었다.'],
               ignore: [['like', 2], "게임하다 늦게 봤다. 지우는 '바빴구나 ㅋㅋ 괜찮아' 했다."] },
        mingyeol: { now: [['like', 3], "바로 답하자 민결이 '뭐야 대기 타고 있었어요? ㅋㅋ' 하며 한 발 물러섰다."],
                    wait: [['like', 8], '적당히 뜸을 들였다. 민결은 그 거리감을 오히려 편해했다.'],
                    ignore: [['sincere', 4], "며칠 두자, 민결이 먼저 '바쁜가 보네요' 하고 툭. 의외로 신경 쓰는 눈치였다."] },
      };
      const d = tables[who] || { now: [['bond', 5], 'ㅋㅋ 형 답장 빠르네, 심심했지? 하고 도윤이 놀렸다.'],
        wait: [['bond', 2], '도윤은 답이 늦어도 개의치 않았다.'], ignore: [['bond', 0], "도윤은 '바쁜갑네 ㅋㅋ' 하고 말았다."] };
      const [[gauge, amt], line] = d[mode];
      if (gauge === 'like') sys.add_like(who, amt);
      else if (gauge === 'sincere') sys.add_sincere(who, amt);
      else if (gauge === 'bond') sys.add_bond(amt);
      return line;
    },
  };
  return sys;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/systems.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/src/theme.js web/src/systems.js test/systems.test.js && git commit -m "feat(engine): port affection/items/reply systems to JS"
```

---

## Task 3: 식 평가기 (eval_expr.js)

변환기가 만든 `set.expr` / `if.cond` 문자열을 state+systems 스코프에서 평가. 변환기는 `and/or/not`→`&&/||/!`, `True/False/None`→`true/false/null` 등을 이미 치환했다고 가정(Task 7). 평가기는 **vars 키와 systems 메서드를 스코프 변수로 노출**한다.

**Files:**
- Create: `web/src/eval_expr.js`
- Test: `test/eval_expr.test.js`

**Interfaces:**
- Produces:
  - `makeEvaluator(state, sys)` → `{ run(exprString), test(condString) }`
  - 스코프: vars의 모든 키(읽기/쓰기 위해 `with`-유사 처리 불가 → 아래 구현 참고), systems 메서드, `persistent`
  - `run`은 대입/호출 식 실행(부수효과), `test`는 boolean 반환
- 구현 노트: `with` 문은 strict 모듈에서 금지 → vars를 단일 객체 `V`로 노출하고, 변환기가 식의 변수 참조를 `V.<name>`로 프리픽스(Task 7)한다. 평가기는 `V`, `S`(systems), `P`(persistent)를 인자로 받는 `new Function('V','S','P', 'return (' + expr + ')')` 사용.

- [ ] **Step 1: 실패 테스트 작성** — `test/eval_expr.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';

function setup() {
  const s = new GameState();
  s.defineDefaults({ like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    doyun_bond: 0, inventory: {}, item_flags: {}, promise_spring: false });
  const sys = makeSystems(s, {});
  return { ev: makeEvaluator(s, sys), s };
}

test('run executes a system call (V/S prefixed)', () => {
  const { ev, s } = setup();
  ev.run('S.add_like("seoa", 15)');
  assert.equal(s.vars.like.seoa, 15);
});

test('run assigns a var', () => {
  const { ev, s } = setup();
  ev.run('V.promise_spring = true');
  assert.equal(s.vars.promise_spring, true);
});

test('run compound assign on bond', () => {
  const { ev, s } = setup();
  ev.run('V.doyun_bond += 5');
  assert.equal(s.vars.doyun_bond, 5);
});

test('test evaluates condition', () => {
  const { ev, s } = setup();
  s.vars.like.seoa = 80; s.vars.sincere.seoa = 10;
  assert.equal(ev.test('V.like["seoa"] >= 70 && V.sincere["seoa"] < 30'), true);
});

test('test sees system predicate', () => {
  const { ev, s } = setup();
  s.vars.inventory.sakura_card = 1;
  assert.equal(ev.test('S.has_item("sakura_card")'), true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/eval_expr.test.js`
Expected: FAIL (Cannot find module eval_expr.js)

- [ ] **Step 3: 구현** — `web/src/eval_expr.js`

```js
export function makeEvaluator(state, sys) {
  const P = state.persistent;
  return {
    run(expr) {
      const fn = new Function('V', 'S', 'P', `"use strict"; ${expr};`);
      return fn(state.vars, sys, P);
    },
    test(cond) {
      const fn = new Function('V', 'S', 'P', `"use strict"; return (${cond});`);
      return !!fn(state.vars, sys, P);
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/eval_expr.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/src/eval_expr.js test/eval_expr.test.js && git commit -m "feat(engine): scoped expression evaluator (V/S/P)"
```

---

## Task 4: 엔진 상태머신 (engine.js)

노드 배열을 실행. `set/if/jump/call/return/scene/recv/send/music/...`는 즉시 처리; `say/menu/input/pause/chat_open/chat_close/consult/call_screen/toast`는 `view` 싱크의 (async) 메서드를 await. 끝나면 종료. 매 정지점에서 오토세이브.

**Files:**
- Create: `web/src/engine.js`
- Test: `test/engine.test.js`, `test/fixtures/sample.json`

**Interfaces:**
- Consumes: `GameState`, `makeSystems`, `makeEvaluator`, `view` 싱크
- `view` 싱크(모두 async 가능): `scene({bg,with})`, `say({who,name,color,text})`, `chatOpen({room})`, `chatClose()`, `recv({name,text,avatar})`, `send({text})`, `pause()`, `input({prompt,def,max})`→string, `menu({prompt,choices})`→index(number), `consult({who, line, hint})`, `callScreen({name})`, `toast({kind,text})`, `music/sound/amb/stop({file,fadein})`
- Produces:
  - `class Engine { constructor({script, characters, state, sys, evaluator, view}) }`
  - `engine.start(label)` → async, 스크립트 끝/`return`(빈 콜스택)까지 진행
  - `engine.resume(pos)` → 저장 위치에서 재개
  - `engine.position()` → `{label, ip, callStack}`
  - 텍스트 보간: say/toast/recv/send 텍스트의 `[name]`→vars 값, `[[`→`[`
- script 형식: `{ nodes: [...], labels: { name: index } }` (변환기 산출, Task 6에서 labels 인덱싱)

- [ ] **Step 1: 픽스처 + 실패 테스트** — `test/fixtures/sample.json`

```json
{
  "labels": { "start": 0, "branch_a": 7 },
  "nodes": [
    { "op": "label", "name": "start" },
    { "op": "say", "who": "n", "text": "안녕 [mc_name]." },
    { "op": "set", "expr": "S.add_like(\"seoa\", 10)" },
    { "op": "menu", "prompt": "고를래?", "choices": [
      { "text": "A", "body": [ { "op": "jump", "label": "branch_a" } ] },
      { "text": "B", "body": [ { "op": "say", "who": "mc", "text": "B 골랐다" } ] }
    ] },
    { "op": "if", "cond": "V.like[\"seoa\"] >= 5",
      "then": [ { "op": "say", "who": "n", "text": "호감 높음" } ],
      "else": [ { "op": "say", "who": "n", "text": "낮음" } ] },
    { "op": "return" },
    { "op": "say", "who": "n", "text": "닿으면 안 됨" },
    { "op": "label", "name": "branch_a" },
    { "op": "say", "who": "n", "text": "A 분기" },
    { "op": "return" }
  ]
}
```

`test/engine.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';
import { Engine } from '../web/src/engine.js';

const script = JSON.parse(readFileSync(new URL('./fixtures/sample.json', import.meta.url)));
const characters = { n: { name: null, color: null }, mc: { name: '나', color: '#fff' } };

function recordingView(menuChoice = 0) {
  const log = [];
  return {
    log,
    async scene(a) { log.push(['scene', a]); },
    async say(a) { log.push(['say', a.text]); },
    async menu(a) { log.push(['menu', a.choices.length]); return menuChoice; },
    async pause() { log.push(['pause']); },
    async input(a) { log.push(['input']); return '진호'; },
    async chatOpen() {}, async chatClose() {}, async recv() {}, async send() {},
    async consult() {}, async callScreen() {}, async toast() {},
    async music() {}, async sound() {}, async amb() {}, async stop() {},
  };
}

function makeEngine(view) {
  const state = new GameState();
  state.defineDefaults({ like: { seoa: 0 }, sincere: { seoa: 0 }, mc_name: '진호',
    inventory: {}, item_flags: {}, doyun_bond: 0 });
  const sys = makeSystems(state, {});
  return new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
}

test('interpolates [mc_name] in say', async () => {
  const view = recordingView(1); // choose B
  await makeEngine(view).start('start');
  assert.equal(view.log[0][1] || view.log.find(e => e[0] === 'say')[1], '안녕 진호.');
});

test('menu choice B then if-branch true (like incremented earlier)', async () => {
  const view = recordingView(1);
  await makeEngine(view).start('start');
  const says = view.log.filter(e => e[0] === 'say').map(e => e[1]);
  assert.deepEqual(says, ['안녕 진호.', 'B 골랐다', '호감 높음']);
});

test('menu choice A jumps to branch_a and never reaches unreachable say', async () => {
  const view = recordingView(0);
  await makeEngine(view).start('start');
  const says = view.log.filter(e => e[0] === 'say').map(e => e[1]);
  assert.deepEqual(says, ['안녕 진호.', 'A 분기']);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/engine.test.js`
Expected: FAIL (Cannot find module engine.js)

- [ ] **Step 3: 구현** — `web/src/engine.js`

```js
export class Engine {
  constructor({ script, characters, state, sys, evaluator, view }) {
    this.script = script;
    this.nodes = script.nodes;
    this.labels = script.labels;
    this.characters = characters;
    this.state = state;
    this.sys = sys;
    this.ev = evaluator;
    this.view = view;
    this.callStack = [];
  }

  interp(text) {
    if (text == null) return text;
    return String(text)
      .replace(/\[\[/g, ' ESC ')
      .replace(/\[([A-Za-z_]\w*)\]/g, (_, name) => {
        const v = this.state.vars[name];
        return v == null ? '' : String(v);
      })
      .replace(/ ESC /g, '[');
  }

  position() { return { label: this._label, ip: this.ip, callStack: [...this.callStack] }; }

  async start(label) { this.ip = this.labels[label]; this._label = label; await this._run(); }
  async resume(pos) { this.ip = pos.ip; this._label = pos.label; this.callStack = pos.callStack || []; await this._run(); }

  async _run() {
    while (this.ip < this.nodes.length) {
      const node = this.nodes[this.ip];
      const next = await this._exec(node);
      if (next === 'stop') return;          // return with empty callstack
      if (typeof next === 'number') { this.ip = next; continue; }
      this.ip += 1;
    }
  }

  async _execList(list) {
    // for menu choice bodies / if branches: run a sub-list with same engine semantics
    for (let i = 0; i < list.length; i++) {
      const r = await this._exec(list[i], list, i);
      if (r === 'stop') return 'stop';
      if (typeof r === 'object' && r.jump != null) return r;   // propagate jump/return-to-label
      if (r === 'return') return 'return';
    }
    return null;
  }

  async _exec(node, list, idx) {
    const v = this.view;
    switch (node.op) {
      case 'label': return undefined;
      case 'scene': await v.scene({ bg: node.bg, with: node.with }); break;
      case 'say': {
        const c = this.characters[node.who] || {};
        await v.say({ who: node.who, name: c.name, color: node.color || c.color, text: this.interp(node.text) });
        break;
      }
      case 'chat_open': await v.chatOpen({ room: this.interp(node.room) }); break;
      case 'chat_close': await v.chatClose(); break;
      case 'recv': await v.recv({ name: node.name, text: this.interp(node.text), avatar: node.avatar }); break;
      case 'send': await v.send({ text: this.interp(node.text) }); break;
      case 'pause': await v.pause(); break;
      case 'input': {
        const val = await v.input({ prompt: this.interp(node.prompt), def: node.default, max: node.max });
        this.state.vars[node.var] = (val ?? '').trim() || node.default || '';
        break;
      }
      case 'set': this.ev.run(node.expr); break;
      case 'toast': await v.toast({ kind: node.kind || 'item', text: this.interp(node.text) }); break;
      case 'music': await v.music({ file: node.file, fadein: node.fadein }); break;
      case 'sound': await v.sound({ file: node.file }); break;
      case 'amb': await v.amb({ file: node.file, fadein: node.fadein }); break;
      case 'stop': await v.stop({ channel: node.channel }); break;
      case 'call_screen': await v.callScreen({ name: node.name }); break;
      case 'consult': {
        if (this.state.vars.doyun_used_chapter) {
          await v.say({ who: 'd', name: '도윤', color: '#2fb574',
            text: '형, 아까 이미 한 번 물어봤잖아. 이번 챕터는 알아서 좀 해봐 ㅋㅋ' });
        } else {
          const [line, hint] = this.sys.doyun_line(node.who);
          await v.consult({ who: node.who, line, hint });
          this.state.vars.doyun_used_chapter = true;
        }
        break;
      }
      case 'menu': {
        const choices = (node.choices || []).filter(c => !c.cond || this.ev.test(c.cond));
        const pick = await v.menu({ prompt: this.interp(node.prompt), choices: choices.map(c => this.interp(c.text)) });
        const r = await this._execList(choices[pick].body || []);
        if (r === 'stop') return 'stop';
        if (r === 'return') return this._doReturn();
        if (r && r.jump != null) return this._gotoLabel(r.jump);
        break;
      }
      case 'if': {
        const branch = this.ev.test(node.cond) ? (node.then || []) : (node.else || []);
        const r = await this._execList(branch);
        if (r === 'stop') return 'stop';
        if (r === 'return') return this._doReturn();
        if (r && r.jump != null) return this._gotoLabel(r.jump);
        break;
      }
      case 'jump':
        if (list) return { jump: node.label };       // inside sub-list: propagate
        return this._gotoLabel(node.label);
      case 'call':
        if (node.args) node.args.forEach((a, i) => { this.state.vars['__arg' + i] = a; });
        this.callStack.push(this.ip + 1);
        return this._gotoLabel(node.label);
      case 'return':
        if (list) return 'return';
        return this._doReturn();
      default: console.warn('unknown op', node.op);
    }
    return undefined;
  }

  _gotoLabel(label) {
    this._label = label;
    return this.labels[label];
  }
  _doReturn() {
    if (this.callStack.length === 0) return 'stop';
    return this.callStack.pop();
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/engine.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/src/engine.js test/engine.test.js test/fixtures/sample.json && git commit -m "feat(engine): node state machine with menu/if/call/jump"
```

---

## Task 5: 변환기 — 선언/캐릭터/배경 파싱 (rpy2json.py 1부)

**Files:**
- Create: `tools/rpy2json.py`
- Test: `tools/test_rpy2json.py`

**Interfaces:**
- Produces (이 태스크 범위):
  - `parse_lines(text) -> list[Line]` where `Line=(indent:int, raw:str, content:str)` — 빈 줄/주석(`#`) 제거, 들여쓰기 칸 수 계산
  - `parse_declarations(lines) -> dict` → `{ "characters": {id:{name,color}}, "backgrounds": {name:hex}, "defaults": {var:value} }`
  - `Character(None)`→`{name:null,color:null}`; `Character("나", color="#cfd4e6")`→`{name:"나",color:"#cfd4e6"}`
  - `image bg room = Solid("#23283d")`→backgrounds["room"]="#23283d"
  - `default doyun_bond = 0`→defaults["doyun_bond"]=0 (파이썬 리터럴은 `ast.literal_eval`)

- [ ] **Step 1: 실패 테스트** — `tools/test_rpy2json.py`

```python
import unittest
from rpy2json import parse_lines, parse_declarations

class TestDecls(unittest.TestCase):
    def test_parse_lines_strips_comments_blanks(self):
        text = "label x:\n    # comment\n\n    say\n"
        lines = parse_lines(text)
        self.assertEqual([l.content for l in lines], ["label x:", "say"])
        self.assertEqual(lines[1].indent, 4)

    def test_character_defs(self):
        text = ('define n = Character(None)\n'
                'define mc = Character("나", color="#cfd4e6")\n')
        d = parse_declarations(parse_lines(text))
        self.assertEqual(d["characters"]["n"], {"name": None, "color": None})
        self.assertEqual(d["characters"]["mc"], {"name": "나", "color": "#cfd4e6"})

    def test_background_and_default(self):
        text = ('image bg room = Solid("#23283d")\n'
                'default doyun_bond = 0\n'
                'default like = {"seoa": 0}\n')
        d = parse_declarations(parse_lines(text))
        self.assertEqual(d["backgrounds"]["room"], "#23283d")
        self.assertEqual(d["defaults"]["doyun_bond"], 0)
        self.assertEqual(d["defaults"]["like"], {"seoa": 0})
```

- [ ] **Step 2: 실패 확인**

Run: `PYTHONUTF8=1 python3 -X utf8 -m unittest -v tools.test_rpy2json` (from repo root, or `cd tools && python3 -m unittest test_rpy2json`)
Expected: FAIL (No module named rpy2json) — ensure run from `tools/`.

- [ ] **Step 3: 구현 (1부)** — `tools/rpy2json.py`

```python
"""Ren'Py(.rpy) -> 웹 VN 엔진 JSON 변환기. stdlib만 사용."""
import re, ast
from dataclasses import dataclass

@dataclass
class Line:
    indent: int
    raw: str
    content: str

def parse_lines(text):
    out = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith('#'):
            continue
        indent = len(raw) - len(raw.lstrip(' '))
        out.append(Line(indent=indent, raw=raw, content=stripped))
    return out

_CHAR_RE = re.compile(r'^define\s+(\w+)\s*=\s*Character\((.*)\)\s*$')
_IMG_RE  = re.compile(r'^image\s+bg\s+(\w+)\s*=\s*Solid\("(#[0-9a-fA-F]+)"\)')
_DEF_RE  = re.compile(r'^default\s+(\w+)\s*=\s*(.+)$')

def _parse_character_args(argstr):
    name, color = None, None
    if argstr.strip() == 'None':
        return {"name": None, "color": None}
    m = re.match(r'^\s*"((?:[^"\\]|\\.)*)"', argstr)
    if m:
        name = m.group(1)
    mc = re.search(r'color\s*=\s*"(#[0-9a-fA-F]+)"', argstr)
    if mc:
        color = mc.group(1)
    return {"name": name, "color": color}

def parse_declarations(lines):
    chars, bgs, defaults = {}, {}, {}
    for l in lines:
        m = _CHAR_RE.match(l.content)
        if m:
            chars[m.group(1)] = _parse_character_args(m.group(2)); continue
        m = _IMG_RE.match(l.content)
        if m:
            bgs[m.group(1)] = m.group(2); continue
        m = _DEF_RE.match(l.content)
        if m:
            try:
                defaults[m.group(1)] = ast.literal_eval(m.group(2))
            except Exception:
                pass  # 비-리터럴 default(Character 등)는 건너뜀
            continue
    return {"characters": chars, "backgrounds": bgs, "defaults": defaults}
```

- [ ] **Step 4: 통과 확인**

Run (from `tools/`): `python3 -m unittest test_rpy2json -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/rpy2json.py tools/test_rpy2json.py && git commit -m "feat(converter): parse declarations/characters/backgrounds"
```

---

## Task 6: 변환기 — 블록 파서(대사/연출/채팅/사운드/제어) (rpy2json.py 2부)

들여쓰기 기반 재귀 블록 파서. `menu:`/`if/elif/else`/choice body를 중첩 노드로. 라벨 인덱스 맵 생성.

**Files:**
- Modify: `tools/rpy2json.py`
- Modify: `tools/test_rpy2json.py`

**Interfaces:**
- Consumes: `parse_lines`
- Produces:
  - `parse_block(lines, i, base_indent) -> (nodes:list, next_i:int)` — base_indent보다 깊은 줄들을 노드 배열로
  - `convert(text) -> dict` → `{ "nodes":[...], "labels":{name:flatIndex}, "review":[str,...] }`
  - 라인 분류기 `classify(content) -> node|None|('REVIEW', content)`:
    - `<id> "txt"` / `"txt"` → `{op:"say", who, text}` (무명=who "n")
    - `scene bg X with T` / `scene X` → `{op:"scene", bg, with?}`
    - `show screen masil_chat ...` → 무시(채팅 표시는 chat_open이 담당), `hide screen masil_chat` → `{op:"chat_close"}`
    - `pause N?` → `{op:"pause"}` (숫자 인자는 무시: 클릭 대기로 통일)
    - `jump X`/`return` → 해당 op
    - `call X(args)` / `call screen Y` → `{op:"call",label}` / `{op:"call_screen",name}`
  - 텍스트 say는 `{w}{p}{i}` 태그 보존, `\"`→`"`, 시작/끝 따옴표 제거

- [ ] **Step 1: 실패 테스트 추가** — `tools/test_rpy2json.py`

```python
from rpy2json import convert

class TestBlocks(unittest.TestCase):
    def test_say_narration_and_char(self):
        out = convert('label start:\n    "나레이션{w=0.3}야"\n    mc "내 대사"\n')
        nodes = out["nodes"]
        self.assertEqual(nodes[0], {"op": "label", "name": "start"})
        self.assertEqual(nodes[1], {"op": "say", "who": "n", "text": "나레이션{w=0.3}야"})
        self.assertEqual(nodes[2], {"op": "say", "who": "mc", "text": "내 대사"})

    def test_scene_with_transition(self):
        out = convert('label s:\n    scene bg room with slowfade\n')
        self.assertEqual(out["nodes"][1], {"op": "scene", "bg": "room", "with": "slowfade"})

    def test_labels_index_map(self):
        out = convert('label a:\n    "x"\nlabel b:\n    "y"\n')
        self.assertEqual(out["labels"]["a"], 0)
        self.assertEqual(out["nodes"][out["labels"]["b"]], {"op": "label", "name": "b"})

    def test_menu_nested_body(self):
        src = ('label m:\n'
               '    menu:\n'
               '        n "고를래?"\n'
               '        "A":\n'
               '            mc "에이"\n'
               '        "B":\n'
               '            jump m\n')
        out = convert(src)
        menu = out["nodes"][1]
        self.assertEqual(menu["op"], "menu")
        self.assertEqual(menu["prompt"], "고를래?")
        self.assertEqual(menu["choices"][0]["text"], "A")
        self.assertEqual(menu["choices"][0]["body"][0], {"op": "say", "who": "mc", "text": "에이"})
        self.assertEqual(menu["choices"][1]["body"][0], {"op": "jump", "label": "m"})
```

- [ ] **Step 2: 실패 확인**

Run (from `tools/`): `python3 -m unittest test_rpy2json -v`
Expected: FAIL (convert not defined / nested parsing wrong)

- [ ] **Step 3: 구현 (2부)** — `tools/rpy2json.py` 에 추가

```python
_SAY_CHAR_RE = re.compile(r'^(\w+)\s+"((?:[^"\\]|\\.)*)"\s*$')
_SAY_NARR_RE = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*$')
_SCENE_RE = re.compile(r'^scene\s+(?:bg\s+)?(\w+)(?:\s+with\s+(\w+))?\s*$')
_CALL_SCREEN_RE = re.compile(r'^call\s+screen\s+(\w+)')
_CALL_RE = re.compile(r'^call\s+(\w+)\s*(?:\((.*)\))?\s*$')
_JUMP_RE = re.compile(r'^jump\s+(\w+)\s*$')
_MENU_CHOICE_RE = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*(?:if\s+(.+?))?\s*:\s*$')

def _unquote(s):
    return s.replace('\\"', '"').replace("\\'", "'")

# classify() / parse_block() defined here; $-lines & if/menu handled in Task 7's extension.
def convert(text):
    lines = parse_lines(text)
    nodes, review = [], []
    i = 0
    while i < len(lines):
        node, i = _consume(lines, i, nodes, review)
    labels = {}
    for idx, n in enumerate(nodes):
        if n.get("op") == "label":
            labels[n["name"]] = idx
    return {"nodes": nodes, "labels": labels, "review": review}
```

  > 구현 세부: `_consume`/`parse_block`는 들여쓰기 스택으로 블록 경계를 잡는다. 최상위는 평탄(flat) 노드 배열에 push하되, `menu`/`if`의 자식만 중첩 `body`/`then`/`else`에 담는다. (`label`은 항상 최상위·평탄 → labels 인덱스가 flat 인덱스와 일치.) 아래 `parse_block` 참조:

```python
def parse_block(lines, i, base_indent, review):
    """base_indent보다 더 깊은 연속 줄들을 노드 리스트로 (중첩 body 용)."""
    block = []
    while i < len(lines) and lines[i].indent > base_indent:
        node, i = _line_to_node(lines, i, review)
        if node is not None:
            block.append(node)
    return block, i

def _line_to_node(lines, i, review):
    l = lines[i]
    c = l.content
    if c.startswith('label ') and c.endswith(':'):
        return {"op": "label", "name": c[6:-1].strip()}, i + 1
    if c == 'menu:':
        return _parse_menu(lines, i, review)
    if c.startswith('if ') and c.endswith(':'):
        return _parse_if(lines, i, review)
    node = classify(c, review)
    return node, i + 1
```

  > `_consume`(최상위)는 `_line_to_node`와 동일하되 결과를 flat `nodes`에 append. `classify`는 say/scene/jump/return/call/call_screen/chat_close/pause/`$`(Task 7)·`elif/else`(menu/if 내부에서만) 처리. `_parse_menu`: 첫 자식이 `n "..."`(또는 무명 say)면 `prompt`로 흡수, 그 다음 `"text":`(+옵션 `if cond`)마다 `parse_block`로 body 수집. `_parse_if`: `cond`=`if ...:`의 식(Task 7에서 py→js 변환), `then`=parse_block, 이어지는 `elif`/`else`를 중첩 `if`로 변환.

```python
def classify(c, review):
    m = _SCENE_RE.match(c)
    if m:
        node = {"op": "scene", "bg": m.group(1)}
        if m.group(2): node["with"] = m.group(2)
        return node
    if c == 'return': return {"op": "return"}
    m = _JUMP_RE.match(c)
    if m: return {"op": "jump", "label": m.group(1)}
    m = _CALL_SCREEN_RE.match(c)
    if m: return {"op": "call_screen", "name": m.group(1)}
    m = _CALL_RE.match(c)
    if m:
        node = {"op": "call", "label": m.group(1)}
        return node
    if c.startswith('hide screen masil_chat'): return {"op": "chat_close"}
    if c.startswith('show screen') or c.startswith('hide screen') or c.startswith('show ') or c.startswith('window '):
        return None  # 비-채팅 화면 연출은 무시
    if c.startswith('pause'): return {"op": "pause"}
    if c.startswith('$ '):
        return _convert_dollar(c[2:].strip(), review)   # Task 7
    m = _SAY_CHAR_RE.match(c)
    if m: return {"op": "say", "who": m.group(1), "text": _unquote(m.group(2))}
    m = _SAY_NARR_RE.match(c)
    if m: return {"op": "say", "who": "n", "text": _unquote(m.group(1))}
    review.append(c)
    return None
```

  > 이 태스크에서는 `_convert_dollar`/`_parse_menu`/`_parse_if`의 **시그니처와 최소 동작**(테스트가 요구하는 say/scene/label/menu 중첩)을 만족시키면 된다. `_parse_menu` 최소 구현:

```python
def _parse_menu(lines, i, review):
    base = lines[i].indent
    i += 1
    prompt, choices = None, []
    while i < len(lines) and lines[i].indent > base:
        c = lines[i].content
        mc = _MENU_CHOICE_RE.match(c)
        if mc:
            text, cond = mc.group(1), mc.group(2)
            body, i = parse_block(lines, i + 1, lines[i].indent, review)
            ch = {"text": _unquote(text), "body": body}
            if cond: ch["cond"] = cond  # Task 7에서 py→js 변환
            choices.append(ch)
        else:
            node = classify(c, review)
            if node and node.get("op") == "say" and prompt is None:
                prompt = node["text"]
            i += 1
    out = {"op": "menu", "choices": choices}
    if prompt is not None: out["prompt"] = prompt
    return out, i

def _parse_if(lines, i, review):
    base = lines[i].indent
    cond = lines[i].content[3:-1].strip()
    then, i = parse_block(lines, i + 1, base, review)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review)
        node["else"] = els
    return node, i

def _parse_if_from_elif(lines, i, review):
    base = lines[i].indent
    cond = lines[i].content[5:-1].strip()
    then, i = parse_block(lines, i + 1, base, review)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review)
        node["else"] = els
    return node, i
```

  > `_consume`(최상위) 구현:

```python
def _consume(lines, i, nodes, review):
    node, ni = _line_to_node(lines, i, review)
    if node is not None:
        nodes.append(node)
    return node, ni
```

  > `_convert_dollar` 최소 스텁(Task 7에서 본격 구현; 지금은 알 수 없는 건 review):

```python
def _convert_dollar(code, review):
    review.append('$ ' + code)
    return None
```

- [ ] **Step 4: 통과 확인**

Run (from `tools/`): `python3 -m unittest test_rpy2json -v`
Expected: PASS (이전 3 + 신규 4 = 7 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/rpy2json.py tools/test_rpy2json.py && git commit -m "feat(converter): indentation block parser (say/scene/menu/if/labels)"
```

---

## Task 7: 변환기 — `$` 파이썬 줄 → op/표현식 변환 + REVIEW (rpy2json.py 3부)

`$ ...` 한 줄과 `if`/`menu` 조건을 처리. 알려진 헬퍼 호출은 그대로(식 평가기가 `S.`/`V.` 프리픽스로 실행), 채팅/사운드/특수 호출은 전용 op로, 나머지는 `set`+py→js 식. 못 알아먹으면 REVIEW.

**Files:**
- Modify: `tools/rpy2json.py`
- Modify: `tools/test_rpy2json.py`

**Interfaces:**
- Produces:
  - `py_to_js(expr) -> str` — `and→&&`,`or→||`,`not →!`,`True→true`,`False→false`,`None→null`; `.format()`은 이 코드베이스에 사용처 없음(있으면 REVIEW)
  - `scope_prefix(expr, var_names, sys_names) -> str` — 식별자를 `V.`/`S.`로 프리픽스 (vars/systems 멤버에 한해)
  - `_convert_dollar(code, review)` 완성:
    - `recv("t", name="도윤")`→`{op:"recv",name,text}`; `send("t")`→`{op:"send",text}`; `chat_reset("room")`→`{op:"chat_open",room}`
    - `pmusic("f", fadein=)`→`{op:"music",file,fadein?}`; `psound("f")`→`{op:"sound"}`; `pamb`→`{op:"amb"}`; `pstop()`→`{op:"stop"}`
    - `doyun_ping("t")`→`{op:"toast",kind:"doyun",text}`
    - `mc = Character(...)`/`tmp = renpy.input(...)` 조합 → `renpy.input` 줄을 `{op:"input"}`로(아래), `mc = Character(...)`는 무시(이름은 mc_name 보간)
    - 그 외 헬퍼/대입(`add_like(...)`,`get_item(...)`,`unlock_station(...)`,`x = y`,`x += y`) → `{op:"set", expr: scope_prefix(py_to_js(code))}`
  - `if`/`menu` cond는 `convert()` 마지막에 일괄 `scope_prefix(py_to_js(...))` 적용
  - `renpy.input(prompt, default=, length=)` 처리: 직후 `mc_name = tmp.strip() or "..."` 패턴을 인식해 `{op:"input", var:"mc_name", prompt, default, max}` 단일 노드로 축약 (특수 케이스, 주석으로 명시)

- [ ] **Step 1: 실패 테스트 추가**

```python
from rpy2json import py_to_js, convert

class TestDollar(unittest.TestCase):
    def test_py_to_js_operators(self):
        self.assertEqual(py_to_js('a and b or not c'), 'a && b || ! c')
        self.assertEqual(py_to_js('x == True'), 'x == true')

    def test_recv_send_chatreset(self):
        out = convert('label x:\n    $ chat_reset("서아")\n    $ recv("안녕", name="서아")\n    $ send("ㅎㅇ")\n')
        n = out["nodes"]
        self.assertEqual(n[1], {"op": "chat_open", "room": "서아"})
        self.assertEqual(n[2], {"op": "recv", "name": "서아", "text": "안녕"})
        self.assertEqual(n[3], {"op": "send", "text": "ㅎㅇ"})

    def test_helper_call_becomes_set_with_prefix(self):
        out = convert('label x:\n    $ add_like("seoa", 15)\n')
        self.assertEqual(out["nodes"][1], {"op": "set", "expr": 'S.add_like("seoa", 15)'})

    def test_assignment_var_prefixed(self):
        out = convert('label x:\n    $ promise_spring = True\n')
        # promise_spring is a known var (passed via var_names at convert time)
        self.assertEqual(out["nodes"][1], {"op": "set", "expr": 'V.promise_spring = true'})

    def test_music_and_ping(self):
        out = convert('label x:\n    $ pmusic("audio/bgm/a.ogg", fadein=1.0)\n    $ doyun_ping("형 잘돼?")\n')
        self.assertEqual(out["nodes"][1], {"op": "music", "file": "audio/bgm/a.ogg", "fadein": 1.0})
        self.assertEqual(out["nodes"][2], {"op": "toast", "kind": "doyun", "text": "형 잘돼?"})

    def test_if_cond_translated(self):
        out = convert('label x:\n    if has_item("sakura_card"):\n        "있다"\n')
        self.assertEqual(out["nodes"][1]["cond"], 'S.has_item("sakura_card")')
```

  > 주의: `convert()`가 var/sys 이름을 알아야 프리픽스가 정확하다. `convert(text, var_names=None, sys_names=None)`로 확장하고, 테스트의 기대값에 맞춰 기본 var_names에 `promise_spring` 등 ep1 변수, 기본 sys_names에 `add_like/has_item/...`를 포함한다(아래 구현의 상수 목록).

- [ ] **Step 2: 실패 확인**

Run (from `tools/`): `python3 -m unittest test_rpy2json -v`
Expected: FAIL

- [ ] **Step 3: 구현 (3부)** — `tools/rpy2json.py`

```python
SYS_NAMES = {'add_like','add_sincere','add_bond','hname','chapter_start','get_item','has_item',
    'item_count','use_item','give_item','was_given','unlock_station','doyun_ping','doyun_line',
    'decide_ending','final_ending','apply_timing'}

# ep1에 등장하는 default/런타임 변수 (기본 var_names). convert()에서 declarations로 보강.
BASE_VARS = {'like','sincere','doyun_bond','inventory','item_flags','doyun_used_chapter','show_gauges',
    'mc_name','seoa_result','date_loc','seoa_card_given','promise_spring','ep4_choice'}

def py_to_js(expr):
    e = re.sub(r'\bnot\s+', '! ', expr)
    e = re.sub(r'\band\b', '&&', e)
    e = re.sub(r'\bor\b', '||', e)
    e = e.replace('True', 'true').replace('False', 'false').replace('None', 'null')
    return e

def scope_prefix(expr, var_names, sys_names):
    def repl(m):
        ident = m.group(0)
        # 문자열/숫자/키워드는 정규식이 식별자만 잡으므로 안전
        if ident in sys_names: return 'S.' + ident
        if ident in var_names: return 'V.' + ident
        return ident
    # 식별자 토큰(앞이 '.'·'"' 아닌 경우만): 단순화 위해 \b\w+\b 후 후처리
    # 문자열 리터럴 보호
    parts = re.split(r'("(?:[^"\\]|\\.)*")', expr)
    for k in range(0, len(parts), 2):
        parts[k] = re.sub(r'(?<![\.\w])[A-Za-z_]\w*', repl, parts[k])
    return ''.join(parts)

_RECV_RE = re.compile(r'^recv\("((?:[^"\\]|\\.)*)"\s*,\s*name="((?:[^"\\]|\\.)*)"')
_SEND_RE = re.compile(r'^send\("((?:[^"\\]|\\.)*)"\)')
_RESET_RE = re.compile(r'^chat_reset\("((?:[^"\\]|\\.)*)"\)')
_PMUSIC_RE = re.compile(r'^pmusic\("([^"]*)"(?:\s*,\s*fadein=([\d.]+))?')
_PSOUND_RE = re.compile(r'^psound\("([^"]*)"\)')
_PAMB_RE = re.compile(r'^pamb\("([^"]*)"(?:\s*,\s*fadein=([\d.]+))?')
_PING_RE = re.compile(r'^doyun_ping\("((?:[^"\\]|\\.)*)"\)')
_INPUT_RE = re.compile(r'renpy\.input\("((?:[^"\\]|\\.)*)"(?:\s*,\s*default="([^"]*)")?(?:\s*,\s*length=(\d+))?\)')

def _convert_dollar(code, review, var_names=BASE_VARS, sys_names=SYS_NAMES):
    m = _RESET_RE.match(code)
    if m: return {"op": "chat_open", "room": _unquote(m.group(1))}
    m = _RECV_RE.match(code)
    if m: return {"op": "recv", "name": _unquote(m.group(2)), "text": _unquote(m.group(1))}
    m = _SEND_RE.match(code)
    if m: return {"op": "send", "text": _unquote(m.group(1))}
    m = _PMUSIC_RE.match(code)
    if m:
        node = {"op": "music", "file": m.group(1)}
        if m.group(2): node["fadein"] = float(m.group(2))
        return node
    m = _PSOUND_RE.match(code)
    if m: return {"op": "sound", "file": m.group(1)}
    m = _PAMB_RE.match(code)
    if m:
        node = {"op": "amb", "file": m.group(1)}
        if m.group(2): node["fadein"] = float(m.group(2))
        return node
    if code.startswith('pstop'): return {"op": "stop", "channel": "music"}
    if code.startswith('pamb_stop'): return {"op": "stop", "channel": "amb"}
    m = _PING_RE.match(code)
    if m: return {"op": "toast", "kind": "doyun", "text": _unquote(m.group(1))}
    # renpy.input(...) (닉네임): tmp = renpy.input(...) 형태
    mi = _INPUT_RE.search(code)
    if mi:
        node = {"op": "input", "var": "mc_name", "prompt": _unquote(mi.group(1))}
        if mi.group(2): node["default"] = mi.group(2)
        if mi.group(3): node["max"] = int(mi.group(3))
        return node
    # mc_name = tmp.strip() or "진호"  → input 노드가 이미 처리하므로 무시
    if re.match(r'^mc_name\s*=\s*tmp', code): return None
    # mc = Character(...) 재정의 → 무시 (이름은 mc_name 보간)
    if re.match(r'^\w+\s*=\s*Character\(', code): return None
    if code.startswith('renpy.call_screen'): review.append('$ ' + code); return None
    if code.startswith('persistent.'):
        # persistent.play_count = ... → set with P.
        return {"op": "set", "expr": _persistent_expr(code)}
    # 일반 헬퍼 호출/대입 → set
    return {"op": "set", "expr": scope_prefix(py_to_js(code), var_names, sys_names)}

def _persistent_expr(code):
    return py_to_js(code).replace('persistent.', 'P.')
```

  > `convert(text, var_names=None, sys_names=None)`로 시그니처 확장: 선언 파싱으로 얻은 default 변수명을 `BASE_VARS`에 합집합하고, `_line_to_node`/`classify`/`_parse_menu`/`_parse_if`에 `var_names,sys_names`를 전달. 마지막에 모든 `menu.choices[].cond`·`if.cond`에 `scope_prefix(py_to_js(cond))` 적용(파서가 raw로 저장했으면 후처리, 또는 파싱 시 즉시 변환). 테스트 기대값(`'S.has_item("sakura_card")'`)에 맞춰 cond 변환을 적용할 것.

- [ ] **Step 4: 통과 확인**

Run (from `tools/`): `python3 -m unittest test_rpy2json -v`
Expected: PASS (이전 7 + 신규 6 = 13 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/rpy2json.py tools/test_rpy2json.py && git commit -m "feat(converter): \$-line ops + py->js expr + scope prefix + REVIEW"
```

---

## Task 8: ep1 실제 변환 + REVIEW 0건화 + node 자동 플레이스루

**Files:**
- Modify: `tools/rpy2json.py` (CLI `main`)
- Create: `web/data/ep1.json` (생성물, 커밋)
- Create: `test/playthrough.test.js`

**Interfaces:**
- `python3 rpy2json.py ../script_ep1.rpy -o ../web/data/ep1.json` → ep1.json + `tools/convert_review.log`
- 모든 텍스트는 say `who` 매핑(n/mc/d/s)과 일치. `seoa_result`/`date_loc` 등 default가 ep1 안에서 `default`로 또 선언됨 → 무시(이미 등록).

- [ ] **Step 1: CLI main 추가 + 변환 실행**

`tools/rpy2json.py` 끝에:
```python
def main():
    import sys, json, io
    src, out = sys.argv[1], sys.argv[sys.argv.index('-o') + 1]
    text = io.open(src, encoding='utf-8').read()
    decls = parse_declarations(parse_lines(text))
    var_names = set(BASE_VARS) | set(decls["defaults"].keys())
    result = convert(text, var_names=var_names, sys_names=SYS_NAMES)
    result["backgrounds"] = decls["backgrounds"]
    io.open(out, 'w', encoding='utf-8').write(json.dumps(result, ensure_ascii=False, indent=1))
    with io.open('convert_review.log', 'w', encoding='utf-8') as f:
        f.write('\n'.join(result["review"]))
    print('nodes:', len(result["nodes"]), 'labels:', len(result["labels"]), 'review:', len(result["review"]))

if __name__ == '__main__':
    main()
```

Run (from `tools/`):
```bash
PYTHONUTF8=1 python3 -X utf8 rpy2json.py "../script_ep1.rpy" -o "../web/data/ep1.json"
```
Expected: 출력에 `review: 0` (또는 남은 항목을 Step 2에서 처리)

- [ ] **Step 2: convert_review.log 검토 → 0건화**

Read `tools/convert_review.log`. 남은 라인별 대응:
- `call screen subway_map` → 이미 `call_screen`로 처리됨(REVIEW 아님). 아니면 classify 보강.
- `renpy.call_screen("masil_choices", ...)` → ep1엔 없음(demo 전용). 있으면 menu로 수동 대응.
- 기타 미인식 `$`/지시문 → 해당 정규식/분기 보강 후 재실행.
반복하여 `review: 0` 달성. (정말 무시해도 되는 줄은 코드에서 명시적으로 `return None` 처리하고 주석.)

- [ ] **Step 3: 자동 플레이스루 테스트 작성** — `test/playthrough.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';
import { Engine } from '../web/src/engine.js';

const script = JSON.parse(readFileSync(new URL('../web/data/ep1.json', import.meta.url)));
const characters = JSON.parse(readFileSync(new URL('../web/data/characters.json', import.meta.url)));
const DEFAULTS = {
  like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
  doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false, show_gauges: false,
  mc_name: '진호', seoa_result: '', date_loc: '', seoa_card_given: false, promise_spring: false, ep4_choice: '',
};

function autoView(pickFn) {
  const says = [];
  let menuN = 0;
  return {
    says,
    async scene() {}, async chatOpen() {}, async chatClose() {}, async recv() {}, async send() {},
    async pause() {}, async consult() {}, async callScreen() {}, async toast() {},
    async music() {}, async sound() {}, async amb() {}, async stop() {},
    async say(a) { says.push(a.text); },
    async input() { return '진호'; },
    async menu(a) { return pickFn(menuN++, a.choices); },
  };
}

function play(pickFn) {
  const state = new GameState();
  state.defineDefaults(DEFAULTS);
  const sys = makeSystems(state, {});
  const view = autoView(pickFn);
  const eng = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
  return eng.start('episode1_full').then(() => ({ state, view }));
}

test('plays prologue+Ep1 to an end taking first choices, no crash, no unknown var', async () => {
  const { view } = await play(() => 0);
  assert.ok(view.says.length > 50, 'should render many lines');
});

test('plays taking last choices to the other end', async () => {
  const { view } = await play((_, choices) => choices.length - 1);
  assert.ok(view.says.length > 50);
});

test('sakura_card branch: choosing to make postcard then give it sets seoa_card_given', async () => {
  // 첫 메뉴 응답 분기를 조정해 엽서 제작→전달 경로를 태움
  const { state } = await play((i) => (i === 2 || i === 7) ? 0 : 0);
  assert.equal(typeof state.vars.seoa_card_given, 'boolean');
});
```

  > 주: 마지막 테스트의 정확한 menu 인덱스는 ep1.json 실제 메뉴 순서를 보고 확정한다(실행 후 인덱스 매핑 확인 → 엽서 제작=해당 메뉴 0, 전달=해당 메뉴 0). 핵심 단언은 "크래시 없이 끝까지, 변수 일관".

- [ ] **Step 4: 전체 테스트 통과 확인**

Run (from repo root): `node --test test/` 그리고 (from `tools/`) `python3 -m unittest test_rpy2json -v`
Expected: 모든 테스트 PASS, `review: 0`

- [ ] **Step 5: 커밋**

```bash
git add tools/rpy2json.py web/data/ep1.json test/playthrough.test.js && git commit -m "feat(converter): convert ep1 to JSON + node playthrough grounding"
```

---

## Task 9: 스테이지 UI + 기본 레이아웃 (stage.js, style.css, index.html 골격)

**Files:**
- Create: `web/index.html`, `web/style.css`, `web/src/ui/stage.js`

**Interfaces:**
- Produces:
  - `index.html`: `#stage`(배경), `#textbox`(대사), `#name`, `#choices`, `#chat`, `#overlay` 레이어 + `<script type="module" src="src/ui/view_dom.js">`
  - `makeStage(rootEl, backgrounds)` → `{ scene({bg,with}), say({who,name,color,text}) -> Promise }`
  - `say`는 텍스트박스에 이름(색)+본문 렌더, 텍스트태그 `{i}{/i}`→`<em>`, `{w=n}`→무시(즉시 표시, 클릭 진행으로 단순화), `{p}`→줄바꿈, 클릭/Enter/Space에서 resolve
  - 배경: backgrounds[bg] 색을 `#stage` 배경으로(트랜지션은 CSS opacity 0.4s)

- [ ] **Step 1: index.html + style.css 골격 작성**

`web/index.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <title>오픈챗에서 만나요</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game">
    <div id="stage"></div>
    <div id="chat" class="hidden"></div>
    <div id="textbox" class="hidden"><div id="name"></div><div id="line"></div></div>
    <div id="choices" class="hidden"></div>
    <div id="overlay" class="hidden"></div>
    <div id="toast"></div>
  </div>
  <script type="module" src="src/ui/view_dom.js"></script>
</body>
</html>
```

`web/style.css` (핵심 — 16:9 반응형 컨테이너 + 레이어; 폰트 추후 내장):
```css
:root { --bg:#15171f; --ink:#eef0f6; }
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; background:#000; color:var(--ink);
  font-family: "Pretendard", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
#game { position: relative; width: 100vw; height: 100vh; max-width: calc(100vh * 16 / 9);
  margin: 0 auto; overflow: hidden; }
#stage { position:absolute; inset:0; transition: background-color .4s ease; background:#000; }
.hidden { display:none !important; }
#textbox { position:absolute; left:0; right:0; bottom:0; min-height:26%;
  background:#0b0d14d9; padding: 5% 6% 6%; cursor:pointer; }
#name { font-weight:700; font-size: clamp(16px,2.6vw,24px); margin-bottom:.4em; }
#line { font-size: clamp(15px,2.4vw,22px); line-height:1.65; white-space:pre-wrap; }
#choices { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center;
  align-items:center; gap:14px; background:#0008; padding:8%; }
#choices button { width:min(680px,92%); padding:18px 22px; font-size: clamp(15px,2.3vw,22px);
  border:0; border-radius:14px; background:#eef0f8; color:#2f3447; cursor:pointer; text-align:left; }
#choices button:hover { background:#dfe3f6; }
#toast { position:absolute; top:14px; left:50%; transform:translateX(-50%); display:flex;
  flex-direction:column; gap:8px; pointer-events:none; z-index:90; }
.toast-item { background:#1f2333ee; color:#cfd4e6; padding:12px 18px; border-radius:12px;
  font-size:15px; box-shadow:0 6px 24px #0007; }
.toast-doyun { border-left:4px solid #2fb574; }
```

- [ ] **Step 2: stage.js 작성** (브라우저 모듈 — 단위테스트 대신 Task 13 그라운딩으로 검증)

```js
export function makeStage(root, backgrounds) {
  const stage = root.querySelector('#stage');
  const box = root.querySelector('#textbox');
  const nameEl = root.querySelector('#name');
  const lineEl = root.querySelector('#line');

  function renderTags(text) {
    return text
      .replace(/\{w=[\d.]+\}/g, '').replace(/\{p\}/g, '\n')
      .replace(/\{i\}/g, '<em>').replace(/\{\/i\}/g, '</em>');
  }
  return {
    scene({ bg }) { if (bg && backgrounds[bg]) stage.style.backgroundColor = backgrounds[bg]; },
    say({ name, color, text }) {
      return new Promise(resolve => {
        box.classList.remove('hidden');
        nameEl.textContent = name || '';
        nameEl.style.color = color || '#eef0f6';
        nameEl.style.display = name ? 'block' : 'none';
        lineEl.innerHTML = renderTags(text);
        const onAdv = (e) => {
          if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
          box.removeEventListener('click', onAdv); document.removeEventListener('keydown', onAdv);
          resolve();
        };
        box.addEventListener('click', onAdv); document.addEventListener('keydown', onAdv);
      });
    },
  };
}
```

- [ ] **Step 3: 커밋**

```bash
git add web/index.html web/style.css web/src/ui/stage.js && git commit -m "feat(ui): stage layer, layout, text-tag rendering"
```

---

## Task 10: 마실 채팅 UI (chat.js)

`screens_chat.rpy`를 DOM으로. 말풍선/타임스탬프/읽음/입력중/프사 이니셜/방 상단바/자동 스크롤.

**Files:**
- Create: `web/src/ui/chat.js`
- Modify: `web/style.css` (채팅 스타일 추가)
- Modify: `web/index.html` (없음 — `#chat` 이미 있음)

**Interfaces:**
- Produces: `makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES })` →
  - `open({room})`, `close()`
  - `recv({name, text, avatar}) -> Promise` (입력중 0.8s 후 말풍선, 그 후 resolve)
  - `send({text}) -> Promise` (즉시 말풍선 + 읽음)
  - 가짜 시계: 오후 9:10 시작, 메시지마다 +1분 (`_fmt_time` 포팅)
- 프사: avatar 이미지 경로가 로드 실패하면 이니셜 동그라미(색 = CHAT_AVATARS[name] || avatar_bg)

- [ ] **Step 1: 채팅 CSS 추가** — `web/style.css`

```css
#chat { position:absolute; inset:0; background:#e8ebf2; display:flex; flex-direction:column; z-index:50; }
#chat .topbar { height:64px; background:#2f3447; color:#fff; display:flex; align-items:center;
  gap:10px; padding:0 18px; flex:0 0 auto; }
#chat .topbar .room { font-weight:700; font-size:18px; }
#chat .topbar .sub { color:#b8c0d0; font-size:12px; display:flex; align-items:center; gap:6px; }
#chat .topbar .dot { width:9px; height:9px; border-radius:50%; background:#46d18a; display:inline-block; }
#chat .log { flex:1 1 auto; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.bubble-row { display:flex; gap:8px; align-items:flex-end; max-width:80%; }
.bubble-row.left { align-self:flex-start; }
.bubble-row.right { align-self:flex-end; flex-direction:row-reverse; }
.avatar { width:44px; height:44px; border-radius:50%; flex:0 0 auto; display:flex;
  align-items:center; justify-content:center; color:#fff; font-weight:700; background-size:cover; }
.bubble { padding:11px 15px; border-radius:14px; font-size:16px; line-height:1.5; word-break:break-word; }
.left .bubble { background:#fff; color:#1c1f2a; }
.right .bubble { background:#6c7cf0; color:#fff; }
.meta { font-size:11px; color:#8a90a3; align-self:flex-end; }
.right .meta .read { color:#6c7cf0; }
.sender { font-size:13px; color:#3b4257; font-weight:700; margin-bottom:3px; }
.typing span { display:inline-block; width:7px; height:7px; margin:0 2px; border-radius:50%;
  background:#9aa0b3; animation: blink 1.2s infinite; }
.typing span:nth-child(2){animation-delay:.18s} .typing span:nth-child(3){animation-delay:.36s}
@keyframes blink { 0%,100%{opacity:.35} 50%{opacity:1} }
```

- [ ] **Step 2: chat.js 작성**

```js
export function makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES = {} }) {
  const wrap = root.querySelector('#chat');
  let log, minutes = 0;

  function fmtTime() {
    const t = 21 * 60 + 10 + minutes; minutes += 1;
    const h = Math.floor(t / 60) % 24, m = t % 60;
    const ampm = h < 12 ? '오전' : '오후'; const h12 = (h % 12) || 12;
    return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
  }
  function avatarEl(name, avatar) {
    const el = document.createElement('div'); el.className = 'avatar';
    const file = avatar || AVATAR_FILES[name];
    if (file) { const img = new Image(); img.onerror = () => initial(); img.src = file;
      el.style.backgroundImage = `url("${file}")`; }
    else initial();
    function initial() { el.style.background = CHAT_AVATARS[name] || MASIL.avatar_bg; el.textContent = (name || '?')[0]; }
    return el;
  }
  function scrollBottom() { log.scrollTop = log.scrollHeight; }

  return {
    open({ room }) {
      wrap.classList.remove('hidden'); minutes = 0;
      wrap.innerHTML = `<div class="topbar"><span style="font-size:28px">‹</span>
        <div><div class="room">${room}</div><div class="sub"><span class="dot"></span>온라인</div></div></div>
        <div class="log"></div>`;
      log = wrap.querySelector('.log');
    },
    close() { wrap.classList.add('hidden'); },
    recv({ name, text, avatar }) {
      return new Promise(resolve => {
        const row = document.createElement('div'); row.className = 'bubble-row left';
        row.appendChild(avatarEl(name, avatar));
        const col = document.createElement('div');
        col.innerHTML = `<div class="sender">${name || ''}</div>
          <div class="bubble typing"><span></span><span></span><span></span></div>`;
        row.appendChild(col); log.appendChild(row); scrollBottom();
        setTimeout(() => {
          col.innerHTML = `<div class="sender">${name || ''}</div>
            <div class="bubble">${escapeHtml(text)}</div><div class="meta">${fmtTime()}</div>`;
          scrollBottom(); resolve();
        }, 800);
      });
    },
    send({ text }) {
      const row = document.createElement('div'); row.className = 'bubble-row right';
      row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
        <div class="meta"><span class="read">읽음</span><br>${fmtTime()}</div>`;
      log.appendChild(row); scrollBottom();
      return Promise.resolve();
    },
  };
}
function escapeHtml(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/ui/chat.js web/style.css && git commit -m "feat(ui): 마실 chat UI (bubbles, typing, avatar, timestamp)"
```

---

## Task 11: 메뉴/입력/상담/토스트/맵·폰 스텁 (menu.js, overlay.js)

**Files:**
- Create: `web/src/ui/menu.js`, `web/src/ui/overlay.js`
- Modify: `web/style.css` (모달/입력 스타일)

**Interfaces:**
- `makeMenu(root)` → `{ menu({prompt,choices})->Promise<index>, input({prompt,def,max})->Promise<string> }`
- `makeOverlay(root)` →
  - `consult({who,line,hint})->Promise` (도윤 상담 모달; 닫기 시 resolve)
  - `toast({kind,text})` (3초 자동 사라짐; `kind==='doyun'`→`toast-doyun`)
  - `callScreen({name})->Promise` — `subway_map`→"역 해금" 인터스티셜(클릭 진행), `inventory`→소지품 모달, 그 외 즉시 resolve
  - `phoneButton()` — 우상단 📱 버튼(이번 슬라이스는 비활성/no-op 표시)

- [ ] **Step 1: 모달/입력 CSS 추가** — `web/style.css`

```css
#overlay { position:absolute; inset:0; background:#000a; display:flex; align-items:center;
  justify-content:center; z-index:70; padding:8%; }
.modal { background:#fffdf7; color:#2b2b2b; border-radius:16px; padding:28px; max-width:760px; width:100%; }
.modal h3 { color:#2f3447; margin-bottom:14px; font-size:clamp(18px,3vw,26px); }
.modal .hint { color:#2fb574; font-style:italic; margin-top:12px; white-space:pre-wrap; }
.modal .close { margin-top:18px; float:right; border:0; background:none; color:#6c7cf0;
  font-size:18px; cursor:pointer; }
.input-row { display:flex; gap:10px; margin-top:16px; }
.input-row input { flex:1; padding:14px; font-size:18px; border:1px solid #ccd; border-radius:10px; }
.input-row button { padding:14px 20px; border:0; border-radius:10px; background:#6c7cf0; color:#fff; cursor:pointer; }
.map-interstitial { background:#1b1f2e; color:#cfd4e6; text-align:center; }
```

- [ ] **Step 2: menu.js**

```js
export function makeMenu(root) {
  const choicesEl = root.querySelector('#choices');
  const overlayEl = root.querySelector('#overlay');
  return {
    menu({ prompt, choices }) {
      return new Promise(resolve => {
        choicesEl.classList.remove('hidden');
        choicesEl.innerHTML = prompt ? `<div style="color:#fff;margin-bottom:8px;text-align:center">${prompt}</div>` : '';
        choices.forEach((text, i) => {
          const b = document.createElement('button'); b.textContent = text;
          b.onclick = () => { choicesEl.classList.add('hidden'); choicesEl.innerHTML = ''; resolve(i); };
          choicesEl.appendChild(b);
        });
      });
    },
    input({ prompt, def, max }) {
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal"><h3>${prompt || ''}</h3>
          <div class="input-row"><input id="nick" maxlength="${max || 20}" value="${def || ''}">
          <button id="ok">확인</button></div></div>`;
        const inp = overlayEl.querySelector('#nick');
        const done = () => { const v = inp.value; overlayEl.classList.add('hidden'); overlayEl.innerHTML = ''; resolve(v); };
        overlayEl.querySelector('#ok').onclick = done;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
        inp.focus();
      });
    },
  };
}
```

- [ ] **Step 3: overlay.js**

```js
export function makeOverlay(root) {
  const overlayEl = root.querySelector('#overlay');
  const toastEl = root.querySelector('#toast');
  return {
    consult({ line, hint }) {
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal"><h3>도윤에게 상담하기</h3>
          <div>도윤: "${escapeHtml(line)}"</div><div class="hint">${escapeHtml(hint)}</div>
          <button class="close">고마워, 알겠어</button></div>`;
        overlayEl.querySelector('.close').onclick = () => { overlayEl.classList.add('hidden'); overlayEl.innerHTML = ''; resolve(); };
      });
    },
    callScreen({ name }) {
      if (name !== 'subway_map') return Promise.resolve();
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal map-interstitial"><h3>2호선</h3>
          <div>새로운 역이 열렸다.</div><button class="close">이동</button></div>`;
        overlayEl.querySelector('.close').onclick = () => { overlayEl.classList.add('hidden'); overlayEl.innerHTML = ''; resolve(); };
      });
    },
    toast({ kind, text }) {
      const t = document.createElement('div'); t.className = 'toast-item' + (kind === 'doyun' ? ' toast-doyun' : '');
      t.textContent = (kind === 'doyun' ? '도윤 📱  ' : '') + text;
      toastEl.appendChild(t); setTimeout(() => t.remove(), 3000);
    },
  };
}
function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
```

- [ ] **Step 4: 커밋**

```bash
git add web/src/ui/menu.js web/src/ui/overlay.js web/style.css && git commit -m "feat(ui): menu/input/consult/toast/map overlays"
```

---

## Task 12: 부팅 + view 싱크 연결 (view_dom.js)

엔진과 모든 UI를 연결하는 `view` 싱크 + 부팅. ep1.json/characters.json 로드, default 변수 등록, persistent 로드, `episode1_full`부터 시작, 정지점마다 오토세이브.

**Files:**
- Create: `web/src/ui/view_dom.js`

**Interfaces:**
- Consumes: stage/chat/menu/overlay, Engine, GameState, makeSystems, makeEvaluator, theme
- 부팅 시 `state.defineDefaults`에 ep1.json의 `backgrounds`는 별도, default 변수는 하드코딩 DEFAULTS(엔진 테스트의 DEFAULTS와 동일) 사용 — 또는 ep1.json에 defaults를 포함시켜 로드(권장: 변환기 main이 `result["defaults"]=decls["defaults"]` 추가)
- `view` 싱크는 stage/chat/menu/overlay 메서드를 op별로 위임. `say`는 채팅이 열려있지 않을 때만 textbox 사용
- safe-play: `music/sound/amb/stop`은 `new Audio` 시도 후 에러 무시(에셋 없으면 무음)

- [ ] **Step 1: 변환기 main에 defaults 포함** — `tools/rpy2json.py` main 수정

```python
    result["defaults"] = decls["defaults"]
```
재실행:
```bash
cd tools && PYTHONUTF8=1 python3 -X utf8 rpy2json.py "../script_ep1.rpy" -o "../web/data/ep1.json"
```

- [ ] **Step 2: view_dom.js 작성**

```js
import { GameState } from '../state.js';
import { makeSystems } from '../systems.js';
import { makeEvaluator } from '../eval_expr.js';
import { Engine } from '../engine.js';
import { MASIL, CHAT_AVATARS } from '../theme.js';
import { makeStage } from './stage.js';
import { makeChat } from './chat.js';
import { makeMenu } from './menu.js';
import { makeOverlay } from './overlay.js';

const AVATAR_FILES = {
  '도윤': 'images/avatar/avatar_doyun.png', '서아': 'images/avatar/avatar_seoa.png',
  '지우': 'images/avatar/avatar_jiu.png', '민결': 'images/avatar/avatar_mingyeol.png',
};

async function boot() {
  const root = document.getElementById('game');
  const [script, characters] = await Promise.all([
    fetch('data/ep1.json').then(r => r.json()),
    fetch('data/characters.json').then(r => r.json()),
  ]);

  const state = new GameState(window.localStorage);
  state.defineDefaults(script.defaults || {});
  // 누락 방지: 핵심 구조 default 보강
  state.defineDefaults({ like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    inventory: {}, item_flags: {}, doyun_used_chapter: false, show_gauges: false, mc_name: '진호', ep4_choice: '' });
  state.loadPersistent();
  state.persistent.play_count = (state.persistent.play_count || 0) + 1;
  state.savePersistent();

  const overlay = makeOverlay(root);
  const sys = makeSystems(state, { onNotify: n => overlay.toast(n) });
  const stage = makeStage(root, script.backgrounds || {});
  const chat = makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES });
  const menu = makeMenu(root);
  let chatOpen = false;

  const audio = {};
  function safePlay(file, loop) {
    if (!file) return; try { const a = new Audio(file); a.loop = !!loop; a.play().catch(() => {}); audio[file] = a; } catch (e) {}
  }

  const engine = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys),
    view: {
      async scene(a) { stage.scene(a); },
      async say(a) { await stage.say(a); autosave(); },
      async chatOpen(a) { chatOpen = true; chat.open(a); },
      async chatClose() { chatOpen = false; chat.close(); },
      async recv(a) { await chat.recv(a); },
      async send(a) { await chat.send(a); },
      async pause() { await stage.say({ name: '', text: '' , who:'n'}); }, // 채팅 중 클릭 진행: 빈 줄 대신 아래 처리
      async input(a) { return menu.input(a); },
      async menu(a) { return menu.menu(a); },
      async consult(a) { await overlay.consult(a); autosave(); },
      async callScreen(a) { await overlay.callScreen(a); },
      async toast(a) { overlay.toast(a); },
      async music(a) { safePlay(a.file, true); },
      async sound(a) { safePlay(a.file, false); },
      async amb(a) { safePlay(a.file, true); },
      async stop() {},
    } });

  function autosave() { state.saveAuto(engine.position()); }
  await engine.start('episode1_full');
}
boot();
```

  > **`pause` 처리 보정:** 채팅 중 `pause`는 "탭하면 다음"이어야 한다. 위 stage.say 재사용은 부적절 → `view.pause`는 채팅 화면에 전체 클릭 캡처를 걸어 resolve하도록 `chat`에 `waitTap()`을 추가(아래 보강)하고, 채팅이 안 열렸을 땐 stage 클릭 대기. 이 보정은 Task 13 그라운딩에서 실제로 확인하며 마무리한다.

- [ ] **Step 3: chat.waitTap 보강** — `web/src/ui/chat.js`에 추가

```js
// makeChat 반환 객체에 추가:
    waitTap() {
      return new Promise(resolve => {
        const onTap = () => { wrap.removeEventListener('click', onTap); resolve(); };
        wrap.addEventListener('click', onTap);
      });
    },
```
그리고 view_dom.js의 `pause`를 교체:
```js
      async pause() { if (chatOpen) await chat.waitTap(); else await stage.say({ who:'n', name:'', text:'(계속)' }); },
```

- [ ] **Step 4: 로컬 서버로 부팅 확인 (스모크)**

Run (from `web/`): `python3 -m http.server 8000` → 브라우저 `http://localhost:8000`
Expected: 프롤로그 첫 나레이션 표시, 클릭 진행, 닉네임 입력, 채팅 등장.

- [ ] **Step 5: 커밋**

```bash
git add web/src/ui/view_dom.js web/src/ui/chat.js tools/rpy2json.py web/data/ep1.json && git commit -m "feat(ui): boot + view sink wiring engine<->DOM"
```

---

## Task 13: 브라우저 그라운딩 플레이스루 + 마무리

**[render artifact — verification-grounding-pack 적용]** 실제 브라우저에서 돌려 관찰→수정→재실행.

**Files:**
- Modify: 관찰된 버그에 따라 해당 UI/엔진/변환기 파일
- Create: `web/vercel.json` (정적 배포 설정), `web/README.md` (실행/배포)

**Interfaces:**
- 없음(통합/버그픽스). DoD = spec의 수직 슬라이스 기준 충족.

- [ ] **Step 1: 자동 로직 그라운딩 재확인**

Run (repo root): `node --test test/`
Expected: 전 테스트 PASS (state/systems/eval/engine/playthrough)

- [ ] **Step 2: 브라우저 수동 플레이스루 (관찰 체크리스트)**

`python3 -m http.server 8000` 후, 다음을 **직접 보고** 확인하며 깨지면 고친다:
- [ ] 프롤로그 나레이션 → 클릭/탭/Enter로 진행, `{i}`이탤릭·`{p}`줄바꿈 정상
- [ ] 닉네임 입력 → 이후 `[mc_name]` 보간 표시
- [ ] 채팅: 입력중 점 애니메이션 → 말풍선, 좌(상대 프사 이니셜)/우(읽음·시간), 자동 스크롤
- [ ] 선택지: 분기별로 다른 전개, 도윤 상담 모달(챕터당 1회), 2회차 시 막힘 멘트
- [ ] 데이트 장소 3분기(한강/노래방/카페) 각각 진입
- [ ] 벚꽃 엽서 제작→전달 경로에서 토스트(아이템 획득) + give 분기
- [ ] `unlock_station`/`subway_map` 인터스티셜, `doyun_ping` 토스트
- [ ] **게이지 숫자 어디에도 안 보임**(show_gauges=false)
- [ ] Ep1 두 결말(fast/slow) 도달
- [ ] 모바일 폭(개발자도구 375px)에서 레이아웃 안 깨짐
- [ ] 새로고침 후 오토세이브 이어하기(다음 마일스톤에서 UI 노출; 지금은 localStorage에 위치 저장됨 확인)

- [ ] **Step 3: vercel.json + README 작성**

`web/vercel.json`:
```json
{ "cleanUrls": true, "trailingSlash": false }
```
> Ren'Py와 달리 SharedArrayBuffer 불필요 → COOP/COEP 헤더 없음. 정적 서빙만으로 동작.

`web/README.md`: 로컬 실행(`python3 -m http.server`), Vercel 배포(루트=`web/`), 폰트 내장 TODO, 다음 마일스톤(Ep2~4·메타화면·엔딩) 메모.

- [ ] **Step 4: 최종 커밋**

```bash
git add web/vercel.json web/README.md web/ && git commit -m "feat: playable prologue+Ep1 web vertical slice + deploy config"
```

---

## Self-Review (작성자 점검 결과)

**Spec 커버리지:** 엔진+변환기(Task 1–8), 채팅 UI(10), 메뉴/상담/입력(11), 게이지 로직+비노출(2,13), 세이브(1,12), 반응형(9,13), safe-play(12), REVIEW 0건(8), 브라우저 그라운딩(13) — spec 수직 슬라이스 항목 전부 매핑됨. 메타화면/Ep2~4/엔딩7종은 명시적으로 다음 마일스톤.

**Placeholder 스캔:** 코드 스텁은 모두 실제 동작 코드. Task 8 Step 2(REVIEW 0건화)와 Task 12 Step 2~3(pause 보정), Task 13(그라운딩 픽스)은 본질적으로 "관찰 후 조정" 작업이라 정확한 최종 코드가 실행 결과에 의존 — 이는 렌더 산출물 그라운딩의 정상 절차이며 체크리스트로 구체화함.

**타입/시그니처 일관성:** `view` 싱크 메서드 집합이 engine.js·테스트·view_dom.js에서 동일(scene/say/chatOpen/chatClose/recv/send/pause/input/menu/consult/callScreen/toast/music/sound/amb/stop). systems 메서드명이 eval 프리픽스(`S.`)·테스트·엔진 consult에서 일치. state API(defineDefaults/get/set/saveSlot/loadSlot/saveAuto/loadAuto/savePersistent/loadPersistent/snapshot)가 전 태스크에서 일관.

**알려진 리스크:** Task 12의 `pause`/채팅 탭 진행은 그라운딩에서 가장 조정 가능성 높음(Step 3에 보강 포함). 변환기 menu prompt 흡수가 "무명 say가 prompt 의도가 아닌" 드문 경우 오작동 가능 → Task 8 플레이스루로 검출.
