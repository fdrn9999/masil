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

## 한글 폰트 내장 TODO

웹 폰트가 아직 내장되지 않음 — 현재는 시스템 한글 폰트(Apple SD Gothic Neo / Malgun Gothic)로 표시됨.  
Vercel 배포 전 Pretendard 웹폰트를 `style.css` 에 `@font-face` 로 내장할 것.

## 다음 마일스톤

- Ep2~4 + 에필로그 변환 및 연결
- 2호선 맵 화면 (`screens_map`)
- 친구목록 · 추억함 · 갤러리 · 진단카드 메타화면
- 엔딩 7종 (`final_ending` 분기)
- **reply timing (`reply_prompt`) — 수직 슬라이스에서 보류됨**
- 한글 폰트 내장 (Pretendard `@font-face`)
- 실제 에셋 (배경 이미지, BGM, SE, 프로필 사진)
