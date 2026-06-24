import unittest
from rpy2json import parse_lines, parse_declarations

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

if __name__ == '__main__':
    unittest.main()
