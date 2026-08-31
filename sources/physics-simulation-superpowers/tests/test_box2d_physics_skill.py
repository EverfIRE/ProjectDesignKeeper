"""Box2D v3.1.1 adapter contracts and Phase A behavioral gates."""

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
SKILL = ROOT / "skills" / "box2d-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "box2d-physics" / "references" / "box2d.md"
UI = ROOT / "skills" / "box2d-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "box2d-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "box2d-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "box2d-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "box2d-physics-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "box2d-physics-enabled-response.txt"
ATTEMPT_1_SOURCE = (
    ROOT
    / ".superpowers/sdd/2026-08-26-physics-simulation-superpowers/"
    "task-23-enabled-attempt-1-exact.txt"
)
ATTEMPTS = tuple(
    ROOT / "tests" / "fixtures" / f"box2d-physics-enabled-attempt-{index}-response.txt"
    for index in range(1, 7)
)
ATTEMPT_SOURCES = tuple(
    ROOT
    / ".superpowers/sdd/2026-08-26-physics-simulation-superpowers/"
    f"task-23-enabled-attempt-{index}-exact.txt"
    for index in range(1, 7)
)
ATTEMPT_DIGESTS = (
    (11409, "e348a4b9d45411a688904d8b8b84f150f1a63ea6d3ea111c2d52b34aa7546164"),
    (12120, "a413ca7c9e988e1cec274d5d2072e67f19e96b62f49b97355faf9cb3d356e6d5"),
    (10494, "8c32c00d7c2ebd04289741c0f5a5e610d5b4797b19abe6abc889a23c942cfa33"),
    (10223, "7700d9adf5ec633807fa36ea5a916c4db76c124fa4d5e975eab90b75cbc1aea1"),
    (10178, "1edc81241068607363a77ad3e0bf820c3900c95d03c40b3d238932a225a86bbd"),
    (17570, "b1674ff45427c40ed9a6aa3cc9e9f0e91c50e732bfe4e824a6db5cfc39b1a5cd"),
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
    "https://github.com/erincatto/box2d/releases/tag/v3.1.1",
    "https://github.com/erincatto/box2d/commit/8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3",
    "https://github.com/erincatto/box2d/blob/v3.1.1/include/box2d/box2d.h",
    "https://github.com/erincatto/box2d/blob/v3.1.1/include/box2d/types.h",
    "https://github.com/erincatto/box2d/blob/v3.1.1/include/box2d/id.h",
    "https://github.com/erincatto/box2d/blob/v3.1.1/include/box2d/collision.h",
    "https://github.com/erincatto/box2d/blob/v3.1.1/src/distance.c",
    "https://github.com/erincatto/box2d/blob/v3.1.1/src/world.c",
    "https://github.com/erincatto/box2d/blob/v3.1.1/docs/simulation.md",
    "https://github.com/erincatto/box2d/blob/v3.1.1/test/test_determinism.c",
    "https://github.com/erincatto/box2d/blob/v3.1.1/samples/sample_character.cpp",
    "https://box2d.org/posts/2024/08/determinism/",
    "https://github.com/erincatto/box2d/commit/617d32ab02570930625bbcb8479f54be9bf8d045",
    "https://github.com/erincatto/box2d/blob/617d32ab02570930625bbcb8479f54be9bf8d045/CMakeLists.txt",
    "https://github.com/erincatto/box2d/blob/617d32ab02570930625bbcb8479f54be9bf8d045/include/box2d/box2d.h",
)

FIXTURE_DIGESTS = {
    SCENARIO: (
        2670,
        "73e7c6371ae610ed14fdf736ee632284a508c646190c24dc943c9b592a4604f2",
    ),
    BASELINE: (
        16136,
        "2d5023ad4930844f2b6e3fb7e17a32583ab611f99e708f46a77b3c4c893a138f",
    ),
}

ALL_GAPS = {
    "source-snapshot-drift",
    "id-ownership-mutation",
    "fixed-step-task-phase",
    "event-sensor-lifetime",
    "query-tree-semantics",
    "one-way-presolve",
    "experimental-character-mover",
    "ccd-boundary",
    "determinism-not-rollback",
}


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
    r"(?:not(?!\s+(?:only|merely)\b)|never|unsupported|unsafe|unavailable|"
    r"invalid|arbitrary|experimental|outside\s+stable)|"
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
            prefix = clause[max(0, match.start() - 100):match.start()]
            claim = clause[match.start():match.end()]
            suffix = clause[match.end():match.end() + 80]
            if (
                not DIRECT_DENIAL.search(prefix)
                and not DIRECT_DENIAL.search(claim)
                and not POSTFIX_DENIAL.search(suffix)
            ):
                return True
    return False


SEMANTIC_WINDOW_WORDS = 320
SEMANTIC_WINDOW_UNITS = 5
SEMANTIC_WORD = re.compile(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b")
STRUCTURED_LINE = re.compile(r"^(?:[-+*]\s+|\d+[.)]\s+|\|.*\|\s*$)")


def semantic_word_count(text: str) -> int:
    return len(SEMANTIC_WORD.findall(text))


def bounded_semantic_units(paragraph: str) -> list[str]:
    lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
    if lines and re.match(r"^#{2,6}\s+", lines[0]):
        lines = lines[1:]
    if len(lines) >= 2 and all(STRUCTURED_LINE.match(line) for line in lines):
        return lines
    if semantic_word_count(paragraph) > SEMANTIC_WINDOW_WORDS:
        return []
    clauses = semantic_clauses(paragraph)
    return clauses or [paragraph]


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
            r"^#{2,6}\s+.*(?:glossary|token|index|关键词|术语)",
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
    "source-snapshot-drift": (
        (
            ("box2d v3.1.1", "box2d 3.1.1"),
            ("2025-06-04", "2025-06-4", "june 4, 2025"),
            ("8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3",),
        ),
        (
            ("doxygen 3.1.0", "website documentation remains 3.1.0"),
            ("no documentation update", "no documentation updates"),
            ("tagged public headers", "v3.1.1 public headers"),
            ("final api authority", "symbol authority"),
        ),
        (
            ("617d32ab02570930625bbcb8479f54be9bf8d045",),
            ("3.2.0",),
            ("experimental",),
            ("snapshot",),
            ("recording",),
            ("state hash", "state-hash"),
            ("not stable 3.1.1", "outside stable 3.1.1", "must not leak into 3.1.1"),
        ),
    ),
    "id-ownership-mutation": (
        (
            ("b2defaultworlddef",),
            ("b2defaultbodydef",),
            ("b2defaultshapedef",),
            ("b2defaultchaindef",),
            ("opaque",),
            ("generational", "generation"),
            ("64k allocations", "64k allocation"),
        ),
        (
            ("world destroys", "destroying a world"),
            ("body destroys", "destroying a body"),
            ("shapes and joints", "shape and joint"),
            ("chain",),
            ("segment ids", "segment shape ids"),
            ("application ids", "game ids", "stable game handles"),
        ),
        (
            ("b2destroyshape",),
            ("updatebodymass", "update body mass"),
            ("b2body_applymassfromshapes",),
            ("sensor shapes may have mass", "sensors may have mass"),
            ("cannot start or stop being a sensor", "cannot toggle sensor"),
            ("no 2.4", "not 2.4"),
            ("fixtures",),
            ("pointers", "contact listeners"),
        ),
    ),
    "fixed-step-task-phase": (
        (
            ("fixed dt", "fixed time step", "fixed timestep"),
            ("measured",),
            ("substeps", "substep count"),
            ("freeze", "frozen"),
            (
                "events per main step",
                "events after each main step",
                "events consumed after each main step",
            ),
        ),
        (
            ("workercount", "worker count"),
            ("enqueuetask", "enqueue task"),
            ("finishtask", "finish task"),
            ("b2world_step",),
            ("locked", "locks the world"),
            ("thread-safe", "thread safe"),
            ("no world mutation", "must not modify the world"),
        ),
        (
            ("no world reads", "must not read the world"),
            ("during step", "during the step", "inside the step"),
            ("outside-step", "outside the step"),
            ("read-only queries", "read only queries"),
        ),
    ),
    "event-sensor-lifetime": (
        (
            ("body move events",),
            ("no opt-in flag", "not opt-in"),
            ("available after every step", "available after each step"),
            ("sleeping disabled", "sleep disabled"),
            ("dynamic and kinematic",),
        ),
        (
            ("sensor",),
            ("contact",),
            ("hit",),
            ("presolve", "pre-solve"),
            ("shape flags", "shape event flags"),
            ("default false", "false by default", "default off"),
            ("drain", "process"),
            ("after every step", "after each step", "per main step"),
            ("borrowed event arrays", "borrowed buffers", "transient arrays"),
        ),
        (
            ("end events", "end touch events"),
            ("destroyed", "invalid"),
            ("b2shape_isvalid",),
            ("invalid-access guard", "invalid access guard"),
            ("before api dereference", "before dereference"),
            ("never as identity", "not identity"),
            ("application ids", "game ids", "stable game handles"),
            ("tombstone", "tombstones"),
            ("copy", "translate"),
        ),
        (
            ("sensors can detect other sensors", "sensor-sensor"),
            ("no semantic order", "not gameplay semantic order", "canonicalize"),
            ("persistent overlap", "gameplay overlap set"),
        ),
    ),
    "query-tree-semantics": (
        (
            ("overlapaabb", "aabb overlap"),
            ("broadphase candidate", "broad-phase candidate", "bounding box candidate"),
            ("approximate", "not exact"),
            ("overlapshape", "shape overlap"),
            ("exact", "narrowphase", "narrow-phase"),
        ),
        (
            ("arbitrary order", "any order"),
            ("ray cast", "ray-cast"),
            ("shape cast", "shape-cast"),
            ("multiple hits", "multi-hit", "multi hit"),
            ("sort",),
            ("fraction",),
        ),
        (
            ("b2world_castshape",),
            ("initial overlap",),
            ("zero fraction", "fraction zero"),
            ("zero normal", "normal zero"),
            ("arbitrary point",),
        ),
        (
            ("b2world_castrayclosest",),
            ("ignores initial overlap", "ignore initial overlap"),
            ("ray casts starting inside", "ray cast starting inside"),
            ("miss", "ignored"),
            ("b2world_castmover",),
            ("b2world_collidemover",),
            ("depenetration planes", "collision planes"),
        ),
        (
            ("no persistence", "do not persist", "consume immediately"),
        ),
    ),
    "one-way-presolve": (
        (
            ("enablepresolveevents",),
            ("b2presolvefcn", "pre-solve callback"),
            ("before",),
            ("solver", "collision resolution"),
            ("disable every step", "re-disable every step", "disable each time-step"),
        ),
        (
            ("parallel-for", "worker thread"),
            ("thread-safe", "thread safe"),
            ("must not read", "must not read or write", "no world access"),
            ("must not write", "must not read or write", "no world mutation"),
            ("after step", "after the step", "post-step"),
            ("too late", "cannot disable"),
        ),
        (
            ("high speed", "high-speed"),
            ("does not work", "limitation", "may pause"),
            ("platformer sample", "platformer test"),
            ("v3.1.1", "stable 3.1"),
        ),
    ),
    "experimental-character-mover": (
        (
            ("experimental",),
            ("geometric capsule", "capsule geometry"),
            ("outside the world", "not a body", "outside world ownership"),
            ("b2world_collidemover",),
            ("b2world_castmover",),
        ),
        (
            ("collision planes", "planes"),
            ("b2solveplanes",),
            ("b2clipvector",),
            ("translation",),
            ("velocity",),
        ),
        (
            ("not a complete controller", "not a full controller"),
            ("steps", "step policy"),
            ("state",),
            ("pushing", "push policy"),
            ("rotation",),
            ("application", "gameplay"),
        ),
    ),
    "ccd-boundary": (
        (
            ("default ccd", "continuous collision by default"),
            ("dynamic",),
            ("static",),
        ),
        (
            ("bullet",),
            ("static",),
            ("kinematic",),
            ("dynamic",),
            ("not bullet-bullet", "not other bullets", "no bullet-bullet"),
            ("sparingly", "sparse"),
            ("joint",),
        ),
        (
            ("sensors",),
            ("no ccd", "do not have continuous collision"),
            ("continuous collision", "ccd"),
            ("events",),
            ("next step", "following step"),
        ),
    ),
    "determinism-not-rollback": (
        (
            ("64-bit", "64 bit"),
            ("creation order",),
            ("events",),
            ("msvc",),
            ("precise",),
            ("clang",),
            ("gcc",),
            ("floating point contraction", "fp contraction", "-ffp-contract=off"),
            ("x64",),
            ("arm",),
        ),
        (
            ("1/60", "1.0f / 60.0f"),
            ("4 substeps", "substep count 4"),
            ("workers 1 through 5", "worker counts 1-5", "workercount 1 to 5"),
            ("288",),
            ("0x35467e1e",),
            ("application",),
            ("not proof", "must still be deterministic"),
        ),
        (
            ("no snapshot", "does not provide snapshots", "no public snapshot"),
            ("no rollback", "does not provide rollback", "not rollback"),
            ("stable 3.1.1", "v3.1.1"),
            ("transforms insufficient", "transforms are insufficient"),
            ("no cross-version", "not cross-version"),
            ("exact build", "pinned build"),
        ),
    ),
}


UNSAFE_CLAIMS = {
    "source-snapshot-drift": (
        r"(?:use|ship|call|depend on).{0,80}(?:b2World_Snapshot|b2World_GetStateHash|b2World_StartRecording).{0,80}(?:stable|v?3\.1\.1)",
        r"(?:website|doxygen).{0,50}3\.1\.0.{0,50}(?:final|authoritative).{0,30}(?:3\.1\.1|api)",
        r"v?3\.1\.1.{0,70}(?:includes|provides|ships).{0,50}(?:snapshot|recording|state hash)",
        r"(?:稳定版|稳定).{0,25}3\.1\.1.{0,45}(?:提供|包含|已经有).{0,30}(?:snapshot|recording|state hash)",
    ),
    "id-ownership-mutation": (
        r"(?:raw|box2d).{0,25}(?:body|shape|joint|chain)?\s*ids?.{0,40}(?:durable|persistent|keep forever|indefinitely)",
        r"(?:use|keep|restore).{0,50}(?:b2Body\*|fixture|contact listener).{0,40}(?:3\.1|3\.x|c api)",
        r"(?:toggle|change|convert).{0,35}(?:sensor|isSensor).{0,35}(?:at runtime|after creation)",
        r"3\.x.{0,35}(?:fixture|contact listener).{0,30}(?:继续|使用|保留)",
        r"3\.x.{0,35}(?:继续|使用|保留).{0,30}(?:fixture|contact listener)",
    ),
    "fixed-step-task-phase": (
        r"b2World_Step.{0,50}(?:render delta|frame delta|variable dt)",
        r"(?:hardware concurrency|hardware_concurrency).{0,50}(?:worker|workercount)",
        r"(?:read|query|mutate|modify).{0,40}(?:box2d )?world.{0,50}(?:inside|during).{0,30}(?:step|callback)",
        r"(?:presolve|回调).{0,30}(?:读取|修改|查询).{0,25}(?:box2d )?world",
    ),
    "event-sensor-lifetime": (
        r"(?:retain|store|queue|persist).{0,50}(?:event array|event buffer|event pointer|event element).{0,40}(?:later|next frame|future)",
        r"(?:end|end touch).{0,30}(?:event|ids?).{0,40}(?:always valid|remain valid|guaranteed valid)",
        r"body move events?.{0,55}(?:disabled by default|default off|require.{0,15}opt[- ]?in)",
        r"b2Shape_IsValid.{0,60}(?:only|merely).{0,20}(?:assertion|debug)",
        r"(?:callback|event).{0,30}order.{0,45}(?:gameplay priority|semantic order|landing priority)",
        r"end touch.{0,35}(?:shape )?id.{0,30}(?:永远有效|始终有效|保证有效)",
    ),
    "query-tree-semantics": (
        r"(?:aabb|broadphase|broad-phase).{0,50}(?:exact overlap|exact collision|narrowphase exact)",
        r"(?:ray|shape).{0,15}casts?.{0,45}(?:sorted|nearest first|deterministic order)",
        r"(?:initial overlap|starts? inside).{0,50}(?:ordinary surface normal|valid surface normal|positive fraction)",
        r"(?:all|every).{0,25}(?:box2d )?world casts?.{0,45}(?:initial overlap|start overlap).{0,35}(?:zero fraction|fraction zero)",
        r"b2World_CastMover.{0,55}(?:returns?|reports?).{0,40}(?:penetration|overlap) hit",
        r"射线.{0,35}(?:内部|里面).{0,45}(?:普通表面法线|正 fraction|有效法线)",
    ),
    "one-way-presolve": (
        r"(?:disable|turn off).{0,40}(?:contact|collision).{0,40}(?:after|following).{0,25}(?:step|b2World_Step)",
        r"(?:pre[- ]?solve|b2PreSolveFcn).{0,55}(?:read|query|modify|mutate).{0,30}(?:world|body|shape)",
        r"(?:enablePreSolveEvents|pre[- ]?solve flag).{0,45}(?:unnecessary|not required|optional per shape)",
        r"presolve.{0,35}(?:查询|读取|修改).{0,25}world",
        r"(?:无需|不需要).{0,25}enablePreSolveEvents",
    ),
    "experimental-character-mover": (
        r"(?:mover helpers|b2World_CollideMover|b2SolvePlanes).{0,60}(?:complete|full).{0,25}(?:character controller|movement controller)",
        r"(?:mover|geometric capsule).{0,50}(?:automatically|built-in).{0,50}(?:steps|pushing|rotation|replication)",
        r"(?:mover capsule|character mover).{0,40}(?:is|creates).{0,30}(?:dynamic body|box2d body)",
        r"character mover.{0,35}(?:创建|生成).{0,25}dynamic body",
        r"character mover.{0,35}自动处理.{0,30}(?:旋转|复制|台阶|推动)",
    ),
    "ccd-boundary": (
        r"(?:enable|set).{0,30}(?:bullet|isBullet).{0,40}(?:every|all).{0,30}(?:moving|dynamic) bod",
        r"bullet.{0,35}(?:bullet|other bullets).{0,40}(?:ccd|continuous).{0,30}(?:supported|guaranteed|works)",
        r"sensor.{0,35}(?:ccd|continuous collision).{0,30}(?:supported|enabled|works)",
        r"continuous collision.{0,50}events?.{0,40}(?:same step|immediately)",
        r"传感器.{0,25}(?:支持|启用).{0,15}ccd",
        r"连续碰撞事件.{0,35}(?:同一步|立即).{0,20}(?:到达|生成)",
    ),
    "determinism-not-rollback": (
        r"(?:same seed|seed alone).{0,70}(?:cross-platform|cross[- ]version|all worker|future)",
        r"(?:final|player).{0,25}transforms?.{0,45}(?:sufficient|prove|enough).{0,25}(?:determin|rollback)",
        r"(?:v?3\.1\.1|stable 3\.1).{0,50}(?:snapshot|rollback).{0,35}(?:api|support|available|provided)",
        r"(?:box2d|upstream).{0,40}determinism.{0,45}(?:proves|guarantees).{0,30}(?:application|game)",
        r"(?:最终|只比较).{0,35}(?:玩家 )?transform.{0,35}(?:足以|能够).{0,30}(?:回滚|确定性)",
    ),
}


def unstructured_one_section(text: str) -> bool:
    paragraphs = [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if len(paragraphs) > 1:
        return False
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return not (len(lines) >= 2 and all(STRUCTURED_LINE.match(line) for line in lines))


def response_violations(text: str) -> set[str]:
    missing = {
        label
        for label, clusters in REQUIRED_CLUSTERS.items()
        if not all(local_groups(text, cluster) for cluster in clusters)
    }
    matched = ALL_GAPS - missing
    if len(matched) >= 5 and unstructured_one_section(text):
        missing = set(ALL_GAPS)
    for label, patterns in UNSAFE_CLAIMS.items():
        if any(contains_affirmative_claim(text, pattern) for pattern in patterns):
            missing.add(label)
    return missing


def complete_gate_contract() -> str:
    return """## Source snapshot and drift
Box2D v3.1.1 was released on 2025-06-04 at commit 8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3. The release says there was no documentation update: website Doxygen 3.1.0 remains stale, so the v3.1.1 tagged public headers are the final API authority. Current main commit 617d32ab02570930625bbcb8479f54be9bf8d045 labels 3.2.0 and contains experimental snapshot, recording, and state-hash APIs; these are outside stable 3.1.1 and must not leak into 3.1.1 code.

## IDs, ownership, and mutation
Initialize definitions with b2DefaultWorldDef, b2DefaultBodyDef, b2DefaultShapeDef, and b2DefaultChainDef. Opaque C IDs are generational and validity checks cover up to 64K allocations, so durable application IDs own identity. Destroying a world destroys its objects; destroying a body destroys attached shapes and joints; a chain owns segment shape IDs, which are invalidated with the chain. b2DestroyShape's updateBodyMass choice and b2Body_ApplyMassFromShapes define mass recompute; sensor shapes may have mass and a shape cannot start or stop being a sensor. Use no 2.4 fixtures, pointers, or contact listeners.

## Fixed step and task phase
Use fixed dt; select substeps from measured stability and cost, then freeze the substep count, with events consumed after each main step. workerCount requires enqueueTask and finishTask. b2World_Step locks the world; callbacks and worker tasks are thread-safe and perform no world mutation. Adapter policy permits no world reads during the step either, and confines read-only queries to an outside-step phase.

## Events and sensors
Body move events have no opt-in flag and are available after every step; with sleeping disabled, every dynamic and kinematic body produces move events. Sensor, contact, hit, and PreSolve shape flags default false; drain all borrowed event arrays after every step. End touch events can contain destroyed IDs, so use b2Shape_IsValid as an invalid-access guard before API dereference, never as identity, translate/copy to stable application IDs, tombstone destroyed identities, and never queue raw elements. Sensors can detect other sensors; engine event order is not gameplay semantic order, so canonicalize a persistent gameplay overlap set.

## Queries and tree semantics
OverlapAABB is an approximate broadphase bounding-box candidate query; use OverlapShape or another narrow-phase exact test. Ray-cast and shape-cast callbacks arrive in arbitrary order, so collect multiple hits and sort by fraction plus durable identity. In v3.1.1, b2World_CastShape reports an initial overlap with zero fraction, zero normal, and an arbitrary point. b2World_CastRayClosest ignores initial overlap, and ray casts starting inside treat the shape as a miss. b2World_CastMover also ignores initial overlap; use b2World_CollideMover for depenetration planes. Consume callback results immediately with no persistence.

## One-way PreSolve
Set enablePreSolveEvents and use b2PreSolveFcn before collision resolution. Contacts re-enable, so re-disable every step. The callback runs in a parallel-for/worker thread, must be thread-safe, must not read or write the world, and disabling after the step is too late. Stable v3.1.1 documents a high-speed limitation that may pause; keep the Platformer sample as a test seed and add project cases.

## Experimental character mover
The stable 3.1.1 experimental mover is a geometric capsule outside world ownership, not a body. Call b2World_CollideMover and b2World_CastMover, assemble collision planes, run b2SolvePlanes for translation, then b2ClipVector for velocity. It is not a complete controller: gameplay owns steps, slopes, persistent state, pushing, rotation, support, and replication policy.

## CCD boundary
Default CCD covers dynamic bodies versus static bodies. Bullet mode extends a sparse tested body to static, kinematic, and dynamic targets but not other bullets; use it sparingly because it may interfere with joints. Sensors have no CCD. Continuous-collision contact events can appear on the next step, so gameplay must not require same-step delivery.

## Determinism is not rollback
The official cross-platform claim is for 64-bit targets and creation-order-derived simulation/events: precise FP on MSVC, floating-point contraction disabled on Clang/GCC, tested on x64 and ARM. The pinned determinism test uses 1/60, 4 substeps, worker counts 1-5, expected sleep step 288, and hash 0x35467e1e; application determinism is still required, so this is not proof. Stable v3.1.1 has no public snapshot and no rollback support; transforms are insufficient, there is no cross-version guarantee, and only the pinned exact build plus complete replay can be qualified."""


class Box2DPhysicsSkillTests(unittest.TestCase):
    def test_phase_a_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI, AUDIT, SCENARIO, BASELINE):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_frozen_inputs_have_exact_bytes_hashes_and_line_endings(self):
        for path, (expected_size, expected_sha) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.name):
                raw = path.read_bytes()
                self.assertEqual(len(raw), expected_size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), expected_sha)
                self.assertTrue(raw.endswith(b"\n"))
                self.assertNotIn(b"\r", raw)
    def test_blind_baseline_truthfully_misses_all_nine_box2d_specific_gates(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        self.assertEqual(response_violations(baseline), ALL_GAPS)
        compact = normalized(baseline)
        for already_correct in (
            "fixed dt",
            "stable game handle",
            "drain body/contact/sensor event arrays",
            "same pinned box2d binary",
            "transform-only checkpoint is not sufficient",
        ):
            self.assertIn(already_correct, compact)

    def test_canonical_contract_passes_all_gates(self):
        self.assertEqual(response_violations(complete_gate_contract()), set())

    def test_attempt1_freezes_the_scattered_locality_failure(self):
        if not ATTEMPT_1_SOURCE.is_file():
            self.skipTest("ignored evaluator source is intentionally absent from archives")
        raw = ATTEMPT_1_SOURCE.read_bytes()
        self.assertEqual(len(raw), 11409)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "e348a4b9d45411a688904d8b8b84f150f1a63ea6d3ea111c2d52b34aa7546164",
        )
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            ALL_GAPS - {"ccd-boundary"},
        )

    def test_entry_requires_one_cohesive_item_per_applicable_source_seam(self):
        skill = SKILL.read_text(encoding="utf-8")
        self.assertTrue(
            local_groups(
                skill,
                (
                    ("each applicable seam", "every applicable seam"),
                    ("one compact paragraph", "one compact checklist item"),
                    ("preconditions",),
                    ("limitation", "unavailable guarantee"),
                    ("evidence gate",),
                    ("do not scatter", "never scatter"),
                ),
            )
        )

    def test_entry_caps_each_seam_and_preserves_explicit_source_referents(self):
        skill = SKILL.read_text(encoding="utf-8")
        self.assertTrue(
            local_groups(
                skill,
                (
                    ("at most five sentences",),
                    ("semicolon-separated semantic clauses",),
                    ("exact public symbol",),
                    ("full commit",),
                    ("negative guarantees",),
                    ("official test and sample seeds",),
                    ("do not compress coordinated nouns",),
                    ("explicit referent",),
                ),
            )
        )

    def test_entry_requires_one_canonical_sentence_per_scenario_seam(self):
        skill = normalized(SKILL.read_text(encoding="utf-8"))
        for contract in (
            "before optional detail",
            "exactly one canonical sentence or checklist item",
            "commas and parentheses, not semicolons",
            "but, however, yet, or then",
            "when all nine seams apply to a scenario, emit all nine",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, skill)

    def test_reference_exposes_a_verbatim_canonical_response_block(self):
        skill = normalized(SKILL.read_text(encoding="utf-8"))
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertIn("copy every applicable paragraph", skill)
        self.assertIn("verbatim", skill)
        self.assertIn("do not paraphrase or split", skill)
        marker = "## Canonical response seams"
        self.assertIn(marker, reference)
        canonical = reference.split(marker, 1)[1]
        self.assertEqual(response_violations(canonical), set())

    def test_each_gate_is_independently_deletion_protected_and_section_local(self):
        complete = complete_gate_contract()
        deletions = {
            "source-snapshot-drift": "8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3",
            "id-ownership-mutation": "b2DefaultChainDef",
            "fixed-step-task-phase": "finishTask",
            "event-sensor-lifetime": "invalid-access guard",
            "query-tree-semantics": "b2World_CastMover",
            "one-way-presolve": "enablePreSolveEvents",
            "experimental-character-mover": "b2ClipVector",
            "ccd-boundary": "not other bullets",
            "determinism-not-rollback": "0x35467e1e",
        }
        for label, token in deletions.items():
            with self.subTest(label=label):
                removed = complete.replace(token, "", 1)
                self.assertEqual(response_violations(removed), {label})
                isolated = removed + f"\n\n## Isolated glossary\n{token}"
                self.assertEqual(response_violations(isolated), {label})

    def test_scattered_compact_overlong_and_one_section_soup_fail(self):
        primary_tokens = tuple(
            group[0]
            for clusters in REQUIRED_CLUSTERS.values()
            for cluster in clusters
            for group in cluster
        )
        scattered = "\n\n".join(
            f"## Token {index}\n{token}"
            for index, token in enumerate(primary_tokens)
        )
        self.assertEqual(response_violations(scattered), ALL_GAPS)

        compact = " ".join(primary_tokens)
        self.assertLess(semantic_word_count(compact), 500)
        self.assertEqual(response_violations(compact), ALL_GAPS)

        overlong = re.sub(r"\s+", " ", complete_gate_contract())
        overlong += " " + " ".join(["padding"] * 400)
        self.assertEqual(response_violations(overlong), ALL_GAPS)

        one_section = re.sub(r"^##.*$", "", complete_gate_contract(), flags=re.MULTILINE)
        one_section = re.sub(r"\s+", " ", one_section).strip()
        self.assertEqual(response_violations(one_section), ALL_GAPS)

    def test_realistic_unsafe_english_and_chinese_paraphrases_are_rejected(self):
        complete = complete_gate_contract()
        probes = {
            "source-snapshot-drift": (
                "Use b2World_Snapshot from main as a stable v3.1.1 rollback API.",
                "稳定版3.1.1已经提供 snapshot、recording 和 state hash，可以直接调用。",
            ),
            "id-ownership-mutation": (
                "Raw Box2D body IDs are durable, so keep them indefinitely.",
                "3.x C API 继续使用 fixture 指针和 contact listener 就行。",
            ),
            "fixed-step-task-phase": (
                "Call b2World_Step with the frame delta and hardware_concurrency workers.",
                "在 PreSolve 回调里读取并修改 Box2D world 是安全的。",
            ),
            "event-sensor-lifetime": (
                "Persist the event array elements for processing next frame.",
                "end touch 事件里的 shape ID 永远有效，可以稍后使用。",
                "Body move events are disabled by default and require opt-in.",
                "b2Shape_IsValid is only an assertion aid, so use invalid end IDs.",
            ),
            "query-tree-semantics": (
                "AABB overlap is an exact collision test and ray hits are nearest first.",
                "射线起点在形状内部时会返回普通表面法线和正 fraction。",
                "All Box2D world casts report start overlap as fraction zero.",
                "b2World_CastMover returns a penetration hit when starting overlapped.",
            ),
            "one-way-presolve": (
                "Disable the unwanted contact after b2World_Step.",
                "PreSolve 可以查询 world，且无需 enablePreSolveEvents。",
            ),
            "experimental-character-mover": (
                "The mover helpers are a complete character controller with built-in steps and pushing.",
                "character mover 会创建 dynamic body 并自动处理旋转和复制。",
            ),
            "ccd-boundary": (
                "Enable isBullet on every moving body; bullet-bullet CCD is guaranteed.",
                "传感器支持 CCD，而且连续碰撞事件会在同一步立即到达。",
            ),
            "determinism-not-rollback": (
                "The same seed proves deterministic rollback across future Box2D versions.",
                "只比较最终玩家 transform 就足以证明跨平台回滚确定性。",
            ),
        }
        for label, cases in probes.items():
            for probe in cases:
                with self.subTest(label=label, probe=probe):
                    self.assertIn(label, response_violations(complete + "\n\n" + probe))

    def test_explicit_denials_are_safe_but_late_contradictions_are_not(self):
        complete = complete_gate_contract()
        safe = {
            "source-snapshot-drift": "Do not use main snapshot APIs in stable v3.1.1.",
            "id-ownership-mutation": "Raw Box2D IDs are not durable gameplay identities.",
            "fixed-step-task-phase": "Do not read or mutate the world during Step callbacks.",
            "event-sensor-lifetime": "Do not retain event arrays for the next frame.",
            "query-tree-semantics": "AABB overlap is not an exact collision result.",
            "one-way-presolve": "Do not disable contacts after b2World_Step.",
            "experimental-character-mover": "Mover helpers are not a full character controller.",
            "ccd-boundary": "Sensors do not support CCD and bullets do not hit other bullets continuously.",
            "determinism-not-rollback": "Stable v3.1.1 does not provide rollback snapshots.",
        }
        for label, denial in safe.items():
            with self.subTest(label=label):
                self.assertNotIn(label, response_violations(complete + "\n\n" + denial))

        contradictions = {
            "source-snapshot-drift": "Do not use main snapshots in 3.1.1, but call b2World_Snapshot as a stable v3.1.1 API.",
            "id-ownership-mutation": "Raw IDs are not durable; however raw body IDs are durable and may be kept forever.",
            "fixed-step-task-phase": "Never query during Step, yet read the world inside the callback.",
            "event-sensor-lifetime": "Do not retain event arrays, but queue each event pointer for next frame.",
            "query-tree-semantics": "AABB is approximate, but AABB overlap is an exact collision test.",
            "one-way-presolve": "Do not change contacts post-step; then disable collision after b2World_Step.",
            "experimental-character-mover": "The mover is incomplete, but mover helpers are a complete character controller.",
            "ccd-boundary": "Bullets miss other bullets, but bullet-bullet CCD is guaranteed.",
            "determinism-not-rollback": "The seed is insufficient, but the same seed guarantees cross-version rollback.",
        }
        for label, probe in contradictions.items():
            with self.subTest(label=label):
                self.assertIn(label, response_violations(complete + "\n\n" + probe))

    def test_cohesive_markdown_lists_and_tables_remain_semantic(self):
        paragraphs = complete_gate_contract().split("\n\n")
        cohesive_list = "\n".join(f"- {paragraph.replace(chr(10), ' ')}" for paragraph in paragraphs)
        cohesive_table = "| Contract |\n| --- |\n" + "\n".join(
            f"| {paragraph.replace(chr(10), ' ')} |" for paragraph in paragraphs
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
        self.assertIn("references/box2d.md", skill)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, skill)
        self.assertEqual(response_violations(reference), set())
        compact = normalized(reference)
        for label in (
            "official guarantee",
            "adapter policy",
            "inference",
            "unavailable guarantee",
        ):
            self.assertIn(label, compact)

    def test_source_audit_is_official_pinned_claim_scoped_and_drift_aware(self):
        text = AUDIT.read_text(encoding="utf-8")
        compact = normalized(text)
        self.assertIn("read on 2026-08-30", compact)
        self.assertIn("8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3", compact)
        self.assertIn("617d32ab02570930625bbcb8479f54be9bf8d045", compact)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertEqual(set(links), set(PINNED_URLS))
        for link in links:
            self.assertIn(urlparse(link).hostname, {"github.com", "box2d.org"})
        rows = [line for line in text.splitlines() if line.startswith("| [")]
        self.assertEqual(len(rows), len(PINNED_URLS))
        for row in rows:
            cells = [cell.strip() for cell in row.strip("|").split("|")]
            self.assertEqual(len(cells), 5)
            self.assertTrue(all(cells))
        for boundary in (
            "official source",
            "authority",
            "version",
            "claim",
            "scope",
            "limitation",
            "doxygen 3.1.0",
            "tagged public headers",
            "3.2.0 experimental",
            "no public snapshot",
            "no rollback",
            "official fact",
            "adapter policy",
            "inference",
        ):
            self.assertIn(boundary, compact)

    def test_ui_supports_explicit_and_implicit_invocation(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$box2d-physics", text)
        self.assertIn("allow_implicit_invocation: true", text)
        self.assertLessEqual(len(text.splitlines()), 8)

    def test_phase_b_enabled_response_and_evaluation_are_present(self):
        self.assertTrue(ENABLED.is_file(), "Phase B isolated enabled response is deferred")
        self.assertTrue(EVALUATION.is_file(), "Phase B evaluation promotion is deferred")
        self.assertEqual(response_violations(ENABLED.read_text(encoding="utf-8")), set())

    def test_attempt_6_promotion_preserves_exact_history_and_provenance(self):
        expected_violations = (
            sorted(ALL_GAPS - {"ccd-boundary"}),
            sorted(ALL_GAPS),
            sorted(ALL_GAPS),
            sorted(ALL_GAPS),
            sorted({"event-sensor-lifetime", "query-tree-semantics"}),
            [],
        )
        for index, (fixture, source, digest, violations) in enumerate(
            zip(ATTEMPTS, ATTEMPT_SOURCES, ATTEMPT_DIGESTS, expected_violations),
            start=1,
        ):
            with self.subTest(attempt=index):
                self.assertTrue(fixture.is_file())
                raw = fixture.read_bytes()
                self.assertEqual(len(raw), digest[0])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest[1])
                if source.is_file():
                    self.assertEqual(raw, source.read_bytes())
                self.assertTrue(raw.endswith(b"\n"))
                self.assertNotIn(b"\r", raw)
                self.assertEqual(
                    sorted(response_violations(raw.decode("utf-8"))),
                    violations,
                )

        self.assertEqual(ENABLED.read_bytes(), ATTEMPTS[-1].read_bytes())
        record = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(record["skill"], "box2d-physics")
        self.assertEqual(record["scenario"], SCENARIO.read_text(encoding="utf-8"))
        self.assertEqual(record["baseline"]["response"], BASELINE.read_text(encoding="utf-8"))
        self.assertEqual(record["enabled"]["response"], ENABLED.read_text(encoding="utf-8"))
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(record["baseline"]["violations"], sorted(ALL_GAPS))
        self.assertEqual(record["enabled"]["violations"], [])
        self.assertEqual(record["gate_evidence"]["attempt"], 6)
        self.assertEqual(record["gate_evidence"]["enabled_violations"], [])
        self.assertEqual(
            [entry["attempt"] for entry in record["attempt_history"]],
            [1, 2, 3, 4, 5, 6],
        )
        for entry, digest, violations in zip(
            record["attempt_history"], ATTEMPT_DIGESTS, expected_violations
        ):
            self.assertEqual(entry["sha256"], digest[1])
            self.assertEqual(entry["violations"], violations)
        provenance = record["attempt_6_isolation_provenance"]
        self.assertTrue(provenance["fresh_isolated_evaluator"])
        self.assertEqual(provenance["source_bytes"], ATTEMPT_DIGESTS[-1][0])
        self.assertEqual(provenance["source_sha256"], ATTEMPT_DIGESTS[-1][1])
        self.assertTrue(provenance["copied_byte_for_byte"])
        self.assertEqual(
            provenance["allowed_inputs"],
            ["scenario", "SKILL.md", "references/box2d.md", "agents/openai.yaml"],
        )

    def test_task_23_phase_a_artifacts_are_tracked_and_pass_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            AUDIT,
            ROOT / "tests" / "test_box2d_physics_skill.py",
            SCENARIO,
            BASELINE,
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
            archive = Path(temporary) / "task23-phase-a.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(
                ["git", "archive", "--format=tar", "--output", str(archive), tree],
                cwd=ROOT,
                check=True,
            )
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                self.assertTrue((extract / relative).is_file(), relative)
            archive_test = (
                "import sys, unittest; "
                "from tests.test_box2d_physics_skill import Box2DPhysicsSkillTests as C; "
                "excluded = {"
                "'test_phase_b_enabled_response_and_evaluation_are_present', "
                "'test_task_23_phase_a_artifacts_are_tracked_and_pass_from_staged_archive'}; "
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
