"""Reusable contracts for every authored plugin skill."""

import json
import re
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
EVALUATIONS = ROOT / "evaluations"
ALLOWED_FRONTMATTER = {"name", "description", "license", "allowed-tools", "metadata"}
ROUTER = "using-physics-simulation-superpowers"


def parse_simple_yaml(text: str) -> dict:
    """Parse the deliberately small mapping shape used by skill metadata."""
    result: dict = {}
    stack: list[tuple[int, dict]] = [(-1, result)]
    for raw_line in text.splitlines():
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        match = re.fullmatch(r"\s*([A-Za-z_][\w-]*):(?:\s*(.*))?", raw_line)
        if not match:
            raise ValueError(f"unsupported YAML line: {raw_line!r}")
        key, value = match.groups()
        while indent <= stack[-1][0]:
            stack.pop()
        container = stack[-1][1]
        if value is None or not value.strip():
            child: dict = {}
            container[key] = child
            stack.append((indent, child))
            continue
        value = value.strip()
        if value in {"true", "false"}:
            container[key] = value == "true"
        elif value[0] in {"\"", "'"}:
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError(f"unterminated quoted scalar: {raw_line!r}")
            container[key] = value[1:-1]
        else:
            container[key] = value
    return result


def skill_frontmatter(path: Path) -> tuple[dict, str]:
    content = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", content, re.DOTALL)
    if not match:
        raise AssertionError(f"{path} must have simple YAML frontmatter")
    return parse_simple_yaml(match.group(1)), match.group(2)


class SimpleYamlParsingTests(unittest.TestCase):
    def test_parser_rejects_unterminated_quoted_scalars(self):
        for quote in ("\"", "'"):
            with self.subTest(quote=quote):
                with self.assertRaises(ValueError):
                    parse_simple_yaml(f"interface:\n  display_name: {quote}unterminated")

    def test_parser_accepts_valid_quoted_scalars(self):
        parsed = parse_simple_yaml(
            "interface:\n"
            "  display_name: \"Physics Simulation Router\"\n"
            "  short_description: 'Route real-time physics work to precise skills'\n"
        )
        self.assertEqual(
            parsed,
            {
                "interface": {
                    "display_name": "Physics Simulation Router",
                    "short_description": "Route real-time physics work to precise skills",
                }
            },
        )


class SkillContractTests(unittest.TestCase):
    def test_every_skill_directory_meets_the_shared_contract(self):
        self.assertTrue((SKILLS / ROUTER).is_dir(), "Task 5 router skill must exist")
        for skill_dir in sorted(path for path in SKILLS.iterdir() if path.is_dir()):
            with self.subTest(skill=skill_dir.name):
                frontmatter, body = skill_frontmatter(skill_dir / "SKILL.md")
                self.assertEqual(set(frontmatter).difference(ALLOWED_FRONTMATTER), set())
                self.assertEqual(frontmatter.get("name"), skill_dir.name)
                self.assertTrue(frontmatter.get("description", "").startswith("Use when"))
                self.assertNotIn("TODO", (skill_dir / "SKILL.md").read_text(encoding="utf-8").upper())
                self._assert_metadata(skill_dir)
                self._assert_evaluation(skill_dir)
                self._assert_markdown_links(skill_dir, body)

    def _assert_metadata(self, skill_dir: Path) -> None:
        path = skill_dir / "agents" / "openai.yaml"
        raw = path.read_text(encoding="utf-8")
        metadata = parse_simple_yaml(raw)
        self.assertTrue(set(metadata).issubset({"interface", "policy"}))
        self.assertIn("interface", metadata)
        interface = metadata["interface"]
        self.assertEqual(set(interface), {"display_name", "short_description", "default_prompt"})
        for field in interface:
            source = next(line for line in raw.splitlines() if line.lstrip().startswith(f"{field}:"))
            self.assertIn(source.split(":", 1)[1].strip()[:1], {"\"", "'"})
        self.assertTrue(interface["display_name"].strip())
        self.assertTrue(25 <= len(interface["short_description"]) <= 64)
        self.assertIn(f"${skill_dir.name}", interface["default_prompt"])
        if "policy" in metadata:
            self.assertEqual(metadata["policy"], {"allow_implicit_invocation": True})

    def _assert_evaluation(self, skill_dir: Path) -> None:
        path = EVALUATIONS / skill_dir.name / "evaluation.json"
        self.assertTrue(path.is_file(), f"missing evaluation record: {path.relative_to(ROOT)}")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], skill_dir.name)

    def _assert_markdown_links(self, skill_dir: Path, body: str) -> None:
        for target in re.findall(r"\]\(([^)]+)\)", body):
            with self.subTest(link=target):
                self.assertNotIn("\\", target)
                self.assertFalse(target.startswith(("/", "#")))
                self.assertNotRegex(target, r"^[A-Za-z][A-Za-z0-9+.-]*:")
                relative = target.split("#", 1)[0]
                self.assertTrue((skill_dir / relative).resolve().is_file())

    def test_router_is_a_compact_minimum_sufficient_routing_contract(self):
        path = SKILLS / ROUTER / "SKILL.md"
        frontmatter, body = skill_frontmatter(path)
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", body)), 200)
        self.assertTrue(frontmatter["description"].startswith("Use when"))
        for term in ("real-time physics simulation", "物理", "实时", "仿真"):
            self.assertIn(term, frontmatter["description"])
        for field in (
            "build|debug|profile|survey|review|experiment|analyze|reproduce|transfer",
            "domain",
            "engine/backend",
            "2D/3D",
            "authoritative/cosmetic",
            "network model",
            "target platform",
            "FPS/tick",
            "CPU/GPU/memory budget",
            "60 FPS",
            "version must be verified before API symbols",
        ):
            self.assertIn(field, body)
        self.assertIn(
            "real-time games and transferable graphics/robotics/multibody/differentiable/GPU/numerical research are in scope; traditional CAE, molecular dynamics, and offline scientific CFD are out unless explicitly requested for real-time-game transfer analysis.",
            body,
        )
        self.assertIn(
            "Add architecture only for new contracts; debugging/profiling only when intent/evidence needs them; load one named adapter and only necessary research lanes.",
            body,
        )
        for paper_state_rule in (
            "unknown paper/repo -> survey",
            "candidate paper -> review",
            "executable claim -> reproduce",
            "game adoption -> translate",
        ):
            self.assertIn(paper_state_rule, body)
        required_skills = (
            "architecting-real-time-physics",
            "rigid-body-collision-contact",
            "constraints-ragdolls-active-physics",
            "character-controller-movement",
            "vehicle-physics",
            "cloth-rope-soft-bodies",
            "destruction-fracture-fields",
            "real-time-fluids-particles",
            "networked-deterministic-physics",
            "debugging-testing-physics",
            "profiling-scaling-physics",
            "unreal-chaos-physics",
            "unity-real-time-physics",
            "godot-jolt-physics",
            "native-jolt-physics",
            "nvidia-physx-sdk",
            "rapier-physics",
            "box2d-physics",
            "surveying-real-time-physics-research",
            "reviewing-simulation-papers",
            "designing-simulation-experiments",
            "analyzing-simulation-evidence",
            "reproducing-simulation-papers",
            "translating-research-to-game-physics",
        )
        for name in required_skills:
            self.assertIn(name, body)
        headings = re.findall(r"^## (.+)$", body, re.MULTILINE)
        self.assertEqual(headings, ["Selected skills", "Missing context"])


if __name__ == "__main__":
    unittest.main()
