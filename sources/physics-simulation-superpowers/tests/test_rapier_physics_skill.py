"""Rapier Rust 0.35.3 and JavaScript 0.20.0 adapter contracts."""

import hashlib
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "rapier-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "rapier-physics" / "references" / "rapier.md"
UI = ROOT / "skills" / "rapier-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "rapier-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "rapier-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "rapier-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "rapier-physics-baseline-response.txt"
ATTEMPT_1 = (
    ROOT / "tests" / "fixtures" / "rapier-physics-enabled-attempt-1-response.txt"
)
ATTEMPT_2 = (
    ROOT / "tests" / "fixtures" / "rapier-physics-enabled-attempt-2-response.txt"
)
ENABLED = ROOT / "tests" / "fixtures" / "rapier-physics-enabled-response.txt"
ATTEMPT_1_PROVENANCE = (
    ".superpowers/sdd/2026-08-26-physics-simulation-superpowers/"
    "task-22-enabled-attempt-1-exact.txt"
)
ATTEMPT_2_PROVENANCE = (
    ".superpowers/sdd/2026-08-26-physics-simulation-superpowers/"
    "task-22-enabled-attempt-2-exact.txt"
)
ATTEMPT_2_PORTABLE_SOURCE = (
    ROOT
    / ".superpowers"
    / "fixtures"
    / "development-provenance"
    / "rapier-physics-enabled-attempt-2-source.txt"
)
ATTEMPT_2_SOURCE_COMMIT = "b43cf33bf315300bd09c88d69a2693ddd964d0b6"
ATTEMPT_2_SOURCE_PATH = "tests/fixtures/rapier-physics-enabled-attempt-2-response.txt"
ATTEMPT_2_SOURCE_SIZE = 11805
ATTEMPT_2_SOURCE_SHA256 = (
    "e6c28fc9068e4a488a2d00d0afad622ad699ac61bc502a1094f6527ce59e7eb6"
)

ROUTES = (
    "architecting-real-time-physics",
    "rigid-body-collision-contact",
    "constraints-ragdolls-active-physics",
    "character-controller-movement",
    "networked-deterministic-physics",
    "debugging-testing-physics",
    "profiling-scaling-physics",
)

PINNED_URLS = (
    "https://github.com/dimforge/rapier/releases/tag/v0.35.3",
    "https://github.com/dimforge/rapier/commit/b82079ac41310a8af438af95b49b8fa551ce650f",
    "https://github.com/dimforge/rapier/blob/v0.35.3/crates/rapier2d/Cargo.toml",
    "https://github.com/dimforge/rapier/blob/v0.35.3/crates/rapier3d/Cargo.toml",
    "https://github.com/dimforge/rapier/blob/v0.35.3/src/lib.rs",
    "https://github.com/dimforge/rapier/blob/v0.35.3/run-ci-checks.sh",
    "https://github.com/dimforge/rapier/tree/js-v0.20.0",
    "https://github.com/dimforge/rapier/commit/3e12c2679cb1940a876bde93af9cec0cf2f57944",
    "https://github.com/dimforge/rapier/blob/js-v0.20.0/typescript/CHANGELOG.md",
    "https://github.com/dimforge/rapier/blob/js-v0.20.0/typescript/README.md",
    "https://www.npmjs.com/package/@dimforge/rapier3d-deterministic",
    "https://docs.rs/rapier3d/0.35.3/rapier3d/",
    "https://crates.io/crates/rapier3d/0.35.3",
    "https://rapier.rs/docs/user_guides/rust/determinism/",
    "https://rapier.rs/docs/user_guides/rust/serialization/",
    "https://rapier.rs/docs/user_guides/rust/scene_queries/",
    "https://rapier.rs/docs/user_guides/rust/advanced_collision_detection/",
    "https://rapier.rs/javascript3d/classes/World.html",
    "https://rapier.rs/javascript3d/classes/EventQueue.html",
    "https://rapier.rs/javascript3d/classes/KinematicCharacterController.html",
    "https://rapier.rs/docs/user_guides/javascript/determinism/",
)

FIXTURE_DIGESTS = {
    SCENARIO: (
        1500,
        "b9cf74b1c3676cdfcc954b87a62eeebd1d31f8c372fcfc7d9c69b0a3d6e5e635",
    ),
    BASELINE: (
        9243,
        "dd9e421d742a02e2e03cb4bf2ed08084660503d83d7f6684453ed3545d2a6055",
    ),
    # Frozen isolated evaluator output from task-22-enabled-attempt-1-exact.txt.
    ATTEMPT_1: (
        8467,
        "5ecb94fc161f32737314ff85f076ac43d9395ade13721830164446736da39c64",
    ),
    # Isolated attempt 2, sanitized after the final source-governance review.
    ATTEMPT_2: (
        10942,
        "7db7fc08ceed2701d92fd533d3d4353e0ca363b890dd6d985e0967c7f776d39a",
    ),
    ENABLED: (
        10942,
        "7db7fc08ceed2701d92fd533d3d4353e0ca363b890dd6d985e0967c7f776d39a",
    ),
}

BASELINE_GAPS = {
    "source-snapshot",
    "js-package-flavor",
    "rust-feature-matrix",
    "snapshot-boundary",
    "query-event-controller",
    "validation-matrix",
    "restore-memory-boundary",
}

FORMAL_REVIEW_GAPS = {
    "input-generation-determinism",
}

ATTEMPT_1_GAPS = FORMAL_REVIEW_GAPS | {"restore-memory-boundary"}

ALL_GAPS = BASELINE_GAPS | FORMAL_REVIEW_GAPS


def normalized(text: str) -> str:
    markdown_neutral = text.replace(chr(96), "").replace("**", "")
    return re.sub(r"\s+", " ", markdown_neutral).casefold()


CLAUSE_BOUNDARY = re.compile(
    r"(?<=[.!?])(?=\s|$)|[;。！？；\n]+|\b(?:but|however|yet|then)\b|"
    r"(?:但是|不过|然而|却|然后)",
    re.IGNORECASE,
)
DIRECT_DENIAL = re.compile(
    r"\b(?:no\b|neither|do\s+not|don't|never|cannot|can't|must\s+not|"
    r"should\s+not|does\s+not|is\s+not(?!\s+(?:only|merely)\b)|"
    r"are\s+not(?!\s+(?:only|merely)\b)|did\s+not|no\s+longer|"
    r"not\s+(?!only\b|merely\b))|"
    r"(?:没有|无|不要|不得|不能|不应|不会|不再|不(?!仅|但|只是))",
    re.IGNORECASE,
)
POSTFIX_DENIAL = re.compile(
    r"^\W*(?:(?:is|are|does|do)\s+)?"
    r"(?:not(?!\s+(?:only|merely)\b)|never|neither|forbidden|unsafe|unsupported|"
    r"unavailable|compile[- ]time\s+incompatible|incompatible)|"
    r"^\W*(?:不是|并非|不可|不安全|不受支持|不存在)",
    re.IGNORECASE,
)


def semantic_clauses(text: str) -> list[str]:
    protected = re.sub(
        r"(\bnot\s+(?:only|merely)\b[^.!?;。！？；\n]{0,180})\bbut\b",
        r"\1 __NOT_ONLY_BUT__ ",
        text,
        flags=re.IGNORECASE,
    )
    return [
        part.replace("__NOT_ONLY_BUT__", "but").strip()
        for part in CLAUSE_BOUNDARY.split(protected)
        if part.strip()
    ]


def contains_affirmative_claim(text: str, pattern: str) -> bool:
    expression = re.compile(pattern, re.IGNORECASE)
    for clause in semantic_clauses(text):
        for match in expression.finditer(clause):
            prefix = clause[max(0, match.start() - 80):match.start()]
            claim = clause[match.start():match.end()]
            suffix = clause[match.end():match.end() + 64]
            if (
                not DIRECT_DENIAL.search(prefix)
                and not DIRECT_DENIAL.search(claim)
                and not POSTFIX_DENIAL.search(suffix)
            ):
                return True
    return False


SEMANTIC_WINDOW_WORDS = 240
SEMANTIC_WINDOW_UNITS = 5
SEMANTIC_WORD = re.compile(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b")
STRUCTURED_LINE = re.compile(r"^(?:[-+*]\s+|\d+[.)]\s+|\|.*\|\s*$)")


def semantic_word_count(text: str) -> int:
    return len(SEMANTIC_WORD.findall(text))


def bounded_semantic_units(paragraph: str) -> list[str]:
    if semantic_word_count(paragraph) <= SEMANTIC_WINDOW_WORDS:
        return [paragraph]
    lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
    if lines and re.match(r"^#{2,6}\s+", lines[0]):
        lines = lines[1:]
    if len(lines) >= 2 and all(STRUCTURED_LINE.match(line) for line in lines):
        return lines
    return []


def semantic_blocks(text: str) -> list[str]:
    heading_joined = re.sub(
        r"(^#{2,6}\s+[^\n]+)\n\s*\n",
        r"\1\n",
        text,
        flags=re.MULTILINE,
    )
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", heading_joined)
        if paragraph.strip()
    ]
    segments: list[list[str]] = [[]]
    for paragraph in paragraphs:
        if re.match(
            r"^#{2,6}\s+.*(?:glossary|\btoken\b|\bindex\b)",
            paragraph,
            re.IGNORECASE,
        ):
            segments.append([])
        segments[-1].extend(bounded_semantic_units(paragraph))

    windows: list[str] = []
    for segment in segments:
        for start in range(len(segment)):
            for width in range(
                1,
                min(SEMANTIC_WINDOW_UNITS, len(segment) - start) + 1,
            ):
                window = "\n\n".join(segment[start:start + width])
                if semantic_word_count(window) <= SEMANTIC_WINDOW_WORDS:
                    windows.append(normalized(window))
    return windows


def hyphen_neutral(text: str) -> str:
    return re.sub(r"(?<=\w)[_\-‐‑‒–—](?=\w)", " ", text)


def semantic_contains(block: str, term: str) -> bool:
    value = normalized(term)
    return value in block or hyphen_neutral(value) in hyphen_neutral(block)


def local_groups(text: str, groups: tuple[tuple[str, ...], ...]) -> bool:
    return any(
        all(any(semantic_contains(block, term) for term in group) for group in groups)
        for block in semantic_blocks(text)
    )


REQUIRED_CLUSTERS = {
    "source-snapshot": (
        (
            ("rapier2d", "rapier3d"),
            ("0.35.3",),
            ("v0.35.3",),
            ("b82079ac41310a8af438af95b49b8fa551ce650f",),
        ),
        (
            ("@dimforge/rapier2d", "@dimforge/rapier3d"),
            ("0.20.0",),
            ("js-v0.20.0",),
            ("3e12c2679cb1940a876bde93af9cec0cf2f57944",),
        ),
        (
            ("0.35.0/0.35.1", "0.35.0 and 0.35.1"),
            (
                "not current rust 0.35.3",
                "not current 0.35.3",
                "not rust 0.35.3",
            ),
            (
                "no api parity",
                "do not assume api parity",
                "not api parity",
                "no current rust/javascript api parity",
                "no current rust/js api parity",
                "no official rust/javascript api parity",
                "no official rust/js api parity",
            ),
        ),
    ),
    "js-package-flavor": (
        (
            (
                "@dimforge/rapier2d-deterministic@0.20.0",
                "@dimforge/rapier3d-deterministic@0.20.0",
            ),
            (
                "cross-platform deterministic",
                "cross-platform determinism",
                "cross-platform repeatability",
            ),
        ),
        (
            ("ordinary",),
            ("locally deterministic", "local determinism"),
            (
                "no cross-platform guarantee",
                "not cross-platform",
                "only locally deterministic",
            ),
            ("-simd", "simd package"),
            ("speed", "performance"),
            ("-compat", "compat package"),
            (
                "wasm packaging",
                "bundler packaging",
                "packaging only",
                "changes packaging",
            ),
            (
                "not determinism",
                "does not change determinism",
                "neither implies determinism",
            ),
        ),
    ),
    "rust-feature-matrix": (
        (
            ("rust 0.35.3",),
            ("default four-lane simd", "four-lane simd by default"),
            ("scalar fallback",),
            ("no simd-stable", "simd-stable does not exist"),
            ("simd8",),
            ("enhanced-determinism",),
            (
                "compile-time forbidden",
                "compile-time incompatible",
                "compile error",
                "cannot combine",
            ),
        ),
        (
            ("parallel",),
            ("compatible",),
            ("thread-count", "thread count"),
            (
                "parallel off/on",
                "parallel-off/on",
                "off/on parity",
                "off/on and thread-count parity",
                "leave parallel off",
            ),
            (
                "upstream test",
                "upstream ci",
                "exact build passes parity",
                "parity testing",
                "thread-count parity passes",
            ),
            (
                "measured deployment choice",
                "measure before deployment",
                "enable it in deployment only after",
                "enable parallel only after",
            ),
        ),
    ),
    "snapshot-boundary": (
        (
            ("serde-serialize",),
            (
                "complete owned state bundle",
                "owned state bundle",
                "complete owned bundle",
                "all relevant body",
            ),
            ("stateless pipelines", "stateless physicspipeline"),
            ("excluded", "not serialized", "reconstruct"),
            ("versioned codec", "versioned envelope", "versioned owned bundle"),
        ),
        (
            ("takesnapshot",),
            ("world.restoresnapshot", "static restoresnapshot"),
            ("new world", "replacement world"),
            (
                "world.free()",
                "free old world",
                "free() on the old world",
            ),
            ("eventqueue",),
            ("drain",),
            ("wrappers",),
            ("rebuild", "invalidate"),
        ),
        (
            ("snapshot manifest", "manifest"),
            ("binding",),
            ("dimension",),
            ("precision",),
            ("artifact hash",),
            ("reject",),
            ("mismatch",),
            (
                "no cross-version",
                "not cross-version",
                "not guaranteed across package upgrades",
                "cross-version snapshots",
            ),
            (
                "no rust/js",
                "no rust-to-js",
                "not rust/js",
                "rust/js snapshot guarantee",
                "between rust and javascript",
                "rust-to-javascript snapshots",
            ),
        ),
        (
            ("rapier handle", "handles"),
            ("generational",),
            (
                "application id",
                "application-owned id",
                "application/network id",
            ),
        ),
    ),
    "query-event-controller": (
        (
            ("querypipeline",),
            ("temporary", "ephemeral"),
            ("borrows",),
            ("broad phase", "broad-phase"),
            ("sets",),
            ("reuses",),
            ("bvh",),
            ("stepping", "step"),
            ("end-of-last-step", "end of the last step"),
            ("js queries", "javascript queries"),
            ("world methods", "methods on the current world"),
            (
                "no manual update",
                "do not manually update",
                "old persistent/manual-update model",
                "pre-0.27 persistent-pipeline/manual-update model",
            ),
        ),
        (
            ("activeevents",),
            ("transient",),
            ("substep",),
            ("eventqueue",),
            ("drain immediately", "immediate drain", "drain eventqueue immediately"),
            ("application id", "durable id"),
        ),
        (
            ("kinematiccharactercontroller", "character controller"),
            ("reusable",),
            ("translation-only", "translation only"),
            ("computecollidermovement",),
            ("computedcollision", "computed collision"),
            (
                "consume immediately",
                "immediate consumption",
                "before another computation",
                "must be consumed before the next one",
            ),
        ),
        (
            ("eventqueue",),
            ("free()",),
        ),
    ),
    "validation-matrix": (
        (
            ("fixed tick", "fixed simulation tick"),
        ),
        (
            ("snapshot bytes", "snapshot-byte hash"),
            ("semantic projection", "semantic hash"),
            (
                "application-id-keyed",
                "application id keyed",
                "keyed by durable application id",
                "keyed and sorted by durable application id",
            ),
            ("every tick", "every fixed tick"),
        ),
        (
            ("uninterrupted",),
            ("restore-and-continue", "restore and continue"),
            ("multiple runs", "repeated runs", "fresh runs"),
        ),
        (
            ("native", "rust baseline"),
            ("wasm",),
            ("deterministic js", "deterministic 0.20.0"),
            (
                "parallel off/on",
                "parallel-off/on",
                "parallel off versus on",
            ),
            (
                "thread counts",
                "thread-count",
                "supported workers",
                "deployment-maximum workers",
            ),
            ("simd8",),
            (
                "separate domain",
                "separately reported domain",
                "separate, non-equivalent evidence domain",
            ),
        ),
    ),
    "restore-memory-boundary": (
        (
            ("restore cadence", "restore frequency"),
            ("session envelope", "session duration"),
            ("wasm",),
            ("memory budget", "wasm budget"),
            ("acceptance", "meet"),
        ),
    ),
    "input-generation-determinism": (
        (
            ("exact input bits", "exact input-bit"),
            (
                "negative cross-platform input-generation control",
                "negative cross-platform input generation control",
                "negative control using independently generated transcendental inputs",
            ),
        ),
        (
            ("strict ieee-754-2008", "strict ieee 754 2008"),
            ("complexfield",),
            ("realfield",),
            (
                "instead of native transcendental",
                "avoid native transcendental",
                "not native transcendental",
            ),
        ),
        (
            ("javascript", "js"),
            ("math.sin",),
            ("math.cos",),
            (
                "not cross-platform deterministic",
                "do not use",
                "avoid",
            ),
            (
                "independently generated deterministic initialization",
                "independent deterministic initialization",
                "input generation",
            ),
        ),
    ),
}


def primary_term_soup_labels(text: str) -> set[str]:
    """Reject per-cluster paragraphs synthesized from only primary terms."""
    paragraphs = {
        normalized(paragraph).strip()
        for paragraph in re.split(r"\n\s*\n", text)
        if paragraph.strip()
    }
    return {
        label
        for label, clusters in REQUIRED_CLUSTERS.items()
        if all(
            normalized(" ".join(group[0] for group in cluster)).strip()
            in paragraphs
            for cluster in clusters
        )
    }


UNSAFE_CLAIMS = {
    "source-snapshot": (
        r"\b(?:follow|track|use)\b.{0,36}(?:independent\s+)?latest",
        r"(?:pin|use).{0,24}(?:rapier2d|rapier3d).{0,16}0\.34\.\d+",
        r"(?:js|javascript).{0,20}0\.20\.0.{0,48}(?:same|current|parity).{0,24}(?:rust\s+)?0\.35\.3",
    ),
    "js-package-flavor": (
        r"ordinary.{0,48}(?:guarantees?|is).{0,28}cross-platform",
        r"(?:-compat|compat package).{0,40}(?:guarantees?|provides?|is).{0,24}(?:determin|cross-platform)",
        r"(?:-simd|simd package).{0,40}(?:guarantees?|is).{0,24}cross-platform",
    ),
    "rust-feature-matrix": (
        r"(?:enable|use|select).{0,24}simd-stable",
        r"simd8.{0,32}(?:with|and|compatible).{0,24}enhanced-determinism",
        r"(?:eight|8)[- ]lane\s+simd.{0,40}(?:alongside|with|and|compatible).{0,24}enhanced-determinism",
        r"parallel.{0,40}(?:incompatible|forbidden|cannot combine).{0,36}enhanced-determinism",
    ),
    "snapshot-boundary": (
        r"(?:world\.)?createsnapshot\s*\(",
        r"restoresnapshot.{0,48}(?:same world|in place|keep using)",
        r"restoresnapshot.{0,48}(?:mutates?|modifies?).{0,24}(?:existing|current|old).{0,16}(?:owner|world)",
        r"snapshot.{0,48}(?:compatible|portable).{0,36}(?:cross-version|rust.{0,12}js)",
        r"serialize.{0,28}(?:only\s+)?(?:body\s+)?transforms",
    ),
    "query-event-controller": (
        r"querypipeline.{0,56}(?:manual(?:ly)?\s+)?update",
        r"manual(?:ly)?\s+update.{0,16}querypipeline",
        r"character controller.{0,48}(?:rotate|rotation)",
        r"computedcollision.{0,48}(?:retain|cache|next tick|later)",
        r"eventqueue.{0,48}(?:leave|keep|retain).{0,24}undrained",
        r"(?:leave|keep|retain).{0,24}eventqueue.{0,24}undrained",
    ),
    "validation-matrix": (
        r"(?:one|single).{0,28}final transform.{0,44}(?:proves?|sufficient|passes)",
        r"upstream.{0,48}tests?.{0,32}(?:prove|guarantee).{0,28}(?:application|our)",
        r"simd8.{0,40}(?:same|one).{0,24}(?:determinism\s+)?domain",
    ),
    "input-generation-determinism": (
        r"(?:native sin|native transcendental).{0,72}(?:math\.sin|math\.cos).{0,72}(?:bit-identical|cross-platform)",
        r"strict ieee-?754.{0,32}alone.{0,72}native transcendental.{0,48}(?:deterministic|identical)",
        r"platform trigonometry.{0,40}(?:interchangeable|equivalent).{0,40}(?:deterministic peers|across peers)",
        r"(?:decimal-equal|decimal equal|same decimal).{0,48}sufficient.{0,96}(?:exact input bits|negative control).{0,32}(?:unnecessary|not needed)",
    ),
}


def response_violations(text: str) -> set[str]:
    """Measure the seven admitted-source Rapier omissions or unsafe directions."""
    violations = {
        label
        for label, clusters in REQUIRED_CLUSTERS.items()
        if not all(local_groups(text, cluster) for cluster in clusters)
    }
    violations.update(primary_term_soup_labels(text))
    for label, patterns in UNSAFE_CLAIMS.items():
        if any(contains_affirmative_claim(text, pattern) for pattern in patterns):
            violations.add(label)
    return violations


def complete_gate_contract() -> str:
    return """Rust pins rapier2d and rapier3d 0.35.3, tag v0.35.3, commit b82079ac41310a8af438af95b49b8fa551ce650f, released 2026-08-28.

JavaScript pins @dimforge/rapier2d and @dimforge/rapier3d 0.20.0, tag js-v0.20.0, commit 3e12c2679cb1940a876bde93af9cec0cf2f57944. This is the 0.35.0/0.35.1 source era, not current Rust 0.35.3; there is no API parity.

Choose @dimforge/rapier2d-deterministic@0.20.0 or @dimforge/rapier3d-deterministic@0.20.0 for the official cross-platform deterministic JavaScript flavor.

Ordinary packages are locally deterministic but have no cross-platform guarantee. A -simd package selects speed/performance. A -compat package changes WASM packaging only, not determinism.

For Rust 0.35.3, default four-lane SIMD has a scalar fallback. There is no simd-stable. The simd8 plus enhanced-determinism combination is compile-time forbidden and causes a compile error.

The parallel feature is compatible with enhanced-determinism. Upstream CI has thread-count tests and parallel off/on parity, but it remains a measured deployment choice: measure before deployment.

Rust enables serde-serialize for a complete owned state bundle and a versioned codec. Stateless pipelines are excluded and not serialized.

JavaScript uses takeSnapshot and static World.restoreSnapshot to create a new World. Drain EventQueue, call World.free() on the old owner, invalidate wrappers, and rebuild mappings, controllers, and wrappers around the replacement world.

Store a snapshot manifest with binding, dimension, precision, exact version, package flavor, artifact hash, features, schema, and codec; reject every mismatch. There is no cross-version or Rust/JS snapshot guarantee. Rapier handles are local generational locators, while application IDs are durable.

Rust QueryPipeline is temporary: it borrows the broad phase and object sets, reuses the BVH updated by stepping, and observes end-of-last-step positions. JS queries are World methods. Use no manual update; that is the pre-0.27 model.

Enable ActiveEvents. Contact details may be transient and substep-specific, so drain EventQueue immediately, map handles to application IDs, canonicalize, consume, and call free().

The reusable KinematicCharacterController computes translation-only motion with computeColliderMovement. Read computedCollision results from the last call and consume immediately.

At every fixed tick, hash local snapshot bytes and a separate application-ID-keyed semantic projection. Compare multiple runs plus uninterrupted versus restore-and-continue execution at every tick.

The matrix covers native and WASM, the deterministic JS package, parallel off/on, multiple thread counts, and simd8 as a separate domain.

For repeated restore, test restore cadence at and beyond the maximum supported session envelope. Meet the recorded WASM budget or use a fixed/patched artifact.

Upstream snapshot portability, roundtrip, parallel parity, and thread-count tests are useful seeds, not proof of this application.

Adapter policy: preserve exact input bits and run a negative cross-platform input-generation control. Rust requires a strict IEEE-754-2008 target and nalgebra ComplexField/RealField instead of native transcendental functions. JavaScript Math.sin and Math.cos are not cross-platform deterministic; avoid them for independently generated deterministic initialization."""


class RapierPhysicsSkillTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for path in (
            SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE,
            ATTEMPT_1, ATTEMPT_2, ENABLED,
        ):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(
                    path.is_file(),
                    f"missing Task 22 artifact: {path.relative_to(ROOT)}",
                )

    def test_frozen_fixtures_are_exact_lf_only_tracked_and_protected(self):
        attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")
        for path, (size, digest) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.name):
                self.assertTrue(path.is_file(), f"missing frozen fixture: {path.name}")
                raw = path.read_bytes()
                self.assertEqual(len(raw), size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertEqual(raw[-1:], b"\n")
                self.assertNotIn(b"\r", raw)
                relative = path.relative_to(ROOT).as_posix()
                self.assertIn(
                    f"{relative} -text whitespace=-trailing-space",
                    attributes,
                )
                if (ROOT / ".git").exists():
                    tracked = subprocess.run(
                        ["git", "ls-files", "--error-unmatch", "--", relative],
                        cwd=ROOT,
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertEqual(tracked.returncode, 0, tracked.stderr)

    def test_blind_baseline_has_seven_plus_one_admitted_source_gaps(self):
        self.assertEqual(
            response_violations(BASELINE.read_text(encoding="utf-8")),
            ALL_GAPS,
        )
        self.assertEqual(response_violations(complete_gate_contract()), set())

    def test_attempt_1_is_exact_history_with_two_admitted_review_gaps(self):
        violations = response_violations(ATTEMPT_1.read_text(encoding="utf-8"))
        self.assertEqual(
            violations,
            ATTEMPT_1_GAPS,
            f"Round 2 formal-review labels: {sorted(violations)}",
        )

    def test_sanitized_attempt_2_semantically_clears_all_eight_gates(self):
        raw = ATTEMPT_2.read_bytes()
        self.assertEqual(len(raw), 10942)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "7db7fc08ceed2701d92fd533d3d4353e0ca363b890dd6d985e0967c7f776d39a",
        )
        self.assertEqual(raw[-1:], b"\n")
        self.assertNotIn(b"\r", raw)
        violations = response_violations(raw.decode("utf-8"))
        self.assertEqual(
            violations,
            set(),
            f"attempt 2 false-positive labels: {sorted(violations)}",
        )

    def test_sanitized_evaluation_points_to_hashed_shipped_fixtures(self):
        self.assertTrue(ATTEMPT_2.is_file(), "missing tracked attempt 2 fixture")
        self.assertTrue(ENABLED.is_file(), f"missing canonical fixture: {ENABLED.name}")
        self.assertTrue(EVALUATION.is_file(), "missing sanitized evaluation record")
        self.assertEqual(ENABLED.read_bytes(), ATTEMPT_2.read_bytes())

        record = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(record["schema_version"], "2")
        self.assertEqual(record["skill"], "rapier-physics")
        self.assertEqual(record["scenario"], SCENARIO.relative_to(ROOT).as_posix())
        self.assertEqual(record["baseline"]["response"], BASELINE.relative_to(ROOT).as_posix())
        self.assertEqual(record["enabled"]["response"], ENABLED.relative_to(ROOT).as_posix())
        self.assertTrue(record["baseline"]["observations"])
        self.assertTrue(record["enabled"]["observations"])
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(
            record["gate_evidence"]["baseline_violations"],
            sorted(ALL_GAPS),
        )
        self.assertEqual(
            record["gate_evidence"]["enabled_violations"],
            [],
        )
        self.assertEqual(
            record["gate_evidence"]["attempt_1_violations"],
            sorted(ATTEMPT_1_GAPS),
        )
        self.assertTrue(all(isinstance(item, str) and item for item in record["evidence"]))

        expected_hashes = {
            "scenario_sha256": FIXTURE_DIGESTS[SCENARIO][1],
            "baseline_response_sha256": FIXTURE_DIGESTS[BASELINE][1],
            "enabled_attempt_1_sha256": FIXTURE_DIGESTS[ATTEMPT_1][1],
            "enabled_attempt_2_sha256": FIXTURE_DIGESTS[ATTEMPT_2][1],
            "enabled_response_sha256": FIXTURE_DIGESTS[ATTEMPT_2][1],
        }
        self.assertEqual(record["hashes"], expected_hashes)
        provenance = record["isolation_provenance"]
        self.assertTrue(provenance["fresh_isolated_evaluator"])
        source = provenance["source_snapshot"]
        self.assertEqual(source["git_commit"], ATTEMPT_2_SOURCE_COMMIT)
        self.assertEqual(source["path"], ATTEMPT_2_SOURCE_PATH)
        self.assertEqual(source["bytes"], ATTEMPT_2_SOURCE_SIZE)
        self.assertEqual(source["sha256"], ATTEMPT_2_SOURCE_SHA256)
        self.assertEqual(source["archival_copy"], ATTEMPT_2_PROVENANCE)
        self.assertFalse(source["archival_copy_packaged"])
        self.assertTrue(provenance["sanitized_after_source_governance_review"])
        self.assertFalse(provenance["copied_byte_for_byte"])
        self.assertEqual(
            provenance["allowed_inputs"],
            ["scenario", "SKILL.md", "references/rapier.md", "agents/openai.yaml"],
        )

        restored = ATTEMPT_2_PORTABLE_SOURCE.read_bytes()
        self.assertEqual(len(restored), ATTEMPT_2_SOURCE_SIZE)
        self.assertEqual(hashlib.sha256(restored).hexdigest(), ATTEMPT_2_SOURCE_SHA256)
        operations = provenance["transformation"]["operations"]
        self.assertEqual(
            operations,
            [
                {"op": "delete_lines", "start": 48, "end": 59},
                {
                    "op": "replace_exact",
                    "from": "5. **Use application IDs on the network.**",
                    "to": "4. **Use application IDs on the network.**",
                    "count": 1,
                },
                {
                    "op": "replace_exact",
                    "from": "6. **Reject incompatible snapshots before decoding.**",
                    "to": "5. **Reject incompatible snapshots before decoding.**",
                    "count": 1,
                },
            ],
        )
        lines = restored.decode("utf-8").splitlines(keepends=True)
        derived = "".join(lines[:47] + lines[59:])
        for operation in operations[1:]:
            derived = derived.replace(
                operation["from"], operation["to"], operation["count"]
            )
        self.assertEqual(derived.encode("utf-8"), ATTEMPT_2.read_bytes())

    def test_each_gate_is_independently_deletion_protected_and_section_local(self):
        complete = complete_gate_contract()
        deletions = {
            "source-snapshot": "b82079ac41310a8af438af95b49b8fa551ce650f",
            "js-package-flavor": "cross-platform deterministic",
            "rust-feature-matrix": "scalar fallback",
            "snapshot-boundary": "complete owned state bundle",
            "query-event-controller": "end-of-last-step",
            "validation-matrix": "restore-and-continue",
            "restore-memory-boundary": "maximum supported session envelope",
            "input-generation-determinism": "ComplexField/RealField",
        }
        for label, token in deletions.items():
            with self.subTest(label=label):
                removed = complete.replace(token, "", 1)
                self.assertEqual(response_violations(removed), {label})
                isolated = removed + f"\n\n## Isolated glossary\n{token}"
                self.assertEqual(response_violations(isolated), {label})

    def test_scattered_and_overlong_keyword_soup_cannot_satisfy_the_gate(self):
        tokens = (
            "rapier2d", "rapier3d", "0.35.3", "v0.35.3",
            "b82079ac41310a8af438af95b49b8fa551ce650f", "2026-08-28",
            "@dimforge/rapier2d", "@dimforge/rapier3d", "0.20.0",
            "js-v0.20.0", "3e12c2679cb1940a876bde93af9cec0cf2f57944",
            "0.35.0/0.35.1", "not current Rust 0.35.3", "no API parity",
            "@dimforge/rapier2d-deterministic@0.20.0",
            "@dimforge/rapier3d-deterministic@0.20.0",
            "cross-platform deterministic", "ordinary", "locally deterministic",
            "no cross-platform guarantee", "-simd", "performance", "-compat",
            "WASM packaging", "not determinism", "default four-lane SIMD",
            "scalar fallback", "no simd-stable", "simd8", "enhanced-determinism",
            "compile-time forbidden", "parallel", "compatible", "thread-count",
            "parallel off/on", "upstream CI", "measured deployment choice",
            "serde-serialize", "complete owned state bundle", "stateless pipelines",
            "excluded", "versioned codec", "takeSnapshot", "World.restoreSnapshot",
            "new World", "World.free()", "EventQueue", "drain", "wrappers",
            "rebuild", "snapshot manifest", "binding", "dimension", "precision",
            "artifact hash", "reject", "mismatch", "no cross-version", "no Rust/JS",
            "generational", "application ID", "QueryPipeline", "temporary",
            "borrows", "broad phase", "sets", "reuses", "BVH", "stepping",
            "end-of-last-step", "JS queries", "World methods", "no manual update",
            "ActiveEvents", "transient", "substep", "drain immediately", "free()",
            "KinematicCharacterController", "reusable", "translation-only",
            "computeColliderMovement", "computedCollision", "consume immediately",
            "fixed tick", "snapshot bytes", "semantic projection",
            "application-ID-keyed", "every tick", "uninterrupted",
            "restore-and-continue", "multiple runs", "native", "WASM",
            "deterministic JS", "thread counts", "separate domain", "upstream",
            "snapshot portability", "roundtrip", "parallel parity", "seeds",
            "not proof",
        )
        scattered = "\n\n".join(
            f"## Token {index}\n{token}" for index, token in enumerate(tokens)
        )
        self.assertEqual(response_violations(scattered), ALL_GAPS)

        overlong = re.sub(r"\s+", " ", complete_gate_contract())
        overlong += " " + " ".join(["padding"] * 300)
        self.assertGreater(semantic_word_count(overlong), SEMANTIC_WINDOW_WORDS)
        self.assertEqual(response_violations(overlong), ALL_GAPS)

        formal_fragments = """exact input bits strict IEEE-754-2008 ComplexField
RealField native transcendental Math.sin Math.cos JavaScript independently generated
deterministic initialization negative cross-platform input-generation control"""
        formal_soup = re.sub(r"\s+", " ", formal_fragments).strip()
        padding = 149 - semantic_word_count(formal_soup)
        self.assertGreaterEqual(padding, 0)
        formal_soup += " " + " ".join(["padding"] * padding)
        self.assertEqual(semantic_word_count(formal_soup), 149)
        self.assertTrue(
            FORMAL_REVIEW_GAPS <= response_violations(formal_soup),
            response_violations(formal_soup),
        )

    def test_regenerated_primary_term_soup_fails_all_gates_while_attempt2_passes(self):
        compact_soup = "\n\n".join(
            " ".join(group[0] for group in cluster)
            for clusters in REQUIRED_CLUSTERS.values()
            for cluster in clusters
        ) + "\n"
        self.assertTrue(compact_soup.strip())
        self.assertEqual(response_violations(compact_soup), ALL_GAPS)
        self.assertEqual(
            response_violations(ATTEMPT_2.read_text(encoding="utf-8")),
            set(),
        )

    def test_stale_version_package_and_feature_directions_are_rejected(self):
        complete = complete_gate_contract()
        probes = {
            "source-snapshot": (
                "Follow independent latest releases.",
                "Pin rapier3d 0.34.0 for this adapter.",
                "JavaScript 0.20.0 has current parity with Rust 0.35.3.",
            ),
            "js-package-flavor": (
                "The ordinary @dimforge/rapier3d package guarantees cross-platform execution.",
                "The -compat package provides deterministic cross-platform results.",
                "The -simd package is cross-platform deterministic.",
            ),
            "rust-feature-matrix": (
                "Enable simd-stable for Rust.",
                "Use simd8 with enhanced-determinism.",
                "Use eight-lane SIMD alongside enhanced-determinism.",
                "Parallel is incompatible with enhanced-determinism.",
            ),
            "snapshot-boundary": (
                "Call World.createSnapshot() for checkpoints.",
                "World.restoreSnapshot keeps using the same World in place.",
                "World.restoreSnapshot mutates the existing owner.",
                "The snapshot is compatible cross-version between Rust and JS.",
                "Serialize only body transforms on Rust.",
            ),
            "query-event-controller": (
                "Manually update QueryPipeline after each step.",
                "The character controller may rotate the collider.",
                "Retain computedCollision results until the next tick.",
                "Keep EventQueue undrained for later.",
            ),
            "validation-matrix": (
                "One final transform proves determinism.",
                "Upstream tests prove our application deterministic.",
                "Treat simd8 as the same determinism domain.",
            ),
        }
        for label, cases in probes.items():
            for probe in cases:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(
                        label,
                        response_violations(complete + "\n\n" + probe),
                    )

    def test_formal_review_unsafe_paraphrases_are_rejected(self):
        complete = complete_gate_contract()
        probes = {
            "input-generation-determinism": (
                "Use Rust native sin and JavaScript Math.sin to generate bit-identical cross-platform inputs.",
                "Strict IEEE-754 alone makes native transcendental functions cross-platform deterministic.",
                "Platform trigonometry is interchangeable across deterministic peers.",
                "Decimal-equal initialization is sufficient, so exact input bits and a negative control are unnecessary.",
            ),
        }
        for label, cases in probes.items():
            for probe in cases:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(
                        label,
                        response_violations(complete + "\n\n" + probe),
                    )

    def test_explicit_denials_are_safe_but_late_contradictions_are_not(self):
        complete = complete_gate_contract()
        safe = {
            "source-snapshot": (
                "Do not follow independent latest releases.",
                "JavaScript 0.20.0 is not API parity with Rust 0.35.3.",
            ),
            "js-package-flavor": (
                "The ordinary package does not guarantee cross-platform execution.",
                "The -compat package is not a determinism flavor.",
            ),
            "rust-feature-matrix": (
                "Do not enable simd-stable.",
                "simd8 cannot combine with enhanced-determinism.",
                "simd8 and enhanced-determinism are compile-time incompatible.",
            ),
            "snapshot-boundary": (
                "Do not call World.createSnapshot().",
                "Snapshots are not portable cross-version between Rust and JS.",
            ),
            "query-event-controller": (
                "Do not manually update QueryPipeline.",
                "Do not retain computedCollision results for later.",
            ),
            "validation-matrix": (
                "One final transform does not prove determinism.",
                "Upstream tests do not prove our application.",
            ),
        }
        for label, cases in safe.items():
            for denial in cases:
                with self.subTest(label=label, denial=denial):
                    self.assertNotIn(
                        label,
                        response_violations(complete + "\n\n" + denial),
                    )

        contradictions = {
            "js-package-flavor": (
                "The ordinary package does not guarantee cross-platform results, "
                "but the ordinary package guarantees cross-platform results."
            ),
            "rust-feature-matrix": (
                "Do not enable simd-stable; however, use simd-stable for release."
            ),
            "snapshot-boundary": (
                "Snapshots are not cross-version, but the snapshot is portable cross-version."
            ),
            "query-event-controller": (
                "Do not manually update QueryPipeline, yet manually update QueryPipeline."
            ),
            "validation-matrix": (
                "One final transform does not prove determinism, but one final transform proves determinism."
            ),
        }
        for label, probe in contradictions.items():
            with self.subTest(label=label):
                self.assertIn(
                    label,
                    response_violations(complete + "\n\n" + probe),
                )

        not_only = (
            "The ordinary package not only runs locally but guarantees cross-platform results."
        )
        self.assertIn(
            "js-package-flavor",
            response_violations(complete + "\n\n" + not_only),
        )

    def test_cohesive_markdown_lists_and_tables_remain_semantic(self):
        paragraphs = complete_gate_contract().split("\n\n")
        cohesive_list = "## Contracts\n" + "\n".join(
            f"- {paragraph}" for paragraph in paragraphs
        )
        cohesive_table = "## Contracts\n| Contract |\n| --- |\n" + "\n".join(
            f"| {paragraph} |" for paragraph in paragraphs
        )
        self.assertEqual(response_violations(cohesive_list), set())
        self.assertEqual(response_violations(cohesive_table), set())

    def test_entry_reference_and_routes_are_bounded_semantic_contracts(self):
        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertTrue(skill.isascii())
        self.assertTrue(reference.isascii())
        self.assertLessEqual(semantic_word_count(skill), 500)
        self.assertLessEqual(semantic_word_count(reference), 1600)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/rapier.md", skill)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, skill)
        self.assertEqual(response_violations(reference), set())
        for label in FORMAL_REVIEW_GAPS:
            with self.subTest(entry_label=label):
                self.assertTrue(
                    all(
                        local_groups(skill, cluster)
                        for cluster in REQUIRED_CLUSTERS[label]
                    ),
                    label,
                )
        compact = normalized(reference)
        for label in (
            "official guarantee",
            "adapter policy",
            "inference",
            "unavailable guarantee",
        ):
            with self.subTest(label=label):
                self.assertIn(label, compact)

    def test_source_audit_is_official_pinned_claim_scoped_and_drift_aware(self):
        text = AUDIT.read_text(encoding="utf-8")
        compact = normalized(text)
        self.assertIn("read on 2026-08-30", compact)
        self.assertIn("b82079ac41310a8af438af95b49b8fa551ce650f", compact)
        self.assertIn("3e12c2679cb1940a876bde93af9cec0cf2f57944", compact)
        for field in ("official source", "authority", "version", "claim", "scope", "limitation"):
            self.assertIn(field, compact)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertEqual(set(links), set(PINNED_URLS))
        allowed_hosts = {
            "github.com",
            "rapier.rs",
            "www.rapier.rs",
            "docs.rs",
            "crates.io",
            "www.npmjs.com",
        }
        for link in links:
            with self.subTest(link=link):
                self.assertIn(urlparse(link).hostname, allowed_hosts)
        rows = [line for line in text.splitlines() if line.startswith("| [")]
        self.assertEqual(len(rows), len(PINNED_URLS))
        for row in rows:
            with self.subTest(row=row[:80]):
                cells = [cell.strip() for cell in row.strip("|").split("|")]
                self.assertEqual(len(cells), 5)
                self.assertTrue(all(cells))
        for boundary in (
            "documentation drift",
            "createsnapshot",
            "takesnapshot",
            "current generated api",
            "no rust/js",
            "no cross-version",
            "upstream seed",
            "not application proof",
            "unknown-license community",
            "no runtime claim",
            "bounded memory",
            "restore-frequency/wasm-memory",
            "strict ieee-754-2008",
            "complexfield",
            "realfield",
            "math.sin",
            "math.cos",
            "governance boundary",
            "adapter policy",
        ):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, compact)

    def test_ui_supports_explicit_and_implicit_invocation(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$rapier-physics", text)
        self.assertIn("allow_implicit_invocation: true", text)
        self.assertLessEqual(len(text.splitlines()), 8)

    def test_task_22_artifacts_are_tracked_and_pass_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            AUDIT,
            ROOT / "tests" / "test_rapier_physics_skill.py",
            SCENARIO,
            BASELINE,
            ATTEMPT_1,
            ATTEMPT_2,
            ENABLED,
            EVALUATION,
            ATTEMPT_2_PORTABLE_SOURCE,
        )
        relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
        for relative in relative_paths:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(tracked.returncode, 0, tracked.stderr)

        tree = subprocess.run(
            ["git", "write-tree"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task22-phase-a.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(
                ["git", "archive", "--format=tar", "--output", str(archive), tree],
                cwd=ROOT,
                check=True,
            )
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((extract / relative).is_file())
            archive_test = (
                "import sys, unittest; "
                "from tests.test_rapier_physics_skill import RapierPhysicsSkillTests as C; "
                "excluded = {"
                "'test_task_22_artifacts_are_tracked_and_pass_from_staged_archive'}; "
                "suite = unittest.TestSuite(test for test in "
                "unittest.defaultTestLoader.loadTestsFromTestCase(C) "
                "if test._testMethodName not in excluded); "
                "result = unittest.TextTestRunner(verbosity=2).run(suite); "
                "sys.exit(not result.wasSuccessful())"
            )
            result = subprocess.run(
                [sys.executable, "-c", archive_test],
                cwd=extract,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
