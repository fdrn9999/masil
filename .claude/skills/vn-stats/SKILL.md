---
name: vn-stats
description: 오픈챗 Ren'Py 비주얼노벨의 분량·균형 측정. 에피소드별 한글 글자수(=읽기시간)·메뉴·선택지·채팅 수를 집계하고 분량 불균형을 진단한다. "볼륨/흐름 괜찮아?", 분량 검토, 밸런싱, 보강 전후 비교 시 사용.
---

# vn-stats — 스토리 분량·균형 측정기

Ren'Py 스크립트의 분량을 **실측**해 균형을 진단한다. 감으로 말하지 말고 숫자로.

## 절차

1. **VN 프로젝트 폴더를 찾는다** — `script_ep1.rpy` 가 있는 디렉터리. (이 머신에선 `renPy로 비주얼노벨 만들기/`)
2. 아래 파이썬을 스크래치패드에 쓰고 **UTF-8로 실행**(Windows 콘솔 cp949 회피가 핵심):
   - 출력은 콘솔 대신 **파일로** 받고 Read 도구로 읽는다.
   - 경로의 한글은 소스에 직접 박지 말고, 파일 안에서 `base = r"...C:/..."` 로 두되 **반드시 `PYTHONUTF8=1 python3 -X utf8`** 로 실행.
3. 결과 표 + 읽기시간 + 에피소드별 비중 + **불균형 진단**을 보고한다.

```python
# vn_stats.py  (PYTHONUTF8=1 python3 -X utf8 vn_stats.py 로 실행)
import re, os, io
base = r"C:/Users/ckato/OneDrive/문서/Claude/Projects/renPy로 비주얼노벨 만들기"
files = ["script_ep1.rpy","script_ep2.rpy","script_ep3.rpy","script_ep4.rpy","script_epilogue.rpy"]
out = io.StringIO()
def w(s=""): out.write(s+"\n")
def hangul(s): return len(re.findall(r'[가-힣]', s))
w(f"{'file':<22}{'hangul':>8}{'menu':>6}{'choice':>7}{'recv':>6}{'send':>6}")
g = dict(h=0,menu=0,choice=0,recv=0,send=0); per={}
for f in files:
    t = open(os.path.join(base,f), encoding="utf-8").read()
    h = sum(hangul(m) for m in re.findall(r'"([^"]*)"', t))
    mn = len(re.findall(r'^\s*menu:\s*$', t, re.M))
    ch = len(re.findall(r'^\s{8,}"[^"]+":\s*$', t, re.M))
    rv = len(re.findall(r'recv\(', t)); sd = len(re.findall(r'\bsend\(', t))
    per[f]=h; w(f"{f:<22}{h:>8}{mn:>6}{ch:>7}{rv:>6}{sd:>6}")
    g['h']+=h; g['menu']+=mn; g['choice']+=ch; g['recv']+=rv; g['send']+=sd
w("-"*55); w(f"{'TOTAL':<22}{g['h']:>8}{g['menu']:>6}{g['choice']:>7}{g['recv']:>6}{g['send']:>6}")
H=g['h']
w(f"\n총 {H:,}자 · 읽기 ~{H//350}–{H//250}분(클릭/대기 포함 시 더) · 선택지 {g['choice']} · 채팅 {g['recv']+g['send']}")
w("\n비중:")
for f in files: w(f"  {f:<22}{per[f]:>7}  {per[f]/H*100:>5.1f}%")
open(os.path.join(os.environ.get('TEMP','.'),"vn_out.txt"),"w",encoding="utf-8").write(out.getvalue())
print("done")
```

## 진단 기준 (보고에 포함)
- **읽기시간**: 한글자수 ÷ 250~350자/분. 채팅 입력 딜레이·클릭·전환으로 체감은 더 길다고 명시.
- **불균형 플래그**: 어떤 본편 에피소드가 가장 큰 본편의 **60% 미만**이면 "얇음"으로 지적. 프롤로그가 ep1에 묶여 ep1이 40%+면 "전반 비대" 지적.
- ep1은 보통 프롤로그 포함이라 큼 → 필요하면 `script_ep1.rpy` 를 'Ep.1 — '(서아 타이틀) 기준으로 프롤로그/서아편 분리 측정.
- **정직하게**: 이건 분량·구조 측정이지 '재미' 측정이 아니다(재미는 플레이테스트 영역).

## 활용
보강 전/후로 두 번 돌려 Before→After 표를 보여주면 효과가 명확하다.
