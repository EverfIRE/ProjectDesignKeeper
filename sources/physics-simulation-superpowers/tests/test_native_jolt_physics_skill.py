"""Native Jolt v5.6.0 integration and evidence contracts."""

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
SKILL = ROOT / "skills" / "native-jolt-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "native-jolt-physics" / "references" / "jolt.md"
UI = ROOT / "skills" / "native-jolt-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "native-jolt-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "native-jolt-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "native-jolt-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "native-jolt-physics-baseline-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-attempt-1-response.txt"
ATTEMPT2 = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-attempt-2-response.txt"
ATTEMPT3 = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-attempt-3-response.txt"
ATTEMPT4 = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-attempt-4-response.txt"
ATTEMPT5 = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-attempt-5-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "native-jolt-physics-enabled-response.txt"

ROUTES = (
    "architecting-real-time-physics",
    "rigid-body-collision-contact",
    "constraints-ragdolls-active-physics",
    "character-controller-movement",
    "vehicle-physics",
    "cloth-rope-soft-bodies",
    "networked-deterministic-physics",
    "debugging-testing-physics",
    "profiling-scaling-physics",
)

PINNED_URLS = (
    "https://github.com/jrouwe/JoltPhysics/releases/tag/v5.6.0",
    "https://github.com/jrouwe/JoltPhysics/tree/v5.6.0",
    "https://jrouwe.github.io/JoltPhysicsDocs/5.6.0/",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/HelloWorld/HelloWorld.cpp",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Docs/Architecture.md",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Docs/APIChanges.md",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Build/README.md",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/Body/BodyInterface.cpp",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/Body/BodyManager.cpp",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/PhysicsSystem.h",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/PhysicsSystem.cpp",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/EPhysicsUpdateError.h",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/StateRecorder.h",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/Vehicle/VehicleConstraint.h",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Jolt/Physics/Vehicle/VehicleConstraint.cpp",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Docs/Samples.md",
    "https://github.com/jrouwe/JoltPhysics/blob/v5.6.0/Docs/PerformanceTest.md",
    "https://github.com/jrouwe/JoltPhysics/tree/v5.6.0/UnitTests",
)

FIXTURE_DIGESTS = {
    SCENARIO: (823, "2a33582aaf764ab0be7a797600ac831baa90406539b66abc9a909c34491d63a1"),
    BASELINE: (10590, "33443ecd7f8fa5a89c8a7567b8c69c62f25bc8be8a8959109e042187fc9e2d1f"),
    ATTEMPT1: (11277, "2eb1ce4ae46da4d24272a6302510ad8b3e128b2bdb0049ab48f7db0a286c84c9"),
    ATTEMPT2: (12334, "974f905b8c364af675329dafff26a5fcf608a6c769192e6a5e23b2eb15c67ed8"),
    ATTEMPT3: (12563, "a4e686b1ce474fe957e8bcc62d264f3ff8ff8f58852d1ae2838cff229a2781a8"),
    ATTEMPT4: (14219, "075774c502ed684cd332783d9efadb4c8ebaacb030c9e8f5e85feeb6fd7da674"),
    ATTEMPT5: (14800, "47d45f4ebc3ba993943e7074c805f42aa762fb7416446b0b3c59ff5e0ac10239"),
    ENABLED: (16139, "fb6168d803faa64c3a6316c8114331e7bc77c7b8d8d0e259f3c6b233b48e6ca1"),
}

BASELINE_GAPS = {
    "source-snapshot",
    "layer-filter-contract",
    "state-recorder-structural",
    "module-lifetimes",
    "determinism-harness",
    "upstream-validation-ladder",
}

ADJUDICATED_RESIDUAL_LIMITATIONS = {
    "collapsed-layer-policy",
    "determinism-harness",
    "durable-bodyid",
    "jolt-owned-jobs",
    "module-lifetimes",
    "seed-determinism",
    "update-error-contract",
    "vehicle-controller-ownership",
}


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


CLAUSE_BOUNDARY = re.compile(
    r"(?<=[.!?])(?=\s|$)|[;。！？；\n]+|\b(?:but|however|yet|then)\b|(?:但是|但|不过|然而|却|然后)",
    re.IGNORECASE,
)
DIRECT_DENIAL = re.compile(
    r"\b(?:do\s+not|don't|never|cannot|can't|must\s+not|should\s+not|does\s+not|"
    r"is\s+not(?!\s+(?:only|merely)\b)|are\s+not(?!\s+(?:only|merely)\b)|"
    r"was\s+not(?!\s+(?:only|merely)\b)|were\s+not(?!\s+(?:only|merely)\b)|did\s+not|no\s+longer|"
    r"not\s+(?!only\b|merely\b))|(?:不要|不得|不能|不应|不会|不再|不(?!仅|但|只是))",
    re.IGNORECASE,
)
POSTFIX_DENIAL = re.compile(
    r"^\W*(?:(?:is|are|was|were)\s+)?(?:not(?!\s+(?:only|merely)\b)|never|"
    r"forbidden|unsafe|unsupported|unacceptable)|^\W*(?:不是|并非|不可|不安全|不受支持)",
    re.IGNORECASE,
)


def semantic_clauses(text: str) -> list[str]:
    protected = re.sub(
        r"(\bnot\s+(?:only|merely)\b[^.!?;。！？；\n]{0,160})\bbut\b",
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
            prefix = clause[max(0, match.start() - 64):match.start()]
            claim = clause[match.start():match.end()]
            suffix = clause[match.end():match.end() + 48]
            if (
                not DIRECT_DENIAL.search(prefix)
                and not DIRECT_DENIAL.search(claim)
                and not POSTFIX_DENIAL.search(suffix)
            ):
                return True
    return False


def response_violations(text: str) -> set[str]:
    """Evaluate source-specific teaching gaps and unsafe affirmative directions."""
    value = normalized(text)
    symbol_value = re.sub(r"[\s_-]+", "", value)
    violations = set()
    source_snapshot_missing = (
        not all(term in value for term in (
            "v5.6.0", "e77f175595e64cb44218cc9d9d56fc365ad0e36a",
        ))
        or not any(term in symbol_value for term in ("physicssystem::update", "physicssystem.update"))
        or not all(term in symbol_value for term in ("collisionsteps", "tempallocator", "jobsystem"))
    )
    if source_snapshot_missing:
        violations.add("source-snapshot")

    update_error_groups = (
        ("ephysicsupdateerror",),
        ("manifoldcachefull",),
        ("bodypaircachefull",),
        ("contactconstraintsfull",),
        ("exactly three", "only three", "has three", "defines three", "all nonzero"),
        ("some contacts", "contacts were ignored", "contacts are ignored"),
        ("inmaxcontactconstraints",),
        ("inmaxbodypairs",),
        ("separate", "outside", "not returned", "not update-error", "not update error"),
        ("temporary allocator", "temp allocator", "tempallocator"),
        ("job failure", "job-system failure", "jobsystem failure", "job fault"),
    )
    invented_update_error = (
        r"ephysicsupdateerror(?:::)?.{0,32}(?:allocatorfull|tempallocatorfull|jobsystemfull|jobfailure)",
        r"(?:allocator|job(?:system)?).{0,32}(?:is|are|as).{0,16}(?:an?\s+)?ephysicsupdateerror.{0,12}(?:flag|bit)",
        r"physicssystem(?:::\s*|\s*(?:\.|->)\s*)update.{0,96}(?:returns?|returned|reports?|reported|yields?)"
        r".{0,32}(?:allocatorfull|tempallocatorfull).{0,96}(?:temporary|temp).{0,32}(?:allocat|memory).{0,24}(?:exhaust|full|fail)",
        r"physicssystem(?:::\s*|\s*(?:\.|->)\s*)update.{0,96}(?:temporary|temp).{0,32}"
        r"(?:allocat|memory).{0,24}(?:exhaust|full|fail).{0,96}(?:returns?|returned|reports?|reported|yields?)"
        r".{0,24}(?:allocatorfull|tempallocatorfull)",
        r"(?:allocatorfull|tempallocatorfull).{0,32}(?:is\s+)?(?:returned|reported|yielded).{0,48}"
        r"physicssystem(?:::\s*|\s*(?:\.|->)\s*)update.{0,96}(?:temporary|temp).{0,32}"
        r"(?:allocat|memory).{0,24}(?:exhaust|full|fail)",
        r"(?:临时|temporary|temp).{0,20}(?:分配器|分配|内存|allocat|memory).{0,20}(?:耗尽|用尽|失败|exhaust|full|fail)"
        r".{0,48}physicssystem(?:::\s*|\s*(?:\.|->)\s*)update.{0,24}(?:返回|报告|return|report)"
        r".{0,16}(?:allocatorfull|tempallocatorfull)",
    )
    if not source_snapshot_missing and (
        not all(any(term in value for term in group) for group in update_error_groups)
        or any(contains_affirmative_claim(text, pattern) for pattern in invented_update_error)
    ):
        violations.add("update-error-contract")
    if not all(term in value for term in (
        "objectlayer", "broadphaselayer", "objectlayerpairfilter",
        "objectvsbroadphaselayerfilter", "symmetric",
    )):
        violations.add("layer-filter-contract")
    state_recorder_groups = (
        ("staterecorder",),
        ("restore",),
        ("structural", "structure", "add/remove", "spawn/despawn"),
        ("external", "host state", "gameplay state"),
        ("matching id", "matching bodyid", "same bodyid"),
        ("call order",),
    )
    state_recorder_missing = not all(
        any(term in value for term in group) for group in state_recorder_groups
    )
    if state_recorder_missing:
        violations.add("state-recorder-structural")
    remove_body_groups = (
        (
            r"removebody.{0,64}(?:preserv|retain|keep).{0,32}(?:body\s+object|body).{0,40}(?:bodyid|same\s+id)",
            r"removebody.{0,64}(?:preserv|retain|keep).{0,32}(?:bodyid|same\s+id).{0,40}(?:body\s+object|body)",
        ),
        (
            r"mapping.{0,80}(?:removed/inactive|active/removed|removed\s+state|inactive\s+state)",
        ),
        (
            r"mapping.{0,48}(?:inactive|removed).{0,48}(?:retain|keep).{0,32}(?:bodyid|id)",
            r"(?:keep|mark).{0,32}(?:the\s+)?mapping.{0,32}inactive.{0,32}removed",
        ),
        (r"(?:later|again).{0,32}addbody|addbody.{0,32}(?:later|again|same)",),
        (
            r"(?:only|until).{0,16}destroybody.{0,32}(?:world\s+teardown|world\s+destruction).{0,32}invalidat",
        ),
        (
            r"rollback.{0,48}(?:removebody|remove).{0,32}(?:re-add|readd).{0,32}(?:same\s+bodyid|preserve\s+ids?)",
            r"rollback.{0,64}removebody\W{0,3}/\W{0,3}addbody.{0,128}(?:retain|preserv).{0,32}same\s+body.{0,16}id",
        ),
        (
            r"(?:active.{0,32}removebody|removebody.{0,32}(?:active|body\s+is\s+active)).{0,64}deactivat",
            r"active\s+(?:body\s+)?removal.{0,64}deactivat",
        ),
        (
            r"removebody.{0,160}(?:zero|clear|reset).{0,48}(?:linear.{0,24}angular|linear/angular).{0,24}veloc",
            r"removebody.{0,160}(?:linear.{0,24}angular|linear/angular).{0,24}veloc.{0,32}(?:zero|clear|reset)",
        ),
        (
            r"removebody.{0,128}(?:remove|leave|exclude).{0,32}(?:the\s+)?broad(?:-|\s*)phase",
            r"(?:active\s+)?removal.{0,128}(?:remove|leave|exclude).{0,32}(?:the\s+)?broad(?:-|\s*)phase",
        ),
        (
            r"(?:does\s+not|do\s+not|cannot|won't)\s+preserve.{0,32}(?:full|complete).{0,24}state",
        ),
        (r"activation.{0,48}contacts?.{0,24}cache.{0,48}broad(?:-|\s*)phase\s+membership",),
        (
            r"physicssystem::savestate.{0,80}(?:only|solely).{0,32}in-broad-phase",
            r"physicssystem::savestate.{0,80}(?:only|solely).{0,32}(?:in|inside).{0,16}broad(?:-|\s*)phase",
        ),
        (
            r"(?:physicssystem::savestate|full\s+savestate).{0,160}(?:exclude|omit|does\s+not\s+include).{0,32}removed",
            r"(?:physicssystem::savestate|full\s+savestate).{0,160}removed.{0,32}(?:excluded|omitted|not\s+included)",
            r"removed.{0,32}(?:are|is).{0,16}(?:excluded|omitted|not\s+included).{0,64}(?:physicssystem::savestate|full\s+savestate)",
        ),
        (
            r"before.{0,32}removebody.{0,64}(?:physicssystem::)?savebodystate",
            r"(?:physicssystem::)?savebodystate.{0,64}before.{0,32}removebody",
            r"before.{0,32}removebody.{0,80}complete\s+host-owned\s+capture",
        ),
        (
            r"restore\s+structure.{0,64}(?:same\s+id|same\s+bodyid).{0,64}(?:re-add|readd).{0,64}(?:physicssystem::)?restorebodystate",
            r"restore\s+structure.{0,64}(?:re-add|readd).{0,64}(?:physicssystem::)?restorebodystate",
        ),
        (
            r"ordered.{0,48}(?:removebody/addbody|remove/add|removebody.{0,8}addbody).{0,80}(?:host\s+)?mapping",
            r"(?:host\s+)?mapping.{0,80}ordered.{0,48}(?:removebody/addbody|remove/add|removebody.{0,8}addbody)",
        ),
    )
    invalidate_on_remove = (
        r"removebody.{0,64}(?:invalidate|clear|erase|drop).{0,32}(?:host\s+)?(?:mapping|bodyid|handle)",
        r"(?:invalidate|clear|erase|drop).{0,32}(?:mapping|bodyid|handle).{0,32}(?:on|when|during).{0,12}(?:removebody|removal)",
        r"(?:mapping|bodyid|handle).{0,32}(?:is|was|must\s+be|should\s+be).{0,16}(?:invalidated|cleared|erased|dropped).{0,24}(?:removebody|removal)",
        r"removebody.{0,32}(?:使|让).{0,20}(?:主机)?映射.{0,16}(?:失效|无效|清除|删除)",
        r"(?:主机)?映射.{0,32}(?:不会|不得|不能|因|由|调用).{0,20}removebody.{0,24}(?:失效|无效|清除|删除)",
    )
    preserve_state_on_remove = (
        r"removebody.{0,72}(?:preserv|retain|keep).{0,36}(?:body.{0,12})?(?:full|complete)?\s*(?:simulation\s+)?(?:state|velocity)",
        r"(?:linear.{0,24}angular|linear/angular|velocit|full\s+state|complete\s+(?:simulation\s+)?state)"
        r".{0,48}(?:is|are).{0,16}(?:preserved|retained|kept).{0,32}(?:by|after|through)\s+removebody",
        r"removebody.{0,32}(?:会|将|仍|可以).{0,24}(?:保留|保存).{0,24}(?:速度|完整状态|全部状态)",
        r"(?:速度|完整状态|全部状态).{0,32}(?:由|在|经).{0,16}removebody.{0,24}(?:保留|保存)",
    )
    include_removed_in_full_save = (
        r"physicssystem::savestate.{0,80}(?:include|contain|save|capture).{0,32}(?:removed\s+bod|bodies?\s+after\s+removebody)",
        r"(?:removed\s+bodies?|bodies?\s+after\s+removebody).{0,48}(?:is|are).{0,16}(?:included|contained|saved|captured).{0,48}physicssystem::savestate",
        r"(?:已移除|removebody\s*后).{0,24}(?:对象|物体|body).{0,32}(?:仍|会|将).{0,16}(?:包含|保存).{0,32}physicssystem::savestate",
        r"physicssystem::savestate.{0,32}(?:包含|保存).{0,24}(?:已移除|removebody\s*后).{0,16}(?:对象|物体|body)",
    )
    if not state_recorder_missing and (
        not all(
            any(re.search(pattern, value) for pattern in group)
            for group in remove_body_groups
        )
        or any(contains_affirmative_claim(text, pattern) for pattern in invalidate_on_remove)
        or any(contains_affirmative_claim(text, pattern) for pattern in preserve_state_on_remove)
        or any(contains_affirmative_claim(text, pattern) for pattern in include_removed_in_full_save)
    ):
        violations.add("remove-body-preservation")
    module_groups = (
        ("charactervirtual",),
        ("charactercontactlistener",),
        ("ordinary queries", "normal rigid-body queries"),
        ("rigid bodies",),
        ("automatically", "decide explicitly", "visibility boundary"),
        ("optional", "optionally"),
        ("inner body", "inner-body"),
        ("vehicleconstraint",),
        ("vehiclecollisiontester",),
        ("addconstraint",),
        ("addsteplistener",),
        ("removesteplistener",),
        ("removeconstraint",),
        ("before destruction", "before destroying"),
        ("softbodysharedsettings",),
        ("immutable",),
        ("shared",),
        ("softbodycreationsettings",),
        ("createandaddsoftbody",),
        ("issoftbody",),
        ("softbodymotionproperties",),
        ("softbodycontactlistener",),
        ("wip",),
        ("soft-soft",),
        ("response",),
        ("ordinary constraints", "constraint behavior"),
        ("regular body", "regular-body", "regular rigid-body"),
        (
            "may not apply",
            "do not assume ordinary constraints or all regular-body apis apply",
            "do not assume regular rigid-body or constraint behavior applies",
        ),
    )
    module_missing = not all(any(term in value for term in group) for group in module_groups)
    if module_missing:
        violations.add("module-lifetimes")
    vehicle_core_present = all(term in value for term in (
        "vehicleconstraint", "addconstraint", "addsteplistener",
        "removesteplistener", "removeconstraint",
    ))
    vehicle_controller_groups = (
        ("mcontroller",),
        ("getcontroller",),
        ("borrowed",),
        ("non-owning", "nonowning"),
        ("destructor",),
        ("deletes mcontroller", "delete mcontroller"),
        ("must not separately delete", "do not separately delete", "not separately delete"),
        ("host",),
        ("chassis",),
        ("vehiclecollisiontester",),
        ("listeners",),
    )
    unsafe_controller_ownership = (
        r"host.{0,48}(?:owns?|owned).{0,40}(?:controller|mcontroller).{0,48}getcontroller",
        r"host.{0,64}(?:getcontroller|controller|mcontroller).{0,48}(?:delete|destroy).{0,24}(?:separate|it)",
        r"getcontroller.{0,48}(?:pointer|controller).{0,48}(?:is|was).{0,24}(?:delete|destroy).{0,24}host",
        r"(?:主机|host).{0,40}(?:拥有|owns?).{0,32}getcontroller.{0,48}(?:控制器|controller).{0,32}(?:单独)?(?:delete|删除|销毁)",
    )
    if vehicle_core_present and (
        not all(any(term in value for term in group) for group in vehicle_controller_groups)
        or not re.search(r"vehicleconstraint.{0,64}(?:construct|create).{0,32}(?:and\s+)?owns?.{0,24}mcontroller", value)
        or any(contains_affirmative_claim(text, pattern) for pattern in unsafe_controller_ownership)
    ):
        violations.add("vehicle-controller-ownership")
    determinism_groups = (
        ("jph_cross_platform_deterministic",),
        ("evidence matrix", "platform matrix", "every supported windows/linux"),
        ("windows",),
        ("linux",),
        ("source",),
        ("define",),
        ("simd/fp", "fp policy", "floating-point policy"),
        ("call order", "command order", "total order"),
        ("normalize", "normalise", "stable-sort", "stable sort"),
        ("broadphase", "broad-phase"),
        ("active-body", "active body"),
        ("divergence", "divergent"),
        ("hash",),
        ("collisioncollector", "collision collector"),
        ("addhit",),
        ("getworldspacebounds",),
        ("actual bounding box", "actual bounds", "actual-bounds"),
        ("-ffp-model=precise", "/fp:precise"),
        ("-ffp-contract=off",),
        ("nearest",),
        ("daz",),
        ("ftz",),
        ("jolt sin/cos", "jolt's sin/cos", "jph::sin"),
        ("quicksort",),
        ("binaryheappush",),
        ("binaryheappop",),
    )
    deterministic_shortcuts = (
        r"jph_cross_platform_deterministic.{0,32}(?:alone|only|by\s+itself).{0,32}(?:guarantee|ensure|make).{0,32}(?:determin|lockstep)",
        r"(?:sorting|sort|stable.sort).{0,32}(?:broadphase|broad.phase).{0,32}(?:alone|only|by\s+itself)?.{0,24}(?:make|guarantee|ensure).{0,24}determin",
        r"(?:enabl\w*.{0,24})?jph_cross_platform_deterministic.{0,80}(?:guarantee|ensure|make).{0,48}(?:cross.platform|determin|replay)",
        r"(?:cross.platform|deterministic).{0,48}(?:replay|lockstep|determinism).{0,32}(?:is\s+)?(?:guaranteed|ensured|made).{0,40}(?:enabl\w*.{0,20})?jph_cross_platform_deterministic",
        r"(?:启用|开启).{0,16}jph_cross_platform_deterministic.{0,32}(?:保证|确保).{0,24}(?:跨平台|确定性|回放)",
        r"(?:order|ordering|sort|sorting|stable.sort).{0,32}(?:broadphase|broad.phase).{0,64}\b(?:sufficient|enough|guarantee|ensure|make).{0,48}(?:determin|membership|member\s+set)",
        r"(?:determin\w*.{0,24})?(?:broadphase|broad.phase).{0,24}(?:membership|member\s+set).{0,32}(?:is\s+)?(?:guaranteed|ensured|made).{0,40}(?:order|ordering|sort|sorting).{0,24}(?:hit|result)",
        r"(?:排序|有序|顺序).{0,24}(?:broad.?phase).{0,24}(?:命中|结果).{0,32}(?:足以|即可|保证|确保).{0,24}(?:确定|成员)",
        r"(?:broad.?phase).{0,24}(?:命中|结果).{0,24}(?:排序|有序).{0,32}(?:足以|即可|保证|确保).{0,24}(?:确定|成员)",
    )
    if (
        not all(any(term in value for term in group) for group in determinism_groups)
        or not re.search(r"(?<!std::)\bhash\b", value)
        or any(contains_affirmative_claim(text, pattern) for pattern in deterministic_shortcuts)
    ):
        violations.add("determinism-harness")
    if not all(term in value for term in (
        "helloworld", "unittests", "samples", "performancetest", "p50", "p95", "p99",
        "determinism", "staterecorder", "rollback", "fault", "contact",
    )):
        violations.add("upstream-validation-ladder")
    if not any(term in value for term in ("capacity", "capacities")):
        violations.add("upstream-validation-ladder")

    unsafe_claims = {
        "jolt-owned-jobs": (
            r"jolt.{0,32}(?:create|own|manage).{0,24}(?:worker|thread|job\s*system)",
            r"(?:worker|thread|job\s*system).{0,24}(?:was|were|is|are).{0,12}(?:created|owned|managed).{0,12}by\s+jolt",
            r"jolt.{0,32}(?:创建|拥有|管理).{0,24}(?:线程|任务系统)",
        ),
        "collapsed-layer-policy": (
            r"(?:one|single).{0,24}object\s+layer.{0,40}(?:every|all).{0,20}(?:pair|object).{0,20}collid\w*",
            r"(?:all|every).{0,20}(?:pair|object).{0,24}(?:was|were|is|are)?.{0,12}(?:allowed\s+to\s+)?collid\w*.{0,32}(?:one|single).{0,24}layer",
            r"(?:一个|单一).{0,20}(?:object\s*)?层.{0,32}(?:所有|每对).{0,16}碰撞",
        ),
        "durable-bodyid": (
            r"bodyid.{0,32}(?:forever|permanent|stable|network\s+id)",
            r"(?:serialize|serialized|serializing).{0,20}(?:the\s+)?raw\s+bodyid",
            r"raw\s+bodyid.{0,24}(?:was|were|is|are)?.{0,12}serializ",
            r"(?:永久保留|永久保存|序列化原始).{0,20}bodyid|bodyid.{0,20}(?:永久|网络身份)",
        ),
        "seed-determinism": (
            r"same\s+seed.{0,48}(?:cross.platform|windows.{0,16}linux).{0,32}(?:determin|replay)",
            r"(?:cross.platform|windows.{0,16}linux).{0,48}(?:determin|replay).{0,32}same\s+seed",
            r"相同种子.{0,48}(?:跨平台|windows.{0,16}linux).{0,24}(?:确定|回放)",
        ),
        "helloworld-only": (
            r"helloworld.{0,32}(?:alone|only|enough|passes?).{0,32}(?:ship|release|enough)",
            r"(?:ship|release).{0,32}(?:after|once|when).{0,20}helloworld",
            r"helloworld.{0,32}(?:通过|足够).{0,24}(?:发布|上线)",
        ),
        "sample-default": (
            r"(?:10\s*mib|sample\s+capacit).{0,32}(?:default|production\s+value)",
            r"(?:默认|生产值).{0,24}(?:10\s*mib|样例容量)",
        ),
        "legacy-integration-substeps": (
            r"(?:increase|use|raise).{0,24}integration\s*substeps",
            r"integration\s*substeps.{0,24}(?:current|recommended|required)",
            r"(?:提高|使用).{0,20}integration\s*substeps",
        ),
        "cross-version-binary": (
            r"binary.{0,24}(?:saved\s+)?(?:shape|state).{0,40}(?:cross.version|all\s+versions|durable)",
            r"(?:跨版本|所有版本).{0,32}(?:二进制|binary).{0,24}(?:shape|state|形状|状态)",
        ),
        "wip-production-guarantee": (
            r"(?:soft\s*bod|gpu\s+hair).{0,32}(?:production.ready|ship.ready|guaranteed)",
            r"(?:软体|gpu\s*hair).{0,32}(?:生产就绪|可直接发布|保证)",
        ),
    }
    for label, patterns in unsafe_claims.items():
        if any(contains_affirmative_claim(text, pattern) for pattern in patterns):
            violations.add(label)

    variable_render_prescriptions = (
        r"\b(?:call|use|run|invoke|step)\s+physicssystem::update.{0,64}(?:variable|render).{0,24}(?:delta|loop|frame)",
        r"physicssystem::update\s+(?:is|was|will\s+be|should\s+be|can\s+be)\s+"
        r"(?:called|run|invoked|stepped).{0,48}(?:variable|render).{0,24}(?:delta|loop|frame)",
        r"(?:从|在).{0,20}(?:可变|渲染).{0,20}(?:delta|循环|帧).{0,20}(?:调用|运行)\s*physicssystem::update",
    )
    if any(contains_affirmative_claim(text, pattern) for pattern in variable_render_prescriptions):
        violations.add("variable-render-update")

    qualified_type = r"(?:[A-Za-z_]\w*::)*[A-Za-z_]\w*"
    allocator_types = {
        "tempallocator", "tempallocatorimpl", "tempallocatormalloc",
        "tempallocatorimplwithmallocfallback",
    }
    job_types = {"jobsystem", "jobsystemthreadpool"}
    custom_categories: dict[str, str] = {}

    def type_leaf(type_name: str) -> str:
        return re.sub(r"\s+", "", type_name).split("::")[-1].casefold()

    def type_category(type_name: str) -> str | None:
        leaf = type_leaf(type_name)
        if leaf in allocator_types:
            return "allocator"
        if leaf in job_types:
            return "job"
        return custom_categories.get(leaf)

    class_bases = {
        child.casefold(): base
        for child, base in re.findall(
            rf"\b(?:class|struct)\s+([A-Za-z_]\w*)(?:\s+final)?\s*:\s*"
            rf"(?:public\s+)?({qualified_type})",
            text,
            flags=re.IGNORECASE,
        )
    }
    changed = True
    while changed:
        changed = False
        for child, base in class_bases.items():
            category = type_category(base)
            if category is not None and custom_categories.get(child) != category:
                custom_categories[child] = category
                changed = True

    pointer_variables: dict[str, str | None] = {}
    for type_name, name in re.findall(
        rf"\b(?:const\s+)?({qualified_type})\s*(?:const\s+)?\*\s*"
        rf"(?:const\s+)?([A-Za-z_]\w*)\s*(?=[=;,)])",
        text,
        flags=re.IGNORECASE,
    ):
        pointer_variables[name.casefold()] = type_category(type_name)

    unique_ptr_variables: dict[str, str | None] = {}
    for type_name, name in re.findall(
        rf"\b(?:std::)?unique_ptr\s*<\s*({qualified_type})\s*>\s*([A-Za-z_]\w*)",
        text,
        flags=re.IGNORECASE,
    ):
        unique_ptr_variables[name.casefold()] = type_category(type_name)

    object_variables: dict[str, str | None] = {}
    for type_name, name in re.findall(
        rf"\b(?:const\s+)?({qualified_type})\s+([A-Za-z_]\w*)\s*(?=[=;{{])",
        text,
        flags=re.IGNORECASE,
    ):
        object_variables[name.casefold()] = type_category(type_name)

    pointer_functions: dict[str, str | None] = {}
    for type_name, name in re.findall(
        rf"\b(?:const\s+)?({qualified_type})\s*(?:const\s+)?\*\s*(?:const\s+)?"
        rf"(?:(?:[A-Za-z_]\w*::)*)?([A-Za-z_]\w*)\s*\(",
        text,
        flags=re.IGNORECASE,
    ):
        pointer_functions[name.casefold()] = type_category(type_name)

    def strip_outer_parentheses(source: str) -> str:
        candidate = source.strip()
        while candidate.startswith("(") and candidate.endswith(")"):
            depth = 0
            closing = None
            quote = None
            escaped = False
            for index, character in enumerate(candidate):
                if quote is not None:
                    if escaped:
                        escaped = False
                    elif character == "\\":
                        escaped = True
                    elif character == quote:
                        quote = None
                    continue
                if character in "\"'":
                    quote = character
                elif character == "(":
                    depth += 1
                elif character == ")":
                    depth -= 1
                    if depth == 0:
                        closing = index
                        break
            if closing != len(candidate) - 1:
                break
            candidate = candidate[1:-1].strip()
        return candidate

    def is_pointer_argument(argument: str, expected_category: str) -> bool:
        candidate = strip_outer_parentheses(argument)
        identifier = re.fullmatch(r"[A-Za-z_]\w*", candidate)
        if identifier is not None:
            return pointer_variables.get(identifier.group().casefold()) == expected_category

        get_call = re.fullmatch(
            r"([A-Za-z_]\w*)\s*(?:\.|->)\s*get\s*\(\s*\)",
            candidate,
            re.IGNORECASE | re.DOTALL,
        )
        if get_call is not None:
            return unique_ptr_variables.get(get_call.group(1).casefold()) == expected_category

        if candidate.startswith("&"):
            operand = strip_outer_parentheses(candidate[1:])
            addressed = re.fullmatch(r"[A-Za-z_]\w*", operand)
            if addressed is None:
                return False
            name = addressed.group().casefold()
            if name in pointer_variables or name in unique_ptr_variables:
                return False
            if name in object_variables:
                return object_variables[name] == expected_category
            # A short snippet may omit the object declaration. Address-of is still pointer syntax;
            # visible declarations, when present, are authoritative and checked above.
            return True

        call = re.match(
            r"^(?:(?:[A-Za-z_]\w*)\s*(?:\.|->|::)\s*)*([A-Za-z_]\w*)\s*\(",
            candidate,
            re.IGNORECASE | re.DOTALL,
        )
        return (
            call is not None
            and pointer_functions.get(call.group(1).casefold()) == expected_category
        )

    def balanced_call_arguments(source: str) -> list[str]:
        calls = []
        start_pattern = re.compile(
            r"\b[A-Za-z_]\w*\s*(?:\.|->)\s*Update\s*\(",
            re.IGNORECASE,
        )
        for match in start_pattern.finditer(source):
            opening = match.end() - 1
            depth = 0
            quote = None
            escaped = False
            for index in range(opening, len(source)):
                character = source[index]
                if quote is not None:
                    if escaped:
                        escaped = False
                    elif character == "\\":
                        escaped = True
                    elif character == quote:
                        quote = None
                    continue
                if character in "\"'":
                    quote = character
                elif character == "(":
                    depth += 1
                elif character == ")":
                    depth -= 1
                    if depth == 0:
                        calls.append(source[opening + 1:index])
                        break
        return calls

    def split_arguments(source: str) -> list[str]:
        arguments = []
        start = 0
        depth = 0
        quote = None
        escaped = False
        for index, character in enumerate(source):
            if quote is not None:
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = None
            elif character in "\"'":
                quote = character
            elif character in "([{":
                depth += 1
            elif character in ")]}":
                depth -= 1
            elif character == "," and depth == 0:
                arguments.append(source[start:index].strip())
                start = index + 1
        arguments.append(source[start:].strip())
        return arguments

    for call in balanced_call_arguments(text):
        arguments = split_arguments(call)
        if len(arguments) == 4 and not all(
            is_pointer_argument(argument, expected)
            for argument, expected in zip(arguments[2:], ("allocator", "job"))
        ):
            violations.add("update-pointer-call")
            break
    return violations


class NativeJoltPhysicsSkillTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for path in (
            SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE,
            ATTEMPT1, ATTEMPT2, ATTEMPT3, ATTEMPT4, ATTEMPT5, ENABLED,
        ):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), f"missing Task 20 artifact: {path.relative_to(ROOT)}")

    def test_exact_scenario_and_blind_baseline_are_tracked_and_protected(self):
        for path, (byte_count, digest) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.relative_to(ROOT)):
                raw = path.read_bytes()
                self.assertEqual(raw[-1:], b"\n")
                self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (byte_count, digest))
                if (ROOT / ".git").exists():
                    tracked = subprocess.run(
                        ["git", "ls-files", "--error-unmatch", str(path.relative_to(ROOT))],
                        cwd=ROOT, capture_output=True, text=True, check=False,
                    )
                    self.assertEqual(tracked.returncode, 0, tracked.stderr)
                attribute = f"{path.relative_to(ROOT).as_posix()} -text whitespace=-trailing-space"
                self.assertIn(attribute, (ROOT / ".gitattributes").read_text(encoding="utf-8"))

    def test_blind_baseline_has_only_the_six_source_specific_gaps(self):
        self.assertEqual(response_violations(BASELINE.read_text(encoding="utf-8")), BASELINE_GAPS)

    def test_attempt1_is_exact_and_truthfully_fails_the_current_gate(self):
        self.assertEqual(
            response_violations(ATTEMPT1.read_text(encoding="utf-8")),
            {
                "determinism-harness",
                "module-lifetimes",
                "remove-body-preservation",
                "update-error-contract",
            },
        )

    def test_attempt2_is_exact_and_truthfully_fails_the_current_gate(self):
        self.assertEqual(
            response_violations(ATTEMPT2.read_text(encoding="utf-8")),
            {
                "determinism-harness",
                "remove-body-preservation",
                "update-error-contract",
                "update-pointer-call",
                "vehicle-controller-ownership",
            },
        )

    def test_attempt3_history_is_exact_and_truthfully_fails_the_current_gate(self):
        raw = ATTEMPT3.read_bytes()
        self.assertEqual(
            (len(raw), hashlib.sha256(raw).hexdigest()),
            FIXTURE_DIGESTS[ATTEMPT3],
        )
        self.assertNotEqual(raw, ENABLED.read_bytes())
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            {
                "determinism-harness",
                "remove-body-preservation",
                "update-error-contract",
                "vehicle-controller-ownership",
            },
        )

    def test_attempt4_history_is_exact_and_truthfully_fails_vehicle_controller_ownership(self):
        raw = ATTEMPT4.read_bytes()
        self.assertEqual(len(raw), 14219)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "075774c502ed684cd332783d9efadb4c8ebaacb030c9e8f5e85feeb6fd7da674",
        )
        self.assertEqual(raw[-1:], b"\n")
        self.assertNotIn(b"\r\n", raw)
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            {"remove-body-preservation", "vehicle-controller-ownership"},
        )

    def test_attempt5_is_exact_failed_history_with_one_real_adjudicated_blocker(self):
        self.assertTrue(ATTEMPT5.is_file(), "attempt 5 must be copied into tracked failed history")
        raw = ATTEMPT5.read_bytes()
        self.assertEqual(
            (len(raw), hashlib.sha256(raw).hexdigest(), raw[-1:], b"\r" in raw),
            (
                14800,
                "47d45f4ebc3ba993943e7074c805f42aa762fb7416446b0b3c59ff5e0ac10239",
                b"\n",
                False,
            ),
        )
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            ADJUDICATED_RESIDUAL_LIMITATIONS | {"remove-body-preservation"},
        )

    def test_final_adjudicated_correction_clears_only_the_real_blocker(self):
        text = ENABLED.read_text(encoding="utf-8")
        self.assertIn("adjudicated source correction", normalized(text))
        self.assertIn("not a fresh evaluator attempt", normalized(text))
        self.assertEqual(response_violations(text), ADJUDICATED_RESIDUAL_LIMITATIONS)

    def test_vehicle_controller_ownership_is_explicit_and_deletion_protected(self):
        contract = (
            "The host owns and retains the VehicleConstraint, chassis, VehicleCollisionTester, and listeners. "
            "Register it with AddConstraint and AddStepListener, then call RemoveStepListener and "
            "RemoveConstraint before destruction. "
            "VehicleConstraint constructs and owns mController, and its destructor deletes mController. "
            "GetController returns a borrowed, non-owning pointer; the host must not separately delete it."
        )
        self.assertNotIn("vehicle-controller-ownership", response_violations(contract))
        for removed in (
            contract.replace("VehicleConstraint constructs and owns mController", "The controller is available"),
            contract.replace("its destructor deletes mController", "its destructor runs"),
            contract.replace("GetController returns a borrowed, non-owning pointer", "GetController returns a pointer"),
            contract.replace("the host must not separately delete it", "the host releases resources"),
            contract.replace("VehicleConstraint, chassis, VehicleCollisionTester, and listeners", "vehicle objects"),
        ):
            with self.subTest(controller_contract_removed=removed):
                self.assertIn("vehicle-controller-ownership", response_violations(removed))

        for contradiction in (
            "The host owns the controller returned by GetController and deletes it separately.",
            "The GetController pointer is separately deleted by the host.",
            "主机拥有 GetController 返回的控制器，并单独 delete 它。",
            "The host not only retains the GetController pointer but also owns and deletes it.",
        ):
            with self.subTest(controller_contradiction=contradiction):
                self.assertIn(
                    "vehicle-controller-ownership",
                    response_violations(contract + " " + contradiction),
                )

        for denial in (
            "The host does not own or separately delete the controller returned by GetController.",
            "GetController 返回的是借用指针，主机不得单独 delete。",
        ):
            with self.subTest(controller_denial=denial):
                self.assertNotIn(
                    "vehicle-controller-ownership",
                    response_violations(contract + " " + denial),
                )

    def test_source_snapshot_accepts_symbol_spelling_variants_but_not_deletions(self):
        source_contract = (
            "Pinned Jolt v5.6.0 at e77f175595e64cb44218cc9d9d56fc365ad0e36a. "
            "PhysicsSystem::Update uses collision_steps, TempAllocator temp_allocator, and JobSystem job_system."
        )
        self.assertNotIn("source-snapshot", response_violations(source_contract))
        for removed in (
            source_contract.replace("v5.6.0", "the current release"),
            source_contract.replace("e77f175595e64cb44218cc9d9d56fc365ad0e36a", "the pinned commit"),
            source_contract.replace("PhysicsSystem::Update", "the update function"),
            source_contract.replace("collision_steps", "steps"),
            source_contract.replace("TempAllocator temp_allocator", "temporary memory"),
            source_contract.replace("JobSystem job_system", "worker pool"),
        ):
            with self.subTest(source_removed=removed):
                self.assertIn("source-snapshot", response_violations(removed))

        instance_spelling = (
            "Pinned Jolt v5.6.0 at e77f175595e64cb44218cc9d9d56fc365ad0e36a. "
            "physics_system.Update uses collision_steps with temporary allocator temp_allocator and JobSystem job_system."
        )
        self.assertNotIn("source-snapshot", response_violations(instance_spelling))
        for removed in (
            instance_spelling.replace("v5.6.0", "the release"),
            instance_spelling.replace("e77f175595e64cb44218cc9d9d56fc365ad0e36a", "the commit"),
            instance_spelling.replace("physics_system.Update", "the tick function"),
            instance_spelling.replace("collision_steps", "steps"),
            instance_spelling.replace("temporary allocator temp_allocator", "scratch memory"),
            instance_spelling.replace("JobSystem job_system", "workers"),
        ):
            with self.subTest(instance_source_removed=removed):
                self.assertIn("source-snapshot", response_violations(removed))

    def test_variable_render_diagnosis_is_safe_but_prescriptions_are_not(self):
        diagnosis = (
            "Calling PhysicsSystem::Update from a variable render loop makes the simulation depend on "
            "rendering cadence."
        )
        self.assertNotIn("variable-render-update", response_violations(diagnosis))
        self.assertNotIn(
            "variable-render-update",
            response_violations("Do not call PhysicsSystem::Update from a variable render loop."),
        )
        for prescription in (
            "Call PhysicsSystem::Update from a variable render loop.",
            "Use PhysicsSystem::Update with variable render delta.",
            "PhysicsSystem::Update is called from a variable render loop.",
            "从可变渲染循环调用 PhysicsSystem::Update。",
        ):
            with self.subTest(prescription=prescription):
                self.assertIn("variable-render-update", response_violations(prescription))

    def test_update_requires_pointer_arguments_in_code_calls(self):
        unsafe_calls = (
            "physics_system.Update(dt, collision_steps, temp_allocator, job_system);",
            "physicsSystem.Update(dt, collisionSteps, &tempAllocator, jobSystem);",
            "physics_system.Update(dt, collision_steps, temp_allocator, &job_system);",
        )
        for call in unsafe_calls:
            with self.subTest(call=call):
                self.assertIn("update-pointer-call", response_violations(call))

        safe_calls = (
            "physics_system.Update(dt, collision_steps, &temp_allocator, &job_system);",
            (
                "TempAllocator *temp_allocator_ptr = get_temp_allocator(); "
                "JobSystem *job_system_ptr = get_job_system(); "
                "physics_system.Update(dt, collision_steps, temp_allocator_ptr, job_system_ptr);"
            ),
            (
                "PhysicsSystem::Update takes TempAllocator* and JobSystem* arguments; object locals are passed "
                "by address."
            ),
            (
                "TempAllocatorImpl *temp_allocator = GetAllocator(); "
                "JobSystemThreadPool *job_system = GetJobs(); "
                "physics_system.Update(dt, collision_steps, temp_allocator, job_system);"
            ),
            (
                "TempAllocatorImpl *ChooseAllocator(TempAllocatorImpl *candidate); "
                "JobSystemThreadPool *ChooseJobs(JobSystemThreadPool *candidate); "
                "physics_system.Update(dt, collision_steps, "
                "ChooseAllocator(GetAllocator()), ChooseJobs(GetJobs()));"
            ),
        )
        for call in safe_calls:
            with self.subTest(call=call):
                self.assertNotIn("update-pointer-call", response_violations(call))

        nested_object_calls = (
            (
                "TempAllocatorImpl temp_allocator; JobSystemThreadPool job_system; "
                "physics_system.Update(dt, collision_steps, "
                "PassThrough(temp_allocator), PassThrough(job_system));"
            ),
            (
                "TempAllocatorImpl temp_allocator_ptr; JobSystemThreadPool job_system_pointer; "
                "physics_system.Update(dt, collision_steps, temp_allocator_ptr, job_system_pointer);"
            ),
        )
        for call in nested_object_calls:
            with self.subTest(call=call):
                self.assertIn("update-pointer-call", response_violations(call))

    def test_update_pointer_oracle_uses_visible_declared_types_and_signatures(self):
        compatible_calls = (
            (
                "TempAllocator *scratch; JobSystem *jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
            (
                "TempAllocatorImpl *scratch; JobSystemThreadPool *jobs; "
                "physics_system.Update(dt, steps, (scratch), ((jobs)));"
            ),
            (
                "TempAllocatorMalloc *scratch; JobSystem *jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
            (
                "std::unique_ptr<TempAllocatorImpl> scratch; "
                "std::unique_ptr<JobSystemThreadPool> jobs; "
                "physics_system.Update(dt, steps, scratch.get(), jobs.get());"
            ),
            (
                "class Arena final : public TempAllocator {}; "
                "class EngineJobs final : public JobSystem {}; "
                "Arena *scratch; EngineJobs *jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
            (
                "TempAllocator *ChooseAllocator(int key); JobSystem *ChooseJobs(int key); "
                "physics_system.Update(GetDelta(a, b), GetSteps(1, 2), "
                "ChooseAllocator(MakeKey(1, 2)), ChooseJobs(MakeKey(3, 4)));"
            ),
        )
        for call in compatible_calls:
            with self.subTest(compatible_call=call):
                self.assertNotIn("update-pointer-call", response_violations(call))

        incompatible_calls = (
            (
                "TempAllocatorImpl scratch; JobSystemThreadPool jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
            (
                "int scratch; int jobs; "
                "physics_system.Update(dt, steps, &scratch, &jobs);"
            ),
            (
                "WrongAllocator scratch; WrongJobs jobs; "
                "physics_system.Update(dt, steps, &scratch, &jobs);"
            ),
            (
                "JobSystem *scratch; TempAllocator *jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
            (
                "CustomAllocator *scratch; CustomJobs *jobs; "
                "physics_system.Update(dt, steps, scratch, jobs);"
            ),
        )
        for call in incompatible_calls:
            with self.subTest(incompatible_call=call):
                self.assertIn("update-pointer-call", response_violations(call))

    def test_late_clause_contradictions_override_earlier_correct_prose(self):
        state_contract = (
            "StateRecorder restore retains ordered structural remove/add history and external host state "
            "with matching IDs in recorded call order. RemoveBody retains the Body object and BodyID for "
            "a later AddBody; mark the host mapping removed/inactive and retain that ID. Active removal "
            "deactivates the Body, zeroes linear and angular velocity, and removes it from the broad phase; "
            "it does not preserve full state, activation, contacts/cache, or broad-phase membership. "
            "PhysicsSystem::SaveState includes only in-broad-phase bodies and excludes removed bodies. "
            "Before RemoveBody call PhysicsSystem::SaveBodyState; restore structure and the same ID, re-add, "
            "then call RestoreBodyState. Only DestroyBody or world teardown invalidates the mapping. "
            "Rollback records ordered RemoveBody/AddBody events while preserving the same BodyID."
        )
        determinism_contract = (
            "Use JPH_CROSS_PLATFORM_DETERMINISTIC and a Windows/Linux platform evidence matrix with "
            "pinned source revision, matching defines, SIMD/FP policy, stable host command order, "
            "normalized active-body results, per-tick hashes, and first-divergence capture. For "
            "BroadPhaseQuery, a custom CollisionCollector AddHit repeats the query against the actual "
            "bounding box from Body::GetWorldSpaceBounds before stable ordering. Compile the host with "
            "-ffp-model=precise or /fp:precise and -ffp-contract=off; keep nearest rounding, DAZ, and FTZ "
            "consistent. Use Jolt Sin/Cos, QuickSort, BinaryHeapPush/BinaryHeapPop, and Hash."
        )
        update_contract = (
            "Pinned Jolt v5.6.0 at e77f175595e64cb44218cc9d9d56fc365ad0e36a. "
            "PhysicsSystem::Update uses collisionSteps, TempAllocator, and JobSystem. "
            "EPhysicsUpdateError defines exactly three nonzero bits: ManifoldCacheFull means some contacts "
            "are ignored; increase inMaxContactConstraints. BodyPairCacheFull means some contacts are "
            "ignored; increase inMaxBodyPairs. ContactConstraintsFull means some contacts are ignored; "
            "increase inMaxContactConstraints. Temporary allocator exhaustion and job failure are separate "
            "outside the returned update-error bits."
        )
        complete = state_contract + " " + determinism_contract + " " + update_contract
        for label in (
            "remove-body-preservation", "determinism-harness", "update-error-contract",
        ):
            self.assertNotIn(label, response_violations(complete))

        contradictions = {
            "remove-body-preservation": (
                "RemoveBody invalidates the host mapping.",
                "The host mapping is invalidated by RemoveBody.",
                "调用 RemoveBody 会使主机映射失效。",
                "RemoveBody not only marks the body removed but also invalidates the host mapping.",
            ),
            "determinism-harness": (
                "Enabling JPH_CROSS_PLATFORM_DETERMINISTIC guarantees cross-platform deterministic replay.",
                "Cross-platform deterministic replay is guaranteed by enabling JPH_CROSS_PLATFORM_DETERMINISTIC.",
                "启用 JPH_CROSS_PLATFORM_DETERMINISTIC 可保证跨平台确定性回放。",
                "Enabling JPH_CROSS_PLATFORM_DETERMINISTIC not only helps replay but guarantees it across platforms.",
                "Ordering broad-phase hits is sufficient to guarantee deterministic membership.",
                "Deterministic broad-phase membership is guaranteed by ordering the hits.",
                "只要对 broad-phase 命中排序，就足以保证确定性的成员集合。",
                "Ordering broad-phase hits not only stabilizes order but guarantees deterministic membership.",
            ),
            "update-error-contract": (
                "PhysicsSystem::Update returns AllocatorFull when temporary allocation is exhausted.",
                "AllocatorFull is returned by PhysicsSystem::Update after temporary allocator exhaustion.",
                "临时分配器耗尽时，PhysicsSystem::Update 会返回 AllocatorFull。",
                "PhysicsSystem::Update not only observes temporary allocator exhaustion but returns AllocatorFull.",
            ),
        }
        for label, probes in contradictions.items():
            for probe in probes:
                with self.subTest(label=label, contradiction=probe):
                    self.assertIn(label, response_violations(complete + " " + probe))

        safe_denials = {
            "remove-body-preservation": (
                "RemoveBody does not invalidate the host mapping.",
                "主机映射不会因 RemoveBody 而失效。",
            ),
            "determinism-harness": (
                "Enabling JPH_CROSS_PLATFORM_DETERMINISTIC does not guarantee cross-platform deterministic replay.",
                "Ordering broad-phase hits is not sufficient to guarantee deterministic membership.",
                "仅排序 broad-phase 命中不能保证确定性的成员集合。",
            ),
            "update-error-contract": (
                "PhysicsSystem::Update does not return AllocatorFull when temporary allocation is exhausted.",
                "临时分配器耗尽时，PhysicsSystem::Update 不会返回 AllocatorFull。",
            ),
        }
        for label, denials in safe_denials.items():
            for denial in denials:
                with self.subTest(label=label, denial=denial):
                    self.assertNotIn(label, response_violations(complete + " " + denial))

    def test_state_recorder_and_determinism_use_bounded_semantic_groups(self):
        state_contract = (
            "StateRecorder restore uses structural add/remove history. External host state is retained. "
            "Matching IDs are reconstructed in the recorded call order."
        )
        self.assertNotIn("state-recorder-structural", response_violations(state_contract))
        for removed in (
            state_contract.replace("StateRecorder ", ""),
            state_contract.replace("structural add/remove history", "simulation data"),
            state_contract.replace("External host state is retained. ", ""),
            state_contract.replace("Matching IDs", "Objects"),
            state_contract.replace("recorded call order", "usual sequence"),
        ):
            with self.subTest(state_removed=removed):
                self.assertIn("state-recorder-structural", response_violations(removed))

        determinism_contract = (
            "Use JPH_CROSS_PLATFORM_DETERMINISTIC and a Windows/Linux platform evidence matrix with "
            "pinned source revision, matching defines, SIMD/FP policy, stable host command order, "
            "normalized active-body results, per-tick hashes, and first-divergence capture. "
            "For BroadPhaseQuery, a custom CollisionCollector AddHit repeats the query against the actual "
            "bounding box from Body::GetWorldSpaceBounds before stable ordering. Compile the host with "
            "-ffp-model=precise or /fp:precise and -ffp-contract=off; keep nearest rounding, DAZ, and FTZ "
            "consistent. Use Jolt Sin/Cos, QuickSort, BinaryHeapPush/BinaryHeapPop, and Hash."
        )
        self.assertNotIn("determinism-harness", response_violations(determinism_contract))
        for removed in (
            determinism_contract.replace("JPH_CROSS_PLATFORM_DETERMINISTIC", "the same seed"),
            determinism_contract.replace("Windows/Linux platform evidence matrix", "one local run"),
            determinism_contract.replace("pinned source revision", "a build"),
            determinism_contract.replace("matching defines", "matching settings"),
            determinism_contract.replace("SIMD/FP policy", "runtime configuration"),
            determinism_contract.replace("stable host command order", "host commands"),
            determinism_contract.replace("normalized active-body results", "query results"),
            determinism_contract.replace("first-divergence capture", "a summary"),
            determinism_contract.replace("custom CollisionCollector AddHit", "a collector"),
            determinism_contract.replace("Body::GetWorldSpaceBounds", "cached broad-phase bounds"),
            determinism_contract.replace("actual bounding box", "broad-phase box"),
            determinism_contract.replace(
                "-ffp-model=precise or /fp:precise and -ffp-contract=off",
                "consistent compiler flags",
            ),
            determinism_contract.replace("nearest rounding, DAZ, and FTZ", "the same FPU mode"),
            determinism_contract.replace("Jolt Sin/Cos", "standard sin/cos"),
            determinism_contract.replace("QuickSort", "std::sort"),
            determinism_contract.replace("BinaryHeapPush/BinaryHeapPop", "std heap functions"),
            determinism_contract.replace("Hash", "std::hash"),
        ):
            with self.subTest(determinism_removed=removed):
                self.assertIn("determinism-harness", response_violations(removed))

        for shortcut in (
            "JPH_CROSS_PLATFORM_DETERMINISTIC alone guarantees deterministic lockstep.",
            "Sorting BroadPhaseQuery hits by host ID alone makes the broadphase deterministic.",
        ):
            with self.subTest(shortcut=shortcut):
                self.assertIn(
                    "determinism-harness",
                    response_violations(determinism_contract + " " + shortcut),
                )
        for denial in (
            "JPH_CROSS_PLATFORM_DETERMINISTIC alone does not guarantee deterministic lockstep.",
            "Sorting BroadPhaseQuery hits alone does not make membership deterministic.",
        ):
            with self.subTest(denial=denial):
                self.assertNotIn(
                    "determinism-harness",
                    response_violations(determinism_contract + " " + denial),
                )

    def test_update_error_contract_has_only_the_three_v56_bits(self):
        source_contract = (
            "Pinned Jolt v5.6.0 at e77f175595e64cb44218cc9d9d56fc365ad0e36a. "
            "PhysicsSystem::Update uses collisionSteps, TempAllocator, and JobSystem. "
        )
        error_contract = (
            "EPhysicsUpdateError defines exactly three nonzero bits: ManifoldCacheFull means total body "
            "contacts are too high and some contacts are ignored; increase inMaxContactConstraints. "
            "BodyPairCacheFull means too many bodies contacted and some contacts are ignored; increase "
            "inMaxBodyPairs. ContactConstraintsFull means the contact constraint buffer is full and some "
            "contacts are ignored; increase inMaxContactConstraints. Temporary allocator exhaustion and "
            "job failure are handled separately outside the returned update-error bits."
        )
        complete = source_contract + error_contract
        self.assertNotIn("update-error-contract", response_violations(complete))
        for removed in (
            complete.replace("exactly three", "several"),
            complete.replace("ManifoldCacheFull", "manifold exhaustion"),
            complete.replace("BodyPairCacheFull", "pair exhaustion"),
            complete.replace("ContactConstraintsFull", "constraint exhaustion"),
            complete.replace("some contacts are ignored", "the update reports it"),
            complete.replace("inMaxContactConstraints", "the contact budget"),
            complete.replace("inMaxBodyPairs", "the pair budget"),
            complete.replace(
                "handled separately outside the returned update-error bits",
                "reported by the same flags",
            ),
        ):
            with self.subTest(error_removed=removed):
                self.assertIn("update-error-contract", response_violations(removed))

        for invented in (
            "EPhysicsUpdateError::AllocatorFull is a returned flag.",
            "Allocator exhaustion is an EPhysicsUpdateError bit.",
            "JobSystem failure is an EPhysicsUpdateError flag.",
        ):
            with self.subTest(invented=invented):
                self.assertIn(
                    "update-error-contract",
                    response_violations(complete + " " + invented),
                )
        self.assertNotIn(
            "update-error-contract",
            response_violations(
                complete + " AllocatorFull is not an EPhysicsUpdateError bit."
            ),
        )
        self.assertNotIn(
            "update-error-contract",
            response_violations(
                complete
                + " EPhysicsUpdateError flags are separate from allocator and job faults."
            ),
        )

    def test_remove_body_retains_identity_but_requires_pre_removal_state_capture(self):
        state_contract = (
            "StateRecorder restore retains ordered structural remove/add history and external host state "
            "with matching IDs in recorded call order. RemoveBody retains the Body object and BodyID for "
            "a later AddBody; mark the host mapping removed/inactive and retain that ID. If the Body is "
            "active, RemoveBody deactivates it, zeroes linear and angular velocity, and removes it from the "
            "broad phase. It does not preserve full state, activation, contacts/cache, or broad-phase "
            "membership. PhysicsSystem::SaveState includes only in-broad-phase bodies, so removed bodies "
            "are excluded. Before RemoveBody, rollback calls PhysicsSystem::SaveBodyState or makes an "
            "equivalent complete host-owned capture; restore structure and the same ID, re-add the Body, "
            "then call RestoreBodyState. Only DestroyBody or world teardown invalidates the mapping. "
            "Rollback records ordered RemoveBody/AddBody events while preserving the same BodyID."
        )
        self.assertNotIn("remove-body-preservation", response_violations(state_contract))
        for removed in (
            state_contract.replace("RemoveBody", "Removal", 1),
            state_contract.replace("retains the Body object and BodyID", "updates the body record"),
            state_contract.replace("removed/inactive", "unavailable"),
            state_contract.replace("a later AddBody", "a future restore")
            .replace("re-add the Body", "restore the Body")
            .replace("RemoveBody/AddBody events", "removal events"),
            state_contract.replace("deactivates it, zeroes linear and angular velocity", "updates its motion"),
            state_contract.replace("removes it from the broad phase", "removes it from simulation"),
            state_contract.replace("includes only in-broad-phase bodies", "records simulation bodies"),
            state_contract.replace("removed bodies are excluded", "removed bodies are handled"),
            state_contract.replace("Before RemoveBody", "For removal"),
            state_contract.replace(
                "rollback calls PhysicsSystem::SaveBodyState or makes an equivalent complete host-owned capture",
                "rollback records a snapshot",
            ),
            state_contract.replace("then call RestoreBodyState", "then restore it"),
            state_contract.replace("Only DestroyBody or world teardown", "Lifecycle changes"),
            state_contract.replace("ordered RemoveBody/AddBody events", "lifecycle events"),
        ):
            with self.subTest(remove_contract_removed=removed):
                self.assertIn("remove-body-preservation", response_violations(removed))

        contradictions = (
            "Invalidate the host mapping when RemoveBody runs.",
            "RemoveBody preserves the body's velocity and complete state.",
            "Linear and angular velocity are preserved by RemoveBody.",
            "RemoveBody not only retains the BodyID but also preserves full simulation state.",
            "RemoveBody 会保留速度和完整状态。",
            "Removed bodies are included in PhysicsSystem::SaveState.",
            "PhysicsSystem::SaveState includes bodies after RemoveBody.",
            "PhysicsSystem::SaveState not only saves added bodies but also includes removed bodies.",
            "已移除对象仍包含在 PhysicsSystem::SaveState 中。",
        )
        for contradiction in contradictions:
            with self.subTest(late_contradiction=contradiction):
                self.assertIn(
                    "remove-body-preservation",
                    response_violations(state_contract + " " + contradiction),
                )

        safe_controls = (
            "DestroyBody invalidates the mapping after removal.",
            "Do not invalidate the host mapping on removal.",
            "RemoveBody does not preserve velocity or complete simulation state.",
            "Removed bodies are not included in PhysicsSystem::SaveState.",
            "RemoveBody 不会保留速度或完整状态。",
            "已移除对象不会包含在 PhysicsSystem::SaveState 中。",
        )
        for control in safe_controls:
            with self.subTest(safe_control=control):
                self.assertNotIn(
                    "remove-body-preservation",
                    response_violations(state_contract + " " + control),
                )

    def test_attempt4_wording_variants_are_semantic_and_deletion_protected(self):
        update_contract = (
            "Pinned Jolt v5.6.0 at e77f175595e64cb44218cc9d9d56fc365ad0e36a. "
            "PhysicsSystem::Update uses collisionSteps, TempAllocator, and JobSystem. Inspect all nonzero "
            "v5.6 EPhysicsUpdateError bits: ManifoldCacheFull and ContactConstraintsFull mean contacts were "
            "ignored, so review inMaxContactConstraints; BodyPairCacheFull means body contacts were ignored, "
            "so review inMaxBodyPairs. Temporary-allocator exhaustion and job-system failures are separate "
            "channels, not update-error bits."
        )
        self.assertNotIn("update-error-contract", response_violations(update_contract))
        for removed in (
            update_contract.replace("all nonzero", "selected"),
            update_contract.replace("ContactConstraintsFull", "constraint pressure"),
            update_contract.replace(
                "are separate channels, not update-error bits",
                "use the same returned update-error bits",
            ),
        ):
            with self.subTest(update_variant_removed=removed):
                self.assertIn("update-error-contract", response_violations(removed))
        self.assertIn(
            "update-error-contract",
            response_violations(
                update_contract + " EPhysicsUpdateError::AllocatorFull is a fourth bit."
            ),
        )

        remove_contract = (
            "StateRecorder restore reproduces host structure and external gameplay state with matching IDs "
            "in recorded call order. RemoveBody retains the Body object and the same BodyID for a later "
            "AddBody, but active removal deactivates it, zeroes linear/angular velocity, and removes it from "
            "the broad phase; it does not preserve full state, activation, contacts/cache, or broad-phase "
            "membership. Maintain a world-scoped mapping with active/removed state, keep the mapping "
            "inactive while removed, and retain the same BodyID. PhysicsSystem::SaveState contains "
            "only in-broad-phase bodies and excludes removed bodies. Before RemoveBody use SaveBodyState; "
            "restore structure and ID, re-add, then use RestoreBodyState. Only DestroyBody or world teardown "
            "invalidates the mapping. Rollback records ordered RemoveBody/AddBody events and preserves "
            "the same BodyID."
        )
        self.assertNotIn("remove-body-preservation", response_violations(remove_contract))
        for removed in (
            remove_contract.replace("the Body object and the same BodyID", "the body record"),
            remove_contract.replace("active/removed state", "lifecycle state"),
            remove_contract.replace(
                "keep the mapping inactive while removed, and retain the same BodyID",
                "update the mapping while removed",
            ),
            remove_contract.replace("zeroes linear/angular velocity", "updates motion"),
            remove_contract.replace("excludes removed bodies", "handles removed bodies"),
            remove_contract.replace("Before RemoveBody use SaveBodyState", "Capture rollback state"),
            remove_contract.replace("then use RestoreBodyState", "then restore"),
            remove_contract.replace("Only DestroyBody or world teardown", "Lifecycle changes"),
            remove_contract.replace("ordered RemoveBody/AddBody events", "lifecycle events"),
        ):
            with self.subTest(remove_variant_removed=removed):
                self.assertIn("remove-body-preservation", response_violations(removed))
        self.assertIn(
            "remove-body-preservation",
            response_violations(
                remove_contract + " Invalidate the mapping when RemoveBody runs."
            ),
        )

        determinism_contract = (
            "Use JPH_CROSS_PLATFORM_DETERMINISTIC with pinned source and matching defines, SIMD/FP policy, "
            "and structural call order. Replay across every supported Windows/Linux compiler and build role; "
            "normalize broad-phase and active-body results and record per-tick Hash values plus the first "
            "divergent tick. For BroadPhaseQuery use CollisionCollector AddHit to repeat against "
            "Body::GetWorldSpaceBounds, reject false overlaps, retain actual-bounds-filtered results, and "
            "stable sort by host identity. Use /fp:precise or -ffp-model=precise, -ffp-contract=off, nearest "
            "rounding, DAZ/FTZ, Jolt Sin/Cos, QuickSort, BinaryHeapPush, and BinaryHeapPop."
        )
        self.assertNotIn("determinism-harness", response_violations(determinism_contract))
        for removed in (
            determinism_contract.replace("every supported Windows/Linux", "target"),
            determinism_contract.replace("actual-bounds-filtered", "accepted"),
            determinism_contract.replace("Body::GetWorldSpaceBounds", "broad-phase bounds"),
        ):
            with self.subTest(determinism_variant_removed=removed):
                self.assertIn("determinism-harness", response_violations(removed))
        self.assertIn(
            "determinism-harness",
            response_violations(
                determinism_contract
                + " Sorting BroadPhaseQuery hits alone guarantees deterministic membership."
            ),
        )

        module_contract = (
            "CharacterVirtual uses CharacterContactListener; ordinary queries and rigid bodies do not "
            "automatically see it, so an optional inner-body representation may be used. VehicleConstraint "
            "retains VehicleCollisionTester and uses AddConstraint plus AddStepListener; RemoveStepListener "
            "and RemoveConstraint run before destruction. Immutable shared SoftBodySharedSettings feeds "
            "SoftBodyCreationSettings and CreateAndAddSoftBody; use IsSoftBody, SoftBodyMotionProperties, "
            "and SoftBodyContactListener. Soft bodies are WIP: no simulated soft-soft response, no ordinary "
            "constraints, and regular-body APIs may not apply."
        )
        self.assertNotIn("module-lifetimes", response_violations(module_contract))
        self.assertIn(
            "module-lifetimes",
            response_violations(
                module_contract.replace("optional inner-body representation", "host representation")
            ),
        )
        self.assertIn(
            "wip-production-guarantee",
            response_violations(module_contract + " Soft bodies are production-ready."),
        )

        ladder_contract = (
            "Run pinned HelloWorld, upstream UnitTests, official Samples, determinism and StateRecorder "
            "save/restore checks, rollback host fault injection with world capacities and contact errors, "
            "then PerformanceTest and host profiling with p50/p95/p99 evidence."
        )
        self.assertNotIn("upstream-validation-ladder", response_violations(ladder_contract))
        self.assertIn(
            "upstream-validation-ladder",
            response_violations(ladder_contract.replace("world capacities", "world budgets")),
        )
        self.assertIn(
            "helloworld-only",
            response_violations(ladder_contract + " HelloWorld alone is enough to ship."),
        )

    def test_module_contract_is_local_and_deletion_protected(self):
        module_contract = (
            "CharacterVirtual uses explicit Update and CharacterContactListener; ordinary queries and rigid bodies "
            "do not automatically see it; an inner body is optional. "
            "VehicleConstraint uses VehicleCollisionTester, AddConstraint, and AddStepListener; RemoveStepListener "
            "and RemoveConstraint run before destruction. SoftBodySharedSettings is immutable shared lifetime data; "
            "SoftBodyCreationSettings goes through CreateAndAddSoftBody; use IsSoftBody, SoftBodyMotionProperties, "
            "and SoftBodyContactListener. WIP limits: no simulated soft-soft response, no ordinary constraints, and "
            "relevant regular Body APIs may not apply."
        )
        self.assertNotIn("module-lifetimes", response_violations(module_contract))
        for removed in (
            module_contract.replace("CharacterContactListener", "a callback"),
            module_contract.replace("ordinary queries and rigid bodies do not automatically see it", "it is visible"),
            module_contract.replace("an inner body is optional", "it has a representation"),
            module_contract.replace("AddStepListener", "register it"),
            module_contract.replace("RemoveStepListener", "unregister it"),
            module_contract.replace("SoftBodySharedSettings is immutable shared lifetime data", "Soft body data is retained"),
            module_contract.replace("CreateAndAddSoftBody", "create it"),
            module_contract.replace("IsSoftBody, SoftBodyMotionProperties", "type-specific access"),
            module_contract.replace("SoftBodyContactListener", "a listener"),
            module_contract.replace(
                "WIP limits: no simulated soft-soft response, no ordinary constraints, and relevant regular Body APIs may not apply",
                "WIP limits apply",
            ),
        ):
            with self.subTest(module_removed=removed):
                self.assertIn("module-lifetimes", response_violations(removed))

        spelling_variant = (
            "CharacterVirtual uses CharacterContactListener; normal rigid-body queries and rigid bodies do not "
            "automatically see it; an inner body is optional. VehicleConstraint uses VehicleCollisionTester, "
            "AddConstraint, and AddStepListener; RemoveStepListener and RemoveConstraint run before destroying it. "
            "SoftBodySharedSettings is immutable shared data; SoftBodyCreationSettings uses CreateAndAddSoftBody; "
            "check IsSoftBody, use SoftBodyMotionProperties, and route SoftBodyContactListener. WIP: there is no "
            "simulated soft-soft response. Do not assume regular rigid-body or constraint behavior applies."
        )
        self.assertNotIn("module-lifetimes", response_violations(spelling_variant))
        for removed in (
            spelling_variant.replace("normal rigid-body queries", "visibility checks"),
            spelling_variant.replace("constraint behavior", "interactions"),
            spelling_variant.replace("regular rigid-body", "generic body"),
            spelling_variant.replace(
                "Do not assume regular rigid-body or constraint behavior applies.",
                "Module limits apply.",
            ),
        ):
            with self.subTest(module_variant_removed=removed):
                self.assertIn("module-lifetimes", response_violations(removed))

    def test_unsafe_directions_are_semantic_and_clause_local(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        unsafe = {
            "jolt-owned-jobs": (
                "Jolt creates whatever worker threads it needs.",
                "Worker threads were owned by Jolt.",
                "不仅让 Jolt 创建工作线程，还让它管理任务系统。",
            ),
            "collapsed-layer-policy": (
                "Use one object layer and make every pair collide.",
                "所有对象使用一个层，并让每对对象碰撞。",
            ),
            "durable-bodyid": (
                "Serialize raw BodyID values for rollback.",
                "Raw BodyID was serialized as the permanent network ID.",
                "永久保留 BodyID，并序列化原始 BodyID。",
            ),
            "variable-render-update": (
                "Call PhysicsSystem::Update with variable render delta from the render loop.",
                "在可变渲染帧中调用 PhysicsSystem::Update。",
            ),
            "seed-determinism": (
                "The same seed guarantees cross-platform deterministic replay.",
                "相同种子保证 Windows/Linux 跨平台确定回放。",
            ),
            "helloworld-only": (
                "HelloWorld alone is enough to ship.",
                "HelloWorld 通过就足够发布。",
            ),
            "sample-default": ("Use the sample 10 MiB allocator as the production default.",),
            "legacy-integration-substeps": ("Increase integration substeps for current v5.6.0.",),
            "cross-version-binary": ("Binary saved state is durable across all versions.",),
            "wip-production-guarantee": ("Soft bodies and GPU hair are production-ready.",),
        }
        for expected, probes in unsafe.items():
            for probe in probes:
                with self.subTest(expected=expected, probe=probe):
                    self.assertIn(expected, response_violations(baseline + "\n" + probe))

    def test_explicit_denials_are_safe_but_not_only_is_affirmative(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        safe_denials = {
            "jolt-owned-jobs": (
                "Jolt does not own the worker threads.",
                "Jolt no longer creates the worker pool.",
                "不再让 Jolt 创建工作线程。",
            ),
            "durable-bodyid": (
                "Do not serialize raw BodyID values.",
                "Raw BodyID was not serialized as network identity.",
            ),
            "seed-determinism": ("The same seed does not guarantee cross-platform deterministic replay.",),
            "helloworld-only": ("HelloWorld alone is not enough to ship.",),
            "cross-version-binary": ("Binary saved state is not durable across versions.",),
            "wip-production-guarantee": ("Soft bodies are not guaranteed production-ready.",),
        }
        for label, denials in safe_denials.items():
            for denial in denials:
                with self.subTest(label=label, denial=denial):
                    self.assertNotIn(label, response_violations(baseline + "\n" + denial))
        for affirmative in (
            "Not only does Jolt create worker threads, it owns the pool.",
            "Raw BodyID is not merely serialized; it is the permanent network ID.",
            "不仅让 Jolt 创建工作线程，还让所有任务由它管理。",
        ):
            with self.subTest(affirmative=affirmative):
                self.assertTrue(
                    {"jolt-owned-jobs", "durable-bodyid"} & response_violations(baseline + "\n" + affirmative)
                )

    def test_entry_reference_and_routes_are_bounded_semantic_contracts(self):
        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertLessEqual(len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", skill)), 500)
        self.assertLessEqual(len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", reference)), 2200)
        self.assertTrue(skill.isascii())
        self.assertIn("description: \"Use when", skill)
        self.assertIn("references/jolt.md", skill)
        self.assertIn("v5.6.0", skill)
        self.assertIn("e77f175595e64cb44218cc9d9d56fc365ad0e36a", skill)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, skill)
        compact = normalized(reference)
        required_groups = (
            ("registerdefaultallocator", "factory::sinstance", "registertypes", "unregistertypes"),
            ("objectlayerpairfilter", "broadphaselayer", "objectvsbroadphaselayerfilter", "symmetric"),
            ("createbody", "addbody", "removebody", "destroybody", "bodyid"),
            ("removebody", "bodyid", "inactive", "addbody", "destroybody", "invalidate"),
            ("active", "deactivat", "linear", "angular", "zero", "broad phase"),
            ("savestate", "in-broad-phase", "savebodystate", "restorebodystate"),
            ("bodylockmulti", "lock can fail", "no-lock"),
            (
                "physicssystem::update", "collisionsteps", "ephysicsupdateerror", "fixed-step",
                "manifoldcachefull", "bodypaircachefull", "contactconstraintsfull",
            ),
            ("staterecorder", "matching bodyids", "call order", "structural"),
            (
                "jph_cross_platform_deterministic", "collisioncollector", "addhit",
                "getworldspacebounds", "active-body", "quicksort", "binaryheappush",
                "binaryheappop", "hash",
            ),
            ("charactervirtual", "vehicleconstraint", "softbodycreationsettings", "wip"),
            ("vehicleconstraint", "mcontroller", "getcontroller", "borrowed", "non-owning", "destructor", "delete"),
            ("helloworld", "unittests", "samples", "performancetest", "p50", "p95", "p99"),
        )
        for group in required_groups:
            with self.subTest(group=group):
                self.assertTrue(all(term in compact for term in group), group)

    def test_source_audit_is_pinned_official_and_retains_limitations(self):
        text = AUDIT.read_text(encoding="utf-8")
        compact = normalized(text)
        self.assertIn("read on 2026-08-28", compact)
        self.assertIn("v5.6.0", compact)
        self.assertIn("e77f175595e64cb44218cc9d9d56fc365ad0e36a", compact)
        for field in ("claim", "authority", "version", "scope", "limitation"):
            self.assertIn(field, compact)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertEqual(set(links), set(PINNED_URLS))
        for link in links:
            with self.subTest(link=link):
                self.assertIn(urlparse(link).hostname, {"github.com", "jrouwe.github.io"})
        for boundary in (
            "friction", "integration substeps", "charactervirtual", "physicssteplistener",
            "cross-version", "soft bodies", "gpu hair", "wip",
        ):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, compact)

        rows = {
            line.split("|", 2)[1].strip(): normalized(line)
            for line in text.splitlines()
            if line.startswith("| [")
        }
        release_row = next(row for key, row in rows.items() if "v5.6.0 release" in key)
        architecture_row = next(row for key, row in rows.items() if "Architecture" in key)
        api_changes_row = next(row for key, row in rows.items() if "API changes" in key)
        body_interface_row = next(row for key, row in rows.items() if "BodyInterface.cpp" in key)
        body_manager_row = next(row for key, row in rows.items() if "BodyManager.cpp" in key)
        physics_system_header_row = next(row for key, row in rows.items() if "PhysicsSystem.h" in key)
        physics_system_implementation_row = next(row for key, row in rows.items() if "PhysicsSystem.cpp" in key)
        update_error_row = next(row for key, row in rows.items() if "EPhysicsUpdateError.h" in key)
        vehicle_header_row = next(row for key, row in rows.items() if "VehicleConstraint.h" in key)
        vehicle_implementation_row = next(row for key, row in rows.items() if "VehicleConstraint.cpp" in key)
        self.assertTrue(all(term in release_row for term in ("gpu hair", "wip")))
        self.assertTrue(all(term in architecture_row for term in (
            "soft bodies", "wip", "collisioncollector", "getworldspacebounds",
            "removebody", "addbody", "-ffp-model=precise",
        )))
        self.assertNotIn("gpu hair", api_changes_row)
        self.assertNotIn("wip", api_changes_row)
        self.assertTrue(all(term in body_interface_row for term in (
            "removebody", "active", "deactivatebodies", "broad phase",
        )))
        self.assertTrue(all(term in body_manager_row for term in (
            "linear", "angular", "zero", "in-broad-phase", "savebodystate", "restorebodystate",
        )))
        self.assertTrue(all(term in physics_system_header_row for term in (
            "savestate", "savebodystate", "restorebodystate",
        )))
        self.assertTrue(all(term in physics_system_implementation_row for term in (
            "bodymanager", "savestate", "savebodystate", "restorebodystate",
        )))
        self.assertTrue(all(term in update_error_row for term in (
            "manifoldcachefull", "bodypaircachefull", "contactconstraintsfull",
            "temporary allocator", "job", "not",
        )))
        self.assertTrue(all(term in vehicle_header_row for term in (
            "getcontroller", "mcontroller", "pointer",
        )))
        self.assertTrue(all(term in vehicle_implementation_row for term in (
            "construct", "destructor", "delete", "mcontroller", "owns",
        )))

    def test_reference_teaches_v56_module_visibility_registration_and_wip_limits(self):
        compact = normalized(REFERENCE.read_text(encoding="utf-8"))
        character_groups = (
            ("charactervirtual", "charactercontactlistener"),
            ("ordinary queries", "rigid bodies", "automatically"),
            ("optional", "inner body"),
        )
        vehicle_groups = (
            ("vehicleconstraint", "vehiclecollisiontester"),
            ("addconstraint", "addsteplistener"),
            ("removesteplistener", "removeconstraint", "before", "destruction"),
            ("vehicleconstraint", "owns", "mcontroller", "destructor", "deletes"),
            ("getcontroller", "borrowed", "non-owning", "must not", "separately delete"),
            ("host", "vehicleconstraint", "chassis", "vehiclecollisiontester", "listeners"),
        )
        soft_body_groups = (
            ("softbodysharedsettings", "immutable", "shared"),
            ("softbodycreationsettings", "createandaddsoftbody"),
            ("issoftbody", "softbodymotionproperties", "softbodycontactlistener"),
            ("wip", "soft-soft", "ordinary constraints", "regular body", "may not apply"),
        )
        for group in character_groups + vehicle_groups + soft_body_groups:
            with self.subTest(group=group):
                self.assertTrue(all(term in compact for term in group), group)

    def test_reference_teaches_update_pointer_signature_and_object_local_call(self):
        text = REFERENCE.read_text(encoding="utf-8")
        compact = normalized(text)
        self.assertIn("tempallocator*", compact)
        self.assertIn("jobsystem*", compact)
        self.assertRegex(text, r"Update\s*\([^)]*&temp_allocator\s*,\s*&job_system\s*\)")
        for term in (
            "declared types", "unique_ptr", ".get()", "visible base declaration",
            "bounded", "not full c++ type inference",
        ):
            with self.subTest(pointer_review_boundary=term):
                self.assertIn(term, compact)

    def test_reference_teaches_exact_update_errors_and_separate_fault_channels(self):
        compact = normalized(REFERENCE.read_text(encoding="utf-8"))
        for term in (
            "manifoldcachefull",
            "bodypaircachefull",
            "contactconstraintsfull",
            "inmaxcontactconstraints",
            "inmaxbodypairs",
            "some contacts",
            "temporary allocator",
            "job failure",
            "separate",
        ):
            with self.subTest(term=term):
                self.assertIn(term, compact)
        for invented in ("allocatorfull", "tempallocatorfull", "jobsystemfull"):
            with self.subTest(invented=invented):
                self.assertNotIn(invented, compact)

    def test_reference_teaches_remove_readd_and_deterministic_host_contract(self):
        compact = normalized(REFERENCE.read_text(encoding="utf-8"))
        groups = (
            ("removebody", "retains", "body object", "bodyid", "inactive", "addbody"),
            ("active", "deactivat", "linear", "angular", "zero", "broad phase"),
            ("does not preserve", "full state", "activation", "contacts", "cache", "broad-phase membership"),
            ("physicssystem::savestate", "only", "in-broad-phase", "excludes", "removed"),
            ("before", "removebody", "physicssystem::savebodystate"),
            ("restore structure", "same id", "re-add", "restorebodystate"),
            ("ordered", "remove/add", "host mapping"),
            ("destroybody", "world teardown", "invalidate"),
            ("collisioncollector", "addhit", "getworldspacebounds", "actual bounding box"),
            ("-ffp-model=precise", "/fp:precise", "-ffp-contract=off"),
            ("nearest", "daz", "ftz"),
            ("jolt sin/cos", "quicksort", "binaryheappush", "binaryheappop", "hash"),
        )
        for group in groups:
            with self.subTest(group=group):
                self.assertTrue(all(term in compact for term in group), group)

    def test_evaluation_is_valid_and_preserves_exact_attempt_history(self):
        raw = EVALUATION.read_bytes()
        self.assertEqual(raw[-1:], b"\n")
        data = json.loads(raw)
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "native-jolt-physics")
        self.assertEqual(data["scenario"].encode("utf-8"), SCENARIO.read_bytes())
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ENABLED.read_bytes())
        self.assertEqual(data["verdict"], "accept_with_limitations")
        self.assertEqual(
            response_violations(data["enabled"]["response"]),
            ADJUDICATED_RESIDUAL_LIMITATIONS,
        )
        enabled_observations = normalized(data["enabled"]["observations"])
        for term in (
            "adjudicated source correction", "five-round limit", "not a fresh attempt",
            "eight", "test-only", "heuristic", "accept_with_limitations",
        ):
            with self.subTest(enabled_observation=term):
                self.assertIn(term, enabled_observations)

        attempts = data["attempts"]
        self.assertEqual(
            [(attempt["name"], attempt["violations"], attempt["verdict"]) for attempt in attempts],
            [
                (
                    "attempt-1",
                    [
                        "determinism-harness",
                        "module-lifetimes",
                        "remove-body-preservation",
                        "update-error-contract",
                    ],
                    "fail",
                ),
                (
                    "attempt-2",
                    [
                        "determinism-harness",
                        "remove-body-preservation",
                        "update-error-contract",
                        "update-pointer-call",
                        "vehicle-controller-ownership",
                    ],
                    "fail",
                ),
                (
                    "attempt-3",
                    [
                        "determinism-harness",
                        "remove-body-preservation",
                        "update-error-contract",
                        "vehicle-controller-ownership",
                    ],
                    "fail",
                ),
                (
                    "attempt-4",
                    ["remove-body-preservation", "vehicle-controller-ownership"],
                    "fail",
                ),
                (
                    "attempt-5",
                    [
                        "collapsed-layer-policy",
                        "determinism-harness",
                        "durable-bodyid",
                        "jolt-owned-jobs",
                        "module-lifetimes",
                        "remove-body-preservation",
                        "seed-determinism",
                        "update-error-contract",
                        "vehicle-controller-ownership",
                    ],
                    "fail",
                ),
            ],
        )
        self.assertEqual(attempts[0]["response"].encode("utf-8"), ATTEMPT1.read_bytes())
        self.assertEqual(attempts[1]["response"].encode("utf-8"), ATTEMPT2.read_bytes())
        self.assertEqual(attempts[2]["response"].encode("utf-8"), ATTEMPT3.read_bytes())
        self.assertEqual(attempts[3]["response"].encode("utf-8"), ATTEMPT4.read_bytes())
        self.assertEqual(attempts[4]["response"].encode("utf-8"), ATTEMPT5.read_bytes())
        attempt5_observations = normalized(attempts[4]["observations"])
        for term in (
            "adjudicator", "reject", "eight", "oracle", "test-only",
            "remove-body-preservation", "real content defect",
        ):
            with self.subTest(attempt5_observation=term):
                self.assertIn(term, attempt5_observations)
        evidence = " ".join(data["evidence"])
        for _, digest in FIXTURE_DIGESTS.values():
            self.assertIn(digest, evidence)

    def test_artifacts_are_tracked_and_focused_tests_pass_from_staged_archive(self):
        paths = (
            SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE,
            ATTEMPT1, ATTEMPT2, ATTEMPT3, ATTEMPT4, ATTEMPT5, ENABLED,
        )
        relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
        if not (ROOT / ".git").exists():
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((ROOT / relative).is_file())
            return

        for relative in relative_paths:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(tracked.returncode, 0, tracked.stderr)

        tree = subprocess.run(
            ["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task20.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(
                ["git", "archive", "--format=tar", "--output", str(archive), tree],
                cwd=ROOT, check=True,
            )
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((extract / relative).is_file())
            if response_violations(ENABLED.read_text(encoding="utf-8")):
                archive_test = (
                    "import sys, unittest; "
                    "from tests.test_native_jolt_physics_skill import "
                    "NativeJoltPhysicsSkillTests as C; "
                    "excluded = {"
                    "'test_final_adjudicated_correction_clears_only_the_real_blocker', "
                    "'test_evaluation_is_valid_and_preserves_exact_attempt_history'}; "
                    "suite = unittest.TestSuite("
                    "test for test in unittest.defaultTestLoader.loadTestsFromTestCase(C) "
                    "if test._testMethodName not in excluded); "
                    "result = unittest.TextTestRunner(verbosity=2).run(suite); "
                    "sys.exit(not result.wasSuccessful())"
                )
                command = [sys.executable, "-c", archive_test]
            else:
                command = [
                    sys.executable, "-m", "unittest",
                    "tests.test_native_jolt_physics_skill",
                ]
            subprocess.run(command, cwd=extract, check=True)

    def test_ui_supports_explicit_and_implicit_invocation(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$native-jolt-physics", text)
        self.assertIn("allow_implicit_invocation: true", text)


if __name__ == "__main__":
    unittest.main()
