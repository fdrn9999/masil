# 오픈챗에서 만나요 — 웹 포트

Ren'Py 비주얼노벨 *오픈챗에서 만나요* 의 웹 버전. 현재 **프롤로그 + 에피소드 1** 수직 슬라이스.

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

## 다음 마일스톤

- Ep2~4 + 에필로그 변환 및 연결
- 2호선 맵 화면 (`screens_map`)
- 친구목록 · 추억함 · 갤러리 · 진단카드 메타화면
- 엔딩 7종 (`final_ending` 분기)
- **reply timing (`reply_prompt`) — 수직 슬라이스에서 보류됨**
- 실제 에셋 (배경 이미지, BGM, SE, 프로필 사진)
