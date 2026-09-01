"""NVIDIA PhysX SDK 5.9.0 integration and evidence contracts."""

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

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "nvidia-physx-sdk" / "SKILL.md"
REFERENCE = ROOT / "skills" / "nvidia-physx-sdk" / "references" / "physx.md"
UI = ROOT / "skills" / "nvidia-physx-sdk" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "nvidia-physx-sdk-source-audit.md"
EVALUATION = ROOT / "evaluations" / "nvidia-physx-sdk" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-baseline-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-enabled-attempt-1.txt"
ATTEMPT2 = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-enabled-attempt-2.txt"
ATTEMPT3 = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-enabled-attempt-3.txt"
ENABLED = ROOT / "tests" / "fixtures" / "nvidia-physx-sdk-enabled-response.txt"

ROUTES = (
    "architecting-real-time-physics",
    "rigid-body-collision-contact",
    "constraints-ragdolls-active-physics",
    "character-controller-movement",
    "vehicle-physics",
    "cloth-rope-soft-bodies",
    "real-time-fluids-particles",
    "networked-deterministic-physics",
    "debugging-testing-physics",
    "profiling-scaling-physics",
)

FIXTURE_DIGESTS = {
    SCENARIO: (1284, "330298ea7b714488f6f1ba1c73b64b0a23b6903ae361d1b7f419b81d9542c09e"),
    BASELINE: (15111, "69df305b83af09b79bd9ea35b1b368e66716e3649c67e57a4939fd3471bd8323"),
    ATTEMPT1: (12275, "d7443bac65f70379acc59eb8a88f9d27fe3f81eaf9782b2e07a03618aead99e2"),
    ATTEMPT2: (12612, "54aebe8cc085639fd599e32ee2c8d8270b7b3e34354d3b716d049dfa8924be0d"),
    ATTEMPT3: (11865, "0e0effb1335e5c3ec282fe2756b7d21135b3e159efc4887393154b3c6115dd47"),
    ENABLED: (11865, "0e0effb1335e5c3ec282fe2756b7d21135b3e159efc4887393154b3c6115dd47"),
}

BASELINE_GAPS = {
    "source-snapshot",
    "current-vehicle-cooking",
    "scene-defaults-removals",
    "direct-gpu-boundary",
    "event-query-lifetime-traps",
    "serialization-observability",
    "public-validation-boundary",
}

FORMAL_REVIEW_GAPS = {
    "removed-legacy-vehicle-api",
    "active-actor-release-window",
    "partial-init-unwind",
}

RESIDUAL_EVALUATOR_LIMITATIONS = (
    "Evaluator limitation: DIRECT_DENIAL `never` matches the prefix of `Nevertheless`; "
    "probe `Nevertheless, retain PxVehicleDrive4W in native 5.9.` can evade the vehicle unsafe gate.",
    "Evaluator limitation: the active-actor unsafe regex is word-order dependent; probe "
    "`After release, dereference getActiveActors entries or userData.` can evade the active-actor gate.",
    "Evaluator limitation: the exact 490-token global gate soup is rejected as one flat paragraph "
    "but returns zero violations when formatted as Markdown bullet or table rows.",
)

FINAL_SYNTHESIS_HEADING = "## Final-answer completeness pass"

FINAL_SYNTHESIS_CLUSTERS = {
    "source-snapshot": (
        (
            ("110.1-omni-and-physx-5.9.0",),
            ("517a0073715120e114ee055b63b26c95e00d9039",),
            ("2026-07-14",),
            ("version.txt", "5.9.0.6d94eeb9"),
            ("ovphysx 0.5.10",),
            ("pre-1.0", "pre-release"),
            ("separate", "wrapper"),
            ("not a stable native c++ 5.10",),
        ),
    ),
    "current-vehicle-cooking": (
        (
            ("5.7", "5.7+"),
            ("include/vehicle",),
            ("physxvehicle",),
            ("no vehicle2 namespace", "vehicle2 namespace has been removed"),
            ("pxcookingparams",),
            ("pxcook",),
            ("pxcreate",),
            ("free", "immediate"),
            ("no retained pxcooking", "do not retain a pxcooking"),
        ),
    ),
    "scene-defaults-removals": (
        (
            ("pinned 5.9 header",),
            ("pxscenedesc",),
            ("pgs",),
            ("epabp",),
            ("eenable_pcm",),
            ("particle cloth",),
            ("particle rigid",),
            ("pxsoftbody",),
            ("pxfemsoftbody",),
            ("removed",),
            ("no standalone migrationto59",),
            ("changelog", "authority"),
        ),
    ),
    "direct-gpu-boundary": (
        (
            ("standard cpu",),
            ("standard gpu dynamics",),
            ("gpu broadphase",),
            ("direct gpu",),
            ("gpu-only",),
            ("fem",),
            ("pbd",),
            ("sdf",),
            ("sleeping disabled",),
            ("cct",),
            ("vehicle",),
            ("cpu scene quer",),
            ("ccd",),
            ("trigger",),
            ("contact modification",),
            ("shiftorigin", "origin shift"),
            ("stale",),
            ("setter", "forbidden"),
            ("enhanced determinism",),
            ("no gpu support", "not currently supported on gpu"),
            ("cross-platform",),
            ("no guarantee", "does not guarantee"),
            ("invalid cuda",),
            ("oom",),
            ("capacity",),
            ("device loss",),
            ("rebuild", "application state"),
            ("no feature-equivalent fallback", "not feature-equivalent fallback"),
        ),
    ),
    "event-query-lifetime-traps": (
        (
            ("simulate(dt > 0)",),
            ("exactly one",),
            ("fetchresults",),
            ("outstanding", "in-flight"),
            ("one writer",),
            ("multiple readers",),
            ("cannot upgrade",),
            ("thread-safe",),
            ("callback queue",),
        ),
        (
            ("pair flags",),
            ("enotify_contact_points",),
            ("trigger persists",),
            ("removed actor",),
            ("removed shape",),
            ("invalid", "do not dereference"),
            ("onadvance",),
            ("simulation is running", "overlaps simulation"),
            ("active actor",),
            ("fetch boundary",),
            ("pxquerycache", "query cache"),
            ("bypass",),
            ("filter",),
        ),
        (
            ("allocator",),
            ("error callback",),
            ("outlive foundation",),
            ("dispatcher",),
            ("cuda manager", "cuda context manager"),
            ("pxcloseextensions",),
            ("reverse",),
        ),
    ),
    "serialization-observability": (
        (
            ("5.6",),
            ("binary data conversion", "platform conversion"),
            ("serializecollectiontobinarydeterministic",),
            ("pxbinaryconverter",),
            ("removed",),
            ("pxcollection",),
            ("non-owning",),
            ("does not delete", "does not release"),
            ("128-byte",),
            ("backing memory",),
            ("entire lifetime",),
        ),
        (
            ("pvd",),
            ("live", "transport"),
            ("omnipvd",),
            ("ovd",),
            ("record",),
            ("diagnostic",),
            ("not persistence", "not rollback"),
        ),
    ),
    "public-validation-boundary": (
        (
            ("public 5.9 tree",),
            ("snippets",),
            ("smoke",),
            ("not conformance",),
            ("no auditable public sdk unit-test",),
            ("benchmark target",),
            ("checked",),
            ("windows",),
            ("linux",),
            ("cuda",),
            ("sanitizer",),
            ("nsight",),
            ("compute sanitizer",),
            ("pvd",),
            ("omnipvd",),
            ("soak",),
            ("performance",),
        ),
    ),
    "removed-legacy-vehicle-api": (
        (
            ("pxvehicledrive4w",),
            ("removed",),
            ("current component api",),
            ("port",),
            ("4.1",),
            ("separate reference process", "separate process"),
            ("binary boundary",),
            ("never carry", "do not mix"),
            ("native 5.9",),
        ),
    ),
    "active-actor-release-window": (
        (
            ("getactiveactors",),
            ("released after",),
            ("fetchresults",),
            ("never dereference", "do not dereference"),
            ("immediately",),
            ("before any releases", "before releases"),
            ("host validity/tombstone checks", "validate host tombstones"),
            ("skip", "validate host tombstones"),
            ("without dereference", "without dereferencing"),
        ),
    ),
    "partial-init-unwind": (
        (
            ("pxcreatefoundation", "create and check foundation"),
            ("pxcreatephysics", "create and check physics"),
            ("pxinitextensions",),
            ("bool", "retain whether it succeeded"),
            ("pxscenedesc::isvalid", "call isvalid()"),
            ("factory", "create and check the scene", "create checked materials"),
            ("only successfully initialized stages",),
            ("reverse-unwind", "reverse unwind"),
            ("pxcloseextensions",),
            ("only when init succeeded", "only if extension initialization succeeded"),
            ("failure-injection", "failure injection"),
        ),
    ),
}

PINNED_URLS = (
    "https://github.com/NVIDIA-Omniverse/PhysX/releases/tag/110.1-omni-and-physx-5.9.0",
    "https://github.com/NVIDIA-Omniverse/PhysX/tree/110.1-omni-and-physx-5.9.0",
    "https://github.com/NVIDIA-Omniverse/PhysX/commit/517a0073715120e114ee055b63b26c95e00d9039",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/version.txt",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/CHANGELOG.md",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/documentation/platformreadme/linux/README_LINUX.md",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/documentation/platformreadme/windows/README_WINDOWS.md",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxSceneDesc.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxScene.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/foundation/PxFoundation.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxPhysics.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/extensions/PxExtensionsAPI.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxSimulationEventCallback.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxFiltering.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/PxQueryReport.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/cooking/PxCooking.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/common/PxCollection.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/extensions/PxSerialization.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/pvd/PxPvd.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/blob/110.1-omni-and-physx-5.9.0/physx/include/omnipvd/PxOmniPvd.h",
    "https://github.com/NVIDIA-Omniverse/PhysX/tree/110.1-omni-and-physx-5.9.0/physx/snippets",
    "https://nvidia-omniverse.github.io/PhysX/physx/5.7.0/docs/DirectGPUAPI.html",
    "https://nvidia-omniverse.github.io/PhysX/physx/5.7.0/docs/GPURigidBodies.html",
    "https://nvidia-omniverse.github.io/PhysX/physx/5.6.0/docs/Serialization.html",
    "https://nvidia-omniverse.github.io/PhysX/physx/5.4.0/docs/OmniVisualDebugger.html",
)


def normalized(text: str) -> str:
    markdown_neutral = text.replace("`", "").replace("**", "")
    return re.sub(r"\s+", " ", markdown_neutral).casefold()


CLAUSE_BOUNDARY = re.compile(
    r"(?<=[.!?])(?=\s|$)|[;。！？；\n]+",
    re.IGNORECASE,
)
DIRECT_DENIAL = re.compile(
    r"\b(?:no|neither|do\s+not|don't|never|cannot|can't|must\s+not|should\s+not|does\s+not|"
    r"is\s+not(?!\s+(?:only|merely)\b)|are\s+not(?!\s+(?:only|merely)\b)|"
    r"was\s+not(?!\s+(?:only|merely)\b)|were\s+not(?!\s+(?:only|merely)\b)|did\s+not|"
    r"no\s+longer|not\s+(?!only\b|merely\b))|(?:没有|无|不要|不得|不能|不应|不会|不再|不(?!仅|但|只是))",
    re.IGNORECASE,
)
POSTFIX_DENIAL = re.compile(
    r"^\W*(?:(?:is|are|was|were|does|do)\s+)?(?:not(?!\s+(?:only|merely)\b)|never|"
    r"forbidden|unsafe|unsupported|unavailable)|^\W*(?:不是|并非|不可|不安全|不受支持|不存在)",
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


COORDINATED_PREDICATE = re.compile(
    r"\b(?:and|but|however|yet)\b|(?:并且|并|且|但是|(?<!不)但|不过|然而|却)",
    re.IGNORECASE,
)
COORDINATED_SUBJECT = re.compile(
    r"\bdirect\s*gpu\b|\bpxcollection\b|\bpxvehicledrive4w\b|"
    r"\bgetactiveactors\b|\buserdata\b|\bpxinitextensions\b|"
    r"\b(?:the\s+)?(?:public|upstream).{0,40}?(?:target|suite)\b|"
    r"公开.{0,20}?(?:目标|套件)",
    re.IGNORECASE,
)
PREDICATE_START = re.compile(
    r"^\W*(?:(?:also|still)\s+)?(?:supports?|allows?|keeps?|retains?|uses?|owns?|"
    r"deletes?|releases?|carries?|mixes?|dereferences?|reads?|accesses?|calls?|invokes?|"
    r"unwinds?|is\b|are\b|does\b|do\b|continue\b)|"
    r"^\W*(?:(?:仍|仍然|依然|也|继续).{0,8})?(?:在.{0,20})?"
    r"(?:继续使用|支持|允许|保留|沿用|使用|拥有|删除|解引用|读取|访问|调用|执行|释放|回滚|可用|不存在|不)|"
    r"^\W*(?:释放|销毁|失败).{0,12}(?:后|时).{0,8}(?:仍|仍然|也)?"
    r"(?:解引用|读取|访问|调用|执行)",
    re.IGNORECASE,
)


def coordinated_predicate_scopes(clause: str) -> list[str]:
    """Expose later coordinated predicates without inheriting an earlier denial."""
    scopes = [clause]
    subject_match = COORDINATED_SUBJECT.search(clause)
    subject = subject_match.group(0) if subject_match else ""
    for boundary in COORDINATED_PREDICATE.finditer(clause):
        suffix = clause[boundary.end():].strip(" ,，")
        if not suffix or not (
            PREDICATE_START.search(suffix) or COORDINATED_SUBJECT.match(suffix)
        ):
            continue
        scopes.append(f"{subject} {suffix}".strip())
    return scopes


def contains_affirmative_claim(text: str, pattern: str) -> bool:
    expression = re.compile(pattern, re.IGNORECASE)
    for clause in semantic_clauses(text):
        for scope in coordinated_predicate_scopes(clause):
            for match in expression.finditer(scope):
                prefix = scope[max(0, match.start() - 80):match.start()]
                claim = scope[match.start():match.end()]
                suffix = scope[match.end():match.end() + 64]
                if (
                    not DIRECT_DENIAL.search(prefix)
                    and not DIRECT_DENIAL.search(claim)
                    and not POSTFIX_DENIAL.search(suffix)
                ):
                    return True
    return False


SEMANTIC_WINDOW_WORDS = 270
SEMANTIC_WINDOW_UNITS = 6
SEMANTIC_WORD = re.compile(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b")
STRUCTURED_LINE = re.compile(r"^(?:[-+*]\s+|\d+[.)]\s+|\|.*\|\s*$)")


def semantic_word_count(text: str) -> int:
    return len(SEMANTIC_WORD.findall(text))


def bounded_semantic_units(paragraph: str) -> list[str]:
    """Keep prose bounded; retain Markdown list/table rows as semantic units."""
    if semantic_word_count(paragraph) <= SEMANTIC_WINDOW_WORDS:
        return [paragraph]
    lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
    if lines and re.match(r"^#{2,6}\s+", lines[0]):
        lines = lines[1:]
    if len(lines) >= 2 and all(STRUCTURED_LINE.match(line) for line in lines):
        return lines
    return []


def semantic_blocks(text: str) -> list[str]:
    """Return word- and unit-bounded semantic windows without section collapse."""
    compact_fences = re.sub(
        r"^```[^\n]*\n[\s\S]*?^```\s*$",
        lambda match: re.sub(r"\n\s*\n", "\n", match.group(0)),
        text,
        flags=re.MULTILINE,
    )
    heading_joined = re.sub(
        r"(^#{2,6}\s+[^\n]+)\n\s*\n",
        r"\1\n",
        compact_fences,
        flags=re.MULTILINE,
    )
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", heading_joined)
        if paragraph.strip()
    ]
    segments: list[list[str]] = [[]]
    for paragraph in paragraphs:
        if re.match(r"^#{2,6}\s+.*(?:glossary|\btoken\b)", paragraph, re.IGNORECASE):
            segments.append([])
        segments[-1].extend(bounded_semantic_units(paragraph))

    windows: list[str] = []
    for segment in segments:
        for start in range(len(segment)):
            for width in range(1, min(SEMANTIC_WINDOW_UNITS, len(segment) - start) + 1):
                window = "\n\n".join(segment[start:start + width])
                if semantic_word_count(window) <= SEMANTIC_WINDOW_WORDS:
                    windows.append(window)
    return [normalized(window) for window in windows]


def hyphen_neutral(text: str) -> str:
    return re.sub(r"(?<=\w)[_\-‐‑‒–—](?=\w)", " ", text)


def semantic_contains(block: str, term: str) -> bool:
    normalized_term = normalized(term)
    return (
        normalized_term in block
        or hyphen_neutral(normalized_term) in hyphen_neutral(block)
    )


def local_groups(text: str, groups: tuple[tuple[str, ...], ...]) -> bool:
    return any(
        all(any(semantic_contains(block, term) for term in group) for group in groups)
        for block in semantic_blocks(text)
    )


def markdown_h2_section(text: str, heading: str) -> str:
    match = re.search(
        rf"^{re.escape(heading)}\s*$([\s\S]*?)(?=^##\s|\Z)",
        text,
        flags=re.MULTILINE,
    )
    return match.group(1).strip() if match else ""


def runtime_final_synthesis_violations(skill: str, reference: str) -> set[str]:
    """Require a positive output recipe, then verify each final-answer block locally."""
    entry_recipe = local_groups(
        skill,
        (
            ("before the final answer", "before final answer"),
            ("final completeness pass",),
            ("ten",),
            ("cohesive local blocks",),
            ("final-answer completeness pass",),
        ),
    )
    section = markdown_h2_section(reference, FINAL_SYNTHESIS_HEADING)
    if not entry_recipe or not section:
        return set(BASELINE_GAPS)
    return {
        label
        for label, clusters in FINAL_SYNTHESIS_CLUSTERS.items()
        if not all(local_groups(section, cluster) for cluster in clusters)
    }


def response_violations(text: str) -> set[str]:
    """Measure only frozen PhysX-specific omissions and unsafe affirmative directions."""
    violations: set[str] = set()
    required_clusters = {
        "source-snapshot": (
            (
                ("110.1-omni-and-physx-5.9.0",),
                ("517a0073715120e114ee055b63b26c95e00d9039",),
                ("2026-07-14", "14 july 2026", "july 14, 2026"),
                ("version.txt",),
                ("5.9.0.6d94eeb9",),
                ("ovphysx 0.5.10",),
                ("pre-1.0", "pre-release"),
                ("separate", "wrapper"),
                (
                    "not a stable native c++ 5.10", "not stable native c++ 5.10",
                    "not native physx 5.10", "not native physx c++ 5.10",
                ),
            ),
        ),
        "current-vehicle-cooking": (
            (
                ("include/vehicle", "vehicle/"),
                ("physxvehicle",),
                (
                    "no vehicle2 namespace", "vehicle2 namespace has been removed",
                    "namespace vehicle2 has been removed", "remove use of the vehicle2 namespace",
                    "vehicle2 namespace; it no longer exists", "vehicle2 namespace is gone",
                ),
                ("5.7", "5.7+"),
            ),
            (
                ("pxcookingparams",),
                ("pxcook",),
                ("pxcreate",),
                ("free functions", "standalone functions", "immediate cooking", "immediate pxcreate"),
                (
                    "no pxcooking singleton", "no retained pxcooking", "pxcooking class has been removed",
                    "no current long-lived pxcooking singleton",
                    "do not create or retain a long-lived pxcooking singleton",
                    "do not create or preserve a pxcooking singleton",
                ),
            ),
        ),
        "scene-defaults-removals": (
            (
                ("pxscenedesc",),
                ("pgs",),
                ("pabp",),
                ("pcm",),
                ("pinned header", "5.9 header"),
                ("default", "defaults"),
            ),
            (
                ("5.9",),
                ("particle cloth",),
                ("particle rigid",),
                ("pxsoftbody", "soft-body aliases"),
                ("pxfemsoftbody", "fem aliases"),
                ("removed",),
                (
                    "no standalone migrationto59", "migrationto59 does not exist",
                    "no standalone 5.9 migration guide",
                ),
                ("changelog", "authoritative"),
            ),
        ),
        "direct-gpu-boundary": (
            (
                ("standard cpu",),
                ("standard gpu dynamics",),
                ("gpu broadphase", "gpu broad phase"),
                ("independent", "orthogonal"),
                ("direct gpu",),
                ("gpu-only",),
                ("fem", "deformable"),
                ("pbd", "particle"),
                ("sdf",),
            ),
            (
                ("direct gpu",),
                ("gpu dynamics",),
                ("gpu broadphase", "gpu broad phase"),
                ("sleeping disabled", "disable sleeping"),
                ("enhanced determinism",),
                ("cct", "character controller"),
                ("vehicle",),
                ("cpu scene quer",),
                ("ccd",),
                ("trigger",),
                ("contact modification",),
                ("shiftorigin", "origin shift"),
                ("stale", "outdated"),
                ("setter", "forbidden", "do not work"),
            ),
            (
                ("enhanced determinism",),
                ("not currently supported on gpu", "no gpu support", "unsupported on gpu", "unavailable"),
                ("cross-platform", "windows/linux"),
                ("compiler",),
                ("build",),
                ("no guarantee", "does not guarantee"),
            ),
            (
                ("invalid",),
                ("oom", "out-of-memory"),
                ("overflow", "capacity"),
                ("device loss", "device-loss"),
                ("fail", "rebuild"),
                ("feature-equivalent fallback", "feature-equivalent cpu fallback"),
            ),
        ),
        "event-query-lifetime-traps": (
            (
                ("simulate(dt > 0)", "simulate(dt>0)", "simulate(fixeddt)"),
                ("exactly one", "exactly paired"),
                ("fetchresults",),
                ("outstanding", "in flight", "in-flight"),
                ("one writer", "single writer"),
                ("multiple readers", "many readers", "multiple-reader"),
                (
                    "cannot upgrade", "cannot be upgraded", "non-upgradeable",
                    "lock upgrading is not supported",
                ),
                ("thread-safe",),
                ("callback queue", "event queue", "thread-safe queue"),
            ),
            (
                ("pair flags", "pairflags", "pairs needing contact points"),
                ("notification",),
                ("enotify_contact_points",),
                ("trigger",),
                ("persist",),
                ("not supported", "unsupported"),
                ("query cache", "pxquerycache"),
                ("bypass", "not executed"),
                ("filter",),
            ),
            (
                ("removed actor",),
                ("removed shape",),
                ("invalid", "do not dereference"),
                ("onadvance",),
                ("simulation is running", "overlaps simulation", "overlap simulation"),
                ("active actor",),
                ("fetchresults", "fetch boundary"),
            ),
            (
                ("allocator",),
                ("error callback",),
                ("outlive foundation",),
                ("scene",),
                ("dispatcher",),
                ("cuda manager", "cuda context manager"),
                ("pxcloseextensions",),
                ("physics teardown", "release physics"),
                ("reverse", "shutdown must"),
            ),
        ),
        "serialization-observability": (
            (
                ("5.6",),
                (
                    "binary data conversion", "platform conversion", "platform/binary conversion",
                    "deterministic binary collection conversion",
                ),
                (
                    "serializecollectiontobinarydeterministic", "deterministic binary serialization",
                    "deterministic binary collection conversion",
                ),
                ("pxbinaryconverter",),
                ("removed", "gone"),
            ),
            (
                ("pxcollection", "collection"),
                ("does not delete", "non-owning"),
                ("128-byte", "128 byte"),
                ("backing memory", "memory block"),
                (
                    "entire lifetime", "full lifetime", "until all objects",
                    "until every in-place object",
                ),
            ),
            (
                ("pvd",),
                ("transport", "live"),
                ("omnipvd",),
                ("ovd",),
                ("file", "record"),
                ("diagnostic", "observability"),
                (
                    "not persistence", "not a save", "not rollback state",
                    "neither tool is a persistence format",
                    "neither pvd nor omnipvd is persistence",
                ),
            ),
        ),
        "public-validation-boundary": (
            (
                ("public 5.9 tree", "public tree"),
                ("snippets",),
                ("smoke",),
                ("reference",),
                (
                    "not conformance", "not a release gate",
                    "only a build and startup smoke test",
                ),
                (
                    "no auditable public sdk unit-test", "no public sdk unit-test",
                    "not an auditable sdk unit-test",
                ),
                ("benchmark target", "benchmark suite"),
                ("checked",),
                ("windows",),
                ("linux", "ubuntu"),
                ("cuda",),
                ("sanitizer",),
                ("nsight",),
                ("compute sanitizer",),
                ("pvd",),
                ("omnipvd",),
                ("soak",),
                ("performance",),
            ),
        ),
    }
    for label, clusters in required_clusters.items():
        if not all(local_groups(text, cluster) for cluster in clusters):
            violations.add(label)

    if "source-snapshot" not in violations:
        formal_review_clusters = {
            label: FINAL_SYNTHESIS_CLUSTERS[label]
            for label in FORMAL_REVIEW_GAPS
        }
        for label, clusters in formal_review_clusters.items():
            if not all(local_groups(text, cluster) for cluster in clusters):
                violations.add(label)

    unsafe_claims = {
        "removed-legacy-vehicle-api": (
            r"(?:carry|retain|keep|use|mix).{0,32}pxvehicledrive4w.{0,32}"
            r"(?:into|in|with|for).{0,12}(?:native\s+)?(?:physx\s+)?5\.9",
            r"(?:在.{0,16}(?:原生|native).{0,8}5\.9.{0,24}(?:保留|沿用|使用|混入).{0,16}pxvehicledrive4w|"
            r"(?:保留|沿用|使用|混入).{0,16}pxvehicledrive4w.{0,24}(?:原生|native).{0,8}5\.9)",
        ),
        "active-actor-release-window": (
            r"(?:dereference|read|access|use).{0,40}"
            r"(?:getactiveactors?(?:\(\))?|entries?|userdata).{0,48}"
            r"(?:after|following).{0,20}(?:release|destroy)",
            r"(?:释放|销毁).{0,8}(?:后|之后).{0,24}(?:解引用|读取|访问|使用).{0,24}"
            r"(?:getactiveactors|条目|userdata)",
        ),
        "partial-init-unwind": (
            r"(?:call|invoke|run).{0,24}pxcloseextensions.{0,48}(?:even\s+)?"
            r"(?:when|if|after).{0,24}pxinitextensions.{0,20}(?:fail|false|unsuccessful)",
            r"pxinitextensions.{0,20}(?:fail|false|unsuccessful).{0,48}"
            r"(?:call|invoke|run).{0,20}pxcloseextensions",
            r"(?:reverse[- ]?unwind|unwind|release|tear\s+down).{0,32}"
            r"(?:uninitialized|not[- ]initialized|never[- ]initialized).{0,16}(?:stages?|resources?)",
            r"pxinitextensions.{0,16}(?:失败|返回.{0,4}false).{0,24}(?:仍|也|照样)?.{0,8}"
            r"(?:调用|执行).{0,16}pxcloseextensions",
            r"(?:反向(?:释放|回滚|清理)|释放|回滚).{0,20}(?:未初始化|未成功初始化).{0,12}(?:阶段|资源)",
        ),
        "source-snapshot": (
            r"(?:track|follow|consume)\s+(?:the\s+)?(?:moving\s+)?main\b|"
            r"build(?:\s+\w+){0,3}\s+against\s+(?:the\s+)?(?:moving\s+)?main\b",
            r"(?:跟踪|使用|基于).{0,10}\bmain\b",
            r"ovphysx\s+0\.5\.10.{0,48}(?:is|as).{0,20}(?:a\s+)?stable\s+native\s+c\+\+\s+5\.10",
        ),
        "current-vehicle-cooking": (
            r"(?:(?:carry|retain|keep).{0,48}(?:vehicle2\s+namespace|physx::vehicle2)|"
            r"use\s+(?:the\s+)?(?:vehicle2\s+namespace|physx::vehicle2))",
            r"(?:保留|继续使用|沿用).{0,24}(?:vehicle2\s+命名空间|physx::vehicle2)",
            r"(?:create|retain|keep|own).{0,40}(?:long-lived\s+)?pxcooking\b.{0,20}(?:singleton|object)",
            r"(?:创建|保留).{0,20}(?:长期|全局).{0,12}pxcooking(?:\s+单例|\s+对象)",
        ),
        "scene-defaults-removals": (
            r"pxscenedesc.{0,48}(?:defaults?|default solver).{0,24}tgs",
            r"(?:tgs).{0,24}(?:is|as).{0,16}(?:the\s+)?pxscenedesc\s+default",
            r"pxscenedesc.{0,40}默认.{0,16}tgs",
        ),
        "direct-gpu-boundary": (
            r"direct\s*gpu.{0,64}(?:supports?|allows?|keeps?).{0,40}(?:cpu(?:\s+scene)?\s+quer|vehicles?|cct|character controllers?|triggers?|contact modification|ccd|shiftorigin|origin shift)",
            r"(?:cpu(?:\s+scene)?\s+quer|vehicles?|cct|character controllers?|triggers?|contact modification|ccd).{0,48}(?:works?|supported|available).{0,32}direct\s*gpu",
            r"direct\s*gpu.{0,48}(?:automatic|transparent).{0,32}(?:cpu\s+fallback|feature\s+parity)",
            r"(?:enhanced determinism|same seed).{0,48}(?:guarantees?|ensures?).{0,48}(?:cross-platform|windows.{0,12}linux|bit-identical)",
            r"direct\s*gpu.{0,40}(?:支持|允许).{0,30}(?:cpu\s*场景查询|车辆|角色控制器|触发器|ccd|接触修改|原点平移)",
        ),
        "event-query-lifetime-traps": (
            r"onadvance.{0,48}(?:mutate|modify|add|remove).{0,32}(?:scene|actor|shape)",
            r"trigger.{0,32}(?:touch\s+)?persists?.{0,24}(?:is|are).{0,16}\b(?:supported|available)\b",
            r"(?:query\s+cache|pxquerycache).{0,48}(?:runs?|executes?|applies?).{0,24}(?:the\s+)?filter",
            r"(?:read\s+lock|lockread).{0,48}(?:upgrade|promote).{0,24}(?:write|lockwrite)",
            r"(?:调用|在)\s*onadvance.{0,28}(?:修改|增删).{0,20}(?:场景|actor|shape)",
        ),
        "serialization-observability": (
            r"(?:physx\s+)?binary.{0,48}(?:durable|portable|stable).{0,32}(?:cross-version|network|save|snapshot)",
            r"pxcollection.{0,48}(?:owns?|deletes?|releases?).{0,28}(?:contained\s+)?objects?",
            r"(?:free|deallocate|release).{0,32}(?:backing\s+)?memory.{0,36}(?:after|once).{0,24}(?:collection|addcollection)",
            r"(?:二进制|binary).{0,32}(?:可|能够).{0,16}(?:跨版本|网络快照|持久存档)",
            r"pxcollection.{0,32}(?:拥有|删除|释放).{0,24}(?:对象|其中对象)",
        ),
        "public-validation-boundary": (
            r"(?:public|upstream).{0,28}(?:sdk\s+)?(?:unittests?|unit-test|benchmark).{0,32}(?:target|suite).{0,24}(?:exists?|available|provided)",
            r"snippets?.{0,32}(?:are|is).{0,16}(?:conformance|sufficient\s+to\s+ship|release\s+gate)",
            r"(?:公开|上游).{0,20}(?:单元测试|基准).{0,20}(?:目标|套件).{0,16}(?:存在|可用)",
        ),
    }
    for label, patterns in unsafe_claims.items():
        if any(contains_affirmative_claim(text, pattern) for pattern in patterns):
            violations.add(label)
    return violations


def complete_gate_contract() -> str:
    return """Pinned native C++ snapshot: tag 110.1-omni-and-physx-5.9.0, released 2026-07-14, commit 517a0073715120e114ee055b63b26c95e00d9039; version.txt is 5.9.0.6d94eeb9. The separate ovphysx 0.5.10 wrapper is pre-1.0 and is not a stable native C++ 5.10 release.

Since 5.7, current vehicle headers live under include/vehicle, libraries use PhysXVehicle, and the vehicle2 namespace has been removed: there is no vehicle2 namespace. Current cooking retains PxCookingParams. Do not retain a PxCooking singleton; the PxCooking class has been removed in favor of PxCook* and PxCreate* free functions for immediate cooking.

PxVehicleDrive4W from the old deprecated vehicle API was removed. Port it to the current component API, or isolate the PhysX 4.1 SDK behind a separate reference process and binary boundary; never carry PxVehicleDrive4W into native 5.9.

The pinned 5.9 header makes PxSceneDesc defaults PGS, ePABP, and eENABLE_PCM; the pinned header overrides historical TGS prose. PhysX 5.9 removed particle cloth, particle rigids, PxSoftBody and PxFEMSoftBody aliases. No standalone MigrationTo59 exists, so the pinned changelog is authoritative.

Keep standard CPU, standard GPU dynamics, GPU broadphase, Direct GPU, and GPU-only FEM deformables, PBD particles, and SDF collision paths distinct. GPU dynamics and GPU broadphase are independent choices; Direct GPU is a separate access contract.

Direct GPU requires GPU dynamics, GPU broadphase, and sleeping disabled. It does not support enhanced determinism, CCT/character controllers, vehicles, CPU scene queries, CCD, triggers, contact modification, or runtime origin shift/shiftOrigin. CPU getters may be stale/outdated and setters do not work or are forbidden after Direct GPU initialization.

Enhanced determinism has no GPU support and does not guarantee cross-platform, compiler, or build identity. For invalid CUDA, OOM/out-of-memory, capacity overflow, or device loss, fail explicitly or rebuild from application state; do not promise feature-equivalent fallback.

Every simulate(dt > 0) has exactly one paired fetchResults before another simulate. No scene write occurs while simulation is outstanding/in-flight. Use one writer/multiple readers; lock upgrading is not supported and reads cannot upgrade. Simulation callbacks enqueue into a thread-safe callback queue for later host processing.

Pair flags create notifications; contact points require eNOTIFY_CONTACT_POINTS. Trigger persists notifications are unsupported/not supported. Removed actor and removed shape flags mean pointers may be invalid: do not dereference. onAdvance runs while simulation is running and overlaps simulation. Active actor pointers are data from the fetchResults boundary. A PxQueryCache/query cache bypasses filtering: filters are not executed for the cached shape.

getActiveActors may include actors released after the preceding fetchResults. Never dereference entries, including userData, unless consuming immediately after fetchResults and before any releases; otherwise use host validity/tombstone checks to skip released entries without dereference.

Allocator and error callback objects outlive Foundation. Teardown runs in reverse: release resources then scene; the scene outlives neither dispatcher nor CUDA manager/context manager. Call PxCloseExtensions before Physics teardown/release Physics.

Check every ordinary result: PxCreateFoundation, PxCreatePhysics, the PxInitExtensions bool, PxSceneDesc::isValid, and scene/resource factory returns. Track only successfully initialized stages and reverse-unwind them. Call PxCloseExtensions only when init succeeded; cover every boundary with failure-injection tests.

PhysX 5.6 removed binary data conversion/platform conversion, PxSerialization::serializeCollectionToBinaryDeterministic, and PxBinaryConverter. PxCollection is a non-owning container: release does not delete contained objects. In-place binary deserialization needs 128-byte aligned backing memory kept for the entire lifetime until all objects are released.

PVD is a live transport to the visual debugger; OmniPVD records an OVD file/stream for later inspection. Both are diagnostic observability, not persistence, a save format, or rollback state.

The public 5.9 tree exposes snippets as smoke/reference seeds, not conformance. There is no auditable public SDK unit-test or benchmark target. Validate exact selected snippets, checked builds, host lifecycle/filter/event/replay/determinism tests, Windows/Linux CPU and supported CUDA, sanitizers, Nsight and Compute Sanitizer, PVD/OmniPVD captures, capacity/error tests, soak, and target performance evidence."""


class NvidiaPhysxSdkSkillTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for path in (
            SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE,
            ATTEMPT1, ATTEMPT2, ATTEMPT3, ENABLED,
        ):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(
                    path.is_file(),
                    f"missing Task 21 artifact: {path.relative_to(ROOT)}",
                )

    def test_frozen_fixtures_are_exact_lf_only_and_protected(self):
        attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")
        for path, (size, digest) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.name):
                self.assertTrue(path.is_file(), path)
                raw = path.read_bytes()
                self.assertEqual(len(raw), size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertEqual(raw[-1:], b"\n")
                self.assertNotIn(b"\r", raw)
                relative = path.relative_to(ROOT).as_posix()
                self.assertIn(f"{relative} -text whitespace=-trailing-space", attributes)

    def test_baseline_exposes_exact_physx_specific_gaps(self):
        self.assertEqual(
            response_violations(BASELINE.read_text(encoding="utf-8")),
            BASELINE_GAPS,
        )
        self.assertEqual(response_violations(complete_gate_contract()), set())

    def test_first_enabled_attempt_is_exact_and_retains_real_source_failure(self):
        self.assertEqual(
            response_violations(ATTEMPT1.read_text(encoding="utf-8")),
            {"source-snapshot"},
        )

    def test_first_attempt_distinguishes_real_omissions_from_scattered_evidence(self):
        text = ATTEMPT1.read_text(encoding="utf-8")
        compact = normalized(text)
        for omitted in (
            "2026-07-14", "pre-1.0", "not a stable native c++ 5.10",
            "no standalone migrationto59", "no auditable public sdk unit-test",
        ):
            with self.subTest(omitted=omitted):
                self.assertNotIn(omitted, compact)

        direct_gpu_scattered = (
            ("direct gpu",), ("sleeping disabled",), ("cct",), ("vehicles",),
            ("cpu scene queries",), ("ccd",), ("triggers",), ("contact modification",),
            ("origin shifting",), ("enhanced determinism",), ("oom",), ("device loss",),
        )
        self.assertTrue(all(group[0] in compact for group in direct_gpu_scattered))
        self.assertTrue(local_groups(text, direct_gpu_scattered))

        incorrectly_mixed_determinism_and_recovery = (
            ("enhanced determinism",), ("cross-platform",), ("compilers",), ("build",),
            ("invalid cuda",), ("oom",), ("device loss",), ("feature-equivalent cpu fallback",),
        )
        self.assertTrue(
            all(
                any(semantic_contains(compact, term) for term in group)
                for group in incorrectly_mixed_determinism_and_recovery
            )
        )
        self.assertFalse(local_groups(text, incorrectly_mixed_determinism_and_recovery))

        serialization_scattered = (
            ("5.6",), ("pxbinaryconverter",), ("pxcollection",), ("non-owning",),
            ("128-byte",), ("backing memory",), ("entire lifetime",),
        )
        self.assertTrue(all(group[0] in compact for group in serialization_scattered))
        self.assertTrue(local_groups(text, serialization_scattered))

    def test_section_aware_gate_keeps_attempt_history_after_formal_review(self):
        cases = (
            (ATTEMPT2, FORMAL_REVIEW_GAPS),
            (ATTEMPT1, {"source-snapshot"}),
        )
        for path, expected in cases:
            with self.subTest(path=path.name):
                self.assertEqual(
                    response_violations(path.read_text(encoding="utf-8")),
                    expected,
                )

    def test_third_enabled_attempt_is_frozen_and_promoted_byte_for_byte(self):
        text = ATTEMPT3.read_text(encoding="utf-8")
        violations = response_violations(text)
        self.assertTrue(FORMAL_REVIEW_GAPS.isdisjoint(violations))

        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertIn("attempt-3", {attempt["name"] for attempt in data["attempts"]})
        self.assertEqual(ATTEMPT3.read_bytes(), ENABLED.read_bytes())
        self.assertEqual(violations, set())

    def test_removed_legacy_vehicle_api_is_material_and_deletion_protected(self):
        label = "removed-legacy-vehicle-api"
        self.assertIn(label, response_violations(ATTEMPT2.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(BASELINE.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(ATTEMPT1.read_text(encoding="utf-8")))
        complete = complete_gate_contract()
        self.assertNotIn(label, response_violations(complete))
        token = "current component API"
        self.assertIn(token, complete)
        self.assertIn(label, response_violations(complete.replace(token, "", 1)))

        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        section = markdown_h2_section(reference, FINAL_SYNTHESIS_HEADING)
        self.assertIn(token, section)
        mutated = reference.replace(section, section.replace(token, "", 1), 1)
        self.assertIn(label, runtime_final_synthesis_violations(skill, mutated))

    def test_active_actor_release_window_is_material_and_deletion_protected(self):
        label = "active-actor-release-window"
        self.assertIn(label, response_violations(ATTEMPT2.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(BASELINE.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(ATTEMPT1.read_text(encoding="utf-8")))
        complete = complete_gate_contract()
        self.assertNotIn(label, response_violations(complete))
        token = "host validity/tombstone checks"
        self.assertIn(token, complete)
        self.assertIn(label, response_violations(complete.replace(token, "", 1)))

        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        section = markdown_h2_section(reference, FINAL_SYNTHESIS_HEADING)
        self.assertIn(token, section)
        mutated = reference.replace(section, section.replace(token, "", 1), 1)
        self.assertIn(label, runtime_final_synthesis_violations(skill, mutated))

    def test_partial_init_unwind_is_material_and_deletion_protected(self):
        label = "partial-init-unwind"
        self.assertIn(label, response_violations(ATTEMPT2.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(BASELINE.read_text(encoding="utf-8")))
        self.assertNotIn(label, response_violations(ATTEMPT1.read_text(encoding="utf-8")))
        complete = complete_gate_contract()
        self.assertNotIn(label, response_violations(complete))
        token = "only when init succeeded"
        self.assertIn(token, complete)
        self.assertIn(label, response_violations(complete.replace(token, "", 1)))

        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        section = markdown_h2_section(reference, FINAL_SYNTHESIS_HEADING)
        self.assertIn(token, section)
        mutated = reference.replace(section, section.replace(token, "", 1), 1)
        self.assertIn(label, runtime_final_synthesis_violations(skill, mutated))

    def test_evaluation_preserves_exact_history_and_final_adjudication(self):
        self.assertTrue(EVALUATION.is_file(), EVALUATION)
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "nvidia-physx-sdk")
        self.assertEqual(data["scenario"].encode("utf-8"), SCENARIO.read_bytes())
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ENABLED.read_bytes())
        self.assertEqual(ENABLED.read_bytes(), ATTEMPT3.read_bytes())
        self.assertEqual(data["verdict"], "accept_with_limitations")

        attempts = {attempt["name"]: attempt for attempt in data["attempts"]}
        self.assertEqual(set(attempts), {"attempt-1", "attempt-2", "attempt-3"})
        self.assertEqual(attempts["attempt-1"]["response"].encode("utf-8"), ATTEMPT1.read_bytes())
        self.assertEqual(attempts["attempt-2"]["response"].encode("utf-8"), ATTEMPT2.read_bytes())
        self.assertEqual(attempts["attempt-3"]["response"].encode("utf-8"), ATTEMPT3.read_bytes())
        all_labels = sorted(BASELINE_GAPS)
        self.assertEqual(data["baseline"]["authoritative_violations"], all_labels)
        self.assertEqual(attempts["attempt-1"]["legacy_violations"], all_labels)
        self.assertEqual(attempts["attempt-1"]["authoritative_violations"], ["source-snapshot"])
        self.assertEqual(attempts["attempt-2"]["legacy_violations"], all_labels)
        self.assertEqual(
            attempts["attempt-2"]["authoritative_violations"],
            sorted(FORMAL_REVIEW_GAPS),
        )
        self.assertEqual(attempts["attempt-2"]["verdict"], "fail")
        self.assertEqual(attempts["attempt-3"]["authoritative_violations"], [])
        self.assertEqual(attempts["attempt-3"]["verdict"], "accept_with_limitations")
        self.assertEqual(data["enabled"]["authoritative_violations"], [])
        self.assertEqual(
            data["enabled"]["residual_evaluator_limitations"],
            list(RESIDUAL_EVALUATOR_LIMITATIONS),
        )

        evidence = normalized("\n".join(data["evidence"]))
        for term in (
            "blind baseline isolation", "no web", "legacy paragraph-local",
            "section-aware", "red", "green", "110.1-omni-and-physx-5.9.0",
            "517a0073715120e114ee055b63b26c95e00d9039", "5.9.0.6d94eeb9",
            "technical verdict", "byte-for-byte", "formal review", "fresh attempt 3",
            "five-round cap", "accept_with_limitations", "evaluator limitations",
            "not attempt 3 or runtime omissions", "nevertheless", "after release",
            "markdown bullet or table rows", "round 5",
        ):
            with self.subTest(term=term):
                self.assertIn(term, evidence)

    def test_fresh_attempt3_must_clear_the_formal_review_gate(self):
        self.assertEqual(
            response_violations(ENABLED.read_text(encoding="utf-8")),
            set(),
            "current final is historical attempt 2; a fresh attempt 3 is required",
        )

    def test_evaluation_must_promote_a_fresh_attempt3(self):
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        attempts = {attempt["name"]: attempt for attempt in data["attempts"]}
        self.assertEqual(data["verdict"], "accept_with_limitations")
        self.assertIn("attempt-3", attempts)
        self.assertEqual(attempts["attempt-3"]["authoritative_violations"], [])
        self.assertEqual(attempts["attempt-3"]["response"].encode("utf-8"), ATTEMPT3.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ATTEMPT3.read_bytes())
        self.assertEqual(
            data["enabled"]["residual_evaluator_limitations"],
            list(RESIDUAL_EVALUATOR_LIMITATIONS),
        )

    def test_runtime_requires_a_final_synthesis_in_cohesive_local_blocks(self):
        self.assertEqual(
            runtime_final_synthesis_violations(
                SKILL.read_text(encoding="utf-8"),
                REFERENCE.read_text(encoding="utf-8"),
            ),
            set(),
        )

    def test_gate_is_section_local_and_deletion_protected(self):
        complete = complete_gate_contract()
        deletions = {
            "source-snapshot": "517a0073715120e114ee055b63b26c95e00d9039",
            "current-vehicle-cooking": "PhysXVehicle",
            "scene-defaults-removals": "ePABP",
            "direct-gpu-boundary": "standard CPU",
            "event-query-lifetime-traps": "eNOTIFY_CONTACT_POINTS",
            "serialization-observability": "128-byte",
            "public-validation-boundary": "Compute Sanitizer",
        }
        for label, token in deletions.items():
            with self.subTest(label=label):
                removed = complete.replace(token, "", 1)
                self.assertIn(label, response_violations(removed))
                glossary = removed + f"\n\n## Isolated glossary\n{token}"
                self.assertIn(label, response_violations(glossary))

        keyword_dump = "\n\n".join(
            f"## Token {index}\n{token}"
            for index, token in enumerate(
                (
                    "110.1-omni-and-physx-5.9.0", "517a0073715120e114ee055b63b26c95e00d9039",
                    "version.txt", "5.9.0.6d94eeb9", "ovphysx 0.5.10", "pre-1.0 wrapper",
                    "include/vehicle PhysXVehicle no vehicle2 namespace 5.7", "PxCookingParams PxCook PxCreate",
                    "PxSceneDesc PGS PABP PCM pinned header defaults", "5.9 particle cloth particle rigid removed",
                    "standard CPU", "standard GPU dynamics", "GPU broadphase", "Direct GPU", "GPU-only FEM PBD SDF",
                    "simulate(dt > 0)", "fetchResults", "one writer", "pair flags", "onAdvance", "query cache",
                    "PxCollection 128-byte backing memory", "PVD OmniPVD OVD", "public 5.9 tree snippets",
                    "Windows Linux CUDA sanitizer Nsight Compute Sanitizer soak performance",
                )
            )
        )
        self.assertEqual(response_violations(keyword_dump), BASELINE_GAPS)

    def test_unsafe_directions_are_semantic_and_clause_local(self):
        complete = complete_gate_contract()
        unsafe = {
            "source-snapshot": (
                "Build production against the moving main branch.",
                "生产构建跟踪 main 分支。",
            ),
            "current-vehicle-cooking": (
                "Keep the vehicle2 namespace for the current integration.",
                "继续使用 vehicle2 命名空间。",
                "Create a long-lived PxCooking singleton object.",
            ),
            "scene-defaults-removals": (
                "PxSceneDesc defaults to TGS.",
                "PxSceneDesc 默认使用 TGS。",
            ),
            "direct-gpu-boundary": (
                "Direct GPU supports CPU scene queries and vehicles.",
                "Direct GPU 支持 CPU 场景查询和车辆。",
                "The same seed guarantees Windows/Linux cross-platform bit-identical results.",
            ),
            "event-query-lifetime-traps": (
                "onAdvance may modify actors in the scene.",
                "在 onAdvance 修改场景 actor。",
                "A read lock can upgrade to a write lock.",
            ),
            "serialization-observability": (
                "PhysX binary snapshots are durable cross-version saves.",
                "PhysX binary 可作为跨版本持久存档。",
                "PxCollection owns and deletes the contained objects.",
            ),
            "public-validation-boundary": (
                "The public SDK unit-test target is available upstream.",
                "公开单元测试目标存在并可用。",
                "Snippets are a conformance release gate.",
            ),
        }
        for label, probes in unsafe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(label, response_violations(complete + "\n\n" + probe))

        clause_local = (
            "Direct GPU does not support CPU scene queries, but Direct GPU supports vehicles.",
            "Do not keep vehicle2; however, retain the vehicle2 namespace for compatibility.",
        )
        for probe in clause_local:
            with self.subTest(clause_local=probe):
                self.assertTrue(
                    {"direct-gpu-boundary", "current-vehicle-cooking"}
                    & response_violations(complete + "\n\n" + probe)
                )

    def test_explicit_denials_are_safe_but_not_only_is_affirmative(self):
        complete = complete_gate_contract()
        safe = {
            "source-snapshot": ("Do not build against moving main.", "不要跟踪 main。"),
            "current-vehicle-cooking": (
                "Do not retain a PxCooking singleton object.",
                "不要保留长期 PxCooking 对象。",
            ),
            "scene-defaults-removals": ("PxSceneDesc does not default to TGS.",),
            "direct-gpu-boundary": (
                "Direct GPU does not support CPU scene queries or vehicles.",
                "Enhanced determinism does not guarantee cross-platform bit-identical output.",
            ),
            "event-query-lifetime-traps": (
                "Do not modify actors in onAdvance.",
                "A read lock cannot upgrade to a write lock.",
            ),
            "serialization-observability": (
                "PhysX binary data is not a durable cross-version save.",
                "PxCollection does not delete contained objects.",
            ),
            "public-validation-boundary": (
                "The public SDK unit-test target does not exist.",
                "Snippets are not a conformance release gate.",
            ),
        }
        for label, denials in safe.items():
            for denial in denials:
                with self.subTest(label=label, denial=denial):
                    self.assertNotIn(label, response_violations(complete + "\n\n" + denial))

        for affirmative in (
            "Direct GPU not only supports CPU scene queries but also supports vehicles.",
            "PxCollection not only stores pointers but owns and deletes contained objects.",
            "不仅 Direct GPU 支持 CPU 场景查询，还支持车辆。",
        ):
            with self.subTest(affirmative=affirmative):
                self.assertTrue(
                    {"direct-gpu-boundary", "serialization-observability"}
                    & response_violations(complete + "\n\n" + affirmative)
                )

    def test_coordinated_predicate_contradictions_are_not_masked(self):
        complete = complete_gate_contract()
        unsafe = {
            "direct-gpu-boundary": (
                "Direct GPU does not support CPU scene queries and supports vehicles.",
                "Direct GPU 不支持 CPU 场景查询并支持车辆。",
            ),
            "current-vehicle-cooking": (
                "Do not keep the vehicle2 namespace and retain the vehicle2 namespace for compatibility.",
                "不要保留 vehicle2 命名空间并继续使用 vehicle2 命名空间。",
            ),
            "serialization-observability": (
                "PxCollection does not own contained objects and deletes contained objects.",
                "PxCollection 不拥有其中对象并删除其中对象。",
            ),
            "public-validation-boundary": (
                "The public benchmark target does not exist and the public benchmark target is available.",
                "公开基准目标不存在并且公开基准目标可用。",
            ),
        }
        for label, probes in unsafe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(label, response_violations(complete + "\n\n" + probe))

        safe = {
            "direct-gpu-boundary": (
                "Direct GPU does not support CPU scene queries or vehicles.",
                "Direct GPU 不支持 CPU 场景查询或车辆。",
            ),
            "current-vehicle-cooking": (
                "Do not keep vehicle2 and do not use PhysX::vehicle2.",
                "不要保留 vehicle2，也不要使用 PhysX::vehicle2。",
            ),
            "serialization-observability": (
                "PxCollection does not own or delete contained objects.",
                "PxCollection 不拥有也不删除其中对象。",
            ),
            "public-validation-boundary": (
                "The public unit-test target does not exist and the public benchmark target is not available.",
                "公开单元测试目标不存在并且公开基准目标不可用。",
            ),
        }
        for label, probes in safe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertNotIn(label, response_violations(complete + "\n\n" + probe))

    def test_scoped_no_and_neither_denials_do_not_mask_later_affirmatives(self):
        complete = complete_gate_contract()
        safe = {
            "direct-gpu-boundary": (
                "Direct GPU supports no CPU scene queries or vehicles.",
                "Direct GPU supports neither CPU scene queries nor vehicles.",
            ),
            "public-validation-boundary": (
                "No public SDK unit-test or benchmark target is available.",
            ),
            "serialization-observability": (
                "PxCollection owns no contained objects.",
            ),
        }
        for label, probes in safe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertNotIn(label, response_violations(complete + "\n\n" + probe))

        unsafe = {
            "direct-gpu-boundary": (
                "Direct GPU supports no CPU queries but supports vehicles.",
                "Direct GPU supports neither CPU scene queries nor vehicles, but supports triggers.",
            ),
            "serialization-observability": (
                "PxCollection owns no contained objects but deletes contained objects.",
            ),
            "public-validation-boundary": (
                "No public SDK unit-test target is available, but the public benchmark target is available.",
            ),
        }
        for label, probes in unsafe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(label, response_violations(complete + "\n\n" + probe))

    def test_formal_review_unsafe_directions_are_clause_and_predicate_local(self):
        complete = complete_gate_contract()
        unsafe = {
            "removed-legacy-vehicle-api": (
                "Carry PxVehicleDrive4W into native 5.9.",
                "在原生 5.9 中保留 PxVehicleDrive4W。",
                "Do not carry PxVehicleDrive4W into native 5.9, but retain PxVehicleDrive4W in native 5.9.",
                "不得在原生 5.9 中保留 PxVehicleDrive4W，但仍在原生 5.9 中沿用 PxVehicleDrive4W。",
            ),
            "active-actor-release-window": (
                "Dereference getActiveActors entries or userData after release.",
                "释放后解引用 getActiveActors 条目或 userData。",
                "Never dereference getActiveActors entries after release, but read userData after release.",
                "释放后不得解引用 getActiveActors 条目，但释放后仍读取 userData。",
            ),
            "partial-init-unwind": (
                "Call PxCloseExtensions even when PxInitExtensions failed.",
                "Reverse-unwind uninitialized stages.",
                "即使 PxInitExtensions 失败也调用 PxCloseExtensions。",
                "反向释放未初始化阶段。",
                "Do not call PxCloseExtensions when PxInitExtensions failed, but call PxCloseExtensions after PxInitExtensions failed.",
                "PxInitExtensions 失败时不得调用 PxCloseExtensions，但失败后仍调用 PxCloseExtensions。",
            ),
        }
        for label, probes in unsafe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(label, response_violations(complete + "\n\n" + probe))

        safe = {
            "removed-legacy-vehicle-api": (
                "Do not carry PxVehicleDrive4W into native 5.9.",
                "不得在原生 5.9 中保留 PxVehicleDrive4W。",
            ),
            "active-actor-release-window": (
                "Never dereference getActiveActors entries or userData after release.",
                "释放后不得解引用 getActiveActors 条目或 userData。",
            ),
            "partial-init-unwind": (
                "Do not call PxCloseExtensions when PxInitExtensions failed.",
                "Never reverse-unwind uninitialized stages.",
                "PxInitExtensions 失败时不得调用 PxCloseExtensions。",
                "不得反向释放未初始化阶段。",
            ),
        }
        for label, probes in safe.items():
            for probe in probes:
                with self.subTest(label=label, probe=probe):
                    self.assertNotIn(label, response_violations(complete + "\n\n" + probe))

    def test_one_h2_isolated_paragraph_keyword_soup_is_rejected(self):
        paragraphs = complete_gate_contract().split("\n\n")
        omitted = (
            "Pinned native C++ snapshot", "PxVehicleDrive4W", "getActiveActors",
            "Check every ordinary result",
        )
        complete = "\n\n".join(
            paragraph for paragraph in paragraphs
            if not any(marker in paragraph for marker in omitted)
        )
        soup = "## One H2 glossary\n\n" + re.sub(r"\s+", "\n\n", complete.strip())
        word_pattern = r"\b[A-Za-z][A-Za-z0-9_:'-]*\b"
        count = len(re.findall(word_pattern, soup))
        self.assertLessEqual(count, 490)
        soup += "\n\n" + "\n\n".join(["padding"] * (490 - count))
        self.assertEqual(len(re.findall(word_pattern, soup)), 490)
        self.assertEqual(response_violations(soup), BASELINE_GAPS)

    def test_one_h2_one_paragraph_pipe_delimited_global_gate_soup_is_rejected(self):
        fragments = (
            "110.1-omni-and-physx-5.9.0 517a0073715120e114ee055b63b26c95e00d9039 "
            "2026-07-14 version.txt 5.9.0.6d94eeb9 ovphysx 0.5.10 pre-1.0 separate wrapper "
            "not native PhysX C++ 5.10",
            "include/vehicle PhysXVehicle no vehicle2 namespace 5.7 PxCookingParams PxCook PxCreate "
            "immediate cooking no retained PxCooking",
            "PxSceneDesc PGS PABP PCM pinned 5.9 header defaults 5.9 particle cloth particle rigid "
            "PxSoftBody PxFEMSoftBody removed no standalone MigrationTo59 changelog authority",
            "standard CPU standard GPU dynamics GPU broadphase independent Direct GPU GPU-only FEM PBD SDF",
            "Direct GPU GPU dynamics GPU broadphase sleeping disabled enhanced determinism CCT vehicle "
            "CPU scene queries CCD trigger contact modification shiftOrigin stale setter forbidden",
            "enhanced determinism no GPU support cross-platform compiler build no guarantee invalid OOM "
            "capacity overflow device loss fail feature-equivalent fallback",
            "simulate(dt > 0) exactly one fetchResults outstanding one writer multiple readers cannot upgrade "
            "thread-safe callback queue pair flags notification eNOTIFY_CONTACT_POINTS trigger persists "
            "unsupported query cache bypass filter",
            "removed actor removed shape invalid do not dereference onAdvance simulation is running active actor "
            "fetchResults allocator error callback outlive foundation scene dispatcher CUDA manager "
            "PxCloseExtensions release Physics reverse",
            "5.6 binary data conversion serializeCollectionToBinaryDeterministic PxBinaryConverter removed "
            "PxCollection non-owning 128-byte backing memory entire lifetime PVD live transport OmniPVD OVD file "
            "diagnostic not persistence",
            "public 5.9 tree snippets smoke reference not conformance no auditable public SDK unit-test "
            "benchmark target checked Windows Linux CUDA sanitizer Nsight Compute Sanitizer PVD OmniPVD "
            "soak performance",
            "PxVehicleDrive4W removed current component API port 4.1 separate process binary boundary "
            "never carry native 5.9",
            "getActiveActors released after fetchResults never dereference immediately before releases "
            "host validity/tombstone checks skip without dereference",
            "PxCreateFoundation PxCreatePhysics PxInitExtensions bool PxSceneDesc::isValid factory only "
            "successfully initialized stages reverse-unwind PxCloseExtensions only when init succeeded "
            "failure injection",
        )
        soup = "## One H2 global gate tokens\n" + " | ".join(fragments)
        word_pattern = r"\b[A-Za-z][A-Za-z0-9_:'-]*\b"
        count = len(re.findall(word_pattern, soup))
        self.assertLessEqual(count, 490)
        soup += " | " + " | ".join(["padding"] * (490 - count))
        self.assertEqual(len(re.findall(word_pattern, soup)), 490)
        self.assertNotIn("\n\n", soup)
        self.assertEqual(len(soup.splitlines()), 2)
        self.assertEqual(response_violations(soup), BASELINE_GAPS)

    def test_bounded_semantic_windows_accept_cohesive_lists_and_tables(self):
        paragraphs = complete_gate_contract().split("\n\n")
        cohesive_list = "## Cohesive checklist\n" + "\n".join(
            f"- {paragraph}" for paragraph in paragraphs
        )
        cohesive_table = "## Cohesive table\n| Contract |\n| --- |\n" + "\n".join(
            f"| {paragraph} |" for paragraph in paragraphs
        )
        self.assertEqual(response_violations(cohesive_list), set())
        self.assertEqual(response_violations(cohesive_table), set())

    def test_entry_reference_and_routes_are_bounded_semantic_contracts(self):
        self.assertTrue(SKILL.is_file(), SKILL)
        self.assertTrue(REFERENCE.is_file(), REFERENCE)
        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertTrue(skill.isascii())
        self.assertLessEqual(len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", skill)), 500)
        self.assertLessEqual(len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", reference)), 2200)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/physx.md", skill)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, skill)

        combined = normalized(skill + "\n" + reference)
        required_groups = (
            ("110.1-omni-and-physx-5.9.0", "517a0073715120e114ee055b63b26c95e00d9039", "5.9.0.6d94eeb9"),
            ("ovphysx 0.5.10", "pre-1.0", "not", "native c++ 5.10"),
            ("pxcreatefoundation", "pxcreatephysics", "pxinitextensions", "pxcloseextensions", "release"),
            ("pxcookingparams", "pxcook", "pxcreate", "no long-lived pxcooking"),
            ("include/vehicle", "physxvehicle", "vehicle2 namespace", "5.7"),
            ("pxscenedesc", "pgs", "pabp", "pcm", "pinned 5.9 header"),
            ("simulate(dt > 0)", "fetchresults", "one writer", "cannot upgrade", "callback"),
            ("pair flags", "enotify_contact_points", "trigger persists", "onadvance", "pxquerycache"),
            ("standard cpu", "standard gpu dynamics", "gpu broadphase", "direct gpu", "gpu-only"),
            ("enhanced determinism", "cross-platform", "oom", "capacity", "device loss"),
            ("pxbinaryconverter", "128-byte", "pxcollection", "pvd", "omnipvd"),
            ("public 5.9 tree", "snippets", "not conformance", "no auditable public sdk unit-test"),
        )
        for group in required_groups:
            with self.subTest(group=group):
                self.assertTrue(all(term in combined for term in group), group)

    def test_reference_retains_direct_gpu_lifetime_and_validation_boundaries(self):
        self.assertTrue(REFERENCE.is_file(), REFERENCE)
        compact = normalized(REFERENCE.read_text(encoding="utf-8"))
        groups = (
            ("allocator callback", "error callback", "outlive foundation", "reverse order"),
            ("scene", "dispatcher", "cuda context manager", "outlive"),
            ("gpu dynamics", "gpu broadphase", "sleeping disabled", "direct gpu"),
            ("cct", "vehicles", "cpu scene queries", "ccd", "triggers", "contact modification", "shiftorigin"),
            ("stale", "setter", "forbidden"),
            ("particle cloth", "particle rigids", "pxsoftbody", "pxfemsoftbody", "removed"),
            ("binary data conversion", "serializecollectiontobinarydeterministic", "pxbinaryconverter", "5.6"),
            ("128-byte", "backing memory", "entire lifetime", "collection", "does not delete"),
            ("pvd", "transport", "omnipvd", "ovd", "diagnostic", "not persistence"),
            ("windows", "linux", "cuda 12.8", "volta", "checked", "sanitizer", "nsight", "soak"),
        )
        for group in groups:
            with self.subTest(group=group):
                self.assertTrue(all(term in compact for term in group), group)

    def test_source_audit_is_pinned_official_and_claim_scoped(self):
        self.assertTrue(AUDIT.is_file(), AUDIT)
        text = AUDIT.read_text(encoding="utf-8")
        compact = normalized(text)
        self.assertIn("read on 2026-08-28", compact)
        self.assertIn("110.1-omni-and-physx-5.9.0", compact)
        self.assertIn("517a0073715120e114ee055b63b26c95e00d9039", compact)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertEqual(set(links), set(PINNED_URLS))
        for link in links:
            with self.subTest(link=link):
                self.assertIn(urlparse(link).hostname, {"github.com", "nvidia-omniverse.github.io"})

        rows = [line for line in text.splitlines() if line.startswith("| [")]
        self.assertEqual(len(rows), len(PINNED_URLS))
        for row in rows:
            with self.subTest(row=row[:80]):
                cells = [cell.strip() for cell in row.strip("|").split("|")]
                self.assertEqual(len(cells), 6)
                self.assertTrue(all(cells))
        for field in ("claim", "authority", "version", "scope", "limitation"):
            self.assertIn(field, compact)
        for boundary in (
            "pinned header wins", "historical tgs", "no standalone migrationto59",
            "pre-1.0 wrapper", "not a stable native c++ 5.10", "snippets", "no auditable public sdk unit-test",
        ):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, compact)

    def test_formal_review_sources_are_pinned_and_claim_scoped(self):
        compact = normalized(AUDIT.read_text(encoding="utf-8"))
        for claim in (
            "old deprecated vehicle api", "pxvehicledrive4w", "current component api",
            "getactiveactors", "released after fetchresults", "avoid dereferencing",
            "pxcreatefoundation", "pxcreatephysics", "pxinitextensions returns bool",
            "pxscenedesc::isvalid", "only successfully initialized stages",
            "pxcloseextensions only if init succeeded", "failure injection",
        ):
            with self.subTest(claim=claim):
                self.assertIn(claim, compact)

    def test_ui_supports_explicit_and_implicit_invocation(self):
        self.assertTrue(UI.is_file(), UI)
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$nvidia-physx-sdk", text)
        self.assertIn("allow_implicit_invocation: true", text)
        self.assertLessEqual(len(text.splitlines()), 8)

    def test_phase_a_artifacts_are_tracked_and_pass_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes", SKILL, REFERENCE, UI, AUDIT,
            ROOT / "tests" / "test_nvidia_physx_sdk_skill.py", SCENARIO, BASELINE,
            ATTEMPT1, ATTEMPT2, ATTEMPT3, ENABLED, EVALUATION,
        )
        relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
        for relative in relative_paths:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(tracked.returncode, 0, tracked.stderr)

        tree_result = subprocess.run(
            ["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(tree_result.returncode, 0, tree_result.stderr)
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task21-phase-a.tar"
            extract = Path(temporary) / "extract"
            archive_result = subprocess.run(
                ["git", "archive", "--format=tar", "--output", str(archive), tree_result.stdout.strip()],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(archive_result.returncode, 0, archive_result.stderr)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((extract / relative).is_file())
            archive_test = (
                "import sys, unittest; "
                "from tests.test_nvidia_physx_sdk_skill import NvidiaPhysxSdkSkillTests as C; "
                "excluded = {'test_phase_a_artifacts_are_tracked_and_pass_from_staged_archive'}; "
                "suite = unittest.TestSuite(test for test in "
                "unittest.defaultTestLoader.loadTestsFromTestCase(C) "
                "if test._testMethodName not in excluded); "
                "result = unittest.TextTestRunner(verbosity=2).run(suite); "
                "sys.exit(not result.wasSuccessful())"
            )
            result = subprocess.run(
                [sys.executable, "-c", archive_test], cwd=extract,
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
