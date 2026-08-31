"""Contracts for the real-time physics research survey skill."""

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
SKILL = ROOT / "skills" / "surveying-real-time-physics-research" / "SKILL.md"
REFERENCE = (
    ROOT
    / "skills"
    / "surveying-real-time-physics-research"
    / "references"
    / "research-venues.md"
)
UI = ROOT / "skills" / "surveying-real-time-physics-research" / "agents" / "openai.yaml"
AUDIT = (
    ROOT
    / "skills"
    / "surveying-real-time-physics-research"
    / "references"
    / "source-audit.md"
)
SCENARIO = ROOT / "tests" / "fixtures" / "surveying-real-time-physics-research-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "surveying-real-time-physics-research-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "surveying-real-time-physics-research-enabled-response.txt"
ATTEMPT_1 = (
    ROOT
    / "tests"
    / "fixtures"
    / "surveying-real-time-physics-research-enabled-attempt-1-response.txt"
)
ATTEMPT_2 = ATTEMPT_1.with_name(
    "surveying-real-time-physics-research-enabled-attempt-2-response.txt"
)
EVALUATION = ROOT / "evaluations" / "surveying-real-time-physics-research" / "evaluation.json"
ATTEMPT_SOURCE_1 = (
    ROOT
    / ".superpowers"
    / "sdd"
    / "2026-08-26-physics-simulation-superpowers"
    / "task-24-enabled-attempt-1-exact.txt"
)
FIXTURE_DIGESTS = {
    SCENARIO: (2322, "6df6c1211cf66ae18970d0563f6752858bfe6307e7d7e7f586f570455f4b9c41"),
    BASELINE: (17203, "d75a404fba06b08d3380f8dfa81316be9f0e7a937af9f70bae61381788231c60"),
}

PINNED_URLS = (
    "https://www.doi.org/doi-handbook/html/",
    "https://www.crossref.org/documentation/retrieve-metadata/rest-api/",
    "https://www.crossref.org/documentation/principles-practices/best-practices/versioning/",
    "https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/relationships/",
    "https://info.arxiv.org/help/arxiv_identifier.html",
    "https://info.arxiv.org/help/versions.html",
    "https://www.prisma-statement.org/prisma-search",
    "https://www.prisma-statement.org/prisma-2020-flow-diagram",
    "https://dl.acm.org/",
    "https://s2026.siggraph.org/program/technical-papers/",
    "https://computeranimation.org/",
    "https://i3dsymposium.org/",
    "https://www.highperformancegraphics.org/",
    "https://diglib.eg.org/",
    "https://www.ieee-ras.org/conferences-workshops/",
    "https://www.roboticsproceedings.org/",
    "https://help.openalex.org/how-to/api-recipes/",
    "https://docs.github.com/en/rest/licenses/licenses",
    "https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files",
    "https://help.zenodo.org/docs/deposit/manage-versions/",
    "https://www.acm.org/publications/policies/artifact-review-badging",
    "https://www.replicabilitystamp.org/requirements.html",
    "https://doi.org/10.1145/2601248.2601268",
)

ALL_GAPS = {
    "primary-source-venue-map",
    "identifier-version-lineage",
    "query-snowball-update-log",
    "screening-dedup-source-table",
    "artifact-license-claim-depth",
    "resource-stop-boundary",
    "downstream-schema-handoff",
}


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("**", "").replace(chr(96), "")).casefold()


def semantic_word_count(text: str) -> int:
    return len(re.findall(r"\b[A-Za-z][A-Za-z0-9_:'-]*\b", text))


def semantic_blocks(text: str) -> list[str]:
    joined = re.sub(r"(^#{2,6}\s+[^\n]+)\n\s*\n", r"\1\n", text, flags=re.MULTILINE)
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", joined) if part.strip()]
    blocks = []
    for start in range(len(paragraphs)):
        for width in range(1, min(4, len(paragraphs) - start) + 1):
            value = "\n\n".join(paragraphs[start:start + width])
            if semantic_word_count(value) <= 380:
                blocks.append(normalized(value))
    return blocks


def local_groups(text: str, groups: tuple[tuple[str, ...], ...]) -> bool:
    return any(
        all(any(normalized(term) in block for term in alternatives) for alternatives in groups)
        for block in semantic_blocks(text)
    )


REQUIRED_CLUSTERS = {
    "primary-source-venue-map": (
        (("doi handbook",), ("crossref",), ("arxiv",), ("acm digital library",),
         ("eurographics digital library",), ("ieee ras", "ieee xplore"),
         ("rss proceedings", "robotics: science and systems"), ("openalex",)),
        (("year-specific", "publication-year"), ("venue",), ("track",),
         ("review status",), ("discovery index",),
         ("not final authority", "not bibliographic authority", "verify at the publisher")),
    ),
    "identifier-version-lineage": (
        (("preserve the original doi", "preserve original doi", "raw doi"),
         ("strip presentation wrappers", "remove presentation wrappers", "parse recognized"),
         ("uri",), ("urn",),
         ("percent-decode", "percent decode"), ("exactly once", "once"), ("utf-8",),
         ("ascii-only case folding", "ascii case folding"),
         ("no unicode normalization", "do not unicode-normalize")),
        (("versioned arxiv", "arxiv version"), ("v1",),
         ("work family", "conceptual work"), ("manifestation",),
         ("preprint",), ("version of record", "vor")),
        (("depositor assertion", "deposited relation"), ("may be missing", "can be missing"),
         ("title similarity",), ("manual review", "manual adjudication")),
    ),
    "query-snowball-update-log": (
        (("platform/api version", "platform and api version"),
         ("exact endpoint", "query verbatim", "exact query"), ("utc",), ("filters",),
         ("cursor",), ("reported total",), ("retrieved count",),
         ("raw-response checksum", "raw response checksum")),
        (("backward",), ("forward",), ("seed",),
         ("citation direction", "direction"), ("index",),
         ("retrieval date", "retrieved at"), ("round",)),
        (("rerun",), ("saved queries", "preserved queries"), ("delta",),
         ("cutoff date",), ("change log", "diff"), ("withdrawn",), ("retracted",)),
    ),
    "screening-dedup-source-table": (
        (("candidate id", "candidate_id"), ("raw title", "raw_title"),
         ("raw url", "raw_url", "url"), ("discovery",), ("preserve",)),
        (("work_id",), ("contribution class", "contribution_classes"),
         ("current_decision", "inclusion decision"), ("reason",)),
        (("venue",), ("year", "date"), ("primary_url", "primary link"),
         ("review status", "review_status")),
        (("artifact",), ("license",), ("relevance", "scope_role"),
         ("evidence", "claim")),
        (("duplicate",), ("superseded",), ("retain", "preserve", "do not delete")),
    ),
    "artifact-license-claim-depth": (
        (("author-controlled", "author controlled"), ("fork",), ("mirror",),
         ("third-party", "third party")),
        (("commit",), ("release",)),
        (("code",), ("data",), ("model",), ("assets",), ("license",),
         ("no license", "without a license"),
         ("not open source", "not recorded as open source")),
        (("author-reported", "directly reported"), ("independent",)),
        (("full text", "full_text"),
         ("artifact static", "artifact_static", "static inspection"),
         ("artifact executed", "artifact_executed", "execution run")),
        (("artifact executed", "artifact_executed", "execution run", "execution_runs"),
         ("logs",)),
        (("source locator", "page, section", "evidence anchor"),),
    ),
    "resource-stop-boundary": (
        (("freeze",), ("scope",), ("cutoff",), ("sources",), ("queries",),
         ("screening rules",)),
        (("undeclared", "not provided", "unknown"),
         ("resource budget", "person-hours", "work cap"),
         ("blocker", "remain open", "ask the user"),
         ("do not invent", "never invent")),
        (("saturation",), ("resource cap", "budget/time"),
         ("api/access cap", "access cap"), ("complete round",),
         ("zero new eligible", "no new eligible"), ("unscreened",), ("unresolved",)),
    ),
    "downstream-schema-handoff": (
        (("survey record",), ("does not validate directly", "not validate directly"),
         ("paper-record.schema.json",), ("full text",),
         ("claims",), ("methods",), ("conditions",), ("artifacts",),
         ("limitations",), ("applicability",), ("verdict",), ("confidence",)),
        (("reviewing-simulation-papers",),
         ("designing-simulation-experiments",), ("reproducing-simulation-papers",),
         ("translating-research-to-game-physics",),
         ("pending_route", "pending route"), ("not installed", "unavailable")),
        (("canonical identity",), ("claim anchors", "evidence anchors"),
         ("unknowns",), ("target claim",), ("artifact revision",), ("transfer",)),
    ),
}

UNSAFE_CLAIMS = {
    "primary-source-venue-map": (
        r"(?:openalex|semantic scholar|google scholar).{0,80}(?:final|authoritative|canonical|binding|source of truth|ground truth|controlling).{0,45}(?:bibliographic|publication|metadata|record|source)",
        r"(?:siggraph|sca|i3d|hpg).{0,50}(?:always|every year).{0,40}(?:tog|cgf|pacm)",
    ),
    "identifier-version-lineage": (
        r"(?:normalize|convert|rewrite|store).{0,25}(?:raw|original|entire|every|all)\s+doi.{0,30}(?:to )?lowercase",
        r"normalize\s+(?:the\s+)?doi\s+to\s+lowercase",
        r"title similarity.{0,45}(?:is enough|suffices|automatically merge)",
    ),
    "query-snowball-update-log": (r"(?:first page|top \d+ results).{0,45}(?:complete|enough|exhaustive)",),
    "screening-dedup-source-table": (r"(?:delete|drop|discard).{0,35}(?:excluded|duplicate|superseded).{0,25}(?:record|candidate|row)",),
    "artifact-license-claim-depth": (
        r"public (?:github )?repository\s+(?:is|means|therefore).{0,25}open source",
        r"(?:abstract|teaser|venue prestige).{0,45}(?:proves?|establishes?).{0,35}production[- ]ready",
        r"(?:code|artifact).{0,35}(?:ran|executed|reproduced).{0,40}(?:without|no).{0,25}(?:log|run record)",
    ),
    "resource-stop-boundary": (
        r"resource_cap_person_hours.{0,15}160",
        r"resource_cap_unique_works.{0,15}2500",
        r"(?:below|under)\s*2%.{0,40}(?:screened|yield|works)",
        r"(?:use|set|require).{0,30}(?:160 person-hours|2,500 unique works)",
    ),
    "downstream-schema-handoff": (r"(?:send|advance|route).{0,35}(?:abstract-only|metadata-only).{0,40}(?:directly|straight).{0,30}(?:reproduction|game transfer)",),
}


def claim_clauses(text: str) -> list[str]:
    return [
        clause.strip()
        for clause in re.split(
            r"(?:\n+|[.!?;]+|\bbut\b|\bhowever\b|\byet\b|\bthen\b)",
            normalized(text),
            flags=re.IGNORECASE,
        )
        if clause.strip()
    ]


def contains_affirmative_claim(text: str, pattern: str) -> bool:
    denial = re.compile(
        r"\b(?:do not|don't|never|must not|should not|cannot|can't|not(?!\s+only\b))\b",
        re.IGNORECASE,
    )
    inside_denial = re.compile(
        r"\b(?:is|are|was|were|be)\s+not(?!\s+only\b)", re.IGNORECASE
    )
    for clause in claim_clauses(text):
        for match in re.finditer(pattern, clause, re.IGNORECASE):
            before = clause[max(0, match.start() - 80):match.start()]
            if denial.search(before) or inside_denial.search(match.group(0)):
                continue
            return True
    return False


def response_violations(text: str) -> set[str]:
    missing = {
        label for label, clusters in REQUIRED_CLUSTERS.items()
        if not all(local_groups(text, cluster) for cluster in clusters)
    }
    for label, patterns in UNSAFE_CLAIMS.items():
        if any(contains_affirmative_claim(text, pattern) for pattern in patterns):
            missing.add(label)
    return missing


def complete_contract() -> str:
    return """## Primary-source venue map
Use the DOI Handbook, Crossref, arXiv, ACM Digital Library, Eurographics Digital Library, IEEE RAS or IEEE Xplore, and RSS proceedings as primary identity or publication sources; use OpenAlex as a discovery index, not final authority. Venue, track, review status, and publication outlet are year-specific: verify them at the publisher rather than inferring them from a series name.

## Identifier, version, and lineage
Preserve the original DOI; parse recognized URI and URN presentation wrappers, percent-decode the representation exactly once as UTF-8, and compare only ASCII letters with ASCII-only case folding and no Unicode normalization. Keep a versioned arXiv ID such as v1, an unversioned family ID, a conceptual work, and each manifestation separate. Record preprint and version of record lineage. A Crossref relation is a depositor assertion and may be missing; title similarity only creates a manual review queue, never an automatic merge.

## Query, snowballing, and updates
For every search record the platform/API version, exact endpoint or query verbatim, UTC time, filters, cursor, reported total, retrieved count, and raw-response checksum. For backward and forward snowballing, record the seed, citation direction, index, retrieval date, and round. Rerun saved queries at a declared cutoff date; publish a delta change log covering additions, metadata changes, withdrawn records, and retracted records.

## Screening, deduplication, and source table
Preserve every discovery row with candidate_id, raw title, raw URL, discovery source, query, and retrieval time. The normalized source table carries work_id, identity, venue, year, contribution_classes, primary_url, artifacts, license, relevance, evidence dimensions, current_decision, and reason. Retain excluded, duplicate, and superseded candidates plus append-only screening_events.

## Artifacts, licenses, and claim depth
Distinguish author-controlled artifacts, forks, mirrors, and third-party implementations; pin commit, release, and checksum. Audit code, data, model, and assets licenses separately. A no license repository is not open source. Label evidence as author-reported, directly reported in full text, artifact static inspection, artifact executed with logs, or independent validation; every claim keeps a source locator such as page, section, table, repository path, and evidence anchor.

## Resources and stopping
Freeze scope, cutoff, sources, queries, and screening rules before collection. If resource budget, person-hours, or work cap is not provided, mark it unknown and a blocker, keep the decision open, and ask the user; do not invent a number. Distinguish saturation, resource cap or budget/time stop, and API/access cap. Saturation requires a complete round with zero new eligible works. Report unscreened candidates and unresolved conflicts for every stop reason.

## Schema handoff
A survey record does not validate directly against paper-record.schema.json. After full text review, adapt a qualified record with claims, methods, conditions, artifacts, limitations, applicability, verdict, and confidence, then validate that adapter payload. Route it to reviewing-simulation-papers, designing-simulation-experiments, reproducing-simulation-papers, or translating-research-to-game-physics; while a named skill is not installed, emit pending_route rather than claiming execution. The handoff includes canonical identity, claim anchors, unknowns, target claim, artifact revision, and transfer assumptions.
"""


class SurveyingRealTimePhysicsResearchSkillTests(unittest.TestCase):
    def test_task_24_required_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI, AUDIT, SCENARIO, BASELINE, ATTEMPT_1):
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

    def test_blind_baseline_truthfully_misses_five_task_24_gates(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        self.assertEqual(
            response_violations(baseline),
            {
                "primary-source-venue-map",
                "identifier-version-lineage",
                "query-snowball-update-log",
                "resource-stop-boundary",
                "downstream-schema-handoff",
            },
        )
        compact = normalized(baseline)
        for already_correct in (
            "every result receives a permanent candidate_id",
            "title similarity alone is insufficient",
            "a public repository with no license is not recorded as open source",
            "only an execution_runs record with logs",
            "duplicate_discovery and superseded_version preserve links",
        ):
            self.assertIn(already_correct, compact)

    def test_canonical_contract_passes_all_gates(self):
        self.assertEqual(response_violations(complete_contract()), set())

    def test_attempt_1_is_exact_history_with_three_formal_review_gaps(self):
        raw = ATTEMPT_1.read_bytes()
        self.assertEqual(len(raw), 25033)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "7b14519fbb0de965a37f59da2124fb6cf134460c07d5dec3aea0bb4c5deb99ed",
        )
        self.assertTrue(raw.endswith(b"\n"))
        self.assertNotIn(b"\r", raw)
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            {
                "primary-source-venue-map",
                "identifier-version-lineage",
                "downstream-schema-handoff",
            },
        )
        if ATTEMPT_SOURCE_1.is_file():
            self.assertEqual(raw, ATTEMPT_SOURCE_1.read_bytes())

    def test_each_gate_is_independently_deletion_protected(self):
        deletions = {
            "primary-source-venue-map": "Eurographics Digital Library",
            "identifier-version-lineage": "ASCII-only case folding",
            "query-snowball-update-log": "raw-response checksum",
            "screening-dedup-source-table": "candidate_id",
            "artifact-license-claim-depth": "third-party implementations",
            "resource-stop-boundary": "zero new eligible",
            "downstream-schema-handoff": "paper-record.schema.json",
        }
        complete = complete_contract()
        for label, token in deletions.items():
            with self.subTest(label=label):
                self.assertEqual(
                    response_violations(complete.replace(token, "", 1)),
                    {label},
                )

    def test_realistic_unsafe_claims_are_rejected(self):
        probes = {
            "primary-source-venue-map": "Treat OpenAlex as the binding source of truth for publication metadata.",
            "identifier-version-lineage": "Normalize the entire DOI to lowercase.",
            "query-snowball-update-log": "The first page is enough for an exhaustive search.",
            "screening-dedup-source-table": "Delete every duplicate candidate record.",
            "artifact-license-claim-depth": "A public repository is therefore open source.",
            "resource-stop-boundary": "Set resource_cap_person_hours: 160.",
            "downstream-schema-handoff": "Send abstract-only records directly to reproduction.",
        }
        complete = complete_contract()
        for label, probe in probes.items():
            with self.subTest(label=label):
                self.assertIn(label, response_violations(complete + "\n\n" + probe))

    def test_explicit_denials_are_safe_and_late_contradictions_are_not(self):
        safe = {
            "primary-source-venue-map": "OpenAlex is not the final authoritative bibliographic record.",
            "identifier-version-lineage": "Do not normalize the entire DOI to lowercase.",
            "query-snowball-update-log": "The first page is not enough for an exhaustive search.",
            "screening-dedup-source-table": "Do not delete a duplicate candidate record.",
            "artifact-license-claim-depth": "A public repository is not open source by default.",
            "resource-stop-boundary": "Do not set resource_cap_person_hours: 160.",
            "downstream-schema-handoff": "Do not send abstract-only records directly to reproduction.",
        }
        unsafe = {
            label: denial + " But " + probe
            for (label, denial), probe in zip(
                safe.items(),
                (
                    "OpenAlex is the final authoritative bibliographic record.",
                    "Normalize the entire DOI to lowercase.",
                    "The first page is enough for an exhaustive search.",
                    "Delete every duplicate candidate record.",
                    "A public repository is therefore open source.",
                    "Set resource_cap_person_hours: 160.",
                    "Send abstract-only records directly to reproduction.",
                ),
            )
        }
        complete = complete_contract()
        for label, denial in safe.items():
            with self.subTest(label=label, mode="safe"):
                self.assertNotIn(label, response_violations(complete + "\n\n" + denial))
        comparison_key = (
            "Preserve the raw DOI and lowercase only ASCII A-Z in a separate "
            "equality comparison key."
        )
        self.assertNotIn(
            "identifier-version-lineage",
            response_violations(complete + "\n\n" + comparison_key),
        )
        for label, contradiction in unsafe.items():
            with self.subTest(label=label, mode="contradiction"):
                self.assertIn(
                    label, response_violations(complete + "\n\n" + contradiction)
                )

    def test_entry_reference_and_routes_are_bounded_contracts(self):
        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertTrue(skill.isascii())
        self.assertTrue(reference.isascii())
        self.assertLessEqual(semantic_word_count(skill), 500)
        self.assertLessEqual(semantic_word_count(reference), 1600)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/research-venues.md", skill)
        self.assertIn("references/source-audit.md", skill)
        self.assertIn("copy every applicable paragraph", normalized(skill))
        self.assertIn("verbatim", normalized(skill))
        self.assertIn("paper-record.schema.json", skill)
        for route in (
            "reviewing-simulation-papers",
            "designing-simulation-experiments",
            "reproducing-simulation-papers",
            "translating-research-to-game-physics",
        ):
            with self.subTest(route=route):
                self.assertIn(route, skill)
        self.assertIn("pending_route", skill)
        self.assertIn("does not validate directly", normalized(reference))
        self.assertIn("claims, methods, conditions, artifacts, limitations", normalized(reference))
        self.assertEqual(response_violations(reference), set())

    def test_reference_keeps_discovery_authority_and_evidence_boundaries(self):
        compact = normalized(REFERENCE.read_text(encoding="utf-8"))
        for boundary in (
            "publisher and venue records",
            "depositor supplied",
            "unversioned id resolves to the latest version",
            "percent-decode exactly once as utf-8",
            "ieee ras/ieee xplore",
            "rss proceedings",
            "discovery only",
            "public visibility grants no reuse permission",
            "version doi",
            "not proof of every claim",
            "does not validate directly against paper-record.schema.json",
            "pending_route",
            "saturated",
            "resource_limited",
            "access_limited",
        ):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, compact)

    def test_source_audit_is_primary_claim_scoped_and_exactly_pinned(self):
        text = AUDIT.read_text(encoding="utf-8")
        compact = normalized(text)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertEqual(set(links), set(PINNED_URLS))
        self.assertEqual(len(links), len(PINNED_URLS))
        rows = [line for line in text.splitlines() if line.startswith("| [")]
        self.assertEqual(len(rows), len(PINNED_URLS))
        for row in rows:
            cells = [cell.strip() for cell in row.strip("|").split("|")]
            self.assertEqual(len(cells), 5)
            self.assertTrue(all(cells))
        allowed_hosts = {urlparse(url).hostname for url in PINNED_URLS}
        self.assertTrue(all(urlparse(link).hostname in allowed_hosts for link in links))
        for boundary in (
            "read on 2026-08-30",
            "official source",
            "authority",
            "scope",
            "claim",
            "limitation",
            "depositor",
            "discovery",
            "year-specific",
            "no unicode normalization",
            "no license",
            "not proof",
        ):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, compact)

    def test_ui_supports_explicit_and_implicit_invocation(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$surveying-real-time-physics-research", text)
        self.assertIn("allow_implicit_invocation: true", text)
        self.assertLessEqual(len(text.splitlines()), 8)

    def test_phase_b_enabled_response_and_evaluation_are_present(self):
        self.assertTrue(ENABLED.is_file(), "Phase B isolated enabled response is deferred")
        self.assertTrue(EVALUATION.is_file(), "Phase B evaluation promotion is deferred")
        raw = ENABLED.read_bytes()
        self.assertTrue(raw.endswith(b"\n"))
        self.assertNotIn(b"\r", raw)
        self.assertEqual(response_violations(raw.decode("utf-8")), set())

        record = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(record["skill"], "surveying-real-time-physics-research")
        self.assertEqual(record["scenario"], SCENARIO.read_text(encoding="utf-8"))
        self.assertEqual(record["baseline"]["response"], BASELINE.read_text(encoding="utf-8"))
        self.assertEqual(record["enabled"]["response"], raw.decode("utf-8"))
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(
            record["baseline"]["violations"],
            sorted(response_violations(BASELINE.read_text(encoding="utf-8"))),
        )
        self.assertEqual(record["enabled"]["violations"], [])
        self.assertEqual(record["gate_evidence"]["attempt"], 2)
        self.assertEqual(record["gate_evidence"]["enabled_violations"], [])
        self.assertEqual(
            record["hashes"]["scenario_sha256"],
            hashlib.sha256(SCENARIO.read_bytes()).hexdigest(),
        )
        self.assertEqual(
            record["hashes"]["baseline_response_sha256"],
            hashlib.sha256(BASELINE.read_bytes()).hexdigest(),
        )
        self.assertEqual(
            record["hashes"]["enabled_response_sha256"], hashlib.sha256(raw).hexdigest()
        )
        self.assertEqual(
            record["hashes"]["enabled_attempt_1_sha256"],
            "7b14519fbb0de965a37f59da2124fb6cf134460c07d5dec3aea0bb4c5deb99ed",
        )
        self.assertEqual(
            [entry["attempt"] for entry in record["attempt_history"]], [1, 2]
        )
        self.assertEqual(
            record["attempt_history"][0]["violations"],
            sorted(
                {
                    "primary-source-venue-map",
                    "identifier-version-lineage",
                    "downstream-schema-handoff",
                }
            ),
        )
        self.assertEqual(record["attempt_history"][1]["violations"], [])
        self.assertEqual(raw, ATTEMPT_2.read_bytes())

        provenance = record["attempt_2_isolation_provenance"]
        self.assertTrue(provenance["fresh_isolated_evaluator"])
        self.assertEqual(provenance["evaluator_task"], "/root/task24_fresh_enabled_eval_2")
        self.assertEqual(provenance["invocation_date"], "2026-08-30")
        self.assertIn("exact service build is unavailable", provenance["model"])
        self.assertEqual(
            hashlib.sha256(provenance["invocation_prompt"].encode("utf-8")).hexdigest(),
            provenance["invocation_prompt_sha256"],
        )
        self.assertEqual(provenance["source_bytes"], len(raw))
        self.assertEqual(provenance["source_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertTrue(provenance["copied_byte_for_byte"])
        self.assertEqual(
            provenance["allowed_inputs"],
            [
                "scenario",
                "SKILL.md",
                "references/research-venues.md",
                "references/source-audit.md",
                "agents/openai.yaml",
            ],
        )
        self.assertEqual(
            provenance["declared_read_files"],
            [
                "tests/fixtures/surveying-real-time-physics-research-scenario.txt",
                "skills/surveying-real-time-physics-research/SKILL.md",
                "skills/surveying-real-time-physics-research/references/research-venues.md",
                "skills/surveying-real-time-physics-research/references/source-audit.md",
                "skills/surveying-real-time-physics-research/agents/openai.yaml",
            ],
        )
        self.assertEqual(provenance["completion_state"], "interrupted_after_write")

    def test_task_24_phase_a_is_tracked_and_passes_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            AUDIT,
            ROOT / "tests" / "test_surveying_real_time_physics_research_skill.py",
            SCENARIO,
            BASELINE,
            ATTEMPT_1,
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
            ["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task24-phase-a.tar"
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
                "from tests.test_surveying_real_time_physics_research_skill import "
                "SurveyingRealTimePhysicsResearchSkillTests as C; "
                "excluded = {"
                "'test_phase_b_enabled_response_and_evaluation_are_present', "
                "'test_task_24_phase_a_is_tracked_and_passes_from_staged_archive'}; "
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
