<!-- FABLIZE:BEGIN — run Opus like Fable (always-on router). Verified procedures only. Install/update: fablize setup.sh -->
## Operating mode (always on — auto-route by task signal)

Apply what the task signals; with no signal, baseline only. Read each pack only when needed. Routing: smallest matching discipline only, overlap only when genuinely multi-category, mimic observable behavior only.

- **[always]** Lead with the outcome · stay within the requested scope (no incidental refactors) · ground completion claims in this session's tool results · confirm before destructive or hard-to-reverse actions.
- **[2+ sequential stories]** Run `python3 C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/scripts/goals.py`: create → next → checkpoint (with evidence) → final verification gate (no completion without `--verify-cmd` and `--verify-evidence`). Run from the repo root; state in `./.fablize/` (resume with `status`). Skip for single-step tasks.
- **[debugging / test failure / unknown cause / review]** Follow `C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/packs/investigation-protocol.txt`: reproduce first → 3+ competing hypotheses → evidence per hypothesis → full causal chain → verify before/after → report rejected hypotheses.
- **[render/executable artifact: HTML, SVG, game, UI, chart]** Follow `C:/Users/ckato/.claude/plugins/cache/fablize/fablize/2.0.0/packs/verification-grounding-pack.txt` grounding loop: run it in the real renderer → observe the output → fix what you see → re-run. A static check is not observation.
- **[hard or ambiguous task]** Adaptive thinking scales with difficulty automatically. To go higher, recommend `/effort xhigh` to the user. Depth (capability) cannot be raised: if stuck 2+ times or out-of-spec discovery is needed, report the limit honestly and escalate.
<!-- FABLIZE:END -->

# CLAUDE.md — 오픈챗 VN 작업 지침

Ren'Py 비주얼노벨 *(가제) 오픈챗에서 만나요*. 이 폴더의 `.rpy` 들은 Ren'Py 프로젝트의 `game/` 에 들어가는 구성. 개요·실행법은 `README.md` 참조. 이 문서는 **코드를 고칠 때의 규칙**.

## 환경 (먼저 알 것)
- **이 머신엔 Ren'Py SDK가 없다 → 실행/lint 불가.** 변경은 정적으로 검증하고, "실행/검증은 런처에서 `Build → lint` + 플레이 필요"라고 정직하게 고지할 것. 됐다고 단정하지 말 것.
- **진입점:** `label episode1_full` (ep1) → ep2→ep3→ep4→epilogue 가 `jump` 체인. 실제 프로젝트엔 `label start: jump episode1_full` 가 **활성**이어야 함(현재 스크립트엔 주석 처리됨 — 부팅 차단 요인).
- **Windows 콘솔(cp949) 주의:** 파이썬 헬퍼는 `PYTHONUTF8=1 python3 -X utf8` 로 돌리고, 출력은 콘솔 대신 **파일로 받아 Read**. 한글 경로/✓ 출력에서 깨진다.

## 절대 원칙 (어기면 작품이 망가짐)
1. **진심 게이지 ≠ 점수.** 호감/진심/우정 수치는 **노출 금지**(`show_gauges=False`). 새 장치는 "정답이 하나"가 되면 안 됨 — 진심은 비싸고 되돌릴 수 없게. 피드백은 도윤의 말·친구목록의 '결' 같은 **비수치**로.
2. **포지셔닝:** 이건 "여러 여자 썸" 게임이 아니라 **우정·진심(도윤) 이야기**. 헷갈리면 주제(우정/진심) 편을 든다. 연애는 소재.
3. **플레이어 대면 텍스트엔 후반 반전(민결·도윤 과거)을 스포하지 말 것.**

## 도윤 말투 (자주 틀리는 부분 → `/vn-voice`)
도윤=21살 동생, 주인공=24살 **형**. 도윤은 능청·장난기 있지만 **형 대접** 필수.
- 해체(반말)는 OK. 단 **"너/네/니"→"형"**, **"~냐?"→"형 ~해?"**, **명령형(~라/받어)→부탁·청유**, **"야"로 형 부르기 금지**, 형 호칭 살리기.
- **반대로 MC→도윤 반말("자냐 인마")은 정상 → 고치지 말 것.** 고칠 대상은 `d "..."` / `recv(...,name="도윤")` / `doyun_line`·`_doyun_read`·`doyun_ping` 의 도윤 말뿐.

## 파일 지도
- **본편:** `script_ep1~4.rpy`, `script_epilogue.rpy` (한국어 대사). 캐릭터: `n`(나레이션) `mc`(나) `d`(도윤) `s`(서아) `j`(지우) `m`(민결).
- **UI:** `screens_chat`(마실 채팅) · `screens_map`(2호선) · `screens_meta`(친구목록/진단카드/추억함/갤러리/폰메뉴/도윤푸시).
- **시스템:** `systems_affection`(게이지·도윤상담·`final_ending`) · `systems_items`(아이템) · `systems_reply`(답장 타이밍 `reply_prompt`) · `systems_extra`(관계라벨·진단·통계·엔딩수집·맥거핀).
- **연출/설정:** `effects`(안전 사운드·트랜지션·`amb`채널) · `config_web_mobile`(웹/모바일·`scene black` 안전장치).

## 코드 컨벤션
- **새 기능은 가급적 새 `.rpy` 로 추가**(기존 본편 스크립트 최소 수정 = 위험 최소). 본편엔 얇게 `call`/`$` 로만 연결.
- 사운드/이미지는 **safe-play**: 에셋 없어도 무음/통과(`pmusic/psound/pamb`, 프사 자동연결). 배경은 `Solid()` placeholder 상태.
- 헬퍼: `recv/send`(채팅), `pmusic/psound/pstop/pamb`(effects), `get_item/give_item/has_item/use_item/was_given`(items), `add_like/add_sincere/unlock_station/chapter_start/consult_doyun/final_ending/record_ending`.
- 편집 시 `{w=}`·`{p}`·`.format()`·들여쓰기(메뉴 4/8/12)·따옴표 구조 보존. Python2 금지(`basestring`✗ → `str`).

## 스토리/구조 감각
- 흐름: 매 화 [텍스팅 인터루드 → 도윤 콜백 → 만남 → 장소 분기 → 선택 → wrap+도윤 피드백]. 4화 반복이라 한 화는 의도적으로 변주.
- 엔딩 7종은 `final_ending()`(`ep4_choice`·`doyun_bond`·게이지) → 에필로그 분기. 추가 엔딩 손대면 `final_ending`·에필로그·`ENDING_LIST`(systems_extra) 셋을 같이 맞출 것.
- 분량 균형은 `/vn-stats` 로 실측. 보강은 가장 얇은 본편부터.

## 작업 스킬 (프로젝트 루트 `.claude/skills/`)
- `/vn-stats` — 분량·균형 측정 / `/vn-voice` — 도윤 말투 린트 / `/vn-lint` — Ren'Py 정적 점검(부팅 버그) / `/vn-assets` — 에셋 감사.

## 스코프
첫 작품. **"완성이 제일 어렵다"** — 흐름 완성 → 에셋 교체 순서. 큰 신규 시스템(예: 주말 시간 배분)은 완성을 위협하면 보류/단계화.

## 웹 배포
GitHub→Vercel(`웹배포가이드_github_vercel.md`). **gui.rpy에 한글 폰트 내장 필수**(웹 한글 깨짐), 권장 해상도 1280×720, `vercel.json`(COOP/COEP).
