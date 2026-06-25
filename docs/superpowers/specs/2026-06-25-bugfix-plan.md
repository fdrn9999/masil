# Bugfix Plan — 오픈챗 VN web app (2026-06-25)

Six diagnosed bugs (A–F), synthesized into one implementation-ready, conflict-aware plan.
Target: `web/` vanilla-JS VN export. **Hard rules**: no build step / no new bundling beyond
the existing native ES-module imports already in `web/src/ui/*.js`; pastel design tokens
(`--ink`, `--font-display`, `--r-pill`, glass look) reused; escape all story text before HTML;
overlays stay non-blocking with leak-free Escape/cleanup; gauge numbers stay hidden; do not
regress existing skip/auto/menu/chat/overlay behavior.

Paths below are relative to repo root
`C:/Users/JinhoLap/Documents/renPy로 비주얼노벨 만들기/renPy로 비주얼노벨 만들기/`.

---

## Cross-cutting design decisions (decide once, apply across bugs)

1. **A single canonical z-index ladder.** After all fixes the ladder is:
   `#stage/#textbox = 0` → `#chat = 50` → `#choices = 60` (NEW, Bug B) → `#advance-cue = 65`
   (NEW, Bug F) → `#overlay = 70` → `#backlog = 75` → `.phone-btn/.settings-btn = 80` →
   `.ph-layer/#toast = 90` → `.map-panel ≤120` → `#title-layer = 200` → **modal tier**
   `.st-layer = 210`, `.sl-layer = 220` (NEW, Bug A). Anything new must slot into this ladder.
   Reserve **230+** for any future popup that must layer over settings/saveload.

2. **One shared text-tag renderer** (`web/src/ui/tags.js`, Bug C) used by **both** stage and
   chat. No per-surface escaping/tag logic. Escape → render `{i}`/`{p}` → strip all other
   `{…}`. Brackets (`[var]`, `[[`) are NOT touched here (handled upstream in `engine.interp`).

3. **One unified advance surface + blinker** (Bug F): a single `#game`-level click-catcher with
   an `isUiClick()` gate that must NOT swallow clicks meant for menus/overlays/phone/settings/
   sysmenu/saveload/backlog/title/floating-buttons, plus a `pointer-events:none` `#advance-cue`
   pill. This must be built **after** Bug B (so `#choices` is in the gate) and is the same
   `say()`/`waitAdvance()` code that Bug E rewrites — see conflict map.

4. **Modal/cue z-tiers respect the title.** The Bug A modal tier (210/220) sits above title
   (200); the Bug F cue (65) sits below overlays (70) so it can never cover a modal.

---

## BUG A — Title popups (설정 / 불러오기) invisible & unclickable until in-game

- **Root cause:** `#title-layer` is the single topmost layer at `z-index:200`
  (`web/style.css:1225`). Settings (`.st-layer` z90, `web/style.css:1011`) and saveload
  (`.sl-layer` z95, `web/style.css:1391`) render UNDER it. `onLoad`/`onSettings` in
  `web/src/ui/view_dom.js:330-340` open those panels but never call `title.hide()` (unlike
  `onNew`/`onContinue` at 310/321), so they paint behind the opaque full-viewport title and are
  pointer-blocked. After entering the game `title.hide()` sets `display:none`, so the panels
  become topmost — matching "only touchable after entering the game."
- **Exact fix (CSS only):**
  - `web/style.css:1011` `.st-layer` → `z-index: 210;` (was 90)
  - `web/style.css:1391` `.sl-layer` → `z-index: 220;` (was 95)
  - Both layers stay `pointer-events:none` while `.hidden`, so raising z-index does NOT block
    title buttons while closed. Optionally fix stale comments at `:1225` / `:1384`.
- **Files:** `web/style.css` only.
- **Data change?** No.
- **Verify:** `cd web && python3 -m http.server 8000` → on TITLE (before 새로하기/이어하기) click
  설정 (sliders/toggles/close respond) and 불러오기 (slots/닫기/Escape respond); closing returns to
  the still-present title.
- **Regression watch:** in-game both panels now sit above all game UI (correct, they are modal
  scrims). Save-toast (`#toast` z90) renders behind the open save panel — pre-existing
  (was z95>90), out of scope.

---

## BUG B — Menu softlock at 서아 석촌호수 벚꽃 프사 (Ep.1, + 6 more in-chat menus)

- **Root cause:** z-index stacking. A `menu` op fires while the chat is open
  (`web/data/story.json`: `chat_open` ~566 → `menu` at line 888 → `chat_close` at 949).
  `web/src/ui/menu.js:7-8` only un-hides `#choices`; it never raises it or closes chat.
  `#choices` (`web/style.css:134-146`) has **no z-index** (=auto/0) while `#chat`
  (`web/style.css:179-183`) is opaque `inset:0` at `z-index:50`, so choices paint behind chat
  and chat intercepts all taps → the menu Promise never resolves → softlock.
- **Exact fix (one line CSS):** in `#choices` rule (`web/style.css:134-146`) add
  `z-index: 60;` (above chat 50, below overlay 70). Fixes all 7 in-chat menus at once.
- **Files:** `web/style.css`.
- **Data change?** No (the in-chat menu placement in `story.json` is intentional; do NOT
  restructure nodes).
- **Verify:** play Ep.1 → 서아 개인톡 → 벚꽃 사진 → two pastel choices appear over chat and are
  clickable, selecting advances (sincere/like change → `chat_close` → narration). Re-check the
  other 6: Ep1 nodes 132,133,166; Ep3 401,410; Ep4 516,517.
- **Regression watch:** keep `#choices` strictly < 70 — do NOT push to ≥70 or it covers
  `#overlay` modals (consult/input/result card). Menus that fire while chat is closed still work
  (nothing opaque above choices). 60 is the only correct band.

---

## BUG C — Ren'Py text tags shown literally (e.g. `{size=50}`)

- **Root cause (two defects):**
  1. `web/src/ui/stage.js:58-64` `renderTags()` strips only `{w=…}`,`{p}`,`{i}`,`{/i}` — it
     leaks `{size=N}`/`{/size}` (6+6 occurrences on `say` ops in `story.json`) and any future
     `{b}`/`{cps}`/`{color}` etc.
  2. `web/src/ui/chat.js` `recv` (line 47) / `send` (line 59) build bubbles with `escapeHtml`
     only and never call any tag renderer, so ANY brace tag in a chat bubble renders literally
     (latent today, same bug class).
- **Exact fix (shared renderer):** new `web/src/ui/tags.js` exporting `renderTags` + `escapeHtml`:
  escape FIRST, then `{i}`→`<em>` / `{/i}`→`</em>` / `{p}`→`\n`, THEN
  `.replace(/\{[^{}]*\}/g, '')` to strip all remaining control tags (use `[^{}]*`, NOT `.*`, to
  stay local; run strip AFTER `{i}`/`{p}`). Then:
  - `stage.js`: delete local `escapeHtml` (54-57) + `renderTags` (58-64); `import { renderTags }
    from './tags.js';`. Call at line 95 unchanged.
  - `chat.js`: `import { renderTags, escapeHtml } from './tags.js';`; delete local `escapeHtml`
    (line 73); change bubble bodies at lines 47 & 59 from `escapeHtml(text)` → `renderTags(text)`.
    Keep `escapeHtml(name)`/`escapeHtml(room)` as-is.
- **Files:** new `web/src/ui/tags.js`; `web/src/ui/stage.js`; `web/src/ui/chat.js`;
  (optional) `web/style.css` if `.bubble` ever needs `white-space:pre-wrap`.
- **Data change?** No (strip is the correct behavior for cosmetic tags on web).
- **Verify:** `renderTags("{size=50}Ep.1{/size}")`→`"Ep.1"`;
  `renderTags("{w=0.4}안녕{p}다음{i}강조{/i}")`→`"안녕\n다음<em>강조</em>"`;
  `renderTags("값은 [name]")`→`"값은 [name]"` (brackets untouched). In-app: Ep.1 title card +
  epilogue lines show no literal `{size…}`.
- **Regression watch:** never feed `renderTags` pre-escaped/HTML text (both call sites pass raw
  story text — OK). `[var]`/`[[` live in `engine.interp`, untouched. `{p}`→`\n` in a bubble
  collapses without `white-space:pre-wrap` on `.bubble` (`web/style.css:233`); add only if/when a
  chat line uses `{p}` (none today). `#line` already has `pre-wrap`.

---

## BUG D — Mobile portrait (9:16): floating UI covers chat/dialogue

- **Root cause:** no portrait media query for in-game controls. `#chat` is full-screen
  (`web/style.css:179-183`) but `chatOpen` (`web/src/ui/view_dom.js:120-123`) never hides the
  floating controls (mounted once in `mountGameButtons()`, `view_dom.js:228-232`):
  1. `#sysmenu-bar` (`web/style.css:1626-1641`) is `bottom:calc(26% + 14px)` anchored to the
     textbox; in chat mode textbox is hidden so the ~338px-wide bar lands mid-chat-log over
     bubbles and clips the right edge at `right:10px` on ~414px phones.
  2. `.settings-btn`/`.phone-btn` (`web/style.css:649-653`, `986-990`) at `top:3.5%` (~28px,
     height 42 → y28–70) overlap the 64px chat topbar (`#chat .topbar`, `web/style.css:189`).
- **Exact fix (additive CSS at end of `web/style.css`, after line 1618):** add
  `@media (orientation: portrait)` block: center+shrink `#sysmenu-bar` (`left:50%;
  transform:translateX(-50%); max-width:calc(100% - 16px); justify-content:center`), shrink
  `.sm-btn` to 28px, bottom-dock the bar in chat mode via
  `#game:has(#chat:not(.hidden)) #sysmenu-bar{ bottom:8px; }` + `#chat .log{ padding-bottom:56px; }`,
  and `.settings-btn,.phone-btn{ top:72px; }` to clear the topbar. (Full block in Diagnosis 4.)
- **Files:** `web/style.css`.
- **Data change?** No.
- **Verify:** Chrome device mode 414×896 portrait → reach a chat interlude: bar is a small
  centered bottom strip fully on-screen, no bubble under it, ⚙️/📱 under the topbar; in normal
  dialogue the bar floats just above the textbox; landscape PC 16:9 unchanged.
- **Regression watch:** `:has()` needs a modern WebView — if the export targets an older one,
  drop that one selector and always `bottom:8px` in portrait (fallback in Diagnosis 4). Tune
  `padding-bottom`/button size if glyphs cramp (raise to 30px + `flex-wrap:wrap`).

---

## BUG E — Auto (and Skip toggle UX) don't advance the current say line

- **Root cause (two coupled defects in `web/src/ui/stage.js` `say()`, lines 86–134):** the
  auto/skip loop itself works (proved headless); the **toggle path** is broken.
  1. `say()` picks its branch once at start (skip:118 / auto:123 / normal:128). A line already on
     screen in normal mode is parked in the `else` branch with only a click/keydown listener and
     no timer, so toggling 오토 mid-line (`sysmenu.js:56-59` flips `playback.mode`) is never noticed
     — the line looks dead.
  2. The advancing click the player then makes hits
     `if (fromClick && (isSkip()||isAuto())) playback.setMode('normal')` (`stage.js:107-109`),
     which — because mode is now auto — turns auto OFF. So clicking the button is ignored, and the
     wake-up click cancels auto.
- **Exact fix:** replace `say()` body (lines ~90–133) with a version that arms one click/keydown
  listener always and drives auto/skip from a re-checking `setTimeout(tick, 80)` that re-reads
  `playback.isAuto()/isSkip()` each tick (auto delay measured from `startedAt` via
  `playback.autoDelay(a.text)`). A deliberate click during auto/skip still resets to normal AND
  advances (preserves "click stops auto"). Full drop-in in Diagnosis 5.
- **Files:** `web/src/ui/stage.js` (read-only deps: `web/src/playback.js`, `web/src/ui/sysmenu.js`).
- **Data change?** No.
- **Verify:** click 오토 on a live line → it advances within ~1s and keeps advancing every
  `700+len*45`ms with the button lit; one textbox click stops auto. 스킵 blows through at
  ≤80ms; a `menu` halts (no auto-pick).
- **Regression watch:** one pending timer per awaiting line (cleared in `cleanup()` on every
  resolve). Skip mid-line granularity becomes ≤80ms (lines entered already-in-skip finish on the
  first synchronous tick ~0ms). Menus/chat untouched. **This same `say()`/`waitAdvance()` code is
  rewritten by Bug F — coordinate (see conflict map).**

---

## BUG F — Inconsistent advance affordance + no "tap to continue" feedback

- **Root cause:** three different advance surfaces. `say()` binds advance to `#textbox`
  (`web/src/ui/stage.js:120/125/130`, `box`); `waitAdvance()` binds to `#stage`
  (`web/src/ui/stage.js:142`, routed from `view_dom.js:140`); `chat.waitTap()` binds to `#chat`
  (`web/src/ui/chat.js:65-70`, routed from `view_dom.js:137-138`). On a blank/white-flash beat the
  textbox is empty so only `#stage` is tappable → "tap the screen, not the box." No
  "tap to continue" indicator exists anywhere.
- **Exact fix (two parts):**
  - **Unify target with a gated catcher.** In `stage.js` capture `const game = root;`, create a
    `pointer-events:none` `#advance-cue` div appended to `#game`, and add
    `isUiClick(target)` = `target.closest('#choices, #overlay, #chat, #toast, #title-layer,
    #sysmenu-bar, #backlog-layer, .ph-layer, .st-layer, .sl-layer, .phone-btn, .settings-btn')`.
    Route `say()`'s normal-mode wait and `waitAdvance()` to listen on `game` with `onAdv` early-
    returning when `isUiClick(e.target)`; show the cue while waiting in normal mode + in
    `waitAdvance()`, hide it as the first line of `finish()`/on resolve. Apply the same cue
    show/hide to `chat.waitTap()`.
  - **Blinking pastel pill.** `.advance-cue` CSS in `web/style.css` (near textbox, after line
    131): `position:absolute; right:22px; bottom:calc(26% + 18px); z-index:65;
    pointer-events:none;` pastel glass pill, `@keyframes cue-pulse`, `prefers-reduced-motion`
    handled. Text `▼ 클릭/터치하면 다음`. (Full CSS in Diagnosis 6.)
- **Files:** `web/src/ui/stage.js`, `web/src/ui/chat.js`, `web/style.css`.
- **Data change?** No.
- **Verify:** normal dialogue advances by tapping anywhere (box or upper stage), pill pulses while
  waiting and vanishes on advance; white-flash beat advances on a blank-screen tap and shows the
  cue; at a choice menu / consult / map / phone / settings / sysmenu / saveload / backlog the cue
  is hidden and clicks DON'T advance the line beneath; Auto/Skip show no cue and advance on timer
  (one click cancels); Enter/Space still work.
- **Regression watch:** `isUiClick` selector must list every blocking layer (current set verified
  complete; map lives inside `#overlay`, saveload inside `.sl-layer` — covered transitively). Cue
  is `pointer-events:none` so it can't block choice/sysmenu clicks. Auto/skip click-cancel path
  (`stage.js:107-109`) preserved. **Depends on Bug B** (so `#choices` exists in the gate) and
  **shares the `say()` rewrite with Bug E.**

---

## Shared-file conflict map

| File | Bugs touching it | Nature | Merge note |
|------|------------------|--------|------------|
| `web/style.css` | **A, B, C(opt), D, F** | Mostly disjoint regions | A: `.st-layer`(1011)/`.sl-layer`(1391). B: `#choices`(134). D: new `@media portrait` block at EOF. F: new `.advance-cue` block near 131. C(opt): `.bubble`(233). All different line ranges → low conflict; **but all change the z-ladder** — apply the unified ladder from Cross-cutting #1 so 60(choices)/65(cue)/210/220 stay coherent. |
| `web/src/ui/stage.js` | **C, E, F** | **HIGH conflict — same `say()` body** | C removes local `escapeHtml`/`renderTags` (54-64) + adds import. E rewrites `say()` body (90-133). F adds `game`/`#advance-cue`/`isUiClick`/cue + reroutes `say()`+`waitAdvance()` listeners to `game`. **Must be merged into ONE rewrite**, not three sequential edits. Build the final `say()` once: imported `renderTags` (C) + tick-poll auto/skip (E) + game-level gated listener & cue (F). |
| `web/src/ui/chat.js` | **C, F** | Adjacent, different methods | C: imports + `recv`/`send` bubble bodies + delete local `escapeHtml`(73). F: `waitTap()`(65-70) cue show/hide. Different functions → mergeable; do C's import line edit once. |
| `web/src/ui/view_dom.js` | (read-only for E/F routing) | none | No edits required; referenced only for `pause`/`chatOpen` routing. |
| `web/data/story.json` | — | **No data changes in any bug.** | All six fixes are code/CSS only. |
| new `web/src/ui/tags.js` | C | new file | Imported by stage.js + chat.js. |

**Key collision:** `stage.js` `say()` is edited by C, E, and F. Do **not** stage these as three
patches. Implement Bug E's tick-poll rewrite as the base, then fold in F's `game`-level gated
listener + cue calls + `waitAdvance()` unification, and use C's shared `renderTags` for the
`lineEl.innerHTML` line. One coherent `say()`/`waitAdvance()` block ships all three.

---

## Recommended implementation order

1. **Bug C** (shared `tags.js` + stage/chat imports) — establishes the shared renderer that the
   stage.js merge needs; isolated and testable first.
2. **Bug A** (CSS z-tier 210/220) — pure CSS, no JS overlap, unblocks title popups.
3. **Bug B** (`#choices` z-index 60) — pure CSS, one line; **must precede F** (F's `isUiClick`
   gate assumes `#choices` is a real layer in the ladder).
4. **Bug E** (stage.js `say()` tick-poll rewrite) — the base for the stage.js merge; fixes
   auto/skip toggle. Build on top of C's import.
5. **Bug F** (unified `#game` gated catcher + `#advance-cue` + `waitAdvance`/`waitTap` cue) —
   folded into the E rewrite (same `say()`), plus chat.js `waitTap` + `.advance-cue` CSS. Comes
   last among JS because it depends on B (gate) and shares code with E.
6. **Bug D** (portrait `@media` block) — additive CSS, independent; do last so the cue/sysmenu
   positions from F are known when tuning portrait offsets.

After each step: `cd web && python3 -m http.server 8000` and run that bug's Verify. After F,
re-run the full menu/overlay/auto/skip regression sweep. SDK/Ren'Py lint is unavailable on this
machine — the browser playthrough is the verification.

---

**Spec path:** `C:/Users/JinhoLap/Documents/renPy로 비주얼노벨 만들기/renPy로 비주얼노벨 만들기/docs/superpowers/specs/2026-06-25-bugfix-plan.md`
