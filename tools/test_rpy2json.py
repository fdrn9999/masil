import unittest
from rpy2json import parse_lines, parse_declarations, convert

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

if __name__ == '__main__':
    unittest.main()
