"""Validate research artifact manifests using only the Python standard library."""

import json
import math
import sys


KINDS = ("paper-record", "experiment-plan", "reproduction-run")


def _nonempty_string(data, field, diagnostics, path=None):
    path = path or field
    value = data.get(field) if isinstance(data, dict) else None
    if not isinstance(value, str) or not value.strip():
        diagnostics.append(f"{path} must be a nonempty string" if isinstance(data, dict) and field in data else f"{path} is required")


def _nonempty_array(data, field, diagnostics, path=None):
    path = path or field
    value = data.get(field) if isinstance(data, dict) else None
    if not isinstance(value, list) or not value:
        diagnostics.append(f"{path} must be a nonempty array")


def _nonempty_object(data, field, diagnostics, path=None):
    path = path or field
    value = data.get(field) if isinstance(data, dict) else None
    if not isinstance(value, dict) or not value:
        diagnostics.append(f"{path} must be a nonempty object")
    return value if isinstance(value, dict) else None


def _unknown_keys(data, allowed, prefix, diagnostics):
    for key in sorted((key for key in data if not isinstance(key, str)), key=_key_label):
        diagnostics.append(f"{prefix}key {_key_label(key)} must be a string")
    for key in sorted(key for key in data if isinstance(key, str) and key not in allowed):
        diagnostics.append(f"{prefix}{key} is not allowed")


def _key_label(key):
    if key is None or isinstance(key, (bool, int, float)):
        return repr(key)
    return type(key).__name__


def _string_items(data, field, diagnostics, path=None):
    path = path or field
    value = data.get(field) if isinstance(data, dict) else None
    if not isinstance(value, list) or not value:
        diagnostics.append(f"{path} must be a nonempty array")
        return
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            diagnostics.append(f"{path}[{index}] must be a nonempty string")


def _integer_items(data, field, diagnostics):
    value = data.get(field) if isinstance(data, dict) else None
    if not isinstance(value, list) or not value:
        diagnostics.append(f"{field} must be a nonempty array")
        return
    for index, item in enumerate(value):
        if isinstance(item, bool) or not isinstance(item, int):
            diagnostics.append(f"{field}[{index}] must be an integer")


def _result_value_is_valid(value, result_type):
    if result_type in ("numeric-measurement", "performance-comparison"):
        return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
    if result_type in ("qualitative-behavior", "figure-comparison"):
        return isinstance(value, str) and bool(value.strip())
    return not isinstance(value, bool) and isinstance(value, (int, float, str)) and (not isinstance(value, float) or math.isfinite(value)) and (not isinstance(value, str) or bool(value.strip()))


def _result_value_message(path, field, result_type):
    if result_type in ("numeric-measurement", "performance-comparison"):
        return f"{path}.{field} must be a finite number"
    if result_type in ("qualitative-behavior", "figure-comparison"):
        return f"{path}.{field} must be a nonempty string"
    return f"{path}.{field} must be a finite number or nonempty string"


def _validate_paper(data, diagnostics):
    _unknown_keys(data, ("schema_version", "paper", "contribution_type", "claims", "methods_assumptions", "experimental_conditions", "artifacts", "limitations", "real_time_applicability", "verdict", "confidence"), "", diagnostics)
    _nonempty_string(data, "schema_version", diagnostics)
    paper = _nonempty_object(data, "paper", diagnostics)
    if paper is not None:
        _unknown_keys(paper, ("title", "authors", "year", "doi", "url", "arxiv", "primary_link"), "paper.", diagnostics)
        _nonempty_string(paper, "title", diagnostics, "paper.title")
        _string_items(paper, "authors", diagnostics, "paper.authors")
        year = paper.get("year")
        if isinstance(year, bool) or not isinstance(year, int) or year < 1:
            diagnostics.append("paper.year must be an integer >= 1")
        if not any(isinstance(paper.get(key), str) and paper[key].strip() for key in ("doi", "url", "arxiv", "primary_link")):
            diagnostics.append("paper must include at least one primary identifier/link")
    _nonempty_string(data, "contribution_type", diagnostics)
    claims = data.get("claims")
    if not isinstance(claims, list) or not claims:
        diagnostics.append("claims must be a nonempty array")
    else:
        for index, claim in enumerate(claims):
            if not isinstance(claim, dict):
                diagnostics.append(f"claims[{index}] must be an object")
                continue
            _unknown_keys(claim, ("claim", "evidence_anchors"), f"claims[{index}].", diagnostics)
            _nonempty_string(claim, "claim", diagnostics, f"claims[{index}].claim")
            _string_items(claim, "evidence_anchors", diagnostics, f"claims[{index}].evidence_anchors")
    for field in ("methods_assumptions", "experimental_conditions", "limitations"):
        _string_items(data, field, diagnostics)
    _nonempty_object(data, "artifacts", diagnostics)
    _nonempty_string(data, "real_time_applicability", diagnostics)
    verdict = data.get("verdict")
    allowed = "supported, mixed, unsupported, insufficient-evidence"
    if verdict not in ("supported", "mixed", "unsupported", "insufficient-evidence"):
        diagnostics.append(f"verdict must be one of: {allowed}")
    confidence = data.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
        diagnostics.append("confidence must be between 0 and 1")


def _validate_plan(data, diagnostics):
    _unknown_keys(data, ("schema_version", "hypothesis", "independent_variables", "dependent_variables", "baselines", "fixed_budgets", "scenes", "metrics", "seeds", "repetitions", "tolerances", "ablations", "resource_estimate", "stop_conditions"), "", diagnostics)
    _nonempty_string(data, "schema_version", diagnostics)
    _nonempty_string(data, "hypothesis", diagnostics)
    for field in ("independent_variables", "dependent_variables", "baselines", "scenes", "metrics", "ablations", "stop_conditions"):
        _string_items(data, field, diagnostics)
    _integer_items(data, "seeds", diagnostics)
    for field in ("fixed_budgets", "tolerances", "resource_estimate"):
        _nonempty_object(data, field, diagnostics)
    repetitions = data.get("repetitions")
    if isinstance(repetitions, bool) or not isinstance(repetitions, int) or repetitions < 1:
        diagnostics.append("repetitions must be an integer >= 1")


def _validate_reproduction(data, diagnostics):
    _unknown_keys(data, ("schema_version", "target", "reproduction_mode", "artifact", "inventory_hashes", "environment", "commands", "inputs", "expected_results", "observed_results", "tolerances", "patch_log", "deviations", "evidence_paths", "status"), "", diagnostics)
    _nonempty_string(data, "schema_version", diagnostics)
    target = _nonempty_object(data, "target", diagnostics)
    target_claim_id = None
    target_eligible = False
    category_types = {
        "reported-numeric-result": "numeric-measurement",
        "reported-performance-result": "performance-comparison",
        "reported-figure-result": "figure-comparison",
    }
    target_type = None
    lifecycle_terms = ("build", "compile", "compilation", "install", "installation", "setup", "dependency", "preflight", "environment", "readiness", "availability", "preparation", "binary", "executable", "launch", "startup", "smoke")
    if target is not None:
        _unknown_keys(target, ("claim_id", "source_anchor", "category", "description"), "target.", diagnostics)
        _nonempty_string(target, "claim_id", diagnostics, "target.claim_id")
        _nonempty_string(target, "description", diagnostics, "target.description")
        source_anchor = _nonempty_object(target, "source_anchor", diagnostics, "target.source_anchor")
        if source_anchor is not None:
            _unknown_keys(source_anchor, ("kind", "locator"), "target.source_anchor.", diagnostics)
            if source_anchor.get("kind") not in ("figure", "table", "equation", "section", "algorithm", "appendix", "supplement", "page", "abstract"):
                diagnostics.append("target.source_anchor.kind must be one of: figure, table, equation, section, algorithm, appendix, supplement, page, abstract")
            _nonempty_string(source_anchor, "locator", diagnostics, "target.source_anchor.locator")
        category = target.get("category")
        target_type = category_types.get(category) if isinstance(category, str) else None
        if target_type is None:
            diagnostics.append("target.category must be one of: reported-numeric-result, reported-performance-result, reported-figure-result")
        if isinstance(target.get("description"), str) and any(term in target["description"].lower() for term in lifecycle_terms):
            diagnostics.append("target.description must not describe preflight/lifecycle work")
        else:
            target_eligible = isinstance(target.get("claim_id"), str) and bool(target["claim_id"].strip()) and target_type is not None and isinstance(source_anchor, dict) and source_anchor.get("kind") in ("figure", "table", "equation", "section", "algorithm", "appendix", "supplement", "page", "abstract") and isinstance(source_anchor.get("locator"), str) and bool(source_anchor["locator"].strip())
        if isinstance(target.get("claim_id"), str) and target["claim_id"].strip():
            target_claim_id = target["claim_id"]
    mode = data.get("reproduction_mode")
    if mode not in ("artifact-rerun", "independent-reimplementation"):
        diagnostics.append("reproduction_mode must be one of: artifact-rerun, independent-reimplementation")
    artifact = _nonempty_object(data, "artifact", diagnostics)
    if artifact is not None:
        _unknown_keys(artifact, ("name", "commit"), "artifact.", diagnostics)
        _nonempty_string(artifact, "name", diagnostics, "artifact.name")
        _nonempty_string(artifact, "commit", diagnostics, "artifact.commit")
    for field in ("inventory_hashes", "environment", "inputs", "tolerances"):
        _nonempty_object(data, field, diagnostics)
    for field in ("commands", "patch_log", "deviations"):
        _string_items(data, field, diagnostics)
    _string_items(data, "evidence_paths", diagnostics)
    evidence_paths = data.get("evidence_paths")
    evidence_valid = isinstance(evidence_paths, list) and bool(evidence_paths) and all(
        isinstance(path, str) and path.strip() for path in evidence_paths
    )
    expected = data.get("expected_results")
    claims = {}
    claim_counts = {}
    if not isinstance(expected, list) or not expected:
        diagnostics.append("expected_results must be a nonempty array")
    else:
        for index, claim in enumerate(expected):
            path = f"expected_results[{index}]"
            if not isinstance(claim, dict):
                diagnostics.append(f"{path} must be an object")
                continue
            _unknown_keys(claim, ("claim_id", "result_type", "metric", "expected", "unit"), f"{path}.", diagnostics)
            before = len(diagnostics)
            for field in ("claim_id", "metric"):
                _nonempty_string(claim, field, diagnostics, f"{path}.{field}")
            result_type = claim.get("result_type")
            if "result_type" not in claim:
                diagnostics.append(f"{path}.result_type is required")
            elif result_type not in ("numeric-measurement", "performance-comparison", "qualitative-behavior", "figure-comparison"):
                diagnostics.append(f"{path}.result_type must be one of: numeric-measurement, performance-comparison, qualitative-behavior, figure-comparison")
            value = claim.get("expected")
            if "expected" not in claim:
                diagnostics.append(f"{path}.expected is required")
            elif not _result_value_is_valid(value, result_type):
                diagnostics.append(_result_value_message(path, "expected", result_type))
            if "unit" in claim:
                _nonempty_string(claim, "unit", diagnostics, f"{path}.unit")
            lifecycle = isinstance(claim.get("metric"), str) and any(term in claim["metric"].lower() for term in lifecycle_terms)
            claim_id = claim.get("claim_id")
            if isinstance(claim_id, str) and claim_id.strip():
                claim_counts[claim_id] = claim_counts.get(claim_id, 0) + 1
                if claim_id in claims:
                    diagnostics.append(f"{path}.claim_id duplicates expected_results[{claims[claim_id][0]}].claim_id")
                else:
                    claims[claim_id] = (index, claim, lifecycle)
    if target_claim_id is not None:
        claim_info = claims.get(target_claim_id)
        if claim_info is None or claim_counts.get(target_claim_id) != 1:
            diagnostics.append("target.claim_id must reference exactly one expected_results entry")
            target_eligible = False
        if claim_info is not None:
            index, target_claim, lifecycle = claim_info
            if target_type is not None and target_claim.get("result_type") != target_type:
                diagnostics.append(f"expected_results[{index}].result_type must match target.category")
                target_eligible = False
            if lifecycle:
                diagnostics.append(f"expected_results[{index}].metric must not describe preflight/lifecycle work")
                target_eligible = False
    status = data.get("status")
    observed = data.get("observed_results")
    passing_comparison = False
    evaluated_target_comparison = False
    mismatching_target_comparison = False
    target_not_evaluated = False
    has_not_evaluated = False
    observed_claims = {}
    if not isinstance(observed, list) or not observed:
        diagnostics.append("observed_results must be a nonempty array")
    else:
        for index, result in enumerate(observed):
            path = f"observed_results[{index}]"
            if not isinstance(result, dict):
                diagnostics.append(f"{path} must be an object")
                continue
            _unknown_keys(result, ("claim_id", "result_type", "metric", "observed", "outcome", "evidence_path", "unit"), f"{path}.", diagnostics)
            before = len(diagnostics)
            for field in ("claim_id", "metric", "evidence_path"):
                _nonempty_string(result, field, diagnostics, f"{path}.{field}")
            result_type = result.get("result_type")
            if "result_type" not in result:
                diagnostics.append(f"{path}.result_type is required")
            elif result_type not in ("numeric-measurement", "performance-comparison", "qualitative-behavior", "figure-comparison"):
                diagnostics.append(f"{path}.result_type must be one of: numeric-measurement, performance-comparison, qualitative-behavior, figure-comparison")
            outcome = result.get("outcome")
            if "outcome" not in result:
                diagnostics.append(f"{path}.outcome is required")
            elif outcome not in ("exact-match", "within-tolerance", "qualitative-match", "mismatch", "not-evaluated"):
                diagnostics.append(f"{path}.outcome must be one of: exact-match, within-tolerance, qualitative-match, mismatch, not-evaluated")
            value = result.get("observed")
            if "observed" not in result:
                diagnostics.append(f"{path}.observed is required")
            elif outcome == "not-evaluated" and value is not None:
                diagnostics.append(f"{path}.observed must be null when outcome is not-evaluated")
            elif outcome != "not-evaluated" and not _result_value_is_valid(value, result_type):
                diagnostics.append(_result_value_message(path, "observed", result_type))
            if outcome == "not-evaluated":
                has_not_evaluated = True
            if "unit" in result:
                _nonempty_string(result, "unit", diagnostics, f"{path}.unit")
            claim_id = result.get("claim_id")
            claim_id_valid = isinstance(claim_id, str) and bool(claim_id.strip())
            if claim_id_valid:
                if claim_id in observed_claims:
                    diagnostics.append(
                        f"{path}.claim_id duplicates observed_results[{observed_claims[claim_id]}].claim_id"
                    )
                else:
                    observed_claims[claim_id] = index
            claim_info = claims.get(claim_id) if claim_id_valid else None
            if claim_id_valid and claim_id not in claims:
                diagnostics.append(f"{path}.claim_id must reference expected_results")
            elif claim_info is not None:
                _, expected_claim, lifecycle = claim_info
                for field in ("result_type", "metric", "unit"):
                    if field in expected_claim and result.get(field) != expected_claim.get(field):
                        diagnostics.append(f"{path}.{field} must match expected_results claim_id {claim_id}")
                if lifecycle:
                    diagnostics.append(f"{path}.claim_id references lifecycle-only expected result")
            if evidence_valid and result.get("evidence_path") not in evidence_paths:
                diagnostics.append(f"{path}.evidence_path must appear in evidence_paths")
            figure_extensions = (".png", ".jpg", ".jpeg", ".webp", ".exr", ".hdr", ".svg", ".pdf")
            eligible_type = result_type in ("numeric-measurement", "performance-comparison") or (
                result_type == "figure-comparison" and isinstance(result.get("evidence_path"), str) and result["evidence_path"].lower().endswith(figure_extensions)
            )
            linked_target_result = len(diagnostics) == before and evidence_valid and claim_info is not None and claim_id == target_claim_id and target_eligible and not claim_info[2]
            if linked_target_result and outcome == "not-evaluated":
                target_not_evaluated = True
            if linked_target_result and eligible_type and outcome in ("exact-match", "within-tolerance", "qualitative-match", "mismatch"):
                evaluated_target_comparison = True
                if outcome in ("exact-match", "within-tolerance", "qualitative-match"):
                    passing_comparison = True
                if outcome == "mismatch":
                    mismatching_target_comparison = True
    if status not in ("pass", "partial", "fail", "blocked"):
        diagnostics.append("status must be one of: pass, partial, fail, blocked")
    if has_not_evaluated and status not in ("blocked", "fail"):
        diagnostics.append("not-evaluated observations require status blocked or fail")
    if status == "pass":
        if not passing_comparison:
            diagnostics.append("observed_results must contain an eligible target comparison when status is pass")
        if isinstance(evidence_paths, list) and not evidence_paths:
            diagnostics.append("evidence_paths must be a nonempty array when status is pass")
    if status == "partial" and not evaluated_target_comparison:
        diagnostics.append("observed_results must contain an eligible evaluated target comparison when status is partial")
    if status == "blocked" and (evaluated_target_comparison or not target_not_evaluated):
        diagnostics.append("status blocked requires the target outcome to be not-evaluated")
    if status == "fail" and not (mismatching_target_comparison or target_not_evaluated):
        diagnostics.append("status fail requires a target mismatch or not-evaluated outcome")


def validate_document(kind: str, data: dict) -> list[str]:
    """Return deterministic dotted-path diagnostics for a research artifact."""
    if kind not in KINDS:
        return ["kind must be one of: paper-record, experiment-plan, reproduction-run"]
    if not isinstance(data, dict):
        return ["document must be an object"]
    diagnostics = []
    if kind == "paper-record":
        _validate_paper(data, diagnostics)
    elif kind == "experiment-plan":
        _validate_plan(data, diagnostics)
    else:
        _validate_reproduction(data, diagnostics)
    return diagnostics


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        print("usage: validate_research_artifact.py KIND FILE.json")
        return 2
    kind, path = argv
    if kind not in KINDS:
        print("kind must be one of: paper-record, experiment-plan, reproduction-run")
        return 2
    try:
        with open(path, encoding="utf-8") as source:
            data = json.load(source, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"nonstandard constant {value}")))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"unable to parse JSON: {error}")
        return 2
    diagnostics = validate_document(kind, data)
    for diagnostic in diagnostics:
        print(diagnostic)
    return 0 if not diagnostics else 2


if __name__ == "__main__":
    raise SystemExit(main())
