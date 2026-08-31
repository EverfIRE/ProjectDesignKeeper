"""Behavioral and portability contracts for reviewing simulation papers."""

import hashlib
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "reviewing-simulation-papers" / "SKILL.md"
CONTRACT = SKILL.parent / "references" / "paper-review-contract.md"
AUDIT = SKILL.parent / "references" / "source-audit.md"
UI = SKILL.parent / "agents" / "openai.yaml"
SCENARIO = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-enabled-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-enabled-attempt-1-response.txt"
ATTEMPT2 = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-enabled-attempt-2-response.txt"
ATTEMPT3 = ROOT / "tests" / "fixtures" / "reviewing-simulation-papers-enabled-attempt-3-response.txt"
EVALUATION = ROOT / "evaluations" / "reviewing-simulation-papers" / "evaluation.json"
SCHEMA = ROOT / "schemas" / "paper-record.schema.json"
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
import validate_research_artifact  # noqa: E402


FIXTURE_DIGESTS = {
    SCENARIO: (2627, "63e76400b3b4be2457487e29a31c128358ae7d2a21772c53d280c246b7b7ada0"),
    BASELINE: (18436, "f4cdf97579c0302fe0b83bffa2b7d8c756c98c7a2f55d922cf56c21e80c9e789"),
    ENABLED: (24398, "b34e723cb2de53ca97f1d61772cc1e8c97106cb641f64b0d2a91df00496a3fb8"),
    ATTEMPT1: (26413, "a7c39b112e07051f04a43c29f21121bf018b99f86fe94b631861c587d75b6b50"),
    ATTEMPT2: (22958, "45280617cecd4ce00ccac6716bdba03ffc1cc188d640af1bf6ec16124bd53549"),
    ATTEMPT3: (24398, "b34e723cb2de53ca97f1d61772cc1e8c97106cb641f64b0d2a91df00496a3fb8"),
}

REQUIRED_HEADINGS = (
    "Verdict",
    "Core idea",
    "Source manifest",
    "Claim–evidence matrix",
    "Equations and assumptions",
    "Evaluation audit",
    "Artifact status",
    "Limits and contradictions",
    "Confidence",
    "Minimal reproduction target",
    "Unknowns",
    "JSON adapter",
)

ALL_GAPS = {
    "ordered-output",
    "portable-anchors",
    "stable-epistemics",
    "claim-matrix",
    "equation-audit",
    "evaluation-fairness",
    "artifact-boundaries",
    "source-version-scope",
    "reproduction-integrity",
}

ATTEMPT1_VIOLATIONS = {
    "claim-matrix",
    "ordered-output",
    "portable-anchors",
    "stable-epistemics",
    "equation-audit",
    "evaluation-fairness",
    "source-version-scope",
    "reproduction-integrity",
}

ATTEMPT2_VIOLATIONS = {
    "equation-audit",
    "evaluation-fairness",
    "reproduction-integrity",
    "stable-epistemics",
}

ATTEMPT3_VIOLATIONS = set()

EPISTEMIC_MAPPING_SENTENCE = (
    "Epistemic mapping: AUTHOR_CLAIM maps to FACT about what authors report. "
    "DIRECT_OBSERVATION maps to FACT only for a source actually read, an artifact "
    "statically inspected, or code independently executed; it is not independent validation."
)
REVIEW_POLICY_SENTENCE = (
    "Review policy: required audit dimensions are target type, time step, substeps, "
    "iterations, collision cadence, line searches, work budget, pipeline inclusions, "
    "hardware/software/precision, baseline provenance, scene coverage, metrics, variability, "
    "ablations, and stress/failure cases."
)
REAL_TIME_TUPLE_SENTENCE = (
    "The real-time tuple is scene complexity, target Hz, end-to-end frame time, hardware, "
    "precision, and pipeline inclusions."
)

ATTEMPT1_ALLOWED_INPUTS = [
    "tests/fixtures/reviewing-simulation-papers-scenario.txt",
    "skills/reviewing-simulation-papers/SKILL.md",
    "skills/reviewing-simulation-papers/references/paper-review-contract.md",
    "skills/reviewing-simulation-papers/references/source-audit.md",
    "skills/reviewing-simulation-papers/agents/openai.yaml",
    "schemas/paper-record.schema.json",
    "https://jiajunwu.com/papers/chainqueen_icra.pdf",
    "https://cdfg.mit.edu/assets/files/chain_queen_0.pdf",
    "https://www.andrewspielberg.com/chainqueen-a-real-time-differentiable-physical-simulator-for-soft-robotics",
    "https://github.com/yuanming-hu/ChainQueen",
]

PRIMARY_SOURCE_URLS = ATTEMPT1_ALLOWED_INPUTS[-4:]

ATTEMPT1_FORBIDDEN_INPUTS = [
    "baseline response",
    "tests",
    "evaluation",
    "Git metadata or history",
    "plans",
    "conversation",
]

ANCHOR_RE = re.compile(
    r"\[S:(?P<source>[A-Za-z0-9_-]+)@(?P<revision>[^#\]]+)#(?P<locator>[^\]]+)\]"
)
LABEL_RE = re.compile(
    r"\[(?:FACT:F\d{3}|INFERENCE:I\d{3} from=F\d{3}(?:,F\d{3})*|UNKNOWN:U\d{3}|CONTRADICTION:C\d{3})\]"
)
LABEL_LIKE_RE = re.compile(
    r"\[(?:FACT|INFERENCE|UNKNOWN|CONTRADICTION)(?:(?::|\s)[^\]]*)?\]"
)
CLAIM_HEADERS = (
    "normalized claim", "source wording anchor", "scope/qualifiers", "evidence type",
    "evidence anchors", "relation", "coverage", "confidence",
    "linked contradiction/unknown ids",
)
EQUATION_HEADERS = (
    "purpose", "symbols/dimensions/units/domains", "dependencies", "status",
    "derivation check", "implementation mapping", "numerical hazards", "claim impact",
)
ARTIFACT_FIELDS = {
    "artifact_presence", "author_authenticity", "paper_revision_identified",
    "immutable_archive", "license_clarity", "pinned_dependencies", "build_instructions",
    "smoke_test_status", "complete_paper_inputs", "complete_baselines", "raw_outputs",
    "figure/table_scripts", "independent_reproduction", "official_badges",
}
AUDIT_DIMENSIONS = (
    "target type", "time step", "substeps", "iterations", "collision cadence",
    "line searches", "work budget", "pipeline inclusions", "hardware/software/precision",
    "baseline provenance", "scene coverage", "metrics", "variability", "ablations",
    "stress/failure cases",
)


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("**", "").replace(chr(96), "")).casefold()


def semantic_word_count(text: str) -> int:
    return len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", text))


def section(text: str, heading: str) -> str:
    match = re.search(
        rf"^#{{1,6}}\s+(?:\d+\.\s*)?{re.escape(heading)}\s*$\n(?P<body>.*?)(?=^#{{1,6}}\s|\Z)",
        text,
        flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    return match.group("body") if match else ""


def replace_section(text: str, heading: str, body: str) -> str:
    pattern = (
        rf"(^#{{1,6}}\s+(?:\d+\.\s*)?{re.escape(heading)}\s*$\n)"
        rf".*?(?=^#{{1,6}}\s|\Z)"
    )
    return re.sub(pattern, rf"\1{body.rstrip()}\n\n", text, flags=re.IGNORECASE | re.MULTILINE | re.DOTALL)


def headings_are_ordered(text: str) -> bool:
    return re.findall(r"^# ([^\r\n]+)$", text, flags=re.MULTILINE) == list(REQUIRED_HEADINGS)


def has_terms(text: str, *groups: tuple[str, ...]) -> bool:
    compact = normalized(text)
    return all(any(normalized(term) in compact for term in alternatives) for alternatives in groups)


def markdown_table(text: str) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith("|")]
    if len(lines) < 3:
        return (), []

    def cells(line: str) -> list[str]:
        return [cell.strip() for cell in line.strip().strip("|").split("|")]

    headers = tuple(normalized(cell) for cell in cells(lines[0]))
    separator = cells(lines[1])
    if len(separator) != len(headers) or not all(re.fullmatch(r":?-{3,}:?", cell) for cell in separator):
        return (), []
    records = []
    for line in lines[2:]:
        values = cells(line)
        if len(values) != len(headers):
            return (), []
        records.append(dict(zip(headers, values)))
    return headers, records


def epistemic_label_issues(text: str) -> list[str]:
    return [
        f"malformed epistemic label: {match.group(0)}"
        for match in LABEL_LIKE_RE.finditer(text)
        if not LABEL_RE.fullmatch(match.group(0))
    ]


def row_anchor_set(value: str) -> set[str]:
    return {match.group(0) for match in ANCHOR_RE.finditer(value)}


def claim_matrix_issues(text: str) -> list[str]:
    headers, rows = markdown_table(section(text, "Claim–evidence matrix"))
    if headers != CLAIM_HEADERS or len(rows) < 3:
        return ["claim matrix is not a structured table with at least three records"]
    issues = []
    allowed_types = {
        "theorem/proof", "derivation", "controlled quantitative experiment",
        "qualitative figure/video", "ablation", "stress/failure case",
        "artifact inspection", "independent reproduction",
    }
    allowed_relations = {"supports", "partially_supports", "limits", "refutes", "unverified"}
    for index, row in enumerate(rows, 1):
        claim = row["normalized claim"]
        label = LABEL_RE.match(claim)
        relation = normalized(row["relation"])
        evidence_type = normalized(row["evidence type"])
        source_anchors = row_anchor_set(row["source wording anchor"])
        evidence_anchors = row_anchor_set(row["evidence anchors"])
        if not label:
            issues.append(f"claim row {index} lacks a valid leading epistemic record")
            continue
        if evidence_type == "unknown" and not label.group(0).startswith("[UNKNOWN:"):
            issues.append(f"claim row {index} uses UNKNOWN evidence type for a non-UNKNOWN record")
        elif evidence_type != "unknown" and evidence_type not in allowed_types:
            issues.append(f"claim row {index} has invalid evidence type")
        if relation not in allowed_relations:
            issues.append(f"claim row {index} has invalid relation")
        if normalized(row["coverage"]) in {"", "all", "universal"}:
            issues.append(f"claim row {index} lacks bounded coverage")
        if normalized(row["confidence"]) not in {"low", "medium", "high"}:
            issues.append(f"claim row {index} has invalid confidence")
        linked_ids = row["linked contradiction/unknown ids"]
        if not re.fullmatch(r"(?:none|[CU]\d{3}(?:,\s*[CU]\d{3})*)", linked_ids.strip()):
            issues.append(f"claim row {index} has invalid linked IDs")
        if label.group(0).startswith("[UNKNOWN:"):
            unknown_id = re.search(r"U\d{3}", label.group(0)).group(0)
            if relation != "unverified" or source_anchors or evidence_anchors:
                issues.append(f"unknown claim row {index} must be explicitly unverified without fabricated anchors")
            if unknown_id not in linked_ids:
                issues.append(f"unknown claim row {index} is not self-linked")
        elif not source_anchors or source_anchors != evidence_anchors:
            issues.append(f"claim row {index} has missing, swapped, or fabricated evidence locators")
    return issues


def equation_table_issues(text: str) -> list[str]:
    headers, rows = markdown_table(section(text, "Equations and assumptions"))
    if headers != EQUATION_HEADERS or len(rows) < 3:
        return ["equation audit is not a structured table with at least three records"]
    issues = []
    categories = set()
    allowed_status = {"verified", "plausible", "gap", "mismatch", "not_checked"}
    category_names = (
        "exact mathematics", "numerical approximation", "optional safeguard",
        "heuristic", "evaluated code path",
    )
    for index, row in enumerate(rows, 1):
        raw_purpose = row["purpose"].strip()
        purpose = normalized(raw_purpose)
        leading_categories = [name for name in category_names if purpose.startswith(name)]
        if not leading_categories:
            issues.append(f"equation row {index} purpose does not begin with one literal category")
        else:
            categories.add(leading_categories[0])
        row_text = " | ".join(row.values())
        if not LABEL_RE.search(row_text):
            issues.append(f"equation row {index} lacks a local epistemic record")
        if normalized(row["status"]) not in allowed_status:
            issues.append(f"equation row {index} has invalid status")
        for field in EQUATION_HEADERS[1:]:
            if not row[field].strip():
                issues.append(f"equation row {index} has empty {field}")
        mapping = row["implementation mapping"]
        if "UNKNOWN" not in mapping and not ANCHOR_RE.search(mapping):
            issues.append(f"equation row {index} lacks anchored or unknown implementation mapping")
        if re.search(r"\[FACT:F\d{3}\]", row_text) and not ANCHOR_RE.search(row_text):
            issues.append(f"equation row {index} fact lacks a local anchor")
    missing = set(category_names) - categories
    if missing:
        issues.append(f"equation categories missing from records: {sorted(missing)}")
    return issues


def artifact_table_issues(text: str) -> list[str]:
    artifact_section = section(text, "Artifact status")
    if not artifact_section:
        artifact_section = section(text, "Artifacts / license / access status")
    headers, rows = markdown_table(artifact_section)
    if headers != ("field", "status", "evidence / next action"):
        return ["artifact audit is not the required structured table"]
    fields = [normalized(row["field"]) for row in rows]
    issues = []
    if len(rows) != 14 or set(fields) != ARTIFACT_FIELDS or len(set(fields)) != len(fields):
        issues.append("artifact audit does not contain fourteen independent fields")
    for index, row in enumerate(rows, 1):
        if not LABEL_RE.match(row["status"]):
            issues.append(f"artifact row {index} lacks a valid epistemic record")
        if not row["evidence / next action"].strip():
            issues.append(f"artifact row {index} lacks evidence or next action")
        if row["status"].startswith("[FACT:") and not ANCHOR_RE.search(" | ".join(row.values())):
            issues.append(f"artifact row {index} fact lacks a local anchor")
    return issues


def source_manifest_issues(text: str) -> list[str]:
    headers, rows = markdown_table(section(text, "Source manifest"))
    expected = (
        "source id", "role", "stable url", "revision / access", "access date",
        "inspection depth", "license / rights", "support boundary", "locator",
    )
    if headers != expected or len(rows) < 4:
        return ["source manifest is not a structured four-source table"]
    issues = []
    for index, row in enumerate(rows, 1):
        if not re.fullmatch(r"https://\S+", row["stable url"]):
            issues.append(f"manifest row {index} lacks one stable URL")
        for field in expected:
            if not row[field].strip():
                issues.append(f"manifest row {index} has empty {field}")
    return issues


def source_scope_issues(text: str) -> list[str]:
    manifest_headers, manifest_rows = markdown_table(section(text, "Source manifest"))
    if not manifest_headers:
        return ["source scope lacks a structured manifest"]
    source_ids = [normalized(row["source id"]) for row in manifest_rows]
    source_roles = (
        ("icra", "paper"),
        ("derivation", "author-pdf"),
        ("project",),
        ("repo",),
    )
    issues = []
    if any(
        not any(alias in source_id for source_id in source_ids for alias in alternatives)
        for alternatives in source_roles
    ):
        issues.append("source manifestations are not independently represented")

    claim = section(text, "Claim–evidence matrix")
    evaluation = section(text, "Evaluation audit")
    _, claim_rows = markdown_table(claim)
    timing_rows = []
    for row in claim_rows:
        row_text = " | ".join(row.values())
        row_compact = normalized(row_text)
        if ("table ii" in row_compact or "table=ii" in row_compact) and any(
            value in row_compact for value in ("1.594", "1.774", "10.501", "11.594")
        ):
            timing_rows.append(row)
    timing_text = "\n".join(" | ".join(row.values()) for row in timing_rows)
    timing_compact = normalized(timing_text)
    if not timing_rows or not all(
        value in timing_compact for value in ("1.594", "1.774", "10.501", "11.594")
    ):
        issues.append("structured Table II timing claim rows are incomplete")
    if not re.search(r"\b64(?:k|,?000)\b", timing_compact) or not re.search(
        r"\b512(?:k|,?000)\b", timing_compact
    ):
        issues.append("Table II workload sizes are missing from timing claim rows")
    for index, row in enumerate(timing_rows, 1):
        claim_cell = row["normalized claim"]
        claim_local = normalized(claim_cell)
        bounded_local = normalized(" | ".join((
            row["normalized claim"], row["scope/qualifiers"], row["coverage"],
        )))
        author_reported = (
            "author-reported" in claim_local
            or "authors report" in claim_local
            or "author_claim" in claim_local
            or "作者报告" in claim_cell
            or "作者称" in claim_cell
        )
        bounded_report = any(term in bounded_local for term in (
            "not independent", "non-independent", "paper workload only", "bounded",
            "does not establish", "does not include", "author report",
        )) or any(term in " | ".join((row["scope/qualifiers"], row["coverage"])) for term in (
            "不含", "不是", "不能", "未", "作者报告的", "仅",
        ))
        if not author_reported or not bounded_report:
            issues.append(f"Table II timing row {index} lacks local author-report scope")

    boundary_scope = "\n".join((
        section(text, "Source manifest"), section(text, "Artifact status"),
        section(text, "Limits and contradictions"), section(text, "Unknowns"),
    ))
    boundary_compact = normalized(boundary_scope)
    if not all(term in boundary_compact for term in ("full commit sha", "legacy", "license")):
        issues.append("repository revision, legacy, or license boundary is missing")
    if "flex" not in normalized(claim):
        issues.append("Flex comparison scope is missing from claim records")
    method_scope = "\n".join((claim, section(text, "Equations and assumptions"), section(text, "Limits and contradictions")))
    method_compact = normalized(method_scope)
    if not (
        "contact-gradient" in method_compact
        or "contact gradient" in method_compact
        or "friction projection" in method_compact
        or (("接触" in method_scope or "摩擦" in method_scope) and "梯度" in method_scope)
    ):
        issues.append("contact/friction gradient boundary is missing")
    evaluation_compact = normalized(evaluation)
    if not has_terms(
        evaluation_compact,
        ("table ii", "table=ii"), ("gtx 1080 ti", "gtx1080ti"),
        ("falling-cube", "falling cube"),
    ):
        issues.append("evaluation lacks a local Table II hardware/workload record")
    return issues


def fenced_json_issues(text: str) -> list[str]:
    blocks = re.findall(
        r"^```([^\r\n]*)\r?\n(.*?)^```[ \t]*$",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    json_blocks = [block for block in blocks if block[0].strip().casefold() == "json"]
    if len(json_blocks) != 1:
        return ["response must contain exactly one fenced JSON object"]
    adapter_section = section(text, "JSON adapter")
    if not re.fullmatch(r"\s*```json\s*\{.*\}\s*```\s*", adapter_section, flags=re.DOTALL):
        return ["the only fenced JSON object is not the complete JSON adapter section"]
    return []


def unknown_closure_issues(text: str) -> list[str]:
    headers, rows = markdown_table(section(text, "Unknowns"))
    if headers != ("unknown record", "sources checked", "verdict effect", "resolving action"):
        return ["unknowns are not a closure table"]
    all_ids = set(re.findall(r"\[UNKNOWN:(U\d{3})\]", text))
    row_ids = []
    issues = []
    for index, row in enumerate(rows, 1):
        match = re.fullmatch(r"\[UNKNOWN:(U\d{3})\]", row["unknown record"].strip())
        if not match:
            issues.append(f"unknown row {index} lacks one exact unknown record")
            continue
        row_ids.append(match.group(1))
        for field in ("sources checked", "verdict effect", "resolving action"):
            if not row[field].strip():
                issues.append(f"unknown row {index} has empty {field}")
    if set(row_ids) != all_ids or len(row_ids) != len(set(row_ids)):
        issues.append("decision-relevant unknown IDs are not closed exactly once")
    return issues


def evaluation_audit_issues(text: str) -> list[str]:
    audit = section(text, "Evaluation audit")
    lines = [line.strip() for line in audit.splitlines() if line.strip()]
    if len(lines) < 3 or lines[0] != REVIEW_POLICY_SENTENCE or lines[1] != REAL_TIME_TUPLE_SENTENCE:
        return ["Evaluation audit does not begin with the two exact policy sentences"]
    issues = []
    headers, rows = markdown_table(audit)
    if headers != ("audit dimension", "evidence-bounded audit"):
        return ["Evaluation audit table has invalid columns"]
    dimensions = [normalized(row["audit dimension"]) for row in rows]
    if tuple(dimensions) != AUDIT_DIMENSIONS:
        issues.append("Evaluation audit table must contain the fifteen exact ordered fields")
    for index, row in enumerate(rows, 1):
        if not row["evidence-bounded audit"].strip():
            issues.append(f"Evaluation audit row {index} has empty evidence")
    return issues


def minimal_target_issues(text: str) -> list[str]:
    target = section(text, "Minimal reproduction target")
    labels = (
        "figure/table/scene/metric", "publication revision", "artifact revision",
        "configuration", "measurement", "pass/fail criterion",
        "expected resources/runtime", "deviations/non-claims", "logs and hashes",
    )
    values = {}
    for line in target.splitlines():
        clean = line.replace("`", "").strip()
        for label in labels:
            match = re.fullmatch(rf"-\s*{re.escape(label)}:\s*(\S.*)", clean)
            if match:
                values.setdefault(label, []).append(match.group(1).strip())
    issues = []
    for label in labels:
        if len(values.get(label, [])) != 1 or len(values[label][0]) < 3:
            issues.append(f"minimal target field {label} is missing, duplicated, or empty")
    if issues:
        return issues
    approval = values["pass/fail criterion"][0]
    approval_ok = bool(re.search(
        r"\b(?:user|owner|responsible person|product owner) approval\b|(?:用户|负责人|作者).{0,10}批准",
        approval,
        flags=re.IGNORECASE,
    ))
    compact = normalized(target)
    if not approval_ok:
        issues.append("pass/fail criterion lacks local user/owner approval semantics")
    if not ("table ii" in compact or "table=ii" in compact):
        issues.append("minimal target is not bound to Table II")
    if not re.search(r"\b64(?:k|,?000)\b", compact):
        issues.append("minimal target lacks the 64k workload")
    if not all(value in compact for value in ("1.594", "1.774")):
        issues.append("minimal target lacks separate reported timings")
    if not (
        "does not validate" in compact
        or "not validate" in compact
        or "不验证" in target
        or "不能验证" in target
    ):
        issues.append("minimal target lacks a bounded non-validation statement")
    return issues


def stable_section_issues(text: str) -> list[str]:
    verdict = section(text, "Verdict")
    confidence = section(text, "Confidence")
    limits = section(text, "Limits and contradictions")
    verdict_confidence = verdict + "\n" + confidence
    compact_vc = normalized(verdict_confidence)
    compact_verdict = normalized(verdict)
    compact_limits = normalized(limits)
    issues = []
    if "confidence tier" not in compact_vc and "置信度" not in verdict_confidence:
        issues.append("Verdict/Confidence lacks a bounded confidence tier")
    if not (
        "strongest limiting reason" in compact_verdict
        or "最强限制理由" in verdict
        or re.search(r"决定性.{0,10}限制", verdict)
    ):
        issues.append("Verdict lacks its strongest limiting reason")
    english_boundary = has_terms(limits, ("stability",), ("convergence",), ("accuracy",))
    bilingual_boundary = (
        ("Δt" in limits or "delta t" in compact_limits or "稳定" in limits)
        and ("限制" in limits or "上限" in limits)
        and ("contact" in compact_limits or "friction" in compact_limits or "接触" in limits or "摩擦" in limits)
        and ("accuracy" in compact_limits or "精确" in limits or "光滑" in limits)
    )
    if not english_boundary and not bilingual_boundary:
        issues.append("Limits lacks a local stability/contact-accuracy boundary")
    return issues


def anchor_issues(text: str) -> list[str]:
    issues = []
    anchors = list(ANCHOR_RE.finditer(text))
    if len(anchors) < 8:
        issues.append("fewer than eight parseable anchors")
    for match in anchors:
        source = match.group("source").casefold()
        revision = match.group("revision")
        locator = match.group("locator")
        values = {
            key: value
            for part in locator.split(";")
            if "=" in part
            for key, value in (part.split("=", 1),)
        }
        keys = set(values)
        if revision.startswith("accessed:"):
            if "repo-code" in source or "code-repo" in source or "source-code" in source:
                issues.append("repository code source cannot use a mutable HTML revision")
            if not ({"fragment", "para"} <= keys):
                issues.append("mutable HTML anchor lacks fragment/paragraph")
            continue
        if revision.casefold() in {"main", "master", "head", "latest"}:
            issues.append(f"mutable revision: {revision}")
        if "repo" in source:
            if not re.fullmatch(r"[0-9a-f]{40}", revision):
                issues.append(f"repository revision is not a full SHA: {revision}")
            if not {"path", "lines"}.issubset(keys):
                issues.append("repository anchor lacks path/lines")
        elif "video" in source:
            if "time" not in keys:
                issues.append("video anchor lacks timestamp")
        elif not ({"page", "printed_page"} & keys):
            issues.append("paper anchor lacks page")
        page = values.get("page")
        if page is not None and not re.fullmatch(r"[1-9]\d*", page):
            issues.append(f"PDF page is not a one-based positive index: {page}")

        expected_page = None
        if revision.casefold() == "doi:10.1109/icra.2019.8794333":
            equation = values.get("eq", "")
            table = values.get("table", "").casefold()
            section_name = values.get("sec", "").casefold()
            paragraph = values.get("para", "")
            if equation == "1-6":
                expected_page = "2"
            elif equation == "7-10":
                expected_page = "3"
            elif table == "ii":
                expected_page = "3"
            elif table == "iii":
                expected_page = "4"
            elif section_name == "iv.a" and paragraph == "1":
                expected_page = "4"
            elif section_name == "vi" and paragraph == "2":
                expected_page = "6"
        elif (
            revision.casefold()
            == "sha256:25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d"
            and values.get("eq") == "102-116"
        ):
            expected_page = "12"
        if expected_page is not None and page != expected_page:
            issues.append(
                f"known ChainQueen locator is on page {expected_page}, not {page or 'UNKNOWN'}"
            )
    return issues


def affirmative_unsafe_claims(text: str) -> set[str]:
    compact = normalized(text)
    clauses = [item.strip() for item in re.split(r"[\n.!?;]+|\bbut\b|\bhowever\b", compact) if item.strip()]
    patterns = {
        "stable-epistemics": (
            r"(?:title|abstract).{0,60}(?:proves?|establish(?:es)?).{0,40}production[- ]ready",
            r"author[- ]reported.{0,60}(?:is|equals|therefore).{0,45}(?:independent|direct[_ ]observation)",
            r"qualitative (?:video|media).{0,45}proves?.{0,30}(?:numeric|universal)",
            r"stability.{0,25}(?:is|equals).{0,25}(?:convergence|accuracy)",
            r"stable trajectories.{0,45}(?:establish|prove).{0,35}(?:physical )?accuracy",
        ),
        "artifact-boundaries": (
            r"public (?:github )?(?:repo|repository).{0,40}(?:licensed|open source|reproducible)",
            r"(?:github )?(?:repo|repository).{0,35}public.{0,80}(?:licensed|open source|reproducible)",
        ),
        "portable-anchors": (
            r"(?:branch )?(?:main|master).{0,35}(?:exact|immutable).{0,20}revision",
        ),
        "source-version-scope": (
            r"later repository.{0,45}(?:is|proves?).{0,35}(?:paper release|publication snapshot)",
        ),
    }
    violations = set()
    denial = re.compile(r"\b(?:do not|don't|never|cannot|can't|not)\b")
    for label, label_patterns in patterns.items():
        for clause in clauses:
            for pattern in label_patterns:
                for match in re.finditer(pattern, clause):
                    before = clause[max(0, match.start() - 100):match.start()]
                    if not denial.search(before) and not denial.search(match.group(0)):
                        violations.add(label)
    if re.search(
        r"author[- ]reported.{0,80}(?:equals|therefore|is).{0,45}direct[_ ]observation",
        compact,
    ):
        violations.add("stable-epistemics")
    if re.search(r"(?:至少\s*30|30\s+(?:independent\s+)?runs?).{0,100}(?:1[,，]?000|1000)\s*frames", compact):
        violations.add("reproduction-integrity")
    if re.search(r"require exactly.{0,160}(?:runs?|frames?|tolerance|acceptance gate)", compact):
        violations.add("reproduction-integrity")
    return violations


def response_violations(text: str) -> set[str]:
    violations = set()
    if not headings_are_ordered(text):
        violations.add("ordered-output")
    if anchor_issues(text):
        violations.add("portable-anchors")

    labels = {match.group(0) for match in LABEL_RE.finditer(text)}
    manifest = section(text, "Source manifest")
    legacy_mapping_sentence = (
        "Epistemic mapping: AUTHOR_CLAIM maps to FACT about what authors report. "
        "DIRECT_OBSERVATION maps to FACT only for a source actually read, an artifact "
        "statically inspected at a pinned revision, or code independently executed with "
        "retained logs; it is not independent validation."
    )
    mapping_ok = (
        EPISTEMIC_MAPPING_SENTENCE in manifest
        or legacy_mapping_sentence in manifest
    )
    compact = normalized(text)
    contradiction_handled = (
        any(label.startswith("[CONTRADICTION") for label in labels)
        or "no same-scope contradiction established" in compact
        or "没有同一 scope 的互斥来源主张" in compact
        or "未建立同一 scope 的互斥来源主张" in compact
    )
    verdict = section(text, "Verdict")
    limits = section(text, "Limits and contradictions")
    stable_issues = (
        epistemic_label_issues(text)
        or material_record_anchor_issues(text)
        or unknown_closure_issues(text)
        or stable_section_issues(text)
    )
    verdict_semantic_issue = False
    try:
        verdict_adapter = extract_adapter(text)
        if verdict_adapter.get("verdict") == "unsupported":
            verdict_compact = normalized(verdict)
            verdict_semantic_issue = (
                "insufficient-evidence" in verdict_compact
                or "no end-to-end" in verdict_compact
                or "[unknown:" in verdict_compact
                or (
                    "complete real-time tuple" in verdict_compact
                    and ("not given" in verdict_compact or "未给出" in verdict_compact)
                )
            )
    except (AssertionError, json.JSONDecodeError):
        pass
    if (
        len(labels) < 3
        or not all(any(label.startswith(f"[{prefix}") for label in labels) for prefix in ("FACT", "INFERENCE", "UNKNOWN"))
        or not contradiction_handled
        or not mapping_ok
        or stable_issues
        or not LABEL_RE.search(limits)
        or verdict_semantic_issue
    ):
        violations.add("stable-epistemics")

    if claim_matrix_issues(text):
        violations.add("claim-matrix")

    if equation_table_issues(text):
        violations.add("equation-audit")

    evaluation = section(text, "Evaluation audit")
    if evaluation_audit_issues(text):
        violations.add("evaluation-fairness")

    artifacts = section(text, "Artifact status")
    if artifact_table_issues(text):
        violations.add("artifact-boundaries")

    if source_manifest_issues(text) or source_scope_issues(text):
        violations.add("source-version-scope")

    if minimal_target_issues(text):
        violations.add("reproduction-integrity")

    try:
        adapter = extract_adapter(text)
        if fenced_json_issues(text):
            violations.add("reproduction-integrity")
        if validate_research_artifact.validate_document("paper-record", adapter):
            violations.add("reproduction-integrity")
        for claim in adapter.get("claims", []):
            if not all(ANCHOR_RE.fullmatch(anchor) for anchor in claim.get("evidence_anchors", [])):
                violations.add("portable-anchors")
    except (AssertionError, json.JSONDecodeError):
        violations.add("reproduction-integrity")

    violations.update(affirmative_unsafe_claims(text))
    return violations


def canonical_response() -> str:
    paper = "[S:paper@doi:10.1/example#page=1;sec=1]"
    table = "[S:paper@doi:10.1/example#page=2;sec=2;table=II]"
    repo = "[S:author-repo@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#path=README.md;lines=1-4]"
    project = "[S:project-page@accessed:2026-08-30#fragment=About;para=1]"
    adapter = {
        "schema_version": "1.0",
        "paper": {
            "title": "Bounded simulation paper",
            "authors": ["A. Author"],
            "year": 2024,
            "doi": "10.1/example",
        },
        "contribution_type": "A bounded simulation method",
        "claims": [
            {
                "claim": "Authors report separate forward and backward timings for a bounded workload.",
                "evidence_anchors": [table],
            },
            {
                "claim": "Stability does not establish convergence or physical accuracy.",
                "evidence_anchors": [paper],
            },
        ],
        "methods_assumptions": ["Exact mathematics and the evaluated numerical path have different guarantees."],
        "experimental_conditions": ["The reported workload uses a GTX 1080 Ti and a falling-cube scene."],
        "artifacts": {
            "repository_presence": "author repository URL supplied",
            "exact_revision": "unknown",
            "license": "unknown",
            "execution": "not executed",
        },
        "limitations": ["Complete pipeline timing, artifact identity, and independent validation remain unknown."],
        "real_time_applicability": "Insufficient evidence for the requested production workload.",
        "verdict": "insufficient-evidence",
        "confidence": 0.5,
    }
    ticks = chr(96) * 3
    audit_rows = []
    for dimension in AUDIT_DIMENSIONS:
        evidence = f"[UNKNOWN:U002] {dimension} audited; evidence remains bounded {table}"
        if dimension == "target type":
            evidence = (
                f"[FACT:F009] Table II contains author-reported separate forward and backward "
                f"timings for the GTX 1080 Ti falling-cube workload; these values are not "
                f"independent validation {table}"
            )
        audit_rows.append(f"| {dimension} | {evidence} |")
    audit_table = "\n".join(audit_rows)
    return f"""# Verdict
[FACT:F001] Author-reported evidence is scoped to the paper configuration {paper}.
[INFERENCE:I001 from=F001] Decision: insufficient-evidence. Confidence tier: medium. Strongest limiting reason: no end-to-end target-workload evidence.

# Core idea
[FACT:F002] The exact mathematics and implementation claim differ {paper}.

# Source manifest
| source ID | role | stable URL | revision / access | access date | inspection depth | license / rights | support boundary | locator |
|---|---|---|---|---|---|---|---|---|
| paper | ICRA paper | https://example.test/paper | DOI 10.1/example | immutable DOI | full text read | publication rights unknown | bounded author claims only | {paper} |
| author-pdf | author PDF | https://example.test/derivation.pdf | immutable file revision UNKNOWN | 2026-08-30 | identity only | UNKNOWN | formula details remain unknown | UNKNOWN |
| project-page | project page | https://example.test/project | accessed 2026-08-30 | 2026-08-30 | provenance link only | UNKNOWN | author linkage, not independent evaluation | {project} |
| author-repo | author repository | https://example.test/repo | full commit SHA aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | 2026-08-30 | pinned README statically inspected; not executed | license UNKNOWN | legacy repository; Flex, forward, backward, and contact-gradient transfer remain scoped | {repo} |

Epistemic mapping: AUTHOR_CLAIM maps to FACT about what authors report. DIRECT_OBSERVATION maps to FACT only for a source actually read, an artifact statically inspected, or code independently executed; it is not independent validation.

# Claim–evidence matrix
| normalized claim | source wording anchor | scope/qualifiers | evidence type | evidence anchors | relation | coverage | confidence | linked contradiction/unknown IDs |
|---|---|---|---|---|---|---|---|---|
| [FACT:F003] Authors report 64k forward 1.594 ms and backward 1.774 ms; 512k forward 10.501 ms and backward 11.594 ms, not independent validation | {table} | GTX 1080 Ti falling-cube workload | controlled quantitative experiment | {table} | partially_supports | paper workload only | medium | U001 |
| [INFERENCE:I003 from=F003] The timings do not establish an end-to-end production frame | {table} | collision, synchronization, and networking excluded | controlled quantitative experiment | {table} | limits | requested product transfer | high | U001 |
| [UNKNOWN:U001] End-to-end target-workload timing, Flex fairness, and contact-gradient transfer are unavailable | UNKNOWN | target hardware and full pipeline not measured | controlled quantitative experiment | UNKNOWN | unverified | requested product transfer | low | U001 |

# Equations and assumptions
| purpose | symbols/dimensions/units/domains | dependencies | status | derivation check | implementation mapping | numerical hazards | claim impact |
|---|---|---|---|---|---|---|---|
| exact mathematics — conservation law | state vector and time step with declared domains | prior conservation equations | verified | [FACT:F004] signs and units checked locally {paper} | {repo} | conditioning | F003 |
| numerical approximation — explicit update | state vector and discrete time step | exact mathematics | plausible | [FACT:F005] update checked locally {paper} | {repo} | floating-point accumulation | F003 |
| optional safeguard — branch clamp | safeguard domain UNKNOWN | pinned implementation identity | gap | [UNKNOWN:U002] no derivation claim without immutable mapping | UNKNOWN | branch discontinuity | F004 |
| heuristic — policy choice | dimensionless policy | F004 | plausible | [INFERENCE:I004 from=F004] scope bridge only {paper} | {repo} | overshoot | F004 |
| evaluated code path — benchmark timing | milliseconds per frame | pinned benchmark workload | verified | [FACT:F006] Table II inspected {table} | {repo} | synchronization | F003 |

# Evaluation audit
Review policy: required audit dimensions are target type, time step, substeps, iterations, collision cadence, line searches, work budget, pipeline inclusions, hardware/software/precision, baseline provenance, scene coverage, metrics, variability, ablations, and stress/failure cases.
The real-time tuple is scene complexity, target Hz, end-to-end frame time, hardware, precision, and pipeline inclusions.
| audit dimension | evidence-bounded audit |
|---|---|
{audit_table}

# Artifact status
| field | status | evidence / next action |
|---|---|---|
| artifact_presence | [FACT:F007] present {repo} | pinned README identifies the repository |
| author_authenticity | [UNKNOWN:U002] unknown | verify from the paper and project page |
| paper_revision_identified | [UNKNOWN:U002] unknown | request the publication commit |
| immutable_archive | [UNKNOWN:U002] unknown | search an official archive registry |
| license_clarity | [UNKNOWN:U002] unknown | audit root, dependency, and asset licenses |
| pinned_dependencies | [UNKNOWN:U002] unknown | inspect a pinned lock or version inventory |
| build_instructions | [UNKNOWN:U002] unknown | inspect the pinned README |
| smoke_test_status | [UNKNOWN:U002] not executed | execution requires a separately approved route |
| complete_paper_inputs | [UNKNOWN:U002] unknown | map released inputs to paper results |
| complete_baselines | [UNKNOWN:U002] unknown | map every baseline implementation and configuration |
| raw_outputs | [UNKNOWN:U002] unknown | request or locate raw outputs |
| figure/table_scripts | [UNKNOWN:U002] unknown | locate scripts for each target result |
| independent_reproduction | [UNKNOWN:U002] unknown | perform only after provenance preflight |
| official_badges | [UNKNOWN:U002] unknown | check the publisher or official registry |

# Limits and contradictions
[FACT:F008] Stability is not convergence or physical accuracy {paper}.
No same-scope contradiction established.

# Confidence
[INFERENCE:I005 from=F001,F003,F008] Confidence tier remains medium because the author report is bounded and no independent validation was performed.

# Minimal reproduction target
- `figure/table/scene/metric:` [UNKNOWN:U001] Table II 64k falling-cube {table}.
- `publication revision:` [UNKNOWN:U001] DOI 10.1/example.
- `artifact revision:` [UNKNOWN:U001] full commit SHA UNKNOWN.
- `configuration:` [UNKNOWN:U001] preserve the paper workload.
- `measurement:` [UNKNOWN:U001] preserve separate forward 1.594 ms and backward 1.774 ms timings.
- `pass/fail criterion:` [UNKNOWN:U001] any numeric deviation requires user approval.
- `expected resources/runtime:` [UNKNOWN:U001] UNKNOWN pending configuration.
- `deviations/non-claims:` [UNKNOWN:U001] this target does not validate the production pipeline, universal accuracy, license, or independent reproduction.
- `logs and hashes:` [UNKNOWN:U001] retain all run evidence.

# Unknowns
| unknown record | sources checked | verdict effect | resolving action |
|---|---|---|---|
| [UNKNOWN:U001] | ICRA paper, author PDF identity, project page, and author repository | blocks end-to-end product support | freeze the target workload and measure the complete real-time tuple |
| [UNKNOWN:U002] | project page and pinned repository README | blocks artifact, license, and implementation claims | obtain the publication commit and complete a pinned static audit |

# JSON adapter
{ticks}json
{json.dumps(adapter, ensure_ascii=False, indent=2)}
{ticks}
"""


def extract_adapter(text: str) -> dict:
    tail = text.split("# JSON adapter", 1)[-1]
    match = re.search(r"```json\s*(\{.*?\})\s*```", tail, flags=re.DOTALL)
    if not match:
        raise AssertionError("enabled response must contain one JSON adapter code block")
    return json.loads(match.group(1))


def material_record_anchor_issues(text: str) -> list[str]:
    issues = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if re.search(r"\[(?:FACT:F\d{3}|CONTRADICTION:C\d{3})\]", line) and not ANCHOR_RE.search(line):
            issues.append(f"line {line_number} material record lacks local anchor")
    return issues


def pdf_anchor_issues(text: str) -> list[str]:
    issues = []
    for match in ANCHOR_RE.finditer(text):
        if "pdf" not in match.group("source").casefold():
            continue
        revision = match.group("revision")
        keys = {part.split("=", 1)[0] for part in match.group("locator").split(";") if "=" in part}
        if revision.startswith("accessed:"):
            issues.append("PDF anchor uses mutable-HTML access revision")
        if "page" not in keys or not ({"sec", "eq", "fig", "table", "alg"} & keys):
            issues.append("PDF anchor lacks page plus narrow locator")
    return issues


class ReviewingSimulationPapersSkillTests(unittest.TestCase):
    def require_text(self, path: Path) -> str:
        self.assertTrue(path.is_file(), f"missing required Task 25 file: {path.relative_to(ROOT)}")
        return path.read_text(encoding="utf-8")

    def test_task_25_required_artifacts_exist(self):
        for path in (SKILL, CONTRACT, AUDIT, UI, SCENARIO, BASELINE, ENABLED, ATTEMPT1, ATTEMPT2, ATTEMPT3, EVALUATION):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_frozen_scenario_and_baseline_have_exact_bytes_hashes(self):
        for path, (size, digest) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.name):
                self.assertTrue(path.is_file(), f"missing frozen fixture: {path.relative_to(ROOT)}")
                raw = path.read_bytes()
                self.assertEqual(len(raw), size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertTrue(raw.endswith(b"\n"))
                self.assertNotIn(b"\r", raw)

    def test_unaided_baseline_truthfully_fails_every_task_25_gate(self):
        self.assertEqual(response_violations(self.require_text(BASELINE)), ALL_GAPS)

    def test_fresh_enabled_attempt_1_is_exact_and_truthfully_fails(self):
        attempt = self.require_text(ATTEMPT1)
        raw = ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), 26413)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "a7c39b112e07051f04a43c29f21121bf018b99f86fe94b631861c587d75b6b50",
        )
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(response_violations(attempt), ATTEMPT1_VIOLATIONS)

    def test_fresh_enabled_attempt_2_is_exact_and_truthfully_fails(self):
        attempt = self.require_text(ATTEMPT2)
        raw = ATTEMPT2.read_bytes()
        self.assertEqual(len(raw), 22958)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "45280617cecd4ce00ccac6716bdba03ffc1cc188d640af1bf6ec16124bd53549",
        )
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(response_violations(attempt), ATTEMPT2_VIOLATIONS)

    def test_fresh_enabled_attempt_3_is_exact_and_promoted_as_the_passing_canonical(self):
        attempt = self.require_text(ATTEMPT3)
        raw = ATTEMPT3.read_bytes()
        self.assertEqual(len(raw), 24398)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "b34e723cb2de53ca97f1d61772cc1e8c97106cb641f64b0d2a91df00496a3fb8",
        )
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(response_violations(attempt), ATTEMPT3_VIOLATIONS)
        self.assertEqual(ENABLED.read_bytes(), raw)
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", extract_adapter(attempt)),
            [],
        )

    def test_evaluation_records_attempt_1_isolation_provenance(self):
        record = json.loads(self.require_text(EVALUATION))
        history = record.get("attempt_history")
        self.assertIsInstance(history, list)
        self.assertEqual(len(history), 3)
        attempt = history[0]
        self.assertEqual(attempt["id"], "enabled-attempt-1")
        self.assertEqual(
            attempt["fixture"],
            "tests/fixtures/reviewing-simulation-papers-enabled-attempt-1-response.txt",
        )
        self.assertEqual(attempt["response_bytes"], 26413)
        self.assertEqual(
            attempt["response_sha256"],
            "a7c39b112e07051f04a43c29f21121bf018b99f86fe94b631861c587d75b6b50",
        )
        self.assertEqual(attempt["verdict"], "fail")
        self.assertEqual(attempt["violations"], sorted(ATTEMPT1_VIOLATIONS))
        isolation = attempt["isolation"]
        self.assertEqual(isolation["model"], "gpt-5.6-terra")
        self.assertEqual(isolation["reasoning_effort"], "high")
        self.assertEqual(isolation["date"], "2026-08-30")
        self.assertEqual(isolation["allowed_inputs"], ATTEMPT1_ALLOWED_INPUTS)
        self.assertEqual(isolation["forbidden_inputs"], ATTEMPT1_FORBIDDEN_INPUTS)
        self.assertEqual(
            isolation["invocation_summary"],
            "Fresh isolated gpt-5.6-terra/high enabled attempt reading only the scenario, SKILL.md, paper-review-contract.md, source-audit.md, agents/openai.yaml, paper-record.schema.json, and the scenario's four primary URLs.",
        )
        self.assertEqual(
            isolation["external_access_result"],
            {
                "doi_landing": "failed; not used as evidence",
                "derivation_pdf": "temporarily downloaded, SHA-256 25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d, inspected as 13 pages, then deleted",
                "repository": "mutable GitHub README web inspection only; not cloned",
                "author_code": "not run",
            },
        )

    def test_evaluation_records_attempt_2_isolation_provenance(self):
        record = json.loads(self.require_text(EVALUATION))
        attempt = record["attempt_history"][1]
        self.assertEqual(attempt["id"], "enabled-attempt-2")
        self.assertEqual(
            attempt["fixture"],
            "tests/fixtures/reviewing-simulation-papers-enabled-attempt-2-response.txt",
        )
        self.assertEqual(attempt["response_bytes"], 22958)
        self.assertEqual(
            attempt["response_sha256"],
            "45280617cecd4ce00ccac6716bdba03ffc1cc188d640af1bf6ec16124bd53549",
        )
        self.assertEqual(attempt["verdict"], "fail")
        self.assertEqual(attempt["violations"], sorted(ATTEMPT2_VIOLATIONS))
        isolation = attempt["isolation"]
        self.assertEqual(isolation["model"], "gpt-5.6-terra")
        self.assertEqual(isolation["reasoning_effort"], "high")
        self.assertEqual(isolation["date"], "2026-08-30")
        self.assertEqual(isolation["allowed_inputs"], ATTEMPT1_ALLOWED_INPUTS)
        self.assertEqual(isolation["forbidden_inputs"], ATTEMPT1_FORBIDDEN_INPUTS)
        self.assertEqual(
            isolation["invocation_summary"],
            "Second fresh isolated gpt-5.6-terra/high enabled attempt reading only the scenario, SKILL.md, paper-review-contract.md, source-audit.md, agents/openai.yaml, paper-record.schema.json, and the scenario's four primary URLs.",
        )
        self.assertEqual(
            isolation["external_access_result"],
            {
                "derivation_pdf": "inspected as immutable observed snapshot SHA-256 25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d",
                "repository": "mutable GitHub README web inspection only; not cloned",
                "author_code": "not run",
            },
        )

    def test_evaluation_records_attempt_3_promotion_and_isolation_provenance(self):
        record = json.loads(self.require_text(EVALUATION))
        attempt = record["attempt_history"][2]
        self.assertEqual(attempt["id"], "enabled-attempt-3")
        self.assertEqual(
            attempt["fixture"],
            "tests/fixtures/reviewing-simulation-papers-enabled-attempt-3-response.txt",
        )
        self.assertEqual(attempt["response_bytes"], 24398)
        self.assertEqual(
            attempt["response_sha256"],
            "b34e723cb2de53ca97f1d61772cc1e8c97106cb641f64b0d2a91df00496a3fb8",
        )
        self.assertEqual(attempt["verdict"], "pass")
        self.assertEqual(attempt["violations"], [])
        isolation = attempt["isolation"]
        self.assertEqual(isolation["model"], "gpt-5.6-terra")
        self.assertEqual(isolation["reasoning_effort"], "high")
        self.assertEqual(isolation["date"], "2026-08-30")
        self.assertEqual(isolation["allowed_inputs"], ATTEMPT1_ALLOWED_INPUTS)
        self.assertEqual(isolation["forbidden_inputs"], ATTEMPT1_FORBIDDEN_INPUTS)
        self.assertEqual(isolation["external_url_allowlist"], PRIMARY_SOURCE_URLS)
        self.assertEqual(
            isolation["invocation_summary"],
            "Third fresh isolated gpt-5.6-terra/high enabled attempt reading only the scenario, SKILL.md, paper-review-contract.md, source-audit.md, agents/openai.yaml, paper-record.schema.json, and the scenario's four allowlisted primary URLs.",
        )
        self.assertEqual(
            isolation["external_access_result"],
            {
                "derivation_pdf": "inspected as immutable observed snapshot SHA-256 25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d",
                "repository": "mutable GitHub page and README inspection only; not cloned",
                "author_code": "not run",
            },
        )

    def test_anchor_oracle_accepts_accessed_html_and_rejects_mutable_code_and_bad_pdf_pages(self):
        complete = canonical_response()
        safe_html = complete + (
            "\n[S:repo-web@accessed:2026-08-30#fragment=README;para=1]\n"
            "[S:chainqueen-repo@accessed:2026-08-30#fragment=README;para=1]\n"
        )
        self.assertNotIn("portable-anchors", response_violations(safe_html))
        unsafe_anchors = {
            "mutable-code-branch": "[S:repo-code@main#path=README.md;lines=1-4]",
            "code-disguised-as-html": "[S:repo-code@accessed:2026-08-30#fragment=README;para=1]",
            "code-without-lines": "[S:repo-code@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#path=README.md]",
            "zero-based-page": "[S:paper@doi:10.1/example#page=0;sec=1]",
            "table-ii-swapped-page": "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=2;sec=IV.A;table=II]",
            "derivation-swapped-page": "[S:chainqueen-derivation@sha256:25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d#page=11;sec=XI;eq=102-116]",
        }
        for name, anchor in unsafe_anchors.items():
            with self.subTest(name=name):
                self.assertIn("portable-anchors", response_violations(complete + "\n" + anchor))

    def test_oracle_rejects_a_second_fenced_json_object(self):
        complete = canonical_response()
        earlier_text_fence = replace_section(
            complete,
            "Core idea",
            "```text\nP2G -> grid -> G2P\n```\n" + section(complete, "Core idea"),
        )
        second_adapter = complete + "\n```json\n{}\n```\n"
        self.assertEqual(response_violations(complete), set())
        self.assertNotIn("reproduction-integrity", response_violations(earlier_text_fence))
        self.assertIn("reproduction-integrity", response_violations(second_adapter))

    def test_claim_matrix_accepts_spaced_links_and_bounded_unknown_evidence_type_only(self):
        complete = canonical_response()
        claim = section(complete, "Claim–evidence matrix")
        accepted = claim.replace("| medium | U001 |", "| medium | U001, U002 |", 1)
        accepted = accepted.replace(
            "| controlled quantitative experiment | UNKNOWN | unverified | requested product transfer | low | U001 |",
            "| UNKNOWN | UNKNOWN | unverified | requested product transfer | low | U001 |",
            1,
        )
        self.assertEqual(claim_matrix_issues(replace_section(complete, "Claim–evidence matrix", accepted)), [])

        fact_unknown_type = claim.replace(
            "| controlled quantitative experiment |",
            "| UNKNOWN |",
            1,
        )
        bad_link = accepted.replace("U001, U002", "U001, F002", 1)
        anchored_unknown = accepted.replace(
            "| [UNKNOWN:U001] End-to-end target-workload timing, Flex fairness, and contact-gradient transfer are unavailable | UNKNOWN |",
            "| [UNKNOWN:U001] End-to-end target-workload timing, Flex fairness, and contact-gradient transfer are unavailable | [S:paper@doi:10.1/example#page=1;sec=1] |",
            1,
        )
        for mutated in (fact_unknown_type, bad_link, anchored_unknown):
            self.assertTrue(claim_matrix_issues(replace_section(complete, "Claim–evidence matrix", mutated)))

    def test_equation_rows_accept_category_first_with_one_local_record_but_not_label_soup(self):
        paper = "[S:paper@doi:10.1/example#page=1;sec=1]"
        header = """# Equations and assumptions
| purpose | symbols/dimensions/units/domains | dependencies | status | derivation check | implementation mapping | numerical hazards | claim impact |
|---|---|---|---|---|---|---|---|
| exact mathematics — conservation | state/domain | equations | verified | [FACT:F101] checked {paper} | UNKNOWN | conditioning | bounded claim |
| numerical approximation — explicit step | dt/time | grid state | plausible | [FACT:F102] checked {paper} | UNKNOWN | cancellation | bounded claim |
| optional safeguard — branch clamp | threshold/domain | contact state | gap | [UNKNOWN:U101] not derived | UNKNOWN | discontinuity | limits claim |
| heuristic — policy choice | dimensionless | [UNKNOWN:U102] not established | not_checked | UNKNOWN | UNKNOWN | overshoot | limits claim |
| evaluated code path — timing path | ms/time | benchmark | verified | [FACT:F103] table checked {paper} | UNKNOWN | synchronization | bounded claim |""".format(paper=paper)
        self.assertEqual(equation_table_issues(header), [])
        missing_local = header.replace("[FACT:F101] ", "", 1) + "\nGlossary [FACT:F101]."
        self.assertTrue(equation_table_issues(missing_local))
        label_first = header.replace(
            "| exact mathematics — conservation",
            "| [FACT:F104] exact mathematics — conservation",
            1,
        )
        trailing_soup = header.replace(
            "| numerical approximation — explicit step",
            "| exact mathematics — later mention numerical approximation",
            1,
        )
        self.assertTrue(equation_table_issues(label_first))
        self.assertTrue(equation_table_issues(trailing_soup))

    def test_oracle_requires_exact_h1s_accepts_no_contradiction_and_enforces_verdict_semantics(self):
        complete = canonical_response()
        numbered = complete.replace("# Verdict\n", "## 1. Verdict\n", 1)
        self.assertIn("ordered-output", response_violations(numbered))
        chinese_no_contradiction = complete.replace(
            "No same-scope contradiction established.",
            "本文没有同一 scope 的互斥来源主张，故无 CONTRADICTION 记录。",
        )
        self.assertNotIn("stable-epistemics", response_violations(chinese_no_contradiction))
        unsupported_missing_evidence = complete.replace(
            '"verdict": "insufficient-evidence"',
            '"verdict": "unsupported"',
        )
        self.assertIn("stable-epistemics", response_violations(unsupported_missing_evidence))
        high_confidence_no_go = complete.replace(
            "Confidence tier: medium", "Confidence tier: high"
        ).replace(
            "Confidence tier remains medium", "Confidence tier remains high"
        ).replace('"confidence": 0.5', '"confidence": 0.8')
        self.assertEqual(response_violations(high_confidence_no_go), set())

    def test_skill_and_contract_teach_the_literal_output_contract(self):
        skill = self.require_text(SKILL)
        contract = self.require_text(CONTRACT)
        exact_h1s = "\n".join(f"# {heading}" for heading in REQUIRED_HEADINGS)
        self.assertIn(exact_h1s, contract)
        self.assertTrue(has_terms(
            skill,
            ("12 exact H1 headings",),
            ("one-based PDF page index",),
            ("only fenced json object",),
        ))
        self.assertTrue(has_terms(
            contract,
            ("one-based PDF page index",),
            ("page=1 is the first PDF page",),
            ("never page=0",),
            ("only fenced json object",),
            ("insufficient-evidence",),
            ("unsupported",),
            ("FACT IDs only",),
            ("no same-scope contradiction established",),
        ))
        self.assertIn(
            "| source ID | role | stable URL | revision / access | access date | inspection depth | license / rights | support boundary | locator |",
            contract,
        )
        self.assertIn(EPISTEMIC_MAPPING_SENTENCE, contract)
        self.assertIn(REVIEW_POLICY_SENTENCE, contract)
        self.assertIn(REAL_TIME_TUPLE_SENTENCE, contract)
        self.assertTrue(has_terms(
            contract,
            ("unknown record cell contains only",),
            ("[UNKNOWN:U###]",),
            ("structured table or checklist",),
            ("figure/table/scene/metric:",),
            ("publication revision:",),
            ("artifact revision:",),
            ("configuration:",),
            ("measurement:",),
            ("pass/fail criterion:",),
            ("expected resources/runtime:",),
            ("deviations/non-claims:",),
            ("logs and hashes:",),
        ))
        self.assertTrue(has_terms(
            skill,
            ("exact epistemic mapping",),
            ("review policy",),
            ("real-time tuple",),
            ("five equation categories",),
            ("exact-field reproduction",),
        ))
        for category in (
            "exact mathematics", "numerical approximation", "optional safeguard",
            "heuristic", "evaluated code path",
        ):
            self.assertIn(category, normalized(contract))
        for dimension in (
            "target type", "time step", "substeps", "iterations",
            "collision cadence", "line searches", "work budget",
            "pipeline inclusions", "hardware/software/precision",
            "baseline provenance", "scene coverage", "metrics",
            "variability", "ablations", "stress/failure cases",
        ):
            self.assertIn(dimension, normalized(contract))

    def test_source_audit_teaches_the_verified_chainqueen_anchor_map(self):
        raw = self.require_text(AUDIT)
        worked = section(raw, "ChainQueen verified anchor map")
        self.assertTrue(has_terms(
            worked,
            ("one-based PDF page index",),
            ("observed snapshot",),
            ("not a named publisher revision",),
        ))
        required = (
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=2;sec=III;eq=1-6]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=3;sec=III;eq=7-10]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=3;sec=IV.A;table=II]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=4;sec=IV.A;para=1]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=4;sec=IV.B;table=III]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=6;sec=VI;para=2]",
            "[S:chainqueen-derivation@sha256:25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d#page=12;sec=XI;eq=102-116]",
        )
        for anchor in required:
            with self.subTest(anchor=anchor):
                self.assertIn(anchor, worked)
        for wrong in (
            "#page=1;sec=III;eq=1-6",
            "#page=2;sec=III;eq=7-10",
            "#page=2;sec=IV.A;table=II",
            "#page=3;sec=IV.B;table=III",
            "#page=5;sec=VI;para=2",
            "#page=11;sec=XI;eq=102-116",
            "fig=3",
            "eq=stability-bound",
        ):
            with self.subTest(wrong=wrong):
                self.assertNotIn(wrong, worked)

    def test_behavior_oracle_passes_and_each_safety_seam_is_deletion_protected(self):
        complete = canonical_response()
        self.assertEqual(response_violations(complete), set())
        deletions = {
            "claim-matrix": "linked contradiction/unknown IDs",
            "equation-audit": "evaluated code path",
            "evaluation-fairness": "pipeline inclusions",
            "artifact-boundaries": "independent_reproduction",
            "source-version-scope": "full commit SHA",
            "reproduction-integrity": "deviations/non-claims",
        }
        for label, token in deletions.items():
            with self.subTest(label=label):
                self.assertIn(label, response_violations(complete.replace(token, "")))

    def test_oracle_requires_local_literal_templates_and_exact_unknown_cells(self):
        complete = canonical_response()
        mapping_soup = complete.replace(EPISTEMIC_MAPPING_SENTENCE, "", 1) + (
            "\nGlossary soup: AUTHOR_CLAIM maps to FACT about what authors report. "
            "DIRECT_OBSERVATION maps to FACT for a source actually read, an artifact statically "
            "inspected, or code independently executed; it is not independent validation.\n"
        )
        review_policy_soup = complete.replace(REVIEW_POLICY_SENTENCE, "", 1) + (
            "\nGlossary soup: target type time step substeps iterations collision cadence line "
            "searches work budget pipeline inclusions hardware/software/precision baseline provenance "
            "scene coverage metrics variability ablations stress/failure cases.\n"
        )
        tuple_soup = complete.replace(REAL_TIME_TUPLE_SENTENCE, "", 1) + (
            "\nGlossary soup: scene complexity target Hz end-to-end frame time hardware precision "
            "pipeline inclusions.\n"
        )
        unlabeled_target = replace_section(
            complete,
            "Minimal reproduction target",
            section(complete, "Minimal reproduction target").replace("configuration:", "configuration discussed", 1),
        )
        mixed_unknown_cell = complete.replace(
            "| [UNKNOWN:U001] | ICRA paper",
            "| [UNKNOWN:U001] end-to-end timing | ICRA paper",
            1,
        )
        missing_heuristic = complete.replace("heuristic — policy choice", "policy choice", 1)
        self.assertIn("stable-epistemics", response_violations(mapping_soup))
        self.assertIn("evaluation-fairness", response_violations(review_policy_soup))
        self.assertIn("evaluation-fairness", response_violations(tuple_soup))
        self.assertIn("reproduction-integrity", response_violations(unlabeled_target))
        self.assertIn("stable-epistemics", response_violations(mixed_unknown_cell))
        self.assertIn("equation-audit", response_violations(missing_heuristic))

    def test_source_scope_accepts_semantic_number_and_chinese_provenance_equivalents(self):
        complete = canonical_response()
        claim = section(complete, "Claim–evidence matrix")
        claim = claim.replace("64k", "64,000").replace("512k", "512,000")
        claim = claim.replace("Authors report", "作者报告").replace(
            "not independent validation", "非独立验证"
        )
        evaluation = section(complete, "Evaluation audit").replace(
            "author-reported", "作者报告"
        ).replace("not independent validation", "非独立验证")
        equivalent = replace_section(complete, "Claim–evidence matrix", claim)
        equivalent = replace_section(equivalent, "Evaluation audit", evaluation)
        self.assertNotIn("source-version-scope", response_violations(equivalent))

        unqualified_claim = claim.replace("作者报告", "结果").replace("非独立验证", "")
        unqualified = replace_section(equivalent, "Claim–evidence matrix", unqualified_claim)
        unqualified += "\nGlossary soup: 作者报告；非独立验证。\n"
        self.assertIn("source-version-scope", response_violations(unqualified))

    def test_source_scope_rejects_relocated_keyword_soup_without_local_table_ii_record(self):
        complete = canonical_response()
        claim = re.sub(r"\| \[FACT:F003\].*?\n", "", section(complete, "Claim–evidence matrix"), count=1)
        weakened = replace_section(complete, "Claim–evidence matrix", claim)
        weakened += (
            "\nGlossary soup: ICRA paper author PDF project page author repository full commit SHA "
            "legacy license Flex forward backward contact-gradient 64k 1.594 ms 1.774 ms 512k "
            "10.501 ms 11.594 ms author-reported not independent validation Table II GTX 1080 Ti "
            "falling-cube.\n"
        )
        self.assertIn("source-version-scope", response_violations(weakened))

    def test_minimal_target_requires_valued_colon_fields_and_accepts_local_chinese_approval(self):
        complete = canonical_response()
        target = """- `figure/table/scene/metric:` Table II 64k falling-cube forward 1.594 ms and backward 1.774 ms.
- `publication revision:` DOI 10.1/example.
- `artifact revision:` full commit SHA UNKNOWN.
- `configuration:` paper workload configuration.
- `measurement:` separate forward and backward timings.
- `pass/fail criterion:` compare the two author-reported values; any tolerance requires user approval.
- `expected resources/runtime:` UNKNOWN pending configuration.
- `deviations/non-claims:` this probe does not validate production or independent reproduction.
- `logs and hashes:` retain commands, logs, and hashes. {table}""".format(
            table="[S:paper@doi:10.1/example#page=2;sec=2;table=II]"
        )
        valid = replace_section(complete, "Minimal reproduction target", target)
        chinese_approval = valid.replace("requires user approval", "须经用户批准")
        missing_colon = valid.replace("`pass/fail criterion:`", "`pass/fail criterion`", 1)
        empty_values = replace_section(
            complete,
            "Minimal reproduction target",
            """- `figure/table/scene/metric:`
- `publication revision:`
- `artifact revision:`
- `configuration:`
- `measurement:`
- `pass/fail criterion:`
- `expected resources/runtime:`
- `deviations/non-claims:`
- `logs and hashes:`

Table II 64k 1.594 ms 1.774 ms user approval does not validate production; logs and hashes.""",
        )
        self.assertNotIn("reproduction-integrity", response_violations(valid))
        self.assertNotIn("reproduction-integrity", response_violations(chinese_approval))
        self.assertIn("reproduction-integrity", response_violations(missing_colon))
        self.assertIn("reproduction-integrity", response_violations(empty_values))

    def test_bilingual_verdict_and_limits_are_section_local_not_global_glossary_tokens(self):
        complete = canonical_response()
        bilingual = complete.replace(
            "Decision: insufficient-evidence. Confidence tier: medium. Strongest limiting reason: no end-to-end target-workload evidence.",
            "决定：insufficient-evidence。置信度：中。决定性的限制：没有目标 workload 的端到端证据。",
            1,
        ).replace(
            "Stability is not convergence or physical accuracy",
            "Δt 稳定性限制不能证明接触梯度精确或光滑",
            1,
        )
        self.assertNotIn("stable-epistemics", response_violations(bilingual))
        relocated = bilingual.replace("置信度：中。决定性的限制：", "").replace(
            "Δt 稳定性限制不能证明接触梯度精确或光滑",
            "The method has a limit",
            1,
        ) + "\nGlossary soup: 置信度、决定性的限制、Δt 稳定性、接触梯度精确、光滑。\n"
        self.assertIn("stable-epistemics", response_violations(relocated))

    def test_evaluation_policy_is_leading_and_structured_table_rows_are_exact_and_nonempty(self):
        complete = canonical_response()
        dimensions = (
            "target type", "time step", "substeps", "iterations", "collision cadence",
            "line searches", "work budget", "pipeline inclusions", "hardware/software/precision",
            "baseline provenance", "scene coverage", "metrics", "variability", "ablations",
            "stress/failure cases",
        )
        rows = "\n".join(
            f"| {dimension} | [UNKNOWN:U002] audited; evidence or resolving action recorded |"
            for dimension in dimensions
        )
        audit = (
            REVIEW_POLICY_SENTENCE + "\n\n" + REAL_TIME_TUPLE_SENTENCE + "\n\n"
            "| audit dimension | evidence-bounded audit |\n|---|---|\n" + rows
        )
        valid = replace_section(complete, "Evaluation audit", audit)
        missing_row = valid.replace(
            "| variability | [UNKNOWN:U002] audited; evidence or resolving action recorded |\n",
            "",
            1,
        )
        empty_row = valid.replace(
            "| ablations | [UNKNOWN:U002] audited; evidence or resolving action recorded |",
            "| ablations | |",
            1,
        )
        late_policy = replace_section(
            complete,
            "Evaluation audit",
            "[FACT:F006] Evidence first [S:paper@doi:10.1/example#page=2;sec=2;table=II].\n\n" + audit,
        )
        keyword_soup = replace_section(
            complete,
            "Evaluation audit",
            REVIEW_POLICY_SENTENCE + "\n\n" + REAL_TIME_TUPLE_SENTENCE
            + "\n\nEvery dimension keyword appears, but no field is independently populated.",
        )
        single_fact = replace_section(
            complete,
            "Evaluation audit",
            REVIEW_POLICY_SENTENCE + "\n\n" + REAL_TIME_TUPLE_SENTENCE
            + "\n\n[FACT:F106] One benchmark fact "
            + "[S:paper@doi:10.1/example#page=2;sec=2;table=II].",
        )
        self.assertNotIn("evaluation-fairness", response_violations(valid))
        self.assertIn("evaluation-fairness", response_violations(missing_row))
        self.assertIn("evaluation-fairness", response_violations(empty_row))
        self.assertIn("evaluation-fairness", response_violations(late_policy))
        self.assertIn("evaluation-fairness", response_violations(keyword_soup))
        self.assertIn("evaluation-fairness", response_violations(single_fact))

    def test_oracle_rejects_relation_soup_generic_equations_artifact_list_and_empty_adapter(self):
        complete = canonical_response()
        relation_soup = replace_section(
            complete,
            "Claim–evidence matrix",
            """| normalized claim | source wording anchor | scope/qualifiers | evidence type | evidence anchors | relation | coverage | confidence | linked contradiction/unknown IDs |
|---|---|---|---|---|---|---|---|---|
| every relation word | [S:paper@doi:10.1/example#page=1;sec=1] | all | controlled quantitative experiment | [S:paper@doi:10.1/example#page=1;sec=1] | supports / partially_supports / limits / refutes / unverified | partial | medium | U001 |""",
        )
        generic_equation = replace_section(
            complete,
            "Equations and assumptions",
            """Exact mathematics, numerical approximation, optional safeguard, heuristic, and evaluated code path.
purpose; symbols/dimensions/units/domains; dependencies; status; derivation check; implementation mapping; numerical hazards; claim impact.""",
        )
        artifact_list = replace_section(
            complete,
            "Artifact status",
            "artifact_presence; author_authenticity; paper_revision_identified; immutable_archive; license_clarity; pinned_dependencies; build_instructions; smoke_test_status; complete_paper_inputs; complete_baselines; raw_outputs; figure/table_scripts; independent_reproduction; official_badges.",
        )
        empty_adapter = replace_section(
            complete,
            "JSON adapter",
            f"{chr(96) * 3}json\n{{}}\n{chr(96) * 3}",
        )
        self.assertIn("claim-matrix", response_violations(relation_soup))
        self.assertIn("equation-audit", response_violations(generic_equation))
        self.assertIn("artifact-boundaries", response_violations(artifact_list))
        self.assertIn("reproduction-integrity", response_violations(empty_adapter))
        self.assertNotEqual(extract_adapter(complete), {})
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", extract_adapter(complete)),
            [],
        )

    def test_oracle_rejects_epistemic_mutations_negation_scope_and_invented_gates(self):
        complete = canonical_response()
        mutations = {
            "malformed-label": (
                "stable-epistemics",
                complete + "\n[INFERENCE:I099 from=U001] An unknown was treated as a fact.",
            ),
            "author-report-upgrade": (
                "stable-epistemics",
                complete + "\nAlthough it is not independently validated, author-reported timing therefore equals a DIRECT_OBSERVATION.",
            ),
            "public-repo-license": (
                "artifact-boundaries",
                complete + "\nBecause the GitHub repository is public, it is open source, licensed, complete, and reproducible.",
            ),
            "stability-is-accuracy": (
                "stable-epistemics",
                complete + "\nStability is not convergence, but stable trajectories therefore establish physical accuracy.",
            ),
            "qualitative-is-numeric": (
                "stable-epistemics",
                complete + "\nA qualitative video therefore proves the universal numeric error bound.",
            ),
            "invented-gates": (
                "reproduction-integrity",
                complete + "\nRequire exactly 17 runs, 240 frames, tolerance 1e-5, and an RTX 4090 as the acceptance gate.",
            ),
        }
        for name, (label, mutated) in mutations.items():
            with self.subTest(name=name):
                self.assertIn(label, response_violations(mutated))

    def test_enabled_decisive_verdict_timing_failure_and_reproduction_boundaries_are_deletion_protected(self):
        enabled = self.require_text(ENABLED)
        weakened = {
            "verdict": (
                "stable-epistemics",
                replace_section(enabled, "Verdict", "[FACT:F001] Evidence exists [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=2;sec=III]."),
            ),
            "timings": (
                "source-version-scope",
                re.sub(r"\| \[FACT:F003\].*?\n", "", enabled, count=1),
            ),
            "failure": (
                "stable-epistemics",
                replace_section(enabled, "Limits and contradictions", "No same-scope contradiction established."),
            ),
            "reproduction": (
                "reproduction-integrity",
                replace_section(
                    enabled,
                    "Minimal reproduction target",
                    "[UNKNOWN:U008] figure/table/scene/metric; publication revision; artifact revision; configuration; measurement; pass/fail criterion; expected resources/runtime; deviations/non-claims; logs and hashes; user approval.",
                ),
            ),
        }
        for name, (label, mutated) in weakened.items():
            with self.subTest(name=name):
                self.assertIn(label, response_violations(mutated))

    def test_adversarial_unsafe_probes_fail_and_explicit_denials_are_safe(self):
        probes = {
            "stable-epistemics": "The title and abstract establish production-ready behavior.",
            "artifact-boundaries": "A public GitHub repository is licensed and reproducible.",
            "portable-anchors": "Branch main is the exact immutable revision.",
            "source-version-scope": "The later repository proves the paper release.",
            "reproduction-integrity": "Require at least 30 runs and 1,000 frames.",
        }
        safe = {
            "stable-epistemics": "The title and abstract do not establish production-ready behavior.",
            "artifact-boundaries": "A public GitHub repository is not licensed or reproducible by default.",
            "portable-anchors": "Branch main is not an exact immutable revision.",
            "source-version-scope": "The later repository does not prove the paper release.",
        }
        complete = canonical_response()
        for label, probe in probes.items():
            with self.subTest(label=label, mode="unsafe"):
                self.assertIn(label, response_violations(complete + "\n" + probe))
        for label, denial in safe.items():
            with self.subTest(label=label, mode="safe"):
                self.assertNotIn(label, response_violations(complete + "\n" + denial))

    def test_entrypoint_references_and_ui_are_compact_and_routable(self):
        skill = self.require_text(SKILL)
        contract = self.require_text(CONTRACT)
        ui = self.require_text(UI)
        self.assertTrue(skill.isascii())
        self.assertLessEqual(semantic_word_count(skill), 500)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/paper-review-contract.md", skill)
        self.assertIn("references/source-audit.md", skill)
        self.assertIn("read both references before substantive review", normalized(skill))
        self.assertIn("$reviewing-simulation-papers", ui)
        self.assertIn("allow_implicit_invocation: true", ui)
        self.assertLessEqual(len(ui.splitlines()), 8)
        for route in ("designing-simulation-experiments", "reproducing-simulation-papers", "translating-research-to-game-physics"):
            self.assertIn(route, skill)
        self.assertIn("pending_route", skill)
        for heading in REQUIRED_HEADINGS:
            self.assertIn(heading, contract)

    def test_source_audit_contains_portable_primary_source_boundaries(self):
        raw = self.require_text(AUDIT)
        audit = normalized(raw)
        for term in (
            "vertex block descent", "exact argmin", "one newton step", "line search",
            "indefinite", "rank-deficient", "chebyshev", "stability is not convergence",
            "1:10,000", "penalty contact", "c229692045465a76233f9fba9197fb22bbfb3694",
            "no paper release", "unknown-license", "rejected at discovery",
            "license", "artifact badge", "independent reproduction",
        ):
            with self.subTest(term=term):
                self.assertIn(normalized(term), audit)
        for anchor in (
            "[S:paper-acm@doi:10.1145/3658179#page=4;sec=3.2;eq=7-9]",
            "[S:paper-acm@doi:10.1145/3658179#page=15;sec=7;fig=24]",
            "[S:gaia@c229692045465a76233f9fba9197fb22bbfb3694#path=README.md;lines=185-245]",
        ):
            with self.subTest(anchor=anchor):
                self.assertIn(anchor, raw)

    def test_source_audit_uses_verified_vbd_pages_for_every_decisive_boundary(self):
        raw = self.require_text(AUDIT)
        hardware_record = next(
            line for line in raw.splitlines()
            if "Hardware is Ryzen 5950X, 64 GB DDR3, and RTX 4090." in line
        )
        hardware_violations = []
        hardware_anchor = (
            "[S:paper-acm@doi:10.1145/3658179#page=8;sec=4]"
        )
        if hardware_anchor not in hardware_record:
            hardware_violations.append("hardware fact lacks the page-8 Section 4 anchor")
        if re.search(r"Hardware is Ryzen.*#page=9;", hardware_record):
            hardware_violations.append("hardware fact retains a page-9 anchor")
        self.assertEqual(hardware_violations, [])
        required = (
            "[S:paper-acm@doi:10.1145/3658179#page=4;sec=3.2;eq=7-9]",
            "[S:paper-acm@doi:10.1145/3658179#page=6;sec=3.8;eq=18]",
            "[S:paper-acm@doi:10.1145/3658179#page=7;sec=3.8;eq=19]",
            "[S:paper-acm@doi:10.1145/3658179#page=8;sec=5;para=1-2]",
            "[S:paper-acm@doi:10.1145/3658179#page=9;sec=5.2;fig=13]",
            "[S:paper-acm@doi:10.1145/3658179#page=10;alg=1;row=15,22-24]",
            "[S:paper-acm@doi:10.1145/3658179#page=12;sec=5.4;table=1]",
            "[S:paper-acm@doi:10.1145/3658179#page=13;sec=5.5;fig=19]",
            "[S:paper-acm@doi:10.1145/3658179#page=15;sec=7;para=3]",
        )
        for anchor in required:
            with self.subTest(anchor=anchor):
                self.assertIn(anchor, raw)
        self.assertNotIn("#page=5;sec=3.2;eq=7-9", raw)
        self.assertNotRegex(
            normalized(raw),
            r"(?:table 1 timing locator|figure 13 page|figure 19 page|contact equation page|algorithm 1 page): unknown",
        )

    def test_enabled_chainqueen_locators_match_verified_paper_pages(self):
        enabled = self.require_text(ENABLED)
        for anchor in (
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=2;sec=III;eq=1-6]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=3;sec=III;eq=7-10]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=4;sec=IV.A;para=1]",
            "[S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=6;sec=VI;para=2]",
        ):
            with self.subTest(anchor=anchor):
                self.assertIn(anchor, enabled)
        self.assertNotIn("fig=3", enabled)
        self.assertNotIn("eq=stability-bound", enabled)
        self.assertNotIn("#page=2;sec=III;eq=1-10", enabled)

    def test_enabled_manifest_has_a_stable_url_and_separate_provenance_columns_per_source(self):
        manifest = section(self.require_text(ENABLED), "Source manifest")
        rows = [line for line in manifest.splitlines() if "chainqueen-" in line and line.startswith("|")]
        self.assertEqual(len(rows), 4)
        header = next((line for line in manifest.splitlines() if line.startswith("| source ID")), "")
        for field in ("stable URL", "revision / access", "inspection depth", "license / rights", "support boundary"):
            self.assertIn(field, header)
        for row in rows:
            self.assertRegex(row, r"https://[^ |]+")
        derivation = next(row for row in rows if "chainqueen-derivation" in row)
        self.assertIn("25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d", derivation)
        self.assertIn("chainqueen-derivation@sha256:", derivation)

    def test_enabled_policy_is_unlabeled_and_table_ii_fact_is_narrowly_scoped(self):
        enabled = self.require_text(ENABLED)
        audit = section(enabled, "Evaluation audit")
        lines = [line for line in audit.splitlines() if line.strip()]
        self.assertEqual(lines[:2], [REVIEW_POLICY_SENTENCE, REAL_TIME_TUPLE_SENTENCE])
        self.assertEqual(evaluation_audit_issues(enabled), [])
        self.assertTrue(has_terms(audit, ("gtx 1080 ti",), ("falling cube",), ("table ii",)))

    def test_enabled_every_epistemic_label_is_well_formed_and_unknowns_are_closed(self):
        enabled = self.require_text(ENABLED)
        self.assertEqual(epistemic_label_issues(enabled), [])
        unknown_ids = set(re.findall(r"\[UNKNOWN:(U\d{3})\]", enabled))
        unknowns = section(enabled, "Unknowns")
        closed_ids = set(re.findall(r"\[UNKNOWN:(U\d{3})\]", unknowns))
        self.assertEqual(unknown_ids, closed_ids)
        rows = [line for line in unknowns.splitlines() if re.search(r"\[UNKNOWN:U\d{3}\]", line)]
        self.assertEqual(len(rows), len(unknown_ids))
        self.assertEqual(unknown_closure_issues(enabled), [])
        self.assertIn("U002", closed_ids)
        self.assertIn("U006", closed_ids)

    def test_enabled_verdict_directly_states_confidence_tier_and_strongest_limit(self):
        self.assertEqual(stable_section_issues(self.require_text(ENABLED)), [])

    def test_enabled_fixture_has_a_fixed_digest_constant(self):
        self.assertIn(ENABLED, FIXTURE_DIGESTS)
        size, digest = FIXTURE_DIGESTS[ENABLED]
        raw = ENABLED.read_bytes()
        self.assertEqual(len(raw), size)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)

    def test_enabled_response_closes_all_semantic_gates_without_claiming_execution(self):
        enabled = self.require_text(ENABLED)
        self.assertEqual(response_violations(enabled), set())
        self.assertTrue(enabled.encode("utf-8").endswith(b"\n"))
        compact = normalized(enabled)
        self.assertIn("author_claim maps to fact", compact)
        self.assertIn("direct_observation maps to fact", compact)
        self.assertIn("not independent validation", compact)
        self.assertIn("未执行", enabled)
        self.assertEqual(extract_adapter(enabled)["artifacts"]["independent_reproduction"], "not performed")
        self.assertNotIn("30 runs", compact)
        self.assertNotIn("1,000 frames", compact)

    def test_enabled_material_records_are_anchor_local_and_pdf_safe(self):
        enabled = self.require_text(ENABLED)
        self.assertEqual(material_record_anchor_issues(enabled), [])
        self.assertEqual(pdf_anchor_issues(enabled), [])
        self.assertNotIn("chainqueen-author-pdf@accessed:", enabled)
        manifest = section(enabled, "Source manifest")
        for source_id in ("chainqueen-icra", "chainqueen-derivation"):
            row = next((line for line in manifest.splitlines() if source_id in line), "")
            self.assertTrue(row, source_id)
            self.assertTrue(ANCHOR_RE.search(row) or "UNKNOWN" in row, row)

    def test_enabled_preserves_table_ii_author_reports_without_upgrading_them(self):
        enabled = section(self.require_text(ENABLED), "Claim–evidence matrix")
        compact = normalized(enabled)
        self.assertRegex(compact, r"\b64(?:k|,?000)\b")
        self.assertRegex(compact, r"\b512(?:k|,?000)\b")
        for value in ("1.594", "1.774", "10.501", "11.594"):
            self.assertIn(value, compact)
        self.assertIn("作者报告", enabled)
        self.assertTrue("不含" in enabled or "不是" in enabled)

    def test_enabled_confidence_is_bounded_to_the_no_go_decision(self):
        enabled = self.require_text(ENABLED)
        confidence = section(enabled, "Confidence")
        self.assertTrue(has_terms(confidence, ("no-go",), ("high",), ("0.91",), ("不作负面断言",)))
        self.assertEqual(extract_adapter(enabled)["confidence"], 0.91)

    def test_enabled_json_adapter_matches_schema_and_existing_validator(self):
        adapter = extract_adapter(self.require_text(ENABLED))
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        self.assertEqual(set(adapter), set(schema["required"]))
        self.assertEqual(set(adapter).difference(schema["properties"]), set())
        self.assertEqual(validate_research_artifact.validate_document("paper-record", adapter), [])
        self.assertEqual(adapter["verdict"], "insufficient-evidence")
        for claim in adapter["claims"]:
            for anchor in claim["evidence_anchors"]:
                self.assertIsNotNone(ANCHOR_RE.fullmatch(anchor), anchor)

    def test_evaluation_record_freezes_fixture_provenance_and_verdicts(self):
        enabled = self.require_text(ENABLED)
        record = json.loads(self.require_text(EVALUATION))
        self.assertEqual(validate_evaluation_record(record), [])
        self.assertEqual(record["skill"], "reviewing-simulation-papers")
        self.assertEqual(record["scenario"], SCENARIO.read_text(encoding="utf-8"))
        self.assertEqual(record["baseline"]["response"], BASELINE.read_text(encoding="utf-8"))
        self.assertEqual(record["enabled"]["response"], enabled)
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(record["baseline"]["violations"], sorted(ALL_GAPS))
        self.assertEqual(record["enabled"]["violations"], [])
        self.assertEqual(record["hashes"]["scenario_sha256"], FIXTURE_DIGESTS[SCENARIO][1])
        self.assertEqual(record["hashes"]["baseline_response_sha256"], FIXTURE_DIGESTS[BASELINE][1])
        self.assertEqual(record["hashes"]["enabled_response_sha256"], hashlib.sha256(ENABLED.read_bytes()).hexdigest())
        self.assertEqual(record["hashes"]["enabled_response_bytes"], len(ENABLED.read_bytes()))

    def test_task_25_files_are_tracked_and_portable_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes", SKILL, CONTRACT, AUDIT, UI,
            ROOT / "tests" / "test_reviewing_simulation_papers_skill.py",
            SCENARIO, BASELINE, ENABLED, ATTEMPT1, ATTEMPT2, ATTEMPT3, EVALUATION,
        )
        relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
        for relative in relative_paths:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(tracked.returncode, 0, tracked.stderr)

        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task25.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), tree], cwd=ROOT, check=True)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                self.assertTrue((extract / relative).is_file(), relative)
            archive_test = (
                "import sys, unittest; "
                "from tests.test_reviewing_simulation_papers_skill import "
                "ReviewingSimulationPapersSkillTests as C; "
                "excluded = {'test_task_25_files_are_tracked_and_portable_from_staged_archive'}; "
                "suite = unittest.TestSuite(test for test in "
                "unittest.defaultTestLoader.loadTestsFromTestCase(C) "
                "if test._testMethodName not in excluded); "
                "result = unittest.TextTestRunner(verbosity=2).run(suite); "
                "sys.exit(not result.wasSuccessful())"
            )
            result = subprocess.run(
                [sys.executable, "-c", archive_test],
                cwd=extract, capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
