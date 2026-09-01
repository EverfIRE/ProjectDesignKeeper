import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
VALIDATOR = REPO / "tools" / "validate_codex_plugin.py"
RELEASE = REPO / "plugins" / "physics-simulation-superpowers"


class ValidateCodexPluginCliTests(unittest.TestCase):
    def run_validator(self, *arguments):
        return subprocess.run(
            [sys.executable, str(VALIDATOR), *map(str, arguments)],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_rejects_unknown_manifest_field(self):
        with tempfile.TemporaryDirectory() as temporary:
            plugin = Path(temporary) / "plugin"
            shutil.copytree(RELEASE, plugin)
            manifest_path = plugin / ".codex-plugin" / "plugin.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["unapproved"] = True
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            result = self.run_validator("plugin", plugin)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unknown manifest field", result.stderr)

    def test_rejects_skill_description_that_violates_contract(self):
        with tempfile.TemporaryDirectory() as temporary:
            skill = Path(temporary) / "unreal-chaos-physics"
            shutil.copytree(RELEASE / "skills" / skill.name, skill)
            document = skill / "SKILL.md"
            document.write_text(
                document.read_text(encoding="utf-8").replace(
                    'description: "Use when UE5',
                    'description: "TODO <bad> UE5',
                    1,
                ),
                encoding="utf-8",
            )
            result = self.run_validator("skill", skill)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("description", result.stderr)

    def test_rejects_documented_skill_contract_mutations(self):
        mutations = {
            "non-use-when": lambda skill: (skill / "SKILL.md").write_text((skill / "SKILL.md").read_text(encoding="utf-8").replace('description: "Use when', 'description: "Explains', 1), encoding="utf-8"),
            "todo-body": lambda skill: (skill / "SKILL.md").write_text((skill / "SKILL.md").read_text(encoding="utf-8") + "\nTODO: finish this\n", encoding="utf-8"),
            "unterminated-quote": lambda skill: (skill / "SKILL.md").write_text(__import__("re").sub(r'^description:.*$', 'description: "unterminated', (skill / "SKILL.md").read_text(encoding="utf-8"), count=1, flags=__import__("re").MULTILINE), encoding="utf-8"),
            "short-agent-description": lambda skill: (skill / "agents" / "openai.yaml").write_text((skill / "agents" / "openai.yaml").read_text(encoding="utf-8").replace('short_description: "Map current UE Chaos workflows with evidence"', 'short_description: "short"'), encoding="utf-8"),
            "wrong-agent-prompt": lambda skill: (skill / "agents" / "openai.yaml").write_text((skill / "agents" / "openai.yaml").read_text(encoding="utf-8").replace('$unreal-chaos-physics', '$wrong-skill'), encoding="utf-8"),
            "prompt-cross-field-spoof": lambda skill: (skill / "agents" / "openai.yaml").write_text((skill / "agents" / "openai.yaml").read_text(encoding="utf-8").replace('display_name: "Unreal Chaos Physics"', 'display_name: "Unreal Chaos Physics $unreal-chaos-physics"').replace('default_prompt: "Use $unreal-chaos-physics', 'default_prompt: "Use $wrong-skill'), encoding="utf-8"),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                skill = Path(temporary) / "unreal-chaos-physics"
                shutil.copytree(RELEASE / "skills" / skill.name, skill)
                mutate(skill)
                self.assertNotEqual(self.run_validator("skill", skill).returncode, 0)


if __name__ == "__main__":
    unittest.main()
