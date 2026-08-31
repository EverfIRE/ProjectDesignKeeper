#!/usr/bin/env python3
"""Create a deterministic Codex plugin ZIP and an optional verified install tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import sys
import tempfile
import zipfile
from pathlib import Path


RELEASE_ROOT_FILES = {"LICENSE", "README.zh-CN.md", "THIRD_PARTY_NOTICES.md"}
RELEASE_ROOT_DIRECTORIES = {
    ".codex-plugin", "assets", "references", "schemas", "scripts", "skills"
}
DEVELOPMENT_ONLY_ROOTS = {
    ".git", ".superpowers", "docs", "evaluations", "outputs", "tests"
}
EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".superpowers",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
    "outputs",
}
EXCLUDED_TEST_SCRATCH_NAMES = {".scratch", "scratch", "tmp"}
EXCLUDED_FILE_ENDINGS = (
    ".7z",
    ".bak",
    ".bz2",
    ".coverage",
    ".gz",
    ".pyc",
    ".pyo",
    ".rar",
    ".swp",
    ".tar",
    ".tgz",
    ".tmp",
    ".xz",
    ".zip",
    "~",
)
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def is_excluded(relative: Path) -> bool:
    """Return whether a source-relative path belongs outside the portable package."""
    folded_parts = tuple(part.casefold() for part in relative.parts)
    if any(part in EXCLUDED_DIRECTORY_NAMES for part in folded_parts):
        return True
    if (
        len(folded_parts) >= 2
        and folded_parts[0] == "tests"
        and folded_parts[1] in EXCLUDED_TEST_SCRATCH_NAMES
    ):
        return True
    lowered = relative.name.casefold()
    return lowered.endswith(EXCLUDED_FILE_ENDINGS)


def is_link_or_reparse(path: Path) -> bool:
    """Return whether an entry is a symlink, junction, or Windows reparse point."""
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    if callable(is_junction) and is_junction():
        return True
    try:
        attributes = getattr(os.lstat(path), "st_file_attributes", 0)
    except FileNotFoundError:
        return False
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)
    return bool(attributes & reparse_flag)


def resolve_source_root(source_root: Path | str) -> Path:
    """Validate a physical source root before resolving it for packaging."""
    candidate = Path(source_root).expanduser()
    if candidate.drive and not candidate.root:
        raise ValueError(f"drive-relative source roots are not packageable: {candidate}")
    raw_candidate = candidate if candidate.is_absolute() else Path.cwd() / candidate
    component = Path(raw_candidate.anchor)
    for part in raw_candidate.parts[1:]:
        if part == "..":
            component = component.parent
            continue
        component /= part
        if is_link_or_reparse(component):
            raise ValueError(
                f"source root links and junctions are not packageable: {component}"
            )
    source = candidate.resolve()
    if not source.is_dir():
        raise FileNotFoundError(f"source directory does not exist: {source}")
    return source


def plugin_identity(source_root: Path) -> tuple[str, str]:
    """Return the validated plugin name and version from its manifest."""
    source = resolve_source_root(source_root)
    manifest_directory = source / ".codex-plugin"
    if is_link_or_reparse(manifest_directory):
        raise ValueError("links and junctions are not packageable: .codex-plugin")
    manifest_path = manifest_directory / "plugin.json"
    if is_link_or_reparse(manifest_path):
        raise ValueError(
            "links and junctions are not packageable: .codex-plugin/plugin.json"
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"unable to read plugin manifest {manifest_path}: {error}") from error
    if not isinstance(manifest, dict):
        raise ValueError(f"{manifest_path} must contain a JSON object")
    name = manifest.get("name")
    version = manifest.get("version")
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f"{manifest_path} must contain a nonempty string name")
    if not isinstance(version, str) or not version.strip():
        raise ValueError(f"{manifest_path} must contain a nonempty string version")
    if any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in name):
        raise ValueError(f"plugin name must be lowercase hyphen-case: {name}")
    return name, version


def collect_release_files(source_root: Path | str) -> list[Path]:
    """Collect sorted source-relative files from the explicit release allowlist."""
    source = resolve_source_root(source_root)
    files: list[Path] = []
    for name in sorted(RELEASE_ROOT_FILES):
        path = source / name
        if is_link_or_reparse(path):
            raise ValueError(f"links and junctions are not packageable: {name}")
        if not path.is_file():
            raise FileNotFoundError(f"required release file is missing: {name}")
        files.append(Path(name))
    for name in sorted(RELEASE_ROOT_DIRECTORIES):
        directory = source / name
        if is_link_or_reparse(directory):
            raise ValueError(f"links and junctions are not packageable: {name}")
        if not directory.is_dir():
            raise FileNotFoundError(f"required release directory is missing: {name}")
        if name == ".codex-plugin":
            manifest = directory / "plugin.json"
            if is_link_or_reparse(manifest):
                raise ValueError("links and junctions are not packageable: .codex-plugin/plugin.json")
            if not manifest.is_file():
                raise FileNotFoundError(
                    "required release file is missing: .codex-plugin/plugin.json"
                )
            files.append(Path(".codex-plugin/plugin.json"))
            continue
        for path in directory.rglob("*"):
            relative = path.relative_to(source)
            if is_link_or_reparse(path):
                raise ValueError(
                    f"links and junctions are not packageable: {relative.as_posix()}"
                )
            if path.is_file() and not is_excluded(relative):
                files.append(relative)
    return sorted(files, key=lambda path: path.as_posix())


def collect_files(source_root: Path | str) -> list[Path]:
    """Compatibility alias for the curated release collector."""
    return collect_release_files(source_root)


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def hash_tree(root: Path | str, files: list[Path] | None = None) -> dict[str, str]:
    """Return a stable relative-path to SHA-256 map for eligible files."""
    root_path = resolve_source_root(root)
    curated_members = collect_release_files(root_path)
    if files is None:
        members = curated_members
    else:
        supplied_members = [Path(relative).as_posix() for relative in files]
        expected_members = [relative.as_posix() for relative in curated_members]
        if supplied_members != expected_members:
            raise ValueError("hash tree members must exactly match curated release files")
        members = curated_members
    return {relative.as_posix(): hash_file(root_path / relative) for relative in members}


def tree_digest(hashes: dict[str, str]) -> str:
    """Hash a sorted path/hash manifest without depending on JSON formatting."""
    digest = hashlib.sha256()
    for relative, file_digest in sorted(hashes.items()):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(file_digest))
    return digest.hexdigest()


def hash_archive(
    archive_path: Path | str,
    plugin_name: str,
    *,
    expected_hashes: dict[str, str] | None = None,
) -> dict[str, str]:
    """Return and validate the file hash map stored below one plugin prefix."""
    archive = Path(archive_path).expanduser().resolve()
    prefix = f"{plugin_name}/"
    hashes: dict[str, str] = {}
    with zipfile.ZipFile(archive) as package:
        for info in package.infolist():
            member = info.orig_filename
            if (
                info.is_dir()
                or "\\" in member
                or not member.startswith(prefix)
            ):
                raise RuntimeError(f"invalid archive member: {member}")
            relative = member.removeprefix(prefix)
            if not relative or any(
                part in {"", ".", ".."} for part in relative.split("/")
            ):
                raise RuntimeError(f"invalid archive member: {member}")
            if relative in hashes:
                raise RuntimeError(f"duplicate or empty archive member: {member}")
            hashes[relative] = hashlib.sha256(package.read(info)).hexdigest()
    if expected_hashes is not None and hashes != expected_hashes:
        raise RuntimeError("archive contents do not match expected release hashes")
    return hashes


def write_archive(source_root: Path | str, archive_path: Path | str) -> dict[str, object]:
    """Write an atomically replaced deterministic ZIP and return its evidence record."""
    source = resolve_source_root(source_root)
    archive = Path(archive_path).expanduser().resolve()

    try:
        archive_relative = archive.relative_to(source)
    except ValueError:
        archive_relative = None

    if archive_relative is not None and (
        not archive_relative.parts or archive_relative.parts[0].casefold() != "outputs"
    ):
        raise ValueError("archive path inside source must be under outputs")
    if archive.suffix.casefold() != ".zip":
        raise ValueError("archive path must end in .zip")

    plugin_name, version = plugin_identity(source)
    files = collect_release_files(source)
    hashes = hash_tree(source, files)
    archive.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        dir=archive.parent,
        prefix=f".{archive.name}.",
        suffix=".tmp",
    )
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        with zipfile.ZipFile(
            temporary,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
            strict_timestamps=False,
        ) as package:
            for relative in files:
                archive_name = f"{plugin_name}/{relative.as_posix()}"
                info = zipfile.ZipInfo(archive_name, date_time=ZIP_TIMESTAMP)
                info.create_system = 3
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o100644 & 0xFFFF) << 16
                package.writestr(info, (source / relative).read_bytes(), compresslevel=9)
        hash_archive(temporary, plugin_name, expected_hashes=hashes)
        temporary.replace(archive)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {
        "archive": str(archive),
        "archive_sha256": hash_file(archive),
        "file_count": len(files),
        "plugin_name": plugin_name,
        "tree_sha256": tree_digest(hashes),
        "version": version,
    }


def install_tree(
    source_root: Path | str,
    install_dir: Path | str,
    *,
    expected_tree_sha256: str | None = None,
) -> dict[str, object]:
    """Copy eligible source files into a new target and verify every byte before publish."""
    source = resolve_source_root(source_root)
    target = Path(install_dir).expanduser().resolve()
    plugin_name, version = plugin_identity(source)
    if target == source or source in target.parents:
        raise ValueError("install target must be outside the source tree")
    if target.exists():
        raise FileExistsError(f"install target already exists: {target}")
    files = collect_release_files(source)
    source_hashes = hash_tree(source, files)
    source_digest = tree_digest(source_hashes)
    if expected_tree_sha256 is not None and source_digest != expected_tree_sha256:
        raise RuntimeError("source tree changed after archive creation")
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(dir=target.parent, prefix=f".{target.name}.staging-")
    ).resolve()
    try:
        for relative in files:
            destination = staging / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / relative, destination)
        installed_hashes = hash_tree(staging)
        if installed_hashes != source_hashes:
            raise RuntimeError("installed staging tree does not match source hashes")
        staging.rename(target)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return {
        "file_count": len(files),
        "install_dir": str(target),
        "plugin_name": plugin_name,
        "tree_sha256": source_digest,
        "version": version,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a deterministic Codex plugin ZIP and optional verified install tree."
    )
    parser.add_argument("--source", default=".", help="Plugin source root (default: current directory)")
    parser.add_argument("--archive", required=True, help="Destination ZIP path")
    parser.add_argument(
        "--install-dir",
        help="Optional exact plugin install directory; must not already exist",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        source = resolve_source_root(args.source)
        archive_result = write_archive(source, args.archive)
        result: dict[str, object] = {
            "archive": archive_result["archive"],
            "archive_sha256": archive_result["archive_sha256"],
            "file_count": archive_result["file_count"],
            "installed_path": None,
            "installed_tree_sha256": None,
            "plugin_name": archive_result["plugin_name"],
            "source": str(source),
            "source_tree_sha256": archive_result["tree_sha256"],
            "version": archive_result["version"],
        }
        if args.install_dir:
            installed = install_tree(
                source,
                args.install_dir,
                expected_tree_sha256=str(archive_result["tree_sha256"]),
            )
            result["installed_path"] = installed["install_dir"]
            result["installed_tree_sha256"] = installed["tree_sha256"]
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
        return 0
    except (FileExistsError, FileNotFoundError, OSError, RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
