"""Ren'Py(.rpy) -> 웹 VN 엔진 JSON 변환기. stdlib만 사용."""
import re, ast
from dataclasses import dataclass

@dataclass
class Line:
    indent: int
    raw: str
    content: str

def parse_lines(text):
    out = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith('#'):
            continue
        indent = len(raw) - len(raw.lstrip(' '))
        out.append(Line(indent=indent, raw=raw, content=stripped))
    return out

_CHAR_RE = re.compile(r'^define\s+(\w+)\s*=\s*Character\((.*)\)\s*$')
_IMG_RE  = re.compile(r'^image\s+bg\s+(\w+)\s*=\s*Solid\("(#[0-9a-fA-F]+)"\)')
_DEF_RE  = re.compile(r'^default\s+(\w+)\s*=\s*(.+)$')

def _parse_character_args(argstr):
    name, color = None, None
    if argstr.strip() == 'None':
        return {"name": None, "color": None}
    m = re.match(r'^\s*"((?:[^"\\]|\\.)*)"', argstr)
    if m:
        name = m.group(1)
    mc = re.search(r'color\s*=\s*"(#[0-9a-fA-F]+)"', argstr)
    if mc:
        color = mc.group(1)
    return {"name": name, "color": color}

def parse_declarations(lines):
    chars, bgs, defaults = {}, {}, {}
    for l in lines:
        m = _CHAR_RE.match(l.content)
        if m:
            chars[m.group(1)] = _parse_character_args(m.group(2)); continue
        m = _IMG_RE.match(l.content)
        if m:
            bgs[m.group(1)] = m.group(2); continue
        m = _DEF_RE.match(l.content)
        if m:
            try:
                defaults[m.group(1)] = ast.literal_eval(m.group(2))
            except Exception:
                pass  # 비-리터럴 default(Character 등)는 건너뜀
            continue
    return {"characters": chars, "backgrounds": bgs, "defaults": defaults}
