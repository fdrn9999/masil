import unittest
from rpy2json import parse_lines, parse_declarations, convert, py_to_js, convert_files

class TestDecls(unittest.TestCase):
    def test_parse_lines_strips_comments_blanks(self):
        text = "label x:\n    # comment\n\n    say\n"
        lines = parse_lines(text)
        self.assertEqual([l.content for l in lines], ["label x:", "say"])
        self.assertEqual(lines[1].indent, 4)

    def test_character_defs(self):
        text = ('define n = Character(None)\n'
                'define mc = Character("나", color="#cfd4e6")\n')
        d = parse_declarations(parse_lines(text))
        self.assertEqual(d["characters"]["n"], {"name": None, "color": None})
        self.assertEqual(d["characters"]["mc"], {"name": "나", "color": "#cfd4e6"})

    def test_background_and_default(self):
        text = ('image bg room = Solid("#23283d")\n'
                'default doyun_bond = 0\n'
                'default like = {"seoa": 0}\n')
        d = parse_declarations(parse_lines(text))
        self.assertEqual(d["backgrounds"]["room"], "#23283d")
        self.assertEqual(d["defaults"]["doyun_bond"], 0)
        self.assertEqual(d["defaults"]["like"], {"seoa": 0})

    def test_image_no_bg_prefix_captured(self):
        """FIX M-2: 'image white = Solid(...)' without bg prefix must be captured."""
        text = ('image white = Solid("#ffffff")\n'
                'image black = Solid("#000000")\n'
                'image bg room = Solid("#23283d")\n')
        d = parse_declarations(parse_lines(text))
        self.assertEqual(d["backgrounds"]["white"], "#ffffff",
            "bare 'image white' should be captured in backgrounds")
        self.assertEqual(d["backgrounds"]["black"], "#000000",
            "bare 'image black' should be captured in backgrounds")
        self.assertEqual(d["backgrounds"]["room"], "#23283d",
            "existing 'image bg room' should still be captured")

class TestBlocks(unittest.TestCase):
    def test_say_narration_and_char(self):
        out = convert('label start:\n    "나레이션{w=0.3}야"\n    mc "내 대사"\n')
        nodes = out["nodes"]
        self.assertEqual(nodes[0], {"op": "label", "name": "start"})
        self.assertEqual(nodes[1], {"op": "say", "who": "n", "text": "나레이션{w=0.3}야"})
        self.assertEqual(nodes[2], {"op": "say", "who": "mc", "text": "내 대사"})

    def test_scene_with_transition(self):
        out = convert('label s:\n    scene bg room with slowfade\n')
        self.assertEqual(out["nodes"][1], {"op": "scene", "bg": "room", "with": "slowfade"})

    def test_labels_index_map(self):
        out = convert('label a:\n    "x"\nlabel b:\n    "y"\n')
        self.assertEqual(out["labels"]["a"], 0)
        self.assertEqual(out["nodes"][out["labels"]["b"]], {"op": "label", "name": "b"})

    def test_menu_nested_body(self):
        src = ('label m:\n'
               '    menu:\n'
               '        n "고를래?"\n'
               '        "A":\n'
               '            mc "에이"\n'
               '        "B":\n'
               '            jump m\n')
        out = convert(src)
        menu = out["nodes"][1]
        self.assertEqual(menu["op"], "menu")
        self.assertEqual(menu["prompt"], "고를래?")
        self.assertEqual(menu["choices"][0]["text"], "A")
        self.assertEqual(menu["choices"][0]["body"][0], {"op": "say", "who": "mc", "text": "에이"})
        self.assertEqual(menu["choices"][1]["body"][0], {"op": "jump", "label": "m"})

class TestDollar(unittest.TestCase):
    def test_py_to_js_operators(self):
        self.assertEqual(py_to_js('a and b or not c'), 'a && b || ! c')
        self.assertEqual(py_to_js('x == True'), 'x == true')

    def test_recv_send_chatreset(self):
        out = convert('label x:\n    $ chat_reset("서아")\n    $ recv("안녕", name="서아")\n    $ send("ㅎㅇ")\n')
        n = out["nodes"]
        self.assertEqual(n[1], {"op": "chat_open", "room": "서아"})
        self.assertEqual(n[2], {"op": "recv", "name": "서아", "text": "안녕"})
        self.assertEqual(n[3], {"op": "send", "text": "ㅎㅇ"})

    def test_helper_call_becomes_set_with_prefix(self):
        out = convert('label x:\n    $ add_like("seoa", 15)\n')
        self.assertEqual(out["nodes"][1], {"op": "set", "expr": 'S.add_like("seoa", 15)'})

    def test_assignment_var_prefixed(self):
        out = convert('label x:\n    $ promise_spring = True\n')
        # promise_spring is a known var (passed via var_names at convert time)
        self.assertEqual(out["nodes"][1], {"op": "set", "expr": 'V.promise_spring = true'})

    def test_music_and_ping(self):
        out = convert('label x:\n    $ pmusic("audio/bgm/a.ogg", fadein=1.0)\n    $ doyun_ping("형 잘돼?")\n')
        self.assertEqual(out["nodes"][1], {"op": "music", "file": "audio/bgm/a.ogg", "fadein": 1.0})
        self.assertEqual(out["nodes"][2], {"op": "toast", "kind": "doyun", "text": "형 잘돼?"})

    def test_if_cond_translated(self):
        out = convert('label x:\n    if has_item("sakura_card"):\n        "있다"\n')
        self.assertEqual(out["nodes"][1]["cond"], 'S.has_item("sakura_card")')

    def test_persistent_rhs_scope_prefixed(self):
        # NOTE: this test is superseded by test_play_count_increment_stripped below (I-2).
        # The old behavior (producing a set node) is no longer valid — this test now confirms
        # the INCREMENT line is dropped (returns None). Keep for documentation; see I-2 tests.
        out = convert('label x:\n    $ persistent.play_count = (persistent.play_count or 0) + 1\n')
        # I-2: play_count increment owned by boot (view_dom) — must be stripped from script
        ops = [n.get("op") for n in out["nodes"]]
        self.assertNotIn("set", ops)

    # FIX I-2: play_count double-increment prevention
    def test_play_count_increment_stripped(self):
        """$ persistent.play_count = ... increment must produce NO set node (owned by boot)."""
        out = convert('label x:\n    $ persistent.play_count = (persistent.play_count or 0) + 1\n')
        ops = [n.get("op") for n in out["nodes"]]
        self.assertNotIn("set", ops, "play_count increment should be stripped (I-2)")

    def test_play_count_condition_kept(self):
        """if persistent.play_count >= 2: condition node must NOT be stripped."""
        out = convert('label x:\n    if persistent.play_count >= 2:\n        "x"\n')
        # Must have an if node with the correct cond
        if_nodes = [n for n in out["nodes"] if n.get("op") == "if"]
        self.assertEqual(len(if_nodes), 1, "if node for play_count condition must be kept")
        self.assertEqual(if_nodes[0]["cond"], "P.play_count >= 2")


class TestSpecialCalls(unittest.TestCase):
    def test_consult_doyun_maps_to_consult_op(self):
        # call consult_doyun("seoa") → 엔진 내장 consult op (dead generic call 아님)
        out = convert('label x:\n    call consult_doyun("seoa")\n')
        self.assertEqual(out["nodes"][1], {"op": "consult", "who": "seoa"})

    def test_consult_doyun_default_who(self):
        # 인자 없는 호출은 who 기본 "seoa"
        out = convert('label x:\n    call consult_doyun()\n')
        self.assertEqual(out["nodes"][1], {"op": "consult", "who": "seoa"})

    def test_reply_prompt_dropped(self):
        # call reply_prompt(...) → 다음 마일스톤으로 보류, dead {op:call} 미발생
        out = convert('label x:\n    call reply_prompt("seoa")\n    "다음"\n')
        ops = [n.get("op") for n in out["nodes"]]
        self.assertNotIn("call", ops)
        self.assertEqual(out["nodes"][1], {"op": "say", "who": "n", "text": "다음"})


class TestGaugeMirrorSkip(unittest.TestCase):
    # CLAUDE.md #1: 게이지 숫자 미러 표시/셋업은 변환 단계에서 결정론적으로 드롭
    def test_gauge_mirror_display_say_dropped(self):
        out = convert('label x:\n    n "(서아 — 호감 [seoa_like] / 진심 [seoa_sinc])"\n    "그 다음"\n')
        texts = [n.get("text") for n in out["nodes"] if n.get("op") == "say"]
        self.assertNotIn("(서아 — 호감 [seoa_like] / 진심 [seoa_sinc])", texts)
        self.assertIn("그 다음", texts)

    def test_gauge_mirror_setup_dollar_dropped(self):
        out = convert('label x:\n    $ seoa_like = like["seoa"]\n    $ seoa_sinc = sincere["seoa"]\n    "끝"\n')
        ops = [n.get("op") for n in out["nodes"]]
        # set 노드(미러 셋업) 없음 — say(label/끝)만 남아야
        self.assertNotIn("set", ops)
        self.assertEqual(out["nodes"][1], {"op": "say", "who": "n", "text": "끝"})


class TestMulti(unittest.TestCase):
    def test_concat_labels_offset(self):
        import tempfile, os, io
        a = 'label episode1_full:\n    "a"\n    jump episode2_full\n'
        b = 'label episode2_full:\n    "b"\n    return\n'
        with tempfile.NamedTemporaryFile(mode='w', suffix='.rpy', encoding='utf-8', delete=False) as fa:
            fa.write(a); pa = fa.name
        with tempfile.NamedTemporaryFile(mode='w', suffix='.rpy', encoding='utf-8', delete=False) as fb:
            fb.write(b); pb = fb.name
        try:
            result = convert_files([pa, pb])
            nodes = result['nodes']
            labels = result['labels']
            # labels['episode2_full'] must point to the flat index of that label node
            idx = labels['episode2_full']
            self.assertEqual(nodes[idx], {'op': 'label', 'name': 'episode2_full'})
            # episode1_full should still be at index 0
            self.assertEqual(labels['episode1_full'], 0)
            self.assertEqual(nodes[labels['episode1_full']], {'op': 'label', 'name': 'episode1_full'})
        finally:
            os.unlink(pa)
            os.unlink(pb)


if __name__ == '__main__':
    unittest.main()
