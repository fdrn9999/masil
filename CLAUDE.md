<!-- FABLIZE:BEGIN — run Opus like Fable (always-on router). Verified procedures only. Install/update: fablize setup.sh -->
## Operating mode (always on — auto-route by task signal)

Apply what the task signals; with no signal, baseline only. Read each pack only when needed. Routing: smallest matching discipline only, overlap only when genuinely multi-category, mimic observable behavior only.

- **[always]** Lead with the outcome · stay within the requested scope (no incidental refactors) · ground completion claims in this session's tool results · confirm before destructive or hard-to-reverse actions.
- **[2+ sequential stories]** Run `python3 C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/scripts/goals.py`: create → next → checkpoint (with evidence) → final verification gate (no completion without `--verify-cmd` and `--verify-evidence`). Run from the repo root; state in `./.fablize/` (resume with `status`). Skip for single-step tasks.
- **[debugging / test failure / unknown cause / review]** Follow `C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/packs/investigation-protocol.txt`: reproduce first → 3+ competing hypotheses → evidence per hypothesis → full causal chain → verify before/after → report rejected hypotheses.
- **[render/executable artifact: HTML, SVG, game, UI, chart]** Follow `C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/packs/verification-grounding-pack.txt` grounding loop: run it in the real renderer → observe the output → fix what you see → re-run. A static check is not observation.
- **[hard or ambiguous task]** Adaptive thinking scales with difficulty automatically. To go higher, recommend `/effort xhigh` to the user. Depth (capability) cannot be raised: if stuck 2+ times or out-of-spec discovery is needed, report the limit honestly and escalate.
<!-- FABLIZE:END -->

# CLAUDE.md — 오픈챗 VN 작업 지침 (웹 전용)

비주얼노벨 *(가제) 오픈챗에서 만나요* 의 **자체 웹앱**. (원래 Ren'Py였으나 빌드 없는 정적 웹으로 전환 완료 — Ren'Py 코드/변환기는 제거됨.) 개요·실행법은 `README.md`. 이 문서는 **코드를 고칠 때의 규칙**.

## 환경 (먼저 알 것)
- **빌드 없음·외부 의존성 0.** 브라우저가 `web/`의 ES 모듈을 직접 로드. 번들러/npm install 금지.
- **테스트:** Node 내장 러너 — `node --test test/*.test.js` (repo 루트). `node --test test/`(디렉터리형)는 이 환경에서 실패하니 글롭/파일명 사용.
- **콘텐츠 소스:** `web/data/story.json`(전체 스토리 노드 배열) + `web/data/characters.json`. **대사 수정은 story.json을 직접 편집**(Ren'Py 대본은 더 이상 없음 — 옛 버전은 git 히스토리에).
- **렌더 검증:** UI 변경은 헤드리스 Chrome 스크린샷으로 실제 관찰(grounding). 정적 점검은 관찰이 아님.
- **Windows 콘솔(cp949) 주의:** 헬퍼는 `PYTHONUTF8=1 python3 -X utf8`, 출력은 파일로 받아 Read. 한글에서 깨진다.

## 절대 원칙 (어기면 작품이 망가짐)
1. **진심 게이지 ≠ 점수.** 호감/진심/우정 수치는 **노출 금지**. 새 장치는 "정답이 하나"가 되면 안 됨 — 진심은 비싸고 되돌릴 수 없게. 피드백은 도윤의 말·친구목록의 '결' 같은 **비수치**로. (story.json 텍스트에 `[*_like]`/`[*_sinc]`/`[doyun_bond]` 같은 수치 보간이 새지 않게.)
2. **포지셔닝:** "여러 여자 썸" 게임이 아니라 **우정·진심(도윤) 이야기**. 헷갈리면 주제(우정/진심) 편. 연애는 소재.
3. **플레이어 대면 텍스트엔 후반 반전(민결·도윤 과거)을 스포하지 말 것.**

## 도윤 말투 (자주 틀리는 부분)
도윤=21살 동생, 주인공=24살 **형**. 도윤은 능청·장난기 있지만 **형 대접** 필수.
- 해체(반말)는 OK. 단 **"너/네/니"→"형"**, **"~냐?"→"형 ~해?"**, **명령형(~라/받어)→부탁·청유**, **"야"로 형 부르기 금지**, 형 호칭 살리기.
- **반대로 MC→도윤 반말("자냐 인마")은 정상 → 고치지 말 것.** 고칠 대상은 story.json의 `{"who":"d", ...}` say, `{"op":"recv","name":"도윤"}`, 그리고 `systems.js`의 `doyun_line`/`_doyun_read` 도윤 말뿐.

## 파일 지도 (`web/`)
- **콘텐츠:** `data/story.json`(전체 스토리·730노드·40라벨) · `data/characters.json`. 캐릭터: `n`(나레이션) `mc`(나) `d`(도윤) `s`(서아) `j`(지우) `m`(민결).
- **엔진:** `src/engine.js`(노드 상태머신) · `src/state.js`(상태+localStorage 세이브) · `src/eval_expr.js`(조건/식 평가 `V/S/P` 스코프).
- **시스템:** `src/systems.js`(게이지·아이템·`final_ending`/`decide_ending`·도윤 상담·`apply_timing`·`record_ending`·`love_type`) · `src/theme.js`(테마·아이템·`ENDING_LIST` 상수).
- **UI:** `src/ui/stage.js`(배경·대사) · `chat.js`(마실 채팅) · `menu.js`(선택지·입력) · `overlay.js`(상담·토스트·맵 스텁·result_card) · `view_dom.js`(부팅·엔진↔DOM 배선).

## 코드 컨벤션
- **새 기능은 새 모듈로** 추가하고 본편 데이터는 얇게 연결. 한 파일 = 한 책임.
- 사운드/이미지는 **safe-play**: 에셋 없어도 무음/단색/이니셜로 통과. 배경은 `Solid()` 대체 색 상태.
- **innerHTML에 들어가는 동적 값(특히 플레이어 닉네임 `mc_name`)은 반드시 escape.**
- 텍스트 태그 `{w=}`·`{p}`·`{i}` 와 보간 `[var]`/`[[` 규칙 보존. ES 모듈(브라우저 직접 로드) 유지.

## 스토리/구조 감각
- 흐름: 매 화 [텍스팅 인터루드 → 도윤 콜백 → 만남 → 장소 분기 → 선택 → wrap+도윤 피드백]. 4화 반복이라 한 화는 의도적으로 변주.
- 엔딩 7종은 `final_ending()`(`ep4_choice`·`doyun_bond`·게이지) → 에필로그 분기. 손대면 `systems.js`의 `final_ending`/`decide_ending` · story.json 에필로그 분기 · `theme.js`의 `ENDING_LIST` 셋을 같이 맞출 것.

## 스코프
첫 작품. **"완성이 제일 어렵다"** — 흐름 완성 → 에셋 교체 순서. 큰 신규 시스템은 완성을 위협하면 보류/단계화.

## 웹 배포
GitHub→Vercel. **Root Directory = `web/`**, 빌드 없음, 정적 서빙(`web/vercel.json`). 한글 폰트(Pretendard)는 `web/fonts/`에 내장(`@font-face`) — CDN 의존 없이 모바일/오프라인 안정.
