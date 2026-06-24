---
name: vn-lint
description: Ren'Py SDK 없이 .rpy 정적 점검. scene/show에 쓰였지만 정의 안 된 image, jump/call 대상 라벨·screen 부재, 중복 image 정의, label start 존재, 핵심 함수(recv/pmusic/get_item 등) 정의 여부를 확인한다. 빌드/배포 전 사전 검증, "에러 없나?" 점검 시 사용.
---

# vn-lint — Ren'Py 정적 점검 (SDK 없이)

이 머신엔 Ren'Py SDK가 없어 실제 lint를 못 돌린다. 그래서 **흔한 부팅·진행 차단 버그를 정적으로** 잡는다.
**휴리스틱이므로 결과는 사람이 확인할 것**(스크린 언어/속성/at 절 때문에 오탐 가능). 진짜 검증은 런처 `Build → lint` + 플레이.

## 잡아내는 것
1. **`label start` 존재** — 없으면 게임이 안 켜진다. (이 프로젝트는 `label start: jump episode1_full` 가 활성인지 확인. 주석 처리돼 있으면 경고.)
2. **scene/show 미정의 image** — `scene black` 처럼 정의 안 된 맨이름 사용.
3. **jump/call 대상 라벨 부재** · **call screen 대상 screen 부재**.
4. **중복 image 정의** (같은 이름 두 번).
5. **핵심 함수 정의 여부** — `recv send pmusic psound pstop pamb get_item give_item has_item use_item was_given add_like add_sincere chapter_start consult_doyun decide_ending final_ending unlock_station reply_prompt doyun_ping record_ending`.

## 절차
1. `script_ep1.rpy` 가 있는 VN 폴더로 이동.
2. 아래 파이썬을 `PYTHONUTF8=1 python3 -X utf8` 로 실행(출력은 파일로 받아 Read).
3. 보고 + 의심 항목을 직접 눈으로 교차확인 후, 필요한 수정 제안.

```python
# vn_lint.py  — 휴리스틱 정적 점검
import re, glob, os, io
base = r"C:/Users/ckato/OneDrive/문서/Claude/Projects/renPy로 비주얼노벨 만들기"
out = io.StringIO(); W = lambda s="": out.write(s+"\n")
texts = {os.path.basename(p): open(p,encoding="utf-8").read() for p in glob.glob(os.path.join(base,"*.rpy"))}
allt = "\n".join(texts.values())

img_def, img_dup = set(), []
for m in re.findall(r'(?m)^\s*image\s+(.+?)\s*=', allt):
    n=m.strip()
    (img_dup.append(n) if n in img_def else None); img_def.add(n)
for m in re.findall(r'renpy\.image\(\s*["\']([^"\']+)["\']', allt):  # 동적 정의(black 등)
    img_def.add(m.strip())
labels = set(re.findall(r'(?m)^label\s+(\w+)', allt))
screens = set(re.findall(r'(?m)^screen\s+(\w+)', allt))
defs   = set(re.findall(r'\bdef\s+(\w+)\s*\(', allt))
img_words = {w for n in img_def for w in n.split()}

# label start
W("[1] label start: " + ("OK" if "start" in labels else "★없음 — 주석(# label start) 확인! 게임 안 켜짐"))

# scene/show image
W("\n[2] scene/show 미정의 image (확인 필요):")
bad=set()
for f,t in texts.items():
    for mm in re.finditer(r'(?m)^\s*(scene|show)\s+(.+)$', t):
        rest = mm.group(2)
        if rest.startswith("screen"): continue
        phrase = re.split(r'\s+(with|at|behind|as|onlayer|zorder)\s+', rest)[0].strip()
        if not phrase or phrase in img_def: continue
        if phrase.split()[0] in img_words: continue   # 첫 토큰이 정의된 이미지의 단어면 통과
        bad.add(f"{f}: {phrase}")
W("\n".join(sorted(bad)) or "  (없음)")

# jump/call label
W("\n[3] jump/call 미정의 라벨:")
miss=set()
for f,t in texts.items():
    for kw,name in re.findall(r'\b(jump|call)\s+(\w+)', t):
        if name=="screen": continue
        if name not in labels: miss.add(f"{f}: {kw} {name}")
W("\n".join(sorted(miss)) or "  (없음)")

# call screen
W("\n[4] call/show screen 미정의:")
ms=set()
for f,t in texts.items():
    for name in re.findall(r'(?:call|show)\s+screen\s+(\w+)', t):
        if name not in screens: ms.add(f"{f}: {name}")
    for name in re.findall(r'renpy\.(?:call_screen|show_screen)\(\s*["\'](\w+)', t):
        if name not in screens: ms.add(f"{f}: {name}")
W("\n".join(sorted(ms)) or "  (없음)")

# 중복 image
W("\n[5] 중복 image 정의: " + (", ".join(img_dup) if img_dup else "(없음)"))

# 핵심 함수
need = "recv send pmusic psound pstop pamb get_item give_item has_item use_item was_given add_like add_sincere chapter_start decide_ending final_ending unlock_station reply_prompt doyun_ping record_ending love_type rel_subtitle".split()
W("\n[6] 미정의 핵심 함수: " + (", ".join(n for n in need if n not in defs) or "(없음)"))

open(os.path.join(os.environ.get('TEMP','.'),"vn_lint_out.txt"),"w",encoding="utf-8").write(out.getvalue())
print("done")
```

## 주의
- `[2]`는 오탐이 잦다(레이어드이미지 속성, `at` 변형 등). **실제로 정의가 없는지 눈으로 확인** 후에만 수정.
- 이 점검을 통과해도 **Ren'Py 문법 오류(들여쓰기·따옴표·스크린 구문)는 못 잡는다.** 반드시 런처 lint 권장.
