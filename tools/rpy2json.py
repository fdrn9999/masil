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


# ── Part 2: block parser & converter ──────────────────────────────────────────

_SAY_CHAR_RE = re.compile(r'^(\w+)\s+"((?:[^"\\]|\\.)*)"\s*$')
_SAY_NARR_RE = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*$')
_SCENE_RE = re.compile(r'^scene\s+(?:bg\s+)?(\w+)(?:\s+with\s+(\w+))?\s*$')
_CALL_SCREEN_RE = re.compile(r'^call\s+screen\s+(\w+)')
_CALL_RE = re.compile(r'^call\s+(\w+)\s*(?:\((.*)\))?\s*$')
_JUMP_RE = re.compile(r'^jump\s+(\w+)\s*$')
_MENU_CHOICE_RE = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*(?:if\s+(.+?))?\s*:\s*$')

def _unquote(s):
    return s.replace('\\"', '"').replace("\\'", "'")

def _convert_dollar(code, review):
    review.append('$ ' + code)
    return None

def classify(c, review):
    m = _SCENE_RE.match(c)
    if m:
        node = {"op": "scene", "bg": m.group(1)}
        if m.group(2): node["with"] = m.group(2)
        return node
    if c == 'return': return {"op": "return"}
    m = _JUMP_RE.match(c)
    if m: return {"op": "jump", "label": m.group(1)}
    m = _CALL_SCREEN_RE.match(c)
    if m: return {"op": "call_screen", "name": m.group(1)}
    m = _CALL_RE.match(c)
    if m:
        node = {"op": "call", "label": m.group(1)}
        return node
    if c.startswith('hide screen masil_chat'): return {"op": "chat_close"}
    if c.startswith('show screen') or c.startswith('hide screen') or c.startswith('show ') or c.startswith('window '):
        return None  # 비-채팅 화면 연출은 무시
    if c.startswith('pause'): return {"op": "pause"}
    if c.startswith('$ '):
        return _convert_dollar(c[2:].strip(), review)   # Task 7
    m = _SAY_CHAR_RE.match(c)
    if m: return {"op": "say", "who": m.group(1), "text": _unquote(m.group(2))}
    m = _SAY_NARR_RE.match(c)
    if m: return {"op": "say", "who": "n", "text": _unquote(m.group(1))}
    review.append(c)
    return None

def parse_block(lines, i, base_indent, review):
    """base_indent보다 더 깊은 연속 줄들을 노드 리스트로 (중첩 body 용)."""
    block = []
    while i < len(lines) and lines[i].indent > base_indent:
        node, i = _line_to_node(lines, i, review)
        if node is not None:
            block.append(node)
    return block, i

def _line_to_node(lines, i, review):
    l = lines[i]
    c = l.content
    if c.startswith('label ') and c.endswith(':'):
        return {"op": "label", "name": c[6:-1].strip()}, i + 1
    if c == 'menu:':
        return _parse_menu(lines, i, review)
    if c.startswith('if ') and c.endswith(':'):
        return _parse_if(lines, i, review)
    node = classify(c, review)
    return node, i + 1

def _parse_menu(lines, i, review):
    base = lines[i].indent
    i += 1
    prompt, choices = None, []
    while i < len(lines) and lines[i].indent > base:
        c = lines[i].content
        mc = _MENU_CHOICE_RE.match(c)
        if mc:
            text, cond = mc.group(1), mc.group(2)
            body, i = parse_block(lines, i + 1, lines[i].indent, review)
            ch = {"text": _unquote(text), "body": body}
            if cond: ch["cond"] = cond  # Task 7에서 py→js 변환
            choices.append(ch)
        else:
            node = classify(c, review)
            if node and node.get("op") == "say" and prompt is None:
                prompt = node["text"]
            i += 1
    out = {"op": "menu", "choices": choices}
    if prompt is not None: out["prompt"] = prompt
    return out, i

def _parse_if(lines, i, review):
    base = lines[i].indent
    cond = lines[i].content[3:-1].strip()
    then, i = parse_block(lines, i + 1, base, review)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review)
        node["else"] = els
    return node, i

def _parse_if_from_elif(lines, i, review):
    base = lines[i].indent
    cond = lines[i].content[5:-1].strip()
    then, i = parse_block(lines, i + 1, base, review)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review)
        node["else"] = els
    return node, i

def _consume(lines, i, nodes, review):
    node, ni = _line_to_node(lines, i, review)
    if node is not None:
        nodes.append(node)
    return node, ni

def convert(text):
    lines = parse_lines(text)
    nodes, review = [], []
    i = 0
    while i < len(lines):
        node, i = _consume(lines, i, nodes, review)
    labels = {}
    for idx, n in enumerate(nodes):
        if n.get("op") == "label":
            labels[n["name"]] = idx
    return {"nodes": nodes, "labels": labels, "review": review}
