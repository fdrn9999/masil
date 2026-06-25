# 오픈챗에서 만나요 — 웹 포트

Ren'Py 비주얼노벨 *오픈챗에서 만나요* 의 웹 버전. 현재 **전체 스토리(프롤로그 → Ep1~4 → 에필로그 → 7엔딩)** 플레이 가능.

## 로컬 실행

```bash
cd web
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

## Vercel 배포

- Vercel 프로젝트 루트를 `web/` 폴더로 지정
- 빌드 없음, 정적 서빙만
- `vercel.json` 이 이미 포함돼 있음 (`cleanUrls: true, trailingSlash: false`)

## 한글 폰트

Pretendard Variable 웹폰트를 자체 호스팅 중 (`web/fonts/PretendardVariable.woff2`, ~2 MB).
`style.css` 상단의 `@font-face` 블록이 이를 로드하며, CDN 의존 없이 오프라인/Vercel 배포 모두 동작.
라이선스: SIL OFL 1.1 — `web/fonts/OFL.txt` 참조.
출처: https://github.com/orioncactus/pretendard (v1.3.9)

## 완료 (마일스톤 2)

- ✅ Ep2~4 + 에필로그 변환·연결 — 통합 `data/story.json` (730노드, 40라벨)
- ✅ 엔딩 7종 (`final_ending` 분기) + 엔딩 result_card (엔딩명 + 연애유형 진단)
- ✅ reply timing (`reply_prompt`) — 인라인 메뉴로 복원
- ✅ 한글 폰트 내장 (Pretendard `@font-face`, 자체 호스팅)

## 다음 마일스톤

- 2호선 맵 화면 (`screens_map`) — 현재는 "역 해금" 인터스티셜 스텁
- 친구목록 · 추억함 · 갤러리 메타화면 대시보드 (`screens_meta`)
- 실제 에셋 (배경 이미지, BGM, SE, 프로필 사진)
