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
# Matches both 'image bg <name> = Solid(...)' and 'image <name> = Solid(...)' (no bg prefix, e.g. flash bgs)
_IMG_RE  = re.compile(r'^image\s+(?:bg\s+)?(\w+)\s*=\s*Solid\("(#[0-9a-fA-F]+)"\)')
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
# scene: 'with' 절은 단순 식별자 또는 Dissolve(...)/Pause(...) 등 복합 형태 모두 허용
_SCENE_RE = re.compile(r'^scene\s+(?:bg\s+)?(\w+)(?:\s+with\s+(.+?))?\s*$')
_CALL_SCREEN_RE = re.compile(r'^call\s+screen\s+(\w+)')
# call consult_doyun("seoa") / call consult_doyun()  → consult op (who 기본 "seoa")
_CONSULT_RE = re.compile(r'^call\s+consult_doyun\s*\(\s*(?:"((?:[^"\\]|\\.)*)")?\s*\)\s*$')
_REPLY_PROMPT_RE = re.compile(r'^call\s+reply_prompt\s*\(\s*"((?:[^"\\]|\\.)*)"\s*\)\s*$')
_CALL_RE = re.compile(r'^call\s+(\w+)\s*(?:\((.*)\))?\s*$')
_JUMP_RE = re.compile(r'^jump\s+(\w+)\s*$')
_MENU_CHOICE_RE = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*(?:if\s+(.+?))?\s*:\s*$')

def _unquote(s):
    return s.replace('\\"', '"').replace("\\'", "'")


# ── Part 3: py→js + scope prefix + $ converter ────────────────────────────────

SYS_NAMES = {'add_like','add_sincere','add_bond','hname','chapter_start','get_item','has_item',
    'item_count','use_item','give_item','was_given','unlock_station','doyun_ping','doyun_line',
    'decide_ending','final_ending','apply_timing','bitter_candidate'}

# ep1에 등장하는 default/런타임 변수 (기본 var_names). convert()에서 declarations로 보강.
# (seoa_like/seoa_sinc 는 게이지 숫자 미러 표시용 → CLAUDE.md #1 따라 변환 단계에서 드롭됨)
BASE_VARS = {'like','sincere','doyun_bond','inventory','item_flags','doyun_used_chapter','show_gauges',
    'mc_name','seoa_result','date_loc','seoa_card_given','promise_spring','ep4_choice'}

def py_to_js(expr):
    e = re.sub(r'\bnot\s+', '! ', expr)
    e = re.sub(r'\band\b', '&&', e)
    e = re.sub(r'\bor\b', '||', e)
    e = re.sub(r'\bTrue\b', 'true', e)
    e = re.sub(r'\bFalse\b', 'false', e)
    e = re.sub(r'\bNone\b', 'null', e)
    # Python  x in (a, b, c)  →  [a, b, c].includes(x)
    # (튜플 in-check. 문자열 리터럴 안쪽에서는 작동하지 않으므로 간단 패턴만 처리)
    e = re.sub(r'(\S+)\s+in\s+\(([^)]+)\)', r'[\2].includes(\1)', e)
    return e

def scope_prefix(expr, var_names, sys_names):
    def repl(m):
        ident = m.group(0)
        if ident in sys_names: return 'S.' + ident
        if ident in var_names: return 'V.' + ident
        return ident
    # 문자열 리터럴 보호: 짝수 인덱스는 비-리터럴, 홀수 인덱스는 문자열 리터럴
    parts = re.split(r'("(?:[^"\\]|\\.)*")', expr)
    for k in range(0, len(parts), 2):
        parts[k] = re.sub(r'(?<![\.\w])[A-Za-z_]\w*', repl, parts[k])
    return ''.join(parts)

_RECV_RE = re.compile(r'^recv\("((?:[^"\\]|\\.)*)"\s*,\s*name="((?:[^"\\]|\\.)*)"')
_SEND_RE = re.compile(r'^send\("((?:[^"\\]|\\.)*)"\)')
_RESET_RE = re.compile(r'^chat_reset\("((?:[^"\\]|\\.)*)"\)')
_PMUSIC_RE = re.compile(r'^pmusic\("([^"]*)"(?:\s*,\s*fadein=([\d.]+))?')
_PSOUND_RE = re.compile(r'^psound\("([^"]*)"\)')
_PAMB_RE = re.compile(r'^pamb\("([^"]*)"(?:\s*,\s*fadein=([\d.]+))?')
_PING_RE = re.compile(r'^doyun_ping\("((?:[^"\\]|\\.)*)"\)')
_INPUT_RE = re.compile(r'renpy\.input\("((?:[^"\\]|\\.)*)"(?:\s*,\s*default="([^"]*)")?(?:\s*,\s*length=(\d+))?\)')

def _convert_dollar(code, review, var_names=None, sys_names=None):
    if var_names is None: var_names = BASE_VARS
    if sys_names is None: sys_names = SYS_NAMES
    m = _RESET_RE.match(code)
    if m: return {"op": "chat_open", "room": _unquote(m.group(1))}
    m = _RECV_RE.match(code)
    if m: return {"op": "recv", "name": _unquote(m.group(2)), "text": _unquote(m.group(1))}
    m = _SEND_RE.match(code)
    if m: return {"op": "send", "text": _unquote(m.group(1))}
    m = _PMUSIC_RE.match(code)
    if m:
        node = {"op": "music", "file": m.group(1)}
        if m.group(2): node["fadein"] = float(m.group(2))
        return node
    m = _PSOUND_RE.match(code)
    if m: return {"op": "sound", "file": m.group(1)}
    m = _PAMB_RE.match(code)
    if m:
        node = {"op": "amb", "file": m.group(1)}
        if m.group(2): node["fadein"] = float(m.group(2))
        return node
    if code.startswith('pstop'): return {"op": "stop", "channel": "music"}
    if code.startswith('pamb_stop'): return {"op": "stop", "channel": "amb"}
    m = _PING_RE.match(code)
    if m: return {"op": "toast", "kind": "doyun", "text": _unquote(m.group(1))}
    # renpy.input(...) (닉네임): tmp = renpy.input(...) 형태
    mi = _INPUT_RE.search(code)
    if mi:
        node = {"op": "input", "var": "mc_name", "prompt": _unquote(mi.group(1))}
        if mi.group(2): node["default"] = mi.group(2)
        if mi.group(3): node["max"] = int(mi.group(3))
        return node
    # mc_name = tmp.strip() or "진호"  → input 노드가 이미 처리하므로 무시
    if re.match(r'^mc_name\s*=\s*tmp', code): return None
    # mc = Character(...) 재정의 → 무시 (이름은 mc_name 보간)
    if re.match(r'^\w+\s*=\s*Character\(', code): return None
    # renpy.call_screen("X") (결과 미사용 형태) → call_screen op (Task 2)
    if code.startswith('renpy.call_screen'):
        m_cs = re.match(r'^renpy\.call_screen\(\s*"([^"]+)"\s*\)', code)
        if m_cs:
            return {"op": "call_screen", "name": m_cs.group(1)}
        review.append('$ ' + code); return None
    if code.startswith('persistent.'):
        # play_count owned by boot (view_dom) — strip script-side increment to avoid double-count (final review I-2)
        if re.match(r'^persistent\.play_count\s*=', code):
            return None
        # other persistent.x = ... → set with P.
        return {"op": "set", "expr": _persistent_expr(code, var_names, sys_names)}
    # 튜플 언팩 대입: $ a, b = expr  (Task 2)
    # LHS에 콤마가 있고 = 이후에 나타나는 콤마는 RHS 함수 인자이므로 구분 필요.
    # 전략: '=' 기준으로 첫 '=' 위치를 찾은 뒤 LHS 부분에만 콤마 검사.
    # recv/send 등 특수 핸들러를 이미 통과했으므로 여기 도달한 코드만 대상.
    _eq_idx = code.find('=')
    if _eq_idx > 0 and code[_eq_idx - 1] not in ('!', '<', '>', '=') and (
            _eq_idx + 1 >= len(code) or code[_eq_idx + 1] != '='):
        _lhs = code[:_eq_idx].strip()
        _rhs = code[_eq_idx + 1:].strip()
        if ',' in _lhs and re.match(r'^[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+$', _lhs):
            # LHS가 순수 식별자 콤마-목록 → 튜플 언팩
            _names = [n.strip() for n in _lhs.split(',')]
            _lhs_js = '[' + ', '.join('V.' + n for n in _names) + ']'
            _rhs_js = scope_prefix(py_to_js(_rhs), var_names, sys_names)
            return {"op": "set", "expr": _lhs_js + ' = ' + _rhs_js}
    # 일반 헬퍼 호출/대입 → set
    return {"op": "set", "expr": scope_prefix(py_to_js(code), var_names, sys_names)}

def _persistent_expr(code, var_names=BASE_VARS, sys_names=SYS_NAMES):
    js = py_to_js(code).replace('persistent.', 'P.')
    return scope_prefix(js, var_names, sys_names)


def _apply_cond(cond, var_names, sys_names):
    """cond 문자열에 py_to_js + scope_prefix 적용. persistent.x → P.x 포함."""
    c = py_to_js(cond)
    c = c.replace('persistent.', 'P.')
    return scope_prefix(c, var_names, sys_names)

def _translate_conds(nodes, var_names, sys_names):
    """노드 트리를 순회하며 if/menu의 cond를 변환."""
    for node in nodes:
        if node is None:
            continue
        if node.get("op") == "if":
            if "cond" in node:
                node["cond"] = _apply_cond(node["cond"], var_names, sys_names)
            if "then" in node:
                _translate_conds(node["then"], var_names, sys_names)
            if "else" in node:
                _translate_conds(node["else"], var_names, sys_names)
        elif node.get("op") == "menu":
            for ch in node.get("choices", []):
                if "cond" in ch:
                    ch["cond"] = _apply_cond(ch["cond"], var_names, sys_names)
                if "body" in ch:
                    _translate_conds(ch["body"], var_names, sys_names)


# CLAUDE.md #1: gauge numbers must never be shown — strip gauge-mirror display (user-approved)
# 게이지 숫자를 미러링해 플레이어에게 보여주는 표시 줄/셋업을 결정론적으로 드롭한다.
# 소스(.rpy)는 건드리지 않고 생성물(web data)에서만 숨긴다 → 재생성해도 항상 숨겨짐.
# 일반화(Task 2): ep1 seoa 전용에서 모든 캐릭터+doyun_bond 로 확장.
#   say 텍스트에 [<name>_like], [<name>_sinc], [doyun_bond] 보간이 있으면 drop.
#   $ <name>_like = like[...] / $ <name>_sinc = sincere[...] 대입도 drop.
_GAUGE_MIRROR_SAY_RE = re.compile(r'\[(?:\w+_(?:like|sinc)|doyun_bond)\]')
_GAUGE_MIRROR_SET_RE = re.compile(r'^\$\s*\w+_(?:like|sinc)\s*=')

def _is_gauge_mirror_line(c):
    """게이지 숫자 미러 표시/셋업 줄이면 True (드롭 대상)."""
    # 1) 표시용 say 줄: 텍스트에 [<name>_like]/[<name>_sinc]/[doyun_bond] 보간이 있는 줄
    if c.startswith('"') or _SAY_CHAR_RE.match(c):
        if _GAUGE_MIRROR_SAY_RE.search(c):
            return True
    # 2) 셋업 $ 줄: <name>_like / <name>_sinc 에 대입하는 줄
    if _GAUGE_MIRROR_SET_RE.match(c):
        return True
    return False

def _build_reply_prompt_menu(who):
    """call reply_prompt("who") → inline menu (systems_reply.rpy label reply_prompt verbatim).
    choices: 바로 답한다→now, 조금 뜸 들였다 답한다→wait, 지금은 못 본 척한다→ignore.
    Each body: [{set V._r = S.apply_timing("who","mode")}, {say n "[_r]"}]
    """
    modes = [
        ("바로 답한다",           "now"),
        ("조금 뜸 들였다 답한다", "wait"),
        ("지금은 못 본 척한다",   "ignore"),
    ]
    choices = []
    for text, mode in modes:
        expr = f'V._r = S.apply_timing("{who}", "{mode}")'
        # 각 choice마다 say 노드를 새로 생성 (공유 가변 참조 방지)
        choices.append({
            "text": text,
            "body": [{"op": "set", "expr": expr}, {"op": "say", "who": "n", "text": "[_r]"}],
        })
    return {"op": "menu", "prompt": "답장, 어떻게 할까?", "choices": choices}


def classify(c, review, var_names=None, sys_names=None):
    if var_names is None: var_names = BASE_VARS
    if sys_names is None: sys_names = SYS_NAMES
    # CLAUDE.md #1: 게이지 숫자 미러 표시/셋업 줄은 결정론적으로 드롭
    if _is_gauge_mirror_line(c):
        return None
    # 선언부(image/define/default)는 parse_declarations에서 처리 → 무시
    if c.startswith('image ') or c.startswith('define ') or c.startswith('default '):
        return None
    # 독립 'with 전환' 구문은 연출 전용 → 무시
    if c.startswith('with '):
        return None
    # 'centered "..."' 구문은 간판 나레이션으로 처리
    m = re.match(r'^centered\s+"((?:[^"\\]|\\.)*)"', c)
    if m: return {"op": "say", "who": "n", "text": _unquote(m.group(1))}
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
    # 도윤 상담: call consult_doyun("who") → 엔진 내장 consult op (필수 기능)
    m = _CONSULT_RE.match(c)
    if m: return {"op": "consult", "who": m.group(1) or "seoa"}
    # 답장 타이밍: call reply_prompt("X") → 인라인 메뉴 노드 (systems_reply.rpy verbatim)
    m = _REPLY_PROMPT_RE.match(c)
    if m:
        who = m.group(1)
        return _build_reply_prompt_menu(who)
    m = _CALL_RE.match(c)
    if m:
        node = {"op": "call", "label": m.group(1)}
        return node
    if c.startswith('hide screen masil_chat'): return {"op": "chat_close"}
    if c.startswith('show screen') or c.startswith('hide screen') or c.startswith('show ') or c.startswith('window '):
        return None  # 비-채팅 화면 연출은 무시
    if c.startswith('pause'): return {"op": "pause"}
    if c.startswith('$ '):
        # 인라인 주석 제거 (문자열 리터럴 밖의 # 이후 제거)
        code_raw = c[2:].strip()
        parts = re.split(r'("(?:[^"\\]|\\.)*")', code_raw)
        code_stripped = ''.join(
            re.sub(r'\s*#.*$', '', p) if k % 2 == 0 else p
            for k, p in enumerate(parts)
        ).strip()
        return _convert_dollar(code_stripped, review, var_names, sys_names)
    m = _SAY_CHAR_RE.match(c)
    if m: return {"op": "say", "who": m.group(1), "text": _unquote(m.group(2))}
    m = _SAY_NARR_RE.match(c)
    if m: return {"op": "say", "who": "n", "text": _unquote(m.group(1))}
    review.append(c)
    return None

def parse_block(lines, i, base_indent, review, var_names=None, sys_names=None):
    """base_indent보다 더 깊은 연속 줄들을 노드 리스트로 (중첩 body 용)."""
    block = []
    while i < len(lines) and lines[i].indent > base_indent:
        node, i = _line_to_node(lines, i, review, var_names, sys_names)
        if isinstance(node, list):
            block.extend(node)
        elif node is not None:
            block.append(node)
    return block, i

# 에필로그 bitter 패턴: _cand = max(HEROINES, key=lambda ...) 뒤에 who_n = hname(_cand)
_BITTER_MAX_RE = re.compile(r'^_cand\s*=\s*max\s*\(HEROINES\s*,\s*key\s*=\s*lambda')
_BITTER_HNAME_RE = re.compile(r'^who_n\s*=\s*hname\s*\(_cand\)')

def _parse_python_block(lines, i, review, var_names=None, sys_names=None):
    """python: 멀티라인 블록을 파싱해 set 노드 목록을 반환.
    - bitter 패턴(_cand=max+who_n=hname) → single {set V.who_n = S.bitter_candidate()}
    - 일반 줄 → _convert_dollar 경유 set 노드
    - 번역 불가 줄(lambda 등) → REVIEW
    """
    base_indent = lines[i].indent
    i += 1  # 'python:' 줄 건너뜀
    # 블록 줄 수집 (base_indent보다 더 깊은 연속 줄)
    block_lines = []
    while i < len(lines) and lines[i].indent > base_indent:
        block_lines.append(lines[i].content)
        i += 1

    # bitter 패턴 감지: 연속 두 줄이 _cand = max(...) + who_n = hname(_cand)
    bitter_nodes = _try_bitter_collapse(block_lines)
    if bitter_nodes is not None:
        return bitter_nodes, i

    # 일반 처리: 각 줄을 _convert_dollar로 변환
    result_nodes = []
    for code in block_lines:
        # 번역 불가 줄 감지: lambda 키워드 포함 또는 max(... key=lambda ...) 패턴
        if 'lambda' in code or re.search(r'max\s*\(.*key\s*=', code):
            review.append('python: ' + code)
            continue
        node = _convert_dollar(code, review, var_names, sys_names)
        if node is not None:
            result_nodes.append(node)

    # 복수 노드를 list로 반환. _consume/parse_block에서 isinstance 체크로 extend.
    return result_nodes, i  # list of nodes (may be empty)


def _try_bitter_collapse(block_lines):
    """에필로그 bitter 패턴을 감지해 단일 set 노드 목록 반환. 감지 실패 시 None."""
    # 2줄 패턴: _cand = max(HEROINES, key=lambda ...) 다음 who_n = hname(_cand)
    # (블록에 다른 줄이 없어야 함 — 있으면 None을 반환해 일반 경로로)
    if len(block_lines) < 2:
        return None
    # 두 줄 안에 bitter 패턴이 있는지 연속으로 스캔
    for idx in range(len(block_lines) - 1):
        if _BITTER_MAX_RE.match(block_lines[idx]) and _BITTER_HNAME_RE.match(block_lines[idx + 1]):
            # bitter 패턴 발견 — 이 두 줄 외의 줄이 있으면 일반 경로로 위임
            remaining = block_lines[:idx] + block_lines[idx + 2:]
            if remaining:
                return None  # 복잡한 케이스 → 일반 경로
            return [{"op": "set", "expr": "V.who_n = S.bitter_candidate()"}]
    return None


def _line_to_node(lines, i, review, var_names=None, sys_names=None):
    l = lines[i]
    c = l.content
    if c.startswith('label ') and c.endswith(':'):
        return {"op": "label", "name": c[6:-1].strip()}, i + 1
    if c == 'menu:':
        return _parse_menu(lines, i, review, var_names, sys_names)
    if c.startswith('if ') and c.endswith(':'):
        return _parse_if(lines, i, review, var_names, sys_names)
    # python: 멀티라인 블록 (init python이 아닌 경우만)
    if c == 'python:':
        return _parse_python_block(lines, i, review, var_names, sys_names)
    node = classify(c, review, var_names, sys_names)
    return node, i + 1

def _parse_menu(lines, i, review, var_names=None, sys_names=None):
    base = lines[i].indent
    i += 1
    prompt, choices = None, []
    while i < len(lines) and lines[i].indent > base:
        c = lines[i].content
        mc = _MENU_CHOICE_RE.match(c)
        if mc:
            text, cond = mc.group(1), mc.group(2)
            body, i = parse_block(lines, i + 1, lines[i].indent, review, var_names, sys_names)
            ch = {"text": _unquote(text), "body": body}
            if cond: ch["cond"] = cond  # cond는 convert()에서 일괄 변환
            choices.append(ch)
        else:
            node = classify(c, review, var_names, sys_names)
            if node and node.get("op") == "say" and prompt is None:
                prompt = node["text"]
            i += 1
    out = {"op": "menu", "choices": choices}
    if prompt is not None: out["prompt"] = prompt
    return out, i

def _parse_if(lines, i, review, var_names=None, sys_names=None):
    base = lines[i].indent
    cond = lines[i].content[3:-1].strip()
    then, i = parse_block(lines, i + 1, base, review, var_names, sys_names)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review, var_names, sys_names)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review, var_names, sys_names)
        node["else"] = els
    return node, i

def _parse_if_from_elif(lines, i, review, var_names=None, sys_names=None):
    base = lines[i].indent
    cond = lines[i].content[5:-1].strip()
    then, i = parse_block(lines, i + 1, base, review, var_names, sys_names)
    node = {"op": "if", "cond": cond, "then": then}
    if i < len(lines) and lines[i].indent == base and lines[i].content.startswith('elif '):
        sub, i = _parse_if_from_elif(lines, i, review, var_names, sys_names)
        node["else"] = [sub]
    elif i < len(lines) and lines[i].indent == base and lines[i].content.rstrip() == 'else:':
        els, i = parse_block(lines, i + 1, base, review, var_names, sys_names)
        node["else"] = els
    return node, i

def _consume(lines, i, nodes, review, var_names=None, sys_names=None):
    node, ni = _line_to_node(lines, i, review, var_names, sys_names)
    if isinstance(node, list):
        # python: block returns a list of nodes → extend
        nodes.extend(node)
    elif node is not None:
        nodes.append(node)
    return node, ni

def _nodes_from_lines(lines, var_names, sys_names):
    """파일 한 개 분량의 lines -> (nodes, review). convert/convert_files 양쪽에서 공유."""
    nodes, review = [], []
    i = 0
    while i < len(lines):
        node, i = _consume(lines, i, nodes, review, var_names, sys_names)
    return nodes, review


def convert(text, var_names=None, sys_names=None):
    lines = parse_lines(text)
    # declarations로부터 default 변수명을 BASE_VARS에 합집합
    decls = parse_declarations(lines)
    effective_var_names = BASE_VARS | set(decls["defaults"].keys())
    if var_names is not None:
        effective_var_names = effective_var_names | set(var_names)
    effective_sys_names = SYS_NAMES if sys_names is None else SYS_NAMES | set(sys_names)

    nodes, review = _nodes_from_lines(lines, effective_var_names, effective_sys_names)
    # if/menu cond를 일괄 py→js + scope_prefix 변환
    _translate_conds(nodes, effective_var_names, effective_sys_names)
    labels = {}
    for idx, n in enumerate(nodes):
        if n.get("op") == "label":
            labels[n["name"]] = idx
    return {"nodes": nodes, "labels": labels, "review": review}


def convert_files(paths, var_names=None, sys_names=None):
    """여러 .rpy 파일을 순서대로 읽어 nodes/labels/review/defaults/backgrounds를 통합 반환.

    - defaults/backgrounds: 모든 파일의 declarations를 union
    - var_names: BASE_VARS + 모든 파일의 default 변수명 + 호출자 전달 var_names
    - nodes: 파일 순서대로 flat concat
    - labels: 합산된 nodes 위에서의 flat 인덱스 (cross-file jump 해소)
    - review: 파일 순서대로 concat
    """
    import io as _io
    # 1. 모든 파일을 읽고 declarations를 먼저 union → var_names 확정
    all_texts = []
    all_lines = []
    merged_defaults = {}
    merged_backgrounds = {}
    for path in paths:
        with _io.open(path, encoding='utf-8') as fh:
            text = fh.read()
        all_texts.append(text)
        lines = parse_lines(text)
        all_lines.append(lines)
        decls = parse_declarations(lines)
        merged_defaults.update(decls["defaults"])
        merged_backgrounds.update(decls["backgrounds"])

    effective_var_names = BASE_VARS | set(merged_defaults.keys())
    if var_names is not None:
        effective_var_names = effective_var_names | set(var_names)
    effective_sys_names = SYS_NAMES if sys_names is None else SYS_NAMES | set(sys_names)

    # 2. 각 파일의 노드를 순서대로 flat concat
    combined_nodes = []
    combined_review = []
    for lines in all_lines:
        file_nodes, file_review = _nodes_from_lines(lines, effective_var_names, effective_sys_names)
        combined_nodes.extend(file_nodes)
        combined_review.extend(file_review)

    # 3. if/menu cond를 일괄 변환
    _translate_conds(combined_nodes, effective_var_names, effective_sys_names)

    # 4. labels = flat index over combined_nodes
    labels = {}
    for idx, n in enumerate(combined_nodes):
        if n.get("op") == "label":
            labels[n["name"]] = idx

    return {
        "nodes": combined_nodes,
        "labels": labels,
        "review": combined_review,
        "defaults": merged_defaults,
        "backgrounds": merged_backgrounds,
    }


def main():
    import sys, json, io
    # argv 형식: rpy2json.py <src1> [<src2> ...] -o <out>
    o_idx = sys.argv.index('-o')
    srcs = sys.argv[1:o_idx]
    out = sys.argv[o_idx + 1]
    if len(srcs) == 1:
        # 단일 파일: 기존 동작 유지
        text = io.open(srcs[0], encoding='utf-8').read()
        decls = parse_declarations(parse_lines(text))
        var_names = set(BASE_VARS) | set(decls["defaults"].keys())
        result = convert(text, var_names=var_names, sys_names=SYS_NAMES)
        result["backgrounds"] = decls["backgrounds"]
        result["defaults"] = decls["defaults"]
    else:
        result = convert_files(srcs)
    io.open(out, 'w', encoding='utf-8').write(json.dumps(result, ensure_ascii=False, indent=1))
    with io.open('convert_review.log', 'w', encoding='utf-8') as f:
        f.write('\n'.join(result["review"]))
    print('nodes:', len(result["nodes"]), 'labels:', len(result["labels"]), 'review:', len(result["review"]))

if __name__ == '__main__':
    main()
