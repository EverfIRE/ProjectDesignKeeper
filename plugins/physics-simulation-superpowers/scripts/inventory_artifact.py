"""Create a deterministic SHA-256 inventory of a research artifact tree."""

import argparse
import fnmatch
import hashlib
import json
import os
import stat
import sys
from pathlib import Path, PurePosixPath, PureWindowsPath


class ArtifactInventoryError(ValueError):
    """Raised when an artifact cannot be safely and completely inventoried."""


_BUILTIN_EXCLUDED_DIRECTORIES = frozenset(
    {".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".venv"}
)


def _link_or_reparse_kind(path):
    """Name a link-like entry without resolving it, including Windows junctions."""
    try:
        if path.is_symlink():
            return "symbolic link"
        is_junction = getattr(path, "is_junction", None)
        if callable(is_junction) and is_junction():
            return "junction"
        if os.name == "nt":
            attributes = getattr(os.lstat(path), "st_file_attributes", 0)
            reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
            if attributes & reparse_flag:
                return "reparse point"
    except FileNotFoundError:
        return None
    except (OSError, RuntimeError, ValueError, UnicodeError) as error:
        raise ArtifactInventoryError("unable to inspect artifact link state") from error
    return None


def _root_path(root):
    try:
        normalized_root = os.fspath(root)
    except Exception as error:
        raise ArtifactInventoryError("root must be a path to an existing directory") from error
    if isinstance(normalized_root, bytes):
        raise ArtifactInventoryError("root path must be valid UTF-8 text")
    if not normalized_root.strip():
        raise ArtifactInventoryError("root must not be blank")
    try:
        path = Path(normalized_root)
    except (TypeError, ValueError, OSError) as error:
        raise ArtifactInventoryError("root must be a path to an existing directory") from error
    try:
        link_kind = _link_or_reparse_kind(path)
        if link_kind:
            raise ArtifactInventoryError(f"root must not be a {link_kind}")
        resolved = path.resolve(strict=True)
        if not resolved.is_dir():
            raise ArtifactInventoryError("root must be an existing directory")
    except ArtifactInventoryError:
        raise
    except (OSError, RuntimeError, ValueError, UnicodeError) as error:
        raise ArtifactInventoryError("root must be an existing readable directory") from error
    return resolved


def _patterns(exclude_patterns):
    if exclude_patterns is None:
        return ()
    if not isinstance(exclude_patterns, (list, tuple)):
        raise ArtifactInventoryError("exclude_patterns must be a list or tuple of POSIX-style patterns")
    checked = []
    for pattern in exclude_patterns:
        if not isinstance(pattern, str):
            raise ArtifactInventoryError("exclude pattern must be a string")
        if not pattern.strip():
            raise ArtifactInventoryError("exclude pattern must not be blank")
        if "\\" in pattern:
            raise ArtifactInventoryError("exclude pattern must use forward slashes")
        try:
            parts = PurePosixPath(pattern).parts
            absolute = PurePosixPath(pattern).is_absolute() or PureWindowsPath(pattern).is_absolute()
        except (TypeError, ValueError) as error:
            raise ArtifactInventoryError("exclude pattern is invalid") from error
        if absolute or any(part == ".." for part in parts):
            raise ArtifactInventoryError("exclude pattern must be relative and must not contain '..'")
        checked.append(pattern)
    return tuple(checked)


def _valid_relative_path(parts):
    relative = "/".join(parts)
    try:
        relative.encode("utf-8", "strict")
    except UnicodeError as error:
        raise ArtifactInventoryError("artifact path is not valid UTF-8") from error
    return relative


def _full_path_match(relative_path, pattern):
    """Match an entire POSIX path, with a Python 3.11 fallback for recursive globs."""
    path = PurePosixPath(relative_path)
    full_match = getattr(path, "full_match", None)
    if callable(full_match):
        return full_match(pattern)

    path_parts = path.parts
    pattern_parts = PurePosixPath(pattern).parts
    memo = {}

    def matches(path_index, pattern_index):
        key = (path_index, pattern_index)
        if key in memo:
            return memo[key]
        if pattern_index == len(pattern_parts):
            result = path_index == len(path_parts)
        elif pattern_parts[pattern_index] == "**":
            if pattern_index == len(pattern_parts) - 1:
                result = path_index < len(path_parts)
            else:
                result = matches(path_index, pattern_index + 1) or (
                    path_index < len(path_parts) and matches(path_index + 1, pattern_index)
                )
        else:
            result = path_index < len(path_parts) and fnmatch.fnmatchcase(
                path_parts[path_index], pattern_parts[pattern_index]
            ) and matches(path_index + 1, pattern_index + 1)
        memo[key] = result
        return result

    return matches(0, 0)


def _excluded(relative_path, basename, patterns):
    for pattern in patterns:
        if "/" in pattern:
            if _full_path_match(relative_path, pattern):
                return True
        elif fnmatch.fnmatchcase(basename, pattern):
            return True
    return False


def _file_record(path, relative_path):
    try:
        initial = os.lstat(path)
        if not stat.S_ISREG(initial.st_mode):
            raise ArtifactInventoryError(f"artifact file changed into a non-regular file: {relative_path}")
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(path, flags)
        try:
            opened = os.fstat(descriptor)
            if not stat.S_ISREG(opened.st_mode):
                raise ArtifactInventoryError(f"artifact file changed into a non-regular file: {relative_path}")
            if (opened.st_dev, opened.st_ino) != (initial.st_dev, initial.st_ino):
                raise ArtifactInventoryError(f"artifact file changed during inventory: {relative_path}")
            digest = hashlib.sha256()
            with os.fdopen(descriptor, "rb", closefd=False) as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
            final = os.fstat(descriptor)
        finally:
            os.close(descriptor)
        if not stat.S_ISREG(final.st_mode) or (
            final.st_size,
            final.st_mtime_ns,
            final.st_ctime_ns,
        ) != (opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns):
            raise ArtifactInventoryError(f"artifact file changed during inventory: {relative_path}")
    except ArtifactInventoryError:
        raise
    except (OSError, ValueError, UnicodeError) as error:
        raise ArtifactInventoryError(f"unable to read regular artifact file: {relative_path}") from error
    return {"path": relative_path, "bytes": final.st_size, "sha256": digest.hexdigest()}


def inventory_artifact(root, exclude_patterns=None):
    """Return a stable raw-byte SHA-256 manifest for a safe artifact directory."""
    resolved_root = _root_path(root)
    patterns = _patterns(exclude_patterns)
    records = []

    def visit(directory, parts):
        try:
            with os.scandir(directory) as entries:
                entries = sorted(entries, key=lambda entry: entry.name)
        except (OSError, UnicodeError, ValueError) as error:
            raise ArtifactInventoryError("unable to enumerate artifact directory") from error
        for entry in entries:
            try:
                relative_parts = parts + (entry.name,)
                relative_path = _valid_relative_path(relative_parts)
                link_kind = _link_or_reparse_kind(Path(entry.path))
                if link_kind:
                    raise ArtifactInventoryError(f"{link_kind} encountered in artifact: {relative_path}")
                if entry.is_dir(follow_symlinks=False):
                    if entry.name.casefold() in _BUILTIN_EXCLUDED_DIRECTORIES or _excluded(relative_path, entry.name, patterns):
                        continue
                    visit(entry.path, relative_parts)
                elif entry.is_file(follow_symlinks=False):
                    if not _excluded(relative_path, entry.name, patterns):
                        records.append(_file_record(entry.path, relative_path))
                else:
                    raise ArtifactInventoryError(f"non-regular artifact entry encountered: {relative_path}")
            except ArtifactInventoryError:
                raise
            except (OSError, ValueError, UnicodeError) as error:
                raise ArtifactInventoryError("unable to inspect artifact entry") from error

    visit(str(resolved_root), ())
    records.sort(key=lambda record: record["path"])
    return {
        "algorithm": "sha256",
        "file_count": len(records),
        "files": records,
        "total_bytes": sum(record["bytes"] for record in records),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(prog="inventory_artifact.py")
    parser.add_argument("root", metavar="ROOT")
    parser.add_argument("--exclude", action="append", default=[], metavar="PATTERN")
    try:
        arguments = parser.parse_args(argv)
    except SystemExit as error:
        return error.code
    try:
        result = inventory_artifact(arguments.root, arguments.exclude)
        payload = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (ArtifactInventoryError, OSError, TypeError, ValueError, OverflowError, UnicodeError) as error:
        print(str(error) or "invalid inventory input", file=sys.stderr)
        return 2
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
