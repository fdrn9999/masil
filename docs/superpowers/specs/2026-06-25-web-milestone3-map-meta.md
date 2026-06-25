# Web Milestone 3 — 2호선 Map + Phone Meta-Screens (Spec)

Date: 2026-06-25
Project: *(가제) 오픈챗에서 만나요* — vanilla-JS web port
Scope owner: Milestone 3 (UI/logic only)

> **Verification reality:** No Ren'Py SDK on this machine and no Ren'Py runtime in the web port. Everything below is derived **statically** from `.superpowers/refs/*.rpy` + current `web/src/*`. Final visual parity must be confirmed in-browser. Web-side verification = **node tests** (systems helpers, pure logic) + **headless-Chrome screenshots** (each screen mounted with seeded state). Do NOT claim "done" without screenshot evidence.

---

## (a) Goal + Scope

**Goal:** Build the player-facing UI layer for navigation + meta/progression, faithful to the recovered Ren'Py screens, in vanilla JS:

1. **2호선 지하철 맵** (`subway_map`) — story-driven interstitial via `call_screen`.
2. **폰 버튼 + 폰 메뉴** (`phone_button` / `phone_menu`) — player-initiated, non-blocking launcher.
3. **친구목록** (`masil_friends`) — relationship dashboard (non-numeric).
4. **추억함** (`memory_box`) — held items + given/used flags.
5. **갤러리** (`gallery`) — ending collection (cross-playthrough).
6. **진단카드** (`result_card`) — end-of-run diagnosis (completes existing stub).
7. **도윤 푸시** (`doyun_push`) — upgrade existing `kind:'doyun'` toast to the rich card.

Plus the `systems.js` helpers + `theme.js` constants these screens need.

**IN scope:** UI modules, DOM/CSS, the listed `systems.js` helpers + state defaults, `theme.js` constants, wiring into `view_dom`/`overlay`/engine `call_screen` delegation, node tests + headless screenshots.

**OUT of scope (EXCLUDE):**
- **All real-asset work.** Backgrounds stay `Solid()`/placeholder. Avatars stay colored-initial fallback (reuse `CHAT_AVATARS`). Station SE / message SE are safe-play (no-op if asset missing). Emoji icons render as text — no image deps.
- CG art in gallery (Ren'Py itself shows the placeholder line `CG는 아트 추가 후 여기에 채워집니다.`).
- Any new gameplay system (weekend time-budget etc.) — completion first.
- No new engine op, no new story-side screen name. Phone meta-screens are NOT in `story.json`.

---

## (b) File structure

### New UI modules (`web/src/ui/`)
| File | Export | Responsibility |
|---|---|---|
| `web/src/ui/map.js` | `makeMap(root)` → `{ show(stations) → Promise }` | 2호선 map render; resolves on station tap or 닫기. Story-driven (blocks engine `await`). Mounts into `#overlay`. |
| `web/src/ui/phone.js` | `makePhone(root, { sys, state, theme })` → `{ button(), open(), close(), register(id, fn) }` | Floating 📱 button + phone menu + the 4 meta sub-screens. Own `#phone-overlay` container. NEVER calls the engine. |

> Recommendation: bundle the 4 meta sub-screens (`masil_friends`, `memory_box`, `gallery`, `result_card`-as-dashboard) **inside `phone.js`** (or co-located `web/src/ui/meta/*.js` registered via `phone.register`). `result_card` as the END-OF-RUN card stays in `overlay.js` (story-driven); the phone-menu "진단카드" entry renders the same body on demand.

### Modified files
- `web/src/ui/overlay.js` — retire `subway_map` stub branch (`overlay.js:38-48`) → delegate to `map.js`; retire `phoneButton()` stub (`overlay.js:57-68`); upgrade `toast` `kind:'doyun'` branch to the rich push card; **complete** `result_card` (add stats block + kept-promises to existing love_type render).
- `web/src/ui/view_dom.js` — build `makeMap`/`makePhone` (~line 73-78), mount phone button once, delegate `subway_map` `call_screen` to `map.show(state.vars.__stations)`.
- `web/src/systems.js` — add the 7 helpers + 2 var defaults (section d).
- `web/src/theme.js` — add `MAP`, `STATIONS` (section d). Reuse existing `CHAT_AVATARS`, `HEROINES`, `ITEMS`, `ENDING_LIST`.
- `web/style.css` — classes for `.subway-map*`, `.phone-btn`, `.phone-layer*`, `.friends*`, `.memory*`, `.gallery*`, `.result-card*`, `.toast-doyun*`.

---

## (c) Per-screen spec

All hex/Korean strings below are **verbatim from refs** — do not normalize spacing (`친구 목록` keeps its space), do not change em-dashes/ellipses, escape all dynamic text via innerHTML-safe insertion (`textContent` or an escape helper).

### C1. 2호선 지하철 맵 — `subway_map`
**Source:** `.superpowers/refs/screens_map.rpy`. **Mount:** `#overlay`. **Module:** `map.js`.

**Behavior contract:** The story never consumes the return value. Every `call_screen subway_map` is preceded by an `unlock_station(...)` and followed by the engine setting the destination scene. So the map is a **confirmation/flavor interstitial** that resolves a Promise with no meaningful payload (resolve `undefined`). Match existing `callScreen` Promise-on-close signature.

**Reads:** `state.vars.__stations` (array of unlocked ids, insertion order). Optional module-local `currentStation` (default `"jamsil"`).

`isOpen(key) = key === 'jamsil' || key === 'sinchon' || (vars.__stations || []).includes(key)`
(jamsil + sinchon are open by default per Ren'Py `default station_unlocked`.)

**Story call sites (`story.json`):** 5× `subway_map` (each preceded by `unlock_station`). The 7 `unlock_station` calls fire in order: `sinchon, hapjeong, mullae, konkuk, seongsu, hapjeong(dup), gangnam`. `hongdae` is in STATIONS but never unlocked → always renders locked (intended).

**Layout (mount full-bleed in `#overlay`, position children by `left=x*100% top=y*100%`, `translate(-50%,-50%)`):**
1. **Title block** (top center): `2호선` size 48 bold color `MAP.title_txt`; subtitle `가고 싶은 역을 선택하세요` color `#7a7a7a` size 20.
2. **Line ellipse** (behind nodes): single SVG `<ellipse>` in `viewBox="0 0 100 100"`, `cx=50 cy=46 rx=34 ry=37`, `fill=none stroke=MAP.line stroke-width≈1.2 stroke-dasharray` (dotted, mimics the 64-dot ring). Stations are positioned by their own x/y, not snapped to the ellipse.
3. **Station nodes** (per STATIONS entry):
   - `isHere = key === currentStation`; `nodeColor = isHere ? node_here : (isOpen ? node_open : node_lock)`.
   - Glyph: `isHere ? "◉" : "●"`; size `isHere ? 44 : 30`; color `nodeColor`.
   - Label below (gap ~3): open → `name`, color `MAP.name_txt`, size 22, bold if `isHere`; locked → `"🔒 " + name`, color `#9a9a9a`, size 20.
   - Whole node+label is a `<button background:none>`, hit-pad ~`18×14`.
   - **Action:** open → set `currentStation = key` (+ optional safe-play `audio/se/se_station.ogg`), dismiss, `resolve()`. Locked → toast `아직 갈 수 없는 곳이에요.` and stay open.
4. **Legend frame** (top-left): bg `#ffffffcc`, pad ~16×12, rows (icon + label size 17 color `#5a5a5a`): `◉` color `node_here` + `현재 위치`; `●` color `node_open` + `이동 가능`; `🔒` + `아직 잠김`.
5. **Bottom bar** (full-width): bg `#ffffff`, pad ~24×16, hbox: `현재 위치: ` + `stationName(currentStation)` color `#2b2b2b` size 22; `닫기` button color `MAP.line` size 22 → dismiss + `resolve()`.

`stationName(key)` = STATIONS lookup, fallback to `key`.

**Dismiss (all paths):** `overlayEl.classList.add('hidden'); overlayEl.innerHTML=''; resolve();`.

---

### C2. 폰 버튼 + 폰 메뉴 — `phone_button` / `phone_menu`
**Source:** `.superpowers/refs/screens_meta.rpy:228-266`. **Mount:** own `#phone-overlay` (NOT `#overlay`). **Module:** `phone.js`.

**Launcher button** (replaces `overlay.phoneButton()` stub):
- `<button class="phone-btn">📱</button>`, mounted once into `#game` at boot.
- CSS: top-right `top:~3.5%; right:~1.5%` (maps `align(0.985,0.04)`), `background:#1f2333cc`, `padding:8px 12px`, `font-size:26px`, `border:none; border-radius:8px; cursor:pointer`, `z-index:80`.
- `onclick → phone.open()`.

**Phone menu** (`zorder 86`, modal among phone screens only):
- Scrim: full-cover `background:#00000088`, click-to-close.
- Card: centered, `background:#fffdf7`, `padding:24px 30px`, radius ~14, vbox `gap:12px`.
- Title `마실` size 28 bold color `#2f3447`.
- Entries (text-only in source; verbatim labels + order, each size 22 color `#2f3447`):
  1. `친구 목록` → close menu, open `masil_friends`.
  2. `추억함` → close menu, open `memory_box`.
  3. `갤러리` → close menu, open `gallery`.
  4. (web-additive) `진단카드` → open result_card body on demand.
  - Optional additive icons (👥/🗃/🖼) allowed — but **labels stay verbatim with the space**.
- Close: `닫기` size 20 color `#8a90a3` → close menu.

**Non-blocking guarantee:** lives outside the engine `view` sink. Opening/closing never touches the `await` chain. Scrim captures clicks so a tap doesn't advance dialogue underneath. Sub-screens render in the SAME `#phone-overlay`; `onBack` returns to the menu (or fully closes). Recommend a registry: `phone.register(id, renderFn)`.

---

### C3. 친구목록 — `masil_friends`
**Source:** `screens_meta.rpy:8-80` + `systems_extra.rpy:46-61`. **Mount:** phone layer.

**Reads (NEVER render as numbers):** `state.vars.like` (obj), `state.vars.sincere` (obj), `state.vars.doyun_bond` (num), `state.vars.doyun_secret_seen`, `state.vars.mingyeol_truth_known`. Only the `rel_subtitle` text label is shown.

**Panel:** backdrop `#000000cc`; bg `#fffdf7`, pad 30×26, max-width 720, vbox gap 14.
- **Title** `마실 — 친구` size 30 bold color `#2f3447`.
- **Row 1 (pinned):** 도윤 row, key `"doyun"`, with `고정` badge (size 14, color `#2fb574`).
- **Divider:** 1px color `#e6e3da` width 640.
- **Heroine rows:** iterate fixed order `["seoa","jiu","mingyeol"]`; render only if `is_met(k)`; label = `hname(k)`.
- **Easter-egg row:** if `!is_met("mingyeol") && doyun_secret_seen && !mingyeol_truth_known` → render a `???` row.
- **Empty state:** if no heroine met → `아직 도윤 말곤 친구가 없다.` size 17 color `#9aa0b3`. (Drop the Ren'Py `{w=0.0}` tag.)
- **Close:** `닫기` right-aligned size 22 color `#6c7cf0`.

**Friend row (`_friend_row`):** hbox gap 14: `[avatar 54×54] [name-row + subtitle]`.
- Name size 23 bold color `#2f3447`; 도윤 appends `고정` badge.
- Subtitle: `???` → `…누군지 아직 모르는 이름` size 18 color `#8a90a3`; else `rel_subtitle(key)` size 18 color `#8a90a3`.
- Avatar: reuse `CHAT_AVATARS` colored-initial fallback. `???` → bg `#9aa0b3`, initial `?`, color white.

---

### C4. 추억함 — `memory_box`
**Source:** `screens_meta.rpy:140-184`. **Mount:** phone layer.

**Reads:** `state.vars.inventory` (`{iid:count}`), `state.vars.item_flags` (`{"<iid>_given": who}`). From theme: `ITEMS`, `HEROINES`. From systems: `hname`. No new systems/theme needed.

**Panel:** backdrop `#000000cc`; bg `#1f2333`, pad 30×26, max-width 740, vbox gap 14.
- **Title** `추억함` size 30 bold color `#ffffff`.
- **Empty state** (`inventory` empty AND `item_flags` empty): `아직 담긴 추억이 없다.` size 20 color `#9aa0b3`.

**`_mem_row(icon, name, desc, tag)`:** hbox gap 14: icon (emoji) size 32; vbox gap 2: [name size 21 bold `#ffffff` + tag size 15 color `#6c7cf0`]; desc size 16 color `#9aa0b3` max-width 540.

- **Section A — held items** (iterate `inventory`, insertion order): `it = ITEMS[iid]` fallback `{name:iid, icon:"❔", desc:""}`; tag = `간직 중`. Do NOT show count.
- **Section B — given/used flags** (iterate keys ending `_given`): `iid = key.slice(0,-6)`; `it = ITEMS[iid]` (same fallback); `v = item_flags[key]`. `towho`: string in `HEROINES` → `hname(v)`; `"doyun"` → `도윤`; else `""`. tag: `towho` truthy → `→ {towho} 에게`; else → `건넴`.
- Render held items first, then given flags.
- **Close:** `닫기` right-aligned size 22 color `#6c7cf0`.

---

### C5. 갤러리 — `gallery`
**Source:** `screens_meta.rpy:188-225` + `systems_extra.rpy:21-43`. **Mount:** phone layer.

**Reads:** `state.persistent.endings_seen` (array of ending keys, cross-playthrough). From theme: `ENDING_LIST`.

**Panel:** backdrop `#000000dd` (darker than memory_box); bg `#15151f`, pad 32×28, max-width 820, vbox gap 12.
- **Title** `갤러리 — 엔딩 수집` size 30 bold color `#ffffff`.
- **Subtitle** `{seen} / {total} 발견` (format `"%d / %d 발견"`, spaces around `/`) size 18 color `#8a90a3`. `seen = endings_seen.length`, `total = ENDING_LIST.length` (7).
- **Endings list** (iterate `ENDING_LIST`, in order):

| key | title |
|---|---|
| `reconcile` | 용서까지 데려다준 사람 |
| `doyun` | 그날 그 손을 끝까지 |
| `true` | 끝내 건넨 진심 |
| `good` | 서툰 진심 |
| `fishtank` | 모두의, 아무도 아닌 |
| `lonely` | 못다 준 사람 |
| `run` | 다시 혼자 |

  For each `[key, title]`: `seen = endings_seen.includes(key)`. Row hbox gap 12:
  - Bullet: `●` (seen) / `○` (locked); color `#2fb574` / `#555555`; size 20.
  - Label: seen → `title`; locked → `??? — 아직 보지 못한 결말` (verbatim em-dash). Size 20; color `#ffffff` (seen) / `#666666` (locked).
  - **Spoiler guard:** locked NEVER shows the real title.
- **Footer** (branch on `allSeen` = every ENDING_LIST key in endings_seen):
  - allSeen: `★ 모든 결말을 본 당신에게` size 20 bold color `#ffcf5a`; then `도윤: "형, 끝까지 다 봐줬네. …고마워. 진짜로."` size 18 color `#9fe7c2`.
  - else: `CG는 아트 추가 후 여기에 채워집니다.` size 15 color `#8a90a3`.
- **Close:** `닫기` right-aligned size 22 color `#6c7cf0`.

---

### C6. 진단카드 — `result_card`
**Source:** `screens_meta.rpy:94-136` + `systems_extra.rpy`. **Mount:** `#overlay` (story-driven, end-of-run) AND reusable body for phone-menu "진단카드".

**Overlap note:** the existing `result_card` stub in `overlay.js` already renders the `love_type()` part (`당신의 연애 유형` / lt / desc). This **completes** it by adding the stats block + kept-promises.

**Reads:** `love_type()`, `who_remained()`, `heart_vs_like()`, `state.vars.times_ran`, `rel_subtitle("doyun")`, `endings_seen_count()`, `ENDING_LIST.length`, `kept_promises()`.

**Panel:** backdrop `#0b0b12f5`; bg `#1b1f2e`, pad 38×32, max-width 840, vbox gap 12.
- `let [lt, desc] = love_type();`
- Heading `당신의 연애 유형` size 20 color `#8a90a3` centered.
- Type `lt` size 52 bold color `#6c7cf0` centered.
- Desc `desc` size 22 color `#cfd4e6` centered max-width 760.
- **Stats frame** bg `#ffffff12`, pad 22×16, vbox gap 9. Five `_stat_row(label, val)`:
  1. `곁에 남은 사람` → `who_remained()`
  2. `준 마음` → `heart_vs_like()`
  3. `도망친 횟수` → `String(times_ran) + "번"`
  4. `도윤과의 사이` → `rel_subtitle("doyun")`
  5. `본 엔딩` → `` `${endings_seen_count()} / ${ENDING_LIST.length}` ``
- **Kept promises:** `let kp = kept_promises();` if non-empty: header `지킨 약속` size 18 bold color `#2fb574`; each line `· {line}` size 18 color `#cfd4e6`.
- **Share hint** `(이 화면을 캡처해서 공유해 보세요)` size 15 color `#8a90a3` centered.
- **Close:** `닫기` right-aligned size 22 color `#6c7cf0`.

**`_stat_row(label, val)`:** hbox gap 12: label size 18 color `#8a90a3` width 170; value size 19 color `#ffffff` max-width 540.

---

### C7. 도윤 푸시 토스트 — `doyun_push`
**Source:** `screens_meta.rpy:268-298`. **Mount:** `#toast` (top-most). Upgrade existing `overlay.toast` `kind:'doyun'` branch.

**Markup:**
```
<div class="toast-doyun">
  <span class="toast-doyun__chip">도</span>
  <div class="toast-doyun__body">
    <div class="toast-doyun__name">도윤</div>
    <div class="toast-doyun__msg"><!-- escaped msg --></div>
  </div>
</div>
```
- Chip 40×40 `background:#2fb574; color:#fff; font-weight:bold; font-size:20px` centered.
- Card `background:#2f3447f5; padding:14px 18px; max-width:720px; color:#fff`.
- Name `color:#9fe7c2; font-size:16px; font-weight:bold` = `도윤`.
- Msg `font-size:19px; color:#fff; max-width:620px`.
- Slide-in keyframe: from `translateY(-90px); opacity:0` → `translateY(0); opacity:1`, `ease-out 0.32s`.
- Auto-remove at **2800ms** for doyun kind. Non-doyun keeps the plain `.toast-item` path.
- **No tap action** (source is purely informational). Do NOT add tap-to-open.
- `doyun_ping(msg, dur=2.8)` (already in systems.js) plays `audio/se/se_msg_recv.ogg` safe-play, then shows.

---

## (d) NEW systems.js helpers + theme.js constants (verbatim)

### d.1 — `systems.js` state defaults (add first)
```
// per-playthrough (state.vars), autosaved with say
state.vars.times_ran      = state.vars.times_ran      ?? 0;      // 도망친 횟수 (거울 통계용)
state.vars.promise_spring = state.vars.promise_spring ?? false;  // ★맥거핀: 봄 석촌호수 약속

// cross-playthrough (state.persistent) — must survive reset (localStorage)
state.persistent.endings_seen = state.persistent.endings_seen ?? [];  // ending-kind strings
state.persistent.play_count   = state.persistent.play_count   ?? 0;   // 회차 (not read by helpers)
```
> `endings_seen` is written by already-ported `record_ending`; confirm it is PERSISTED (localStorage), not per-session.

### d.2 — `systems.js` helpers to port (1:1, NEW)

**`endings_seen_count()`** (systems_extra.rpy:38-39) — `return (state.persistent.endings_seen || []).length;` (collection tally, NOT a gauge — safe to display).

**`all_endings_seen()`** (systems_extra.rpy:41-43) — `const seen = new Set(state.persistent.endings_seen); return ENDING_LIST.every(([k]) => seen.has(k));`

**`rel_subtitle(who)`** (systems_extra.rpy:46-58) — ★ FRIENDS-LIST CORE. Returns only the label string; thresholds internal; never expose l/s/b.
```
if (who === "doyun") {
  const b = state.vars.doyun_bond || 0;
  if (b >= 25) return "둘도 없는 친구";
  if (b >= 12) return "의지가 되는 동생";
  return "오픈챗 게임 친구";
}
const l = (state.vars.like||{})[who]    || 0;
const s = (state.vars.sincere||{})[who] || 0;
if (s >= 60) return "마음이 닿은 사람";
if (s >= 35) return "조금씩 진심이 오가는";
if (l >= 60 && s < 35) return "잘 보이는 중 (겉도는)";
if (l >= 30) return "점점 친해지는";
if (l > 0 || s > 0) return "이제 막 알게 된";
return "아직 모르는 사이";
```

**`is_met(who)`** (systems_extra.rpy:60-61) — `return ((state.vars.like||{})[who]||0) > 0 || ((state.vars.sincere||{})[who]||0) > 0;`

**`kept_promises()`** (systems_extra.rpy:81-87) — ★ MEMORY/DIAGNOSIS. Returns array (possibly empty):
```
const kept = [];
if (was_given("sakura_card")) kept.push("서아에게 벚꽃 엽서를 건넸다");
if (was_given("warm_can"))    kept.push("지우에게 따뜻한 캔커피를 챙겼다");
if (was_given("hangover"))    kept.push("도윤에게 숙취해소제를 다시 쥐여줬다");
if (state.vars.promise_spring) kept.push("봄에 석촌호수에 가자는 약속을 남겼다");
return kept;
```

**`heart_vs_like()`** (systems_extra.rpy:89-93) — non-numeric summary; sums internal, only phrase returned:
```
const ts = Object.values(state.vars.sincere||{}).reduce((a,b)=>a+b,0);
const tl = Object.values(state.vars.like   ||{}).reduce((a,b)=>a+b,0);
if (ts > tl)       return "진심 > 호감 — 점수보다 마음을 줬다.";
if (tl > ts * 2)   return "호감 ≫ 진심 — 잘 보이는 데 능했다.";
return "호감 ≈ 진심 — 그 사이 어딘가.";
```

**`who_remained()`** (systems_extra.rpy:95-101) — depends on ported `final_ending()` (returns `[kind, who]`) + `hname`:
```
const [kind, who] = final_ending();
if (kind === "doyun")     return "도윤";
if (kind === "reconcile") return "민결, 그리고 도윤";
if (["run","fishtank","lonely"].includes(kind)) return "— (아무도)";
if (who) return hname(who);
return "—";
```

**Already ported — reuse, do NOT re-port:** `love_type`, `hname`, `was_given`, `final_ending`, `record_ending`, `ending_title`, `unlock_station`, item helpers (`has_item`/`get_item`/`give_item`/`item_count`), `doyun_ping`. **`ENDING_LIST` is in theme.js.** No standalone `times_ran()` function — `times_ran` is only a var.

### d.3 — `theme.js` constants to add (verbatim)

**`MAP`** (screens_map.rpy:21-29):
```
export const MAP = {
  bg:        "#f3f1ea",  // 맵 배경 (종이 느낌)
  line:      "#2fb574",  // 2호선 라인
  node_open: "#2fb574",  // 갈 수 있는 역
  node_lock: "#c2c2c2",  // 잠긴 역
  node_here: "#e8553d",  // 현재 위치
  name_txt:  "#2b2b2b",
  title_txt: "#2fb574",
};
```
Other map hex used directly in markup (verbatim): subtitle `#7a7a7a`, locked label `#9a9a9a`, legend text `#5a5a5a`, legend frame bg `#ffffffcc`, bottom bar bg `#ffffff`, current-pos text `#2b2b2b`.

**`STATIONS`** (screens_map.rpy:33-42) — x/y are screen-ratio 0.0–1.0; keep array order:
```
export const STATIONS = [
  { key: "hongdae",  name: "홍대입구", x: 0.30, y: 0.16 },
  { key: "hapjeong", name: "합정",     x: 0.50, y: 0.12 },
  { key: "seongsu",  name: "성수",     x: 0.70, y: 0.16 },
  { key: "konkuk",   name: "건대입구", x: 0.84, y: 0.42 },
  { key: "jamsil",   name: "잠실",     x: 0.78, y: 0.72 },
  { key: "gangnam",  name: "강남",     x: 0.50, y: 0.86 },
  { key: "mullae",   name: "문래",     x: 0.22, y: 0.72 },
  { key: "sinchon",  name: "신촌",     x: 0.16, y: 0.42 },
];
```
**Reuse (no change):** `CHAT_AVATARS`, `HEROINES`, `ITEMS`, `ENDING_LIST`. No new data structures for the meta screens.

---

## (e) Wiring

### e.1 — Map via `call_screen` (story-driven, blocking)
- Engine: `case 'call_screen': await v.callScreen({ name })` (engine.js:78) — unchanged.
- `view_dom.callScreen(a)`: keep `result_card` special-case; for `subway_map` → `await map.show(state.vars.__stations)`. Optionally forward `{ name, stations }`.
- `map.show(stations)` returns a Promise resolved on station tap / 닫기 (Promise-on-close contract identical to current stub → engine `await` unchanged). Return value cosmetic; engine sets the real destination scene next.

### e.2 — Phone button (player-initiated, non-blocking overlay)
- Build `const phone = makePhone(root, { sys, state, theme })` at boot (~view_dom.js:73-78).
- `root.appendChild(phone.button())` — mount ONCE, parallel to engine, live for whole session.
- Button `onclick → phone.open()`.
- Phone uses its OWN `#phone-overlay` (NOT `#overlay`) → never collides with `consult`/`callScreen`/`result_card` promises and never touches the `await` chain. (Alternative: disable button while `#overlay` non-hidden; separate container preferred.)
- Sub-screens register via `phone.register(id, fn)`; `onBack` reopens the menu or closes the layer.

### e.3 — `view_dom` delegation
```
async callScreen(a) {
  if (a.name === 'result_card') { /* existing: compute kind/title/type, render */ }
  else if (a.name === 'subway_map') { await map.show(state.vars.__stations); }
  else { await overlay.callScreen(a); }
}
```

### e.4 — savePersistent on unlocks
- `unlock_station` writes only `state.vars.__stations` (per-playthrough) → rides existing autosave (`saveAuto` on each `say`). **No `savePersistent` needed after station unlocks.**
- Gallery reads `state.persistent.endings_seen` (already in memory, flushed at story end via the existing `state.savePersistent()`). Read-only screens add NO new save calls.
- **If** any meta screen ever unlocks something persistent later → add `state.savePersistent()` at that mutation. Not required for this read-only milestone.

### e.5 — z-order map (Ren'Py → web)
| element | RenPy z | web z-index |
|---|---|---|
| phone button | 26 | 80 |
| phone menu + scrim | 86 | 90 |
| engine `#overlay` modal (consult/result/map) | modal | ensure `> 90` (wins over phone) |
| 도윤 push toast (`#toast`) | 95 | top-most, `>` overlay |

---

## (f) Hard design rules to keep

1. **GAUGE NUMBERS NEVER SHOWN.** Friends list shows ONLY `rel_subtitle` text (the '결' labels). Diagnosis shows ONLY `heart_vs_like()` / `who_remained()` phrases. `like`/`sincere`/`doyun_bond`/`ts`/`tl` are computed internally and never rendered. No debug path may print raw l/s/b/ts/tl to UI. (`endings_seen_count()` is a collection tally, not a gauge — safe.)
2. **도윤 말투:** any 도윤-authored string (push msg, gallery all-seen line) keeps 형 대접 — 해체 OK but no 너/네/니, no ~냐?, no commands, no calling 형 with 야. The all-seen line `도윤: "형, 끝까지 다 봐줬네. …고마워. 진짜로."` is verbatim-correct; do not rewrite.
3. **No late-twist spoilers:** `???` friend row shows `…누군지 아직 모르는 이름`, never the real name while `!mingyeol_truth_known`. Gallery locked endings show `??? — 아직 보지 못한 결말`, never the real title. Do not surface 민결/도윤 past anywhere player-facing.
4. **Safe-play:** all SE (`se_station.ogg`, `se_msg_recv.ogg`) and any future audio are no-op if asset missing. Emoji icons + colored-initial avatars are placeholder-safe; backgrounds stay `Solid()`.
5. **innerHTML escaping:** every dynamic value (item names, msg text, station names, hname output) inserted via `textContent` or an escape helper — never raw template-string interpolation into innerHTML.

---

## (g) Task breakdown + DEFER

**Order: systems → theme → each UI module → wiring → grounding.**

1. **T1 — systems.js additions:** 2 var defaults + 2 persistent defaults; port 7 helpers (d.1, d.2). Node test each helper with seeded `state` (verify exact label strings + gauge-leak-free).
2. **T2 — theme.js additions:** `MAP`, `STATIONS` (d.3). Node test: STATIONS order/keys, MAP keys present.
3. **T3 — map.js** (`makeMap`) + `.subway-map*` CSS. Screenshot: jamsil+sinchon open by default, locked stations gray, 닫기 resolves.
4. **T4 — friends sub-screen** (`masil_friends`) + CSS. Screenshot: 도윤 pinned + `고정`, met heroines only, empty state, `???` easter-egg, NO numbers visible.
5. **T5 — memory_box** + CSS. Screenshot: held items (no count), given flags `→ X 에게` / `건넴`, empty state.
6. **T6 — gallery** + CSS. Screenshot: seen vs `??? — 아직 보지 못한 결말`, `n / 7 발견`, all-seen footer.
7. **T7 — result_card completion** (stats + kept-promises) + CSS. Screenshot: 5 stat rows, kept-promises, no gauge numbers.
8. **T8 — phone.js menu/button** + CSS; doyun_push toast upgrade + CSS keyframe. Screenshot: button top-right, menu labels verbatim, push card.
9. **T9 — wiring:** view_dom delegation (subway_map → map.show), mount phone button, register sub-screens, z-order. Screenshot: open phone mid-dialogue without advancing it; map blocks engine then continues.
10. **T10 — grounding pass:** run all node tests; full headless-Chrome screenshot sweep with seeded states; honestly report "런처 Build → lint + play still required" since no SDK here.

**DEFER:**
- Real backgrounds, CG art (gallery placeholder line stays), real avatar images, real SE assets.
- Backdrop-click / Esc dismissal niceties (Ren'Py used explicit-close `modal True`; matching close-button-only is fine — add later if desired).
- `current_station` persistence across episodes (module-local default `"jamsil"` is enough for M3).
- Tap-to-open-chat on doyun push (not in source — additive, later).
- Any new gameplay system. `play_count` increment logic (var exists; not read by M3 helpers).
