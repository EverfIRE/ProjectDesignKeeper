"""Small, dependency-free validation for this repository's Codex plugin contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$")
SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MANIFEST_FIELDS = {"name", "version", "description", "author", "license", "homepage", "repository", "skills", "assets", "interface"}
INTERFACE_FIELDS = {"displayName", "shortDescription", "longDescription", "developerName", "websiteURL", "category", "capabilities", "defaultPrompt"}


class ValidationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def inside(root: Path, value: str, label: str) -> Path:
    require(isinstance(value, str) and value.strip(), f"{label} must be a nonempty path string")
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise ValidationError(f"{label} escapes plugin root") from error
    return candidate


def https_url(value: object, label: str) -> None:
    require(isinstance(value, str), f"{label} must be a string")
    parsed = urlparse(value)
    require(parsed.scheme == "https" and bool(parsed.netloc), f"{label} must be an HTTPS URL")


def text(value: object, label: str, *, limit: int = 1024) -> None:
    require(isinstance(value, str) and value.strip(), f"{label} must be a nonempty string")
    require(len(value) <= limit, f"{label} must be at most {limit} characters")
    require("<" not in value and ">" not in value and "todo" not in value.lower(), f"{label} contains forbidden placeholder markup")


def validate_plugin(root: Path) -> None:
    root = root.resolve()
    manifest_path = root / ".codex-plugin" / "plugin.json"
    require(manifest_path.is_file(), "plugin manifest is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(isinstance(manifest, dict), "manifest must be an object")
    unknown = set(manifest) - MANIFEST_FIELDS
    if unknown:
        raise ValidationError(f"unknown manifest field: {sorted(unknown)[0]}")
    required = MANIFEST_FIELDS - {"assets"}
    require(required <= set(manifest), f"manifest missing fields: {sorted(required - set(manifest))}")
    require(isinstance(manifest["name"], str) and SKILL_NAME.fullmatch(manifest["name"]) is not None, "manifest name must be hyphenated")
    require(isinstance(manifest["version"], str) and SEMVER.fullmatch(manifest["version"]) is not None, "manifest version must be strict semver")
    text(manifest["description"], "manifest description")
    require(isinstance(manifest["license"], str) and manifest["license"].strip(), "manifest license must be a nonempty string")
    author = manifest["author"]
    require(isinstance(author, dict) and set(author) == {"name", "url"}, "author must contain only name and url")
    text(author["name"], "author.name")
    https_url(author["url"], "author.url")
    https_url(manifest["homepage"], "homepage")
    https_url(manifest["repository"], "repository")
    skills = inside(root, manifest["skills"], "skills")
    require(skills.is_dir(), "skills path must exist inside plugin root")
    assets = manifest.get("assets", [])
    require(isinstance(assets, list), "assets must be a list")
    for asset in assets:
        require(inside(root, asset, "asset").exists(), f"asset does not exist: {asset}")
    interface = manifest["interface"]
    require(isinstance(interface, dict), "interface must be an object")
    require(set(interface) == INTERFACE_FIELDS, "interface has missing or unknown fields")
    for key in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
        text(interface[key], f"interface.{key}")
    https_url(interface["websiteURL"], "interface.websiteURL")
    require(isinstance(interface["capabilities"], list) and interface["capabilities"] and all(isinstance(item, str) and item.strip() for item in interface["capabilities"]), "interface.capabilities must be a nonempty string list")
    require(isinstance(interface["defaultPrompt"], list) and 1 <= len(interface["defaultPrompt"]) <= 3, "interface.defaultPrompt must contain one to three prompts")
    for prompt in interface["defaultPrompt"]:
        text(prompt, "interface.defaultPrompt item")


def parse_front_matter(document: Path) -> dict[str, str]:
    lines = document.read_text(encoding="utf-8").splitlines()
    require(lines and lines[0] == "---", "SKILL.md must start with front matter")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValidationError("SKILL.md front matter is unterminated") from error
    fields: dict[str, str] = {}
    for line in lines[1:end]:
        match = re.fullmatch(r"([a-z_]+):\s*(.+)", line)
        require(match is not None, "SKILL.md front matter must use simple key/value fields")
        key, value = match.groups()
        require(key in {"name", "description"}, f"unknown SKILL.md front matter field: {key}")
        require(key not in fields, f"duplicate SKILL.md front matter field: {key}")
        value = value.strip()
        if value.startswith('"') or value.endswith('"'):
            require(len(value) >= 2 and value.startswith('"') and value.endswith('"'), "SKILL.md front matter has an unterminated quote")
            value = value[1:-1]
        fields[key] = value
    return fields


def validate_agent_metadata(path: Path) -> dict[str, str]:
    require(path.is_file(), "skill agents/openai.yaml is missing")
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    expected = [
        "interface:",
        "  display_name:",
        "  short_description:",
        "  default_prompt:",
        "policy:",
        "  allow_implicit_invocation:",
    ]
    require(len(lines) == len(expected), "agents/openai.yaml has missing or unknown structure")
    values: dict[str, str] = {}
    for line, prefix in zip(lines, expected):
        require(line.startswith(prefix), f"agents/openai.yaml expected {prefix}")
        if prefix.endswith(":") and not prefix.startswith("  "):
            require(line == prefix, f"agents/openai.yaml section {prefix} must not have a value")
        else:
            value = line[len(prefix):].strip()
            if prefix == "  allow_implicit_invocation:":
                require(value in {"true", "false"}, "agents/openai.yaml allow_implicit_invocation must be a boolean")
                values[prefix] = value
            else:
                require(len(value) >= 2 and value[0] == value[-1] == '"', f"agents/openai.yaml {prefix.strip(':')} must be a quoted string")
                values[prefix] = value[1:-1]
    for key, value in values.items():
        if key != "  allow_implicit_invocation:":
            text(value, f"agents/openai.yaml {key.strip(':')}")
    short_description = values["  short_description:"]
    require(25 <= len(short_description) <= 64, "agents/openai.yaml short_description must be 25..64 characters")
    require(values["  allow_implicit_invocation:"] in {"true", "false"}, "agents/openai.yaml allow_implicit_invocation must be a boolean")
    return values


def validate_skill(root: Path) -> None:
    root = root.resolve()
    require(root.is_dir(), "skill root is missing")
    fields = parse_front_matter(root / "SKILL.md")
    require(set(fields) == {"name", "description"}, "SKILL.md must contain name and description")
    require(len(fields["name"]) <= 64 and SKILL_NAME.fullmatch(fields["name"]) is not None, "skill name must be hyphenated and at most 64 characters")
    require(fields["name"] == root.name, "skill name must match its directory")
    text(fields["description"], "skill description")
    require(fields["description"].startswith("Use when"), "skill description must start 'Use when'")
    in_fence = False
    for line in (root / "SKILL.md").read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
        elif not in_fence:
            require("todo" not in line.lower(), "SKILL.md body contains unfinished TODO")
    agent = validate_agent_metadata(root / "agents" / "openai.yaml")
    require(f"${fields['name']}" in agent["  default_prompt:"], "agents/openai.yaml default_prompt must mention the skill name")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=("plugin", "skill"))
    parser.add_argument("root", type=Path)
    args = parser.parse_args(argv)
    try:
        (validate_plugin if args.kind == "plugin" else validate_skill)(args.root)
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(error, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
