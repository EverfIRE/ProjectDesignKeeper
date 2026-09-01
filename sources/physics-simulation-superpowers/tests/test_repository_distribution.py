import importlib.util
import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


SOURCE = Path(__file__).resolve().parents[1]
REPO = SOURCE.parents[1]
RELEASE = REPO / "plugins" / "physics-simulation-superpowers"
REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)


def load_packager():
    path = SOURCE / "scripts" / "package_plugin.py"
    spec = importlib.util.spec_from_file_location("physics_release_packager", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def is_link_or_reparse(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    if is_junction is not None and is_junction():
        return True
    attributes = getattr(path.lstat(), "st_file_attributes", 0)
    return bool(attributes & REPARSE_POINT)


def release_tree(root: Path) -> list[tuple[Path, Path, str]]:
    if is_link_or_reparse(root):
        raise AssertionError("release root is linked or a reparse point")
    result = []
    pending = [root]
    while pending:
        directory = pending.pop()
        for path in directory.iterdir():
            relative = path.relative_to(root)
            if is_link_or_reparse(path):
                raise AssertionError(
                    f"release contains linked or reparse entry: {relative}"
                )
            if path.is_file():
                result.append((relative, path, "file"))
            elif path.is_dir():
                result.append((relative, path, "directory"))
                pending.append(path)
            else:
                raise AssertionError(f"release contains non-regular entry: {relative}")
    return result


def release_files(root: Path) -> dict[Path, bytes]:
    return {
        relative: path.read_bytes()
        for relative, path, entry_type in release_tree(root)
        if entry_type == "file"
    }


def release_entries(root: Path) -> dict[Path, str]:
    return {
        relative: entry_type
        for relative, _path, entry_type in release_tree(root)
    }


def assert_exact_release(expected: Path, committed: Path) -> None:
    if release_entries(expected) != release_entries(committed):
        raise AssertionError("release contains missing, extra, or non-regular entries")
    if release_files(expected) != release_files(committed):
        raise AssertionError("release contains missing, extra, or modified files")


class RepositoryDistributionTests(unittest.TestCase):
    def test_reparse_detector_uses_windows_lstat_attributes_without_is_junction(self):
        class ReparsePathWithoutJunctionApi:
            def is_symlink(self):
                return False

            def lstat(self):
                return SimpleNamespace(st_file_attributes=REPARSE_POINT)

        self.assertTrue(is_link_or_reparse(ReparsePathWithoutJunctionApi()))

    @unittest.skipUnless(os.name == "nt", "junctions are a Windows filesystem feature")
    def test_root_and_nested_junctions_are_rejected_before_traversal(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            target = base / "external"
            target.mkdir()
            (target / "outside.txt").write_text("outside", encoding="utf-8")
            release = base / "release"
            release.mkdir()

            def make_junction(link: Path):
                result = subprocess.run(
                    ["cmd", "/c", "mklink", "/J", str(link), str(target)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode != 0:
                    self.skipTest(
                        f"junction creation is unavailable: {result.stdout}{result.stderr}"
                    )

            root_junction = base / "root-junction"
            make_junction(root_junction)
            try:
                with self.assertRaisesRegex(AssertionError, "linked|reparse"):
                    release_entries(root_junction)
            finally:
                os.rmdir(root_junction)

            nested_junction = release / "nested-junction"
            make_junction(nested_junction)
            try:
                with self.assertRaisesRegex(AssertionError, "linked|reparse"):
                    release_entries(release)
            finally:
                os.rmdir(nested_junction)

    def test_published_manifest_uses_project_design_metadata(self):
        manifest = json.loads(
            (RELEASE / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8")
        )
        self.assertEqual(manifest["name"], "physics-simulation-superpowers")
        self.assertEqual(manifest["version"], "0.1.0")
        self.assertEqual(manifest["license"], "Apache-2.0")
        self.assertEqual(manifest["homepage"], "https://github.com/EverfIRE/ProjectDesign")
        self.assertEqual(manifest["repository"], "https://github.com/EverfIRE/ProjectDesign")
        self.assertEqual(
            manifest["author"],
            {"name": "EverfIRE", "url": "https://github.com/EverfIRE"},
        )

    def test_committed_release_matches_curated_source_bytes(self):
        package_plugin = load_packager()
        self.assertTrue(RELEASE.is_dir())
        self.assertEqual(package_plugin.hash_tree(SOURCE), package_plugin.hash_tree(RELEASE))

    def test_committed_release_has_no_extra_root_or_manifest_files(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            generated = Path(temporary) / "generated"
            package_plugin.install_tree(SOURCE, generated)
            assert_exact_release(generated, RELEASE)
            for extra in ("UNAPPROVED.txt", ".codex-plugin/private.json"):
                altered = Path(temporary) / extra.replace("/", "-")
                package_plugin.install_tree(SOURCE, altered)
                target = altered / extra
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("not approved", encoding="utf-8")
                with self.assertRaisesRegex(AssertionError, "extra"):
                    assert_exact_release(altered, RELEASE)

    def test_archive_matches_committed_release(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "physics-simulation-superpowers.zip"
            result = package_plugin.write_archive(RELEASE, archive)
            digest = package_plugin.tree_digest(package_plugin.hash_tree(RELEASE))
            self.assertEqual(result["tree_sha256"], digest)
