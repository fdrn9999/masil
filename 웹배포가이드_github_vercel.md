# 웹 배포 가이드 — Ren'Py 게임을 GitHub + Vercel로 웹에 올리기

> (가제) 오픈챗에서 만나요
> Ren'Py 게임을 브라우저에서 바로 플레이되도록 웹(HTML5)으로 빌드해서,
> GitHub에 올리고 Vercel로 자동 배포하는 전체 과정.

---

## 0. 큰 그림 (3단계)

```
[1] Ren'Py 런처에서 "Web(beta)" 빌드  →  정적 파일 폴더 생성 (index.html 등)
        │
[2] 그 폴더를 GitHub 저장소에 push
        │
[3] Vercel을 GitHub에 연결  →  push할 때마다 자동으로 웹 배포 (URL 발급)
```

> 핵심: Ren'Py 웹 빌드는 **그냥 정적 파일 묶음**(index.html + 게임 데이터)이에요.
> 그래서 Vercel·GitHub Pages·Netlify 어디든 "정적 사이트"로 올리면 끝납니다.

---

## 1단계 — Ren'Py 웹(HTML5) 빌드

1. **Ren'Py 런처(SDK)** 를 켠다. (renpy.org 에서 SDK 다운로드, 8.x 권장)
2. 프로젝트를 선택한 상태에서 좌측/하단의 **"Web(beta)"** (웹 베타) 메뉴를 누른다.
   - 처음이면 웹 지원 모듈을 다운로드하라고 뜸 → 받는다.
3. **"Build Web Application"** 클릭 → 빌드 시작.
   - 테스트만 할 거면 **"Build and Open in Browser"** 를 누르면 로컬 서버로 바로 브라우저에서 확인 가능.
4. 빌드가 끝나면 프로젝트 폴더 옆에 결과가 생긴다:

```
<프로젝트>-1.0-dists/
   └─ <프로젝트>-1.0-web/      ← 이 폴더가 '웹사이트' 통째
        ├─ index.html
        ├─ game.zip / 데이터 파일들
        ├─ web-presplash...
        └─ ...
```

> ✅ 우리가 배포할 건 바로 이 **`...-web/` 폴더 안의 내용물 전체**입니다.

### 빌드 전 주의 (웹 최적화)
- **파일 50MB 초과 금지(권장).** 50MB 넘는 파일은 캐시가 안 돼서 매번 다시 다운로드됨 → 큰 BGM/CG는 압축하거나 분할.
- 이미지는 웹 로딩을 고려해 과하게 큰 원본(수십 MB PNG)은 피하고 적당히 압축.
- 첫 로딩 체감을 위해 `web-presplash`(로딩 화면 이미지)를 넣어두면 좋음.

---

## 2단계 — GitHub에 올리기

### A. 저장소 만들기
1. GitHub에서 **New repository** 생성 (예: `openchat-vn-web`). Public이면 무료로 충분.
2. 컴퓨터에서 **`...-web/` 폴더 안의 모든 파일**을 저장소 루트에 넣는다.
   - 즉 저장소 최상단에 `index.html` 이 바로 보이게. (web 폴더를 통째로 넣어 한 단계 더 들어가지 않도록 주의)

### B. 명령어로 올리기 (예시)
```bash
cd "<프로젝트>-1.0-dists/<프로젝트>-1.0-web"
git init
git add .
git commit -m "Ren'Py web build"
git branch -M main
git remote add origin https://github.com/<아이디>/openchat-vn-web.git
git push -u origin main
```

> Git이 처음이면 GitHub Desktop(GUI 앱)으로 드래그&드롭 해도 됩니다.

---

## 3단계 — Vercel로 자동 배포

1. **vercel.com** 가입 → "Continue with GitHub" 로 GitHub 계정 연결.
2. **Add New… → Project** → 방금 만든 저장소(`openchat-vn-web`) **Import**.
3. 설정 화면에서:
   - **Framework Preset: Other** (정적 사이트라 빌드 명령 필요 없음)
   - **Build Command: 비워두기**, **Output Directory: 비워두기**(루트의 index.html 사용)
   - **Root Directory:** 저장소 루트(= index.html이 있는 위치).
4. **Deploy** 클릭 → 잠시 후 `https://openchat-vn-web.vercel.app` 같은 URL 발급.
5. 이후 **GitHub에 push할 때마다 Vercel이 자동 재배포**합니다. (새 빌드 push → 사이트 자동 갱신)

### 중요 — 헤더 설정 (Ren'Py 웹 안정화)
Ren'Py 웹은 일부 기능에서 **교차 출처 격리(COOP/COEP) 헤더**가 필요할 수 있습니다.
저장소 루트에 **`vercel.json`** 파일을 추가해 두면 안전합니다:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy",  "value": "require-corp" }
      ]
    }
  ]
}
```

> 게임이 흰 화면/오류로 안 뜨면 십중팔구 이 헤더 문제거나 경로 문제예요. 위 파일 추가 후 재배포해 보세요.

---

## (대안) GitHub Pages로 배포

Vercel 대신 GitHub Pages도 가능합니다.
1. 저장소 **Settings → Pages**.
2. Source: **Deploy from a branch**, Branch: **main / (root)** 선택 후 저장.
3. 몇 분 뒤 `https://<아이디>.github.io/openchat-vn-web/` 로 접속.

> 단, GitHub Pages는 응답 헤더 커스터마이즈가 제한적이라(COOP/COEP 설정 불가),
> Ren'Py 웹의 특정 기능에서 문제가 생기면 **Vercel/Netlify가 더 안전**합니다.

---

## (자동화·선택) GitHub Actions로 빌드까지 자동화

매번 런처로 빌드하기 귀찮으면, **소스(.rpy)** 를 push하면 GitHub Actions가 웹 빌드를 만들고 자동 배포하게 할 수도 있습니다.
- "Build Ren'Py Project" 같은 GitHub Action을 쓰면 `package: web` 으로 웹 빌드 산출물 생성 가능.
- 그 산출물을 Vercel/Pages로 배포하는 워크플로를 연결.
- 처음엔 복잡하니, **익숙해진 뒤 도입** 추천. (1~3단계 수동 방식으로 먼저 성공시키기)

---

## 체크리스트

- [ ] Ren'Py 8.x SDK 설치, Web(beta) 모듈 다운로드
- [ ] "Build Web Application" 성공, 로컬 브라우저 테스트 OK
- [ ] 50MB 넘는 파일 없음(에셋 압축)
- [ ] `...-web/` 내용물을 저장소 루트에 push (index.html이 루트에)
- [ ] Vercel 연결 + Deploy 성공, URL 접속 확인
- [ ] (필요시) `vercel.json` 으로 COOP/COEP 헤더 추가
- [ ] 모바일 브라우저에서도 한번 테스트

---

## 자주 막히는 곳

- **흰 화면/콘솔 에러** → COOP/COEP 헤더(`vercel.json`) 추가, 경로(루트에 index.html) 확인.
- **로딩이 영원히** → 큰 파일(50MB+) 때문일 가능성. 에셋 압축/분할.
- **한글 폰트 깨짐** → 게임에 한글 폰트 파일을 포함하고 `gui.font` 로 지정(웹에선 시스템 폰트 못 믿음).
- **저장 안 됨** → 웹 빌드는 브라우저 저장소를 쓰므로 시크릿창/쿠키 차단 시 세이브 제한될 수 있음.

---

## 모바일/PC 반응형 & 테스트 (꼭 읽기)

Ren'Py 웹은 **가상 해상도 한 장을 화면에 맞춰 스케일**합니다(레터박스). 그래서 "반응형"은
CSS가 아니라 **① 적절한 기준 해상도 + ② 터치 크기 + ③ 한글 폰트 내장**으로 잡습니다.
이 프로젝트엔 이미 다음이 들어가 있습니다:
- `screens_chat.rpy` / `screens_map.rpy` — 말풍선 폭이 **화면 비율 기준(반응형)**, 터치 드래그 스크롤, 큰 탭 영역.
- `config_web_mobile.rpy` — **터치 기기에서 퀵메뉴/대사/선택지 글자 자동 확대**, `scene black` 안전장치.

### A. 기준 해상도 (gui.rpy 본체에서 1회)
`game/gui.rpy` 상단 `gui.init(...)`:
- **1280×720** 권장(웹 용량·성능 유리, 모바일에서 가장 무난).
- 고해상도 원하면 1920×1080(에셋·로딩 무거워짐). **둘 중 하나로 프로젝트 내내 통일.**

### B. 한글 폰트 내장 (웹에서 필수)
웹은 시스템 폰트를 못 믿습니다. **한글 폰트 파일을 `game/`에 넣고 지정**:
```renpy
# gui.rpy 에서 (라이선스 free 폰트: Noto Sans KR, Pretendard, 나눔 등)
define gui.text_font   = "fonts/NotoSansKR-Regular.ttf"
define gui.name_text_font = "fonts/NotoSansKR-Bold.ttf"
define gui.interface_text_font = "fonts/NotoSansKR-Regular.ttf"
```
> 안 넣으면 웹에서 **한글이 □/공백으로 깨짐.** (가장 흔한 사고)

### C. 가로/세로(오리엔테이션)
- VN은 **가로(landscape) 기준**. 세로폰에선 작게 레터박스되니, 첫 화면에 "가로로 돌려주세요" 안내를 한 컷 넣으면 친절.
- Ren'Py 웹은 자동 회전 강제는 어려움 → 안내로 해결.

### D. iOS 사파리 주의
- **오디오 자동재생 차단**: 첫 사용자 터치(시작 버튼 클릭) 전엔 소리가 안 날 수 있음 → 타이틀에서 한 번 탭하게 하면 해제됨(정상 동작).
- 저장은 브라우저 저장소 사용 → **사파리 시크릿창/사이트데이터 차단 시 세이브 제한.**

### E. 테스트 매트릭스 (배포 후 최소 이걸로)
- [ ] **PC Chrome** — 시작→프롤로그→채팅 스크롤→맵 역선택→선택지→엔딩까지 1회 완주.
- [ ] **안드로이드 Chrome** — 채팅 드래그 스크롤, 맵 역 **탭**, 선택지 탭이 손가락으로 잘 눌리는지.
- [ ] **iOS Safari** — 첫 탭 후 소리 나는지, 한글 안 깨지는지, 세이브/로드.
- [ ] 맵에서 **역을 눌렀을 때 정상 진행**되는지(이전 버그 수정 확인), '닫기'도 정상 복귀.
- [ ] 느린 네트워크에서 첫 로딩(웹 presplash 보이는지).

---

## 참고 링크
- Ren'Py 공식 Web/HTML5 문서: https://www.renpy.org/doc/html/web.html
- Vercel + GitHub 연동 문서: https://vercel.com/docs/git/vercel-for-github
- Build Ren'Py Project (GitHub Action): https://github.com/marketplace/actions/build-ren-py-project
