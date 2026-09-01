"""Task 31 deterministic packaging and install-parity contracts."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "package_plugin.py"
PLUGIN_NAME = "physics-simulation-superpowers"


def load_packager():
    spec = importlib.util.spec_from_file_location("package_plugin", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_fixture(root: Path) -> None:
    files = {
        ".codex-plugin/plugin.json": json.dumps(
            {"name": PLUGIN_NAME, "version": "0.1.0"}, sort_keys=True
        )
        + "\n",
        "LICENSE": "license\n",
        "README.zh-CN.md": "portable plugin\n",
        "THIRD_PARTY_NOTICES.md": "notices\n",
        "assets/icon.svg": "<svg/>\n",
        "references/sources.lock.json": "{}\n",
        "schemas/physics-run.schema.json": "{}\n",
        "scripts/tool.py": "print('tool')\n",
        "skills/example/SKILL.md": "---\nname: example\ndescription: Example.\n---\n",
        "docs/design.md": "must not ship\n",
        "evaluations/example/evaluation.json": "must not ship\n",
        "tests/test_keep.py": "KEEP = True\n",
        ".superpowers/report.md": "must not ship\n",
        "__pycache__/root.cpython-314.pyc": "must not ship\n",
        "skills/example/__pycache__/skill.pyc": "must not ship\n",
        "Outputs/generated.json": "must not ship\n",
        "tests/SCRATCH/run.json": "must not ship\n",
        "tests/.scratch/run.json": "must not ship\n",
        "scratch.tmp": "must not ship\n",
        "old-package.tar.gz": "must not ship\n",
    }
    for relative, text in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


class PackagingTests(unittest.TestCase):
    def test_red_phase_packager_exists(self):
        self.assertTrue(SCRIPT.is_file(), SCRIPT)

    def test_reparse_detector_uses_lstat_attributes_without_is_junction(self):
        package_plugin = load_packager()
        reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)

        class ReparsePathWithoutJunctionApi:
            def is_symlink(self):
                return False

        with mock.patch.object(
            package_plugin.os,
            "lstat",
            return_value=SimpleNamespace(st_file_attributes=reparse_flag),
        ):
            self.assertTrue(
                package_plugin.is_link_or_reparse(
                    ReparsePathWithoutJunctionApi()
                )
            )

    def test_public_entrypoints_reject_manifest_reparse_before_read_text(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            write_fixture(source)
            manifest_directory = (source / ".codex-plugin").resolve()

            operations = {
                "write archive": lambda: package_plugin.write_archive(
                    source, root / "plugin.zip"
                ),
                "install tree": lambda: package_plugin.install_tree(
                    source, root / "installed"
                ),
            }
            for label, operation in operations.items():
                with self.subTest(label=label), mock.patch.object(
                    package_plugin,
                    "is_link_or_reparse",
                    side_effect=lambda path: path == manifest_directory,
                ), mock.patch.object(
                    Path,
                    "read_text",
                    side_effect=AssertionError("manifest bytes were read before rejection"),
                ):
                    with self.assertRaisesRegex(ValueError, "links and junctions"):
                        operation()

    def test_install_guide_uses_verified_non_merging_packager(self):
        guide = (ROOT / "README.zh-CN.md").read_text(encoding="utf-8")
        self.assertIn("scripts/package_plugin.py", guide)
        self.assertIn("--install-dir", guide)
        self.assertIn("codex help plugin", guide)
        self.assertNotIn("Expand-Archive", guide)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_is_sorted_and_excludes_development_content(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            write_fixture(source)
            members = [path.as_posix() for path in package_plugin.collect_release_files(source)]
        self.assertEqual(members, sorted(members))
        self.assertEqual(
            members,
            [
                ".codex-plugin/plugin.json",
                "LICENSE",
                "README.zh-CN.md",
                "THIRD_PARTY_NOTICES.md",
                "assets/icon.svg",
                "references/sources.lock.json",
                "schemas/physics-run.schema.json",
                "scripts/tool.py",
                "skills/example/SKILL.md",
            ],
        )

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_includes_only_the_plugin_manifest(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            write_fixture(source)
            (source / ".codex-plugin" / "private.json").write_text(
                "must not ship\n", encoding="utf-8"
            )
            members = [path.as_posix() for path in package_plugin.collect_release_files(source)]
        self.assertNotIn(".codex-plugin/private.json", members)
        self.assertEqual(members.count(".codex-plugin/plugin.json"), 1)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_rejects_a_linked_source_root(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            linked_source = root / "linked-source"
            write_fixture(source)
            try:
                linked_source.symlink_to(source, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            with self.assertRaisesRegex(ValueError, "source root"):
                package_plugin.collect_release_files(linked_source)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_rejects_a_linked_source_ancestor(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            physical_parent = root / "physical-parent"
            source = physical_parent / "source"
            linked_parent = root / "linked-parent"
            write_fixture(source)
            try:
                linked_parent.symlink_to(physical_parent, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            with self.assertRaisesRegex(ValueError, "source root"):
                package_plugin.collect_release_files(linked_parent / "source")

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_rejects_a_linked_ancestor_before_parent_traversal(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            safe_source = root / "source"
            external_root = root / "external"
            external_source = external_root / "source"
            external_container = external_root / "container"
            linked_ancestor = root / "linked-ancestor"
            write_fixture(safe_source)
            write_fixture(external_source)
            external_container.mkdir()
            try:
                linked_ancestor.symlink_to(external_container, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            source_through_link_parent = linked_ancestor / ".." / "source"
            self.assertEqual(
                Path(os.path.abspath(source_through_link_parent)), safe_source
            )
            if os.name == "nt":
                self.assertEqual(source_through_link_parent.resolve(), safe_source.resolve())
            else:
                self.assertEqual(source_through_link_parent.resolve(), external_source.resolve())
            with self.assertRaisesRegex(ValueError, "source root"):
                package_plugin.collect_release_files(source_through_link_parent)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_rejects_a_link_after_missing_parent_traversal(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            external_root = root / "external"
            external_source = external_root / "source"
            linked_external = root / "linked-external"
            write_fixture(external_source)
            try:
                linked_external.symlink_to(external_root, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            source_through_missing_parent = (
                root / "missing" / ".." / "linked-external" / "source"
            )
            self.assertEqual(
                source_through_missing_parent.resolve(), external_source.resolve()
            )
            with self.assertRaisesRegex(ValueError, "source root"):
                package_plugin.collect_release_files(source_through_missing_parent)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_accepts_ordinary_relative_absolute_and_parent_paths(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            nested = root / "nested"
            write_fixture(source)
            nested.mkdir()
            expected = package_plugin.collect_release_files(source)
            previous = Path.cwd()
            try:
                os.chdir(root)
                self.assertEqual(package_plugin.collect_release_files(Path("source")), expected)
                self.assertEqual(
                    package_plugin.collect_release_files(Path("nested") / ".." / "source"),
                    expected,
                )
                if os.name == "nt":
                    self.assertEqual(
                        package_plugin.collect_release_files(Path(str(source)[2:])),
                        expected,
                    )
            finally:
                os.chdir(previous)

    @unittest.skipUnless(os.name == "nt", "Windows drive-relative path test")
    def test_resolve_source_root_rejects_drive_relative_paths(self):
        package_plugin = load_packager()
        for source_root in (Path("C:relative"), Path("C:..") / "linked-source"):
            with self.subTest(source_root=source_root):
                with self.assertRaisesRegex(ValueError, "drive-relative source roots"):
                    package_plugin.resolve_source_root(source_root)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_collect_release_files_rejects_a_linked_required_directory(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            external_manifest = root / "external-manifest"
            write_fixture(source)
            shutil.rmtree(source / ".codex-plugin")
            external_manifest.mkdir()
            (external_manifest / "plugin.json").write_text(
                json.dumps({"name": PLUGIN_NAME, "version": "0.1.0"}) + "\n",
                encoding="utf-8",
            )
            try:
                (source / ".codex-plugin").symlink_to(
                    external_manifest, target_is_directory=True
                )
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            with self.assertRaisesRegex(ValueError, "links and junctions"):
                package_plugin.collect_release_files(source)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_hash_tree_rejects_unapproved_and_escaping_members(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            write_fixture(source)
            (root / "outside.txt").write_text("outside source\n", encoding="utf-8")
            with self.subTest(member="docs/design.md"):
                with self.assertRaisesRegex(ValueError, "curated release"):
                    package_plugin.hash_tree(source, [Path("docs/design.md")])
            with self.subTest(member="../outside.txt"):
                with self.assertRaisesRegex(ValueError, "curated release"):
                    package_plugin.hash_tree(source, [Path("../outside.txt")])
            curated = package_plugin.collect_release_files(source)
            with self.subTest(member="absolute LICENSE"):
                with self.assertRaisesRegex(ValueError, "curated release"):
                    package_plugin.hash_tree(source, [source / "LICENSE"])
            with self.subTest(member="duplicate manifest"):
                with self.assertRaisesRegex(ValueError, "curated release"):
                    package_plugin.hash_tree(source, [*curated, curated[0]])

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_every_development_root_is_absent_from_collected_members(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            write_fixture(source)
            for root in package_plugin.DEVELOPMENT_ONLY_ROOTS:
                marker = source / root / "marker.txt"
                marker.parent.mkdir(parents=True, exist_ok=True)
                marker.write_text("must not ship\n", encoding="utf-8")
            members = [path.as_posix() for path in package_plugin.collect_release_files(source)]
        for root in package_plugin.DEVELOPMENT_ONLY_ROOTS:
            self.assertFalse(any(member == root or member.startswith(f"{root}/") for member in members))

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_required_release_members_must_exist(self):
        package_plugin = load_packager()
        required = [
            *package_plugin.RELEASE_ROOT_FILES,
            *package_plugin.RELEASE_ROOT_DIRECTORIES,
        ]
        for name in required:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                source = Path(temporary) / "source"
                write_fixture(source)
                target = source / name
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
                with self.assertRaisesRegex(FileNotFoundError, name):
                    package_plugin.collect_release_files(source)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_release_root_file_links_are_rejected(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            external = root / "external-license"
            write_fixture(source)
            external.write_text("outside source\n", encoding="utf-8")
            license_file = source / "LICENSE"
            license_file.unlink()
            try:
                license_file.symlink_to(external)
            except OSError as error:
                self.skipTest(f"unable to create test symlink: {error}")
            with self.assertRaisesRegex(ValueError, "links and junctions"):
                package_plugin.collect_release_files(source)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_worktree_gitfile_and_additional_archive_formats_are_excluded(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            write_fixture(source)
            (source / ".git").write_text("gitdir: ../shared/worktrees/example\n", encoding="utf-8")
            for name in ("old.7z", "old.rar", "old.tar.bz2", "old.tar.xz"):
                (source / name).write_text("archive\n", encoding="utf-8")
            members = [path.as_posix() for path in package_plugin.collect_release_files(source)]
        self.assertEqual(members, [
            ".codex-plugin/plugin.json",
            "LICENSE",
            "README.zh-CN.md",
            "THIRD_PARTY_NOTICES.md",
            "assets/icon.svg",
            "references/sources.lock.json",
            "schemas/physics-run.schema.json",
            "scripts/tool.py",
            "skills/example/SKILL.md",
        ])

    @unittest.skipUnless(os.name == "nt", "junctions are a Windows filesystem feature")
    def test_windows_directory_junctions_are_rejected_before_external_files_are_collected(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            external = root / "external"
            write_fixture(source)
            external.mkdir()
            (external / "secret.txt").write_text("outside source\n", encoding="utf-8")
            junction = source / "skills" / "junction"
            created = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(junction), str(external)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            if created.returncode != 0:
                self.skipTest(f"unable to create test junction: {created.stdout}{created.stderr}")
            reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)
            self.assertTrue(
                getattr(junction.lstat(), "st_file_attributes", 0) & reparse_flag
            )
            try:
                with self.assertRaisesRegex(ValueError, "links and junctions"):
                    package_plugin.collect_release_files(source)
            finally:
                os.rmdir(junction)

    @unittest.skipUnless(os.name == "nt", "junctions are a Windows filesystem feature")
    def test_write_archive_rejects_manifest_junction_before_parsing_external_json(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            external = root / "external-manifest"
            archive = root / "plugin.zip"
            write_fixture(source)
            shutil.rmtree(source / ".codex-plugin")
            external.mkdir()
            (external / "plugin.json").write_text("{ malformed external json", encoding="utf-8")
            junction = source / ".codex-plugin"
            created = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(junction), str(external)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            if created.returncode != 0:
                self.skipTest(f"unable to create test junction: {created.stdout}{created.stderr}")
            try:
                with self.assertRaisesRegex(ValueError, "links and junctions"):
                    package_plugin.write_archive(source, archive)
            finally:
                os.rmdir(junction)
            self.assertFalse(archive.exists())

    @unittest.skipUnless(os.name == "nt", "junctions are a Windows filesystem feature")
    def test_install_tree_rejects_manifest_junction_before_parsing_external_json(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            external = root / "external-manifest"
            target = root / "installed"
            write_fixture(source)
            shutil.rmtree(source / ".codex-plugin")
            external.mkdir()
            (external / "plugin.json").write_text("{ malformed external json", encoding="utf-8")
            junction = source / ".codex-plugin"
            created = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(junction), str(external)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            if created.returncode != 0:
                self.skipTest(f"unable to create test junction: {created.stdout}{created.stderr}")
            try:
                with self.assertRaisesRegex(ValueError, "links and junctions"):
                    package_plugin.install_tree(source, target)
            finally:
                os.rmdir(junction)
            self.assertFalse(target.exists())

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_archive_path_cannot_overwrite_source_and_must_be_a_zip(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            write_fixture(source)
            readme = source / "README.zh-CN.md"
            original = readme.read_bytes()
            with self.assertRaisesRegex(ValueError, "inside source must be under outputs"):
                package_plugin.write_archive(source, readme)
            self.assertEqual(readme.read_bytes(), original)
            with self.assertRaisesRegex(ValueError, "must end in .zip"):
                package_plugin.write_archive(source, root / "plugin.bin")
            allowed = source / "outputs" / "plugin.zip"
            package_plugin.write_archive(source, allowed)
            self.assertTrue(allowed.is_file())

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_hash_archive_rejects_unsafe_member_names(self):
        package_plugin = load_packager()
        cases = {
            "parent traversal": f"{PLUGIN_NAME}/../outside.txt",
            "absolute": f"/{PLUGIN_NAME}/outside.txt",
            "backslash": f"{PLUGIN_NAME}\\outside.txt",
            "wrong prefix": "other-plugin/outside.txt",
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for label, member in cases.items():
                with self.subTest(label=label):
                    archive_path = root / f"{label.replace(' ', '-')}.zip"
                    stored_member = member.replace("\\", "/")
                    with zipfile.ZipFile(archive_path, mode="w") as archive:
                        archive.writestr(stored_member, b"outside\n")
                    if stored_member != member:
                        archive_bytes = archive_path.read_bytes()
                        stored_bytes = stored_member.encode("utf-8")
                        self.assertEqual(archive_bytes.count(stored_bytes), 2)
                        archive_path.write_bytes(
                            archive_bytes.replace(stored_bytes, member.encode("utf-8"))
                        )
                    with zipfile.ZipFile(archive_path) as archive:
                        self.assertEqual(archive.infolist()[0].orig_filename, member)
                    with self.assertRaisesRegex(RuntimeError, "invalid archive member"):
                        package_plugin.hash_archive(archive_path, PLUGIN_NAME)

            duplicate_path = root / "duplicate.zip"
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(duplicate_path, mode="w") as archive:
                    member = f"{PLUGIN_NAME}/LICENSE"
                    archive.writestr(member, b"first\n")
                    archive.writestr(member, b"second\n")
            with self.assertRaisesRegex(RuntimeError, "duplicate or empty archive member"):
                package_plugin.hash_archive(duplicate_path, PLUGIN_NAME)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_hash_archive_accepts_the_expected_release_hash_map(self):
        package_plugin = load_packager()
        content = b"license\n"
        expected = {"LICENSE": hashlib.sha256(content).hexdigest()}
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "plugin.zip"
            with zipfile.ZipFile(archive_path, mode="w") as archive:
                archive.writestr(f"{PLUGIN_NAME}/LICENSE", content)
            try:
                actual = package_plugin.hash_archive(
                    archive_path,
                    PLUGIN_NAME,
                    expected_hashes=expected,
                )
            except TypeError as error:
                self.fail(f"hash_archive must accept expected_hashes: {error}")
        self.assertEqual(actual, expected)

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_hash_archive_rejects_drift_from_the_expected_release_hash_map(self):
        package_plugin = load_packager()
        content = b"license\n"
        digest = hashlib.sha256(content).hexdigest()
        invalid_expected_maps = {
            "member drift": {"README.zh-CN.md": digest},
            "hash drift": {"LICENSE": "0" * 64},
        }
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "plugin.zip"
            with zipfile.ZipFile(archive_path, mode="w") as archive:
                archive.writestr(f"{PLUGIN_NAME}/LICENSE", content)
            for label, expected in invalid_expected_maps.items():
                with self.subTest(label=label):
                    with self.assertRaisesRegex(
                        RuntimeError,
                        "archive contents do not match expected release hashes",
                    ):
                        package_plugin.hash_archive(
                            archive_path,
                            PLUGIN_NAME,
                            expected_hashes=expected,
                        )

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_zip_bytes_order_prefix_metadata_and_exclusions_are_deterministic(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            write_fixture(source)
            first = root / "first.zip"
            second = root / "second.zip"
            package_plugin.write_archive(source, first)
            package_plugin.write_archive(source, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                infos = archive.infolist()
                names = [info.filename for info in infos]
                self.assertEqual(names, sorted(names))
                self.assertTrue(names)
                self.assertTrue(
                    all(name.startswith(f"{PLUGIN_NAME}/") for name in names), names
                )
                self.assertTrue(all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in infos))
                self.assertFalse(any(".git" in name for name in names))
                self.assertFalse(any(".superpowers" in name for name in names))
                self.assertFalse(any("__pycache__" in name for name in names))
                self.assertFalse(any(name.endswith((".zip", ".tar.gz", ".tmp")) for name in names))

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_source_archive_and_fresh_install_have_identical_file_hash_maps(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            write_fixture(source)
            archive_path = root / "plugin.zip"
            install_path = root / "installed" / PLUGIN_NAME
            source_hashes = package_plugin.hash_tree(source)
            result = package_plugin.write_archive(source, archive_path)
            installed = package_plugin.install_tree(source, install_path)
            archive_hashes = {}
            with zipfile.ZipFile(archive_path) as archive:
                prefix = f"{PLUGIN_NAME}/"
                for info in archive.infolist():
                    relative = info.filename.removeprefix(prefix)
                    archive_hashes[relative] = hashlib.sha256(archive.read(info)).hexdigest()
            self.assertEqual(source_hashes, archive_hashes)
            self.assertEqual(source_hashes, package_plugin.hash_tree(install_path))
            self.assertEqual(result["tree_sha256"], installed["tree_sha256"])
            self.assertEqual(result["file_count"], len(source_hashes))
            self.assertEqual(installed["file_count"], len(source_hashes))

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_install_refuses_to_overwrite_an_existing_target(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            target = root / "target"
            write_fixture(source)
            target.mkdir()
            (target / "owned.txt").write_text("preserve me\n", encoding="utf-8")
            with self.assertRaisesRegex(FileExistsError, "already exists"):
                package_plugin.install_tree(source, target)
            self.assertEqual((target / "owned.txt").read_text(encoding="utf-8"), "preserve me\n")

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_install_rejects_a_source_tree_that_drifted_after_archiving(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            target = root / "target"
            write_fixture(source)
            archived_digest = package_plugin.tree_digest(package_plugin.hash_tree(source))
            (source / "README.zh-CN.md").write_text("drifted\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "changed after archive creation"):
                package_plugin.install_tree(
                    source,
                    target,
                    expected_tree_sha256=archived_digest,
                )
            self.assertFalse(target.exists())

    @unittest.skipUnless(SCRIPT.is_file(), "Task 31 packager not implemented yet")
    def test_cli_writes_stable_json_and_the_requested_archive_and_install(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            archive_path = root / "out" / "plugin.zip"
            install_path = root / "plugins" / PLUGIN_NAME
            write_fixture(source)
            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--source",
                    str(source),
                    "--archive",
                    str(archive_path),
                    "--install-dir",
                    str(install_path),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(completed.stdout)
            self.assertEqual(list(payload), sorted(payload))
            self.assertEqual(payload["plugin_name"], PLUGIN_NAME)
            self.assertEqual(payload["file_count"], 9)
            self.assertEqual(payload["source_tree_sha256"], payload["installed_tree_sha256"])
            self.assertTrue(archive_path.is_file())
            self.assertTrue((install_path / ".codex-plugin" / "plugin.json").is_file())


if __name__ == "__main__":
    unittest.main()
