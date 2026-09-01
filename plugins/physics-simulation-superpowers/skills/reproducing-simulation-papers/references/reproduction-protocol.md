# Simulation Paper Reproduction Protocol

## Evidence and policy basis

Use these primary sources as boundaries, not as claims that a local run earned an official badge:

- [ACM Artifact Review and Badging v1.1](https://www.acm.org/publications/policies/artifact-review-and-badging-current) separates artifact availability/functionality from results obtained by an independent team. A local `pass` is not an ACM badge.
- [NeurIPS Paper Checklist](https://neurips.cc/public/guides/PaperChecklist) asks for exact commands and environments, experimental details, compute, asset versions, and licenses; it allows missing code when honestly disclosed.
- [NeurIPS Reviewer Guidelines: Executing Code and Clicking on Links](https://neurips.cc/Conferences/2025/ReviewerGuidelines) treats submitted code as untrusted and recommends a secure container, VM, or network-isolated cloud instance. It also warns that links may be hostile or identify visitors.
- [NIST SP 800-190](https://doi.org/10.6028/NIST.SP.800-190) describes container-specific threats and defenses. Apply least privilege, image/runtime hardening, vulnerability management, and monitoring.
- [Docker Engine security](https://docs.docker.com/engine/security/) states that daemon control and unrestricted host mounts are security-sensitive; cgroups limit resource exhaustion, and capabilities should be minimized. [Rootless mode](https://docs.docker.com/engine/security/rootless/) reduces daemon/runtime privilege but is not proof that untrusted code is safe.

## Select the reproduction mode

### `artifact-rerun`

Use the authors' code, data, model, scripts, or images. Pin the paper version and artifact identity. ACM Version 1.1 calls independently obtaining main results using author-supplied artifacts "Results Reproduced"; do not claim that official badge from this workflow.

### `independent-reimplementation`

Implement from the paper, supplement, equations, and declared inputs without copying or executing author code. Record the specification boundary and every inferred choice. The mode is not an author-artifact rerun and does not erase missing method details.

Choose before acquisition. If a clean reimplementation later imports author code or generated data, change the mode or document why the record no longer supports the original mode.

## Permission and isolation gate

Public availability is not execution permission. Confirm license/terms, confidentiality, retention constraints, artifact provenance, and the user's authority over inputs. Request explicit approval immediately before any:

- network access or download;
- GPU assignment or driver/device exposure;
- cloud service, paid compute, storage, or egress;
- private, licensed, confidential, personal, or regulated data access.

Never place untrusted code on a host that holds reusable credentials. Never provide environment secrets, tokens, cloud credentials, SSH keys/agent sockets, the user home, host root, the Docker socket, `--privileged`, host PID/IPC/network namespaces, or unrestricted devices. Refuse `curl | sh` and equivalent download-and-execute chains.

Use a disposable VM when container boundaries are insufficient. Otherwise use a dedicated least-privilege container/runner with:

- a non-root user, rootless runtime where supported, dropped capabilities, `no-new-privileges`, and the platform's seccomp/MAC policy;
- network disabled (`--network none` for Docker) after a separately approved, logged acquisition step;
- immutable image digest, read-only original inputs, and one narrow writable output mount;
- CPU, memory, process, disk, wall-time, and GPU limits;
- no host service sockets, secrets, home mounts, or unrelated files.

If the artifact cannot work within those boundaries, record `blocked` and the minimum additional permission requested. Do not weaken isolation silently.

## Four separated phases

### 1. Acquire and inventory without executing

Record the authoritative URL/DOI, retrieval time, paper version, license/terms, archive byte length and SHA-256, full commit/tag resolution, and container image digest. Do not trust filenames or a README excerpt as identity.

Preserve an immutable original tree. Inspect manifests, build files, scripts, binaries, hooks, submodules, download behavior, telemetry, credential reads, device access, and expected outputs statically. Reject or quarantine links, junctions, device files, and unexplained executables.

Run only after a local tree exists:

```text
python scripts/inventory_artifact.py ORIGINAL_ROOT [--exclude POSIX_PATTERN]
```

Exit `0` emits deterministic compact JSON with raw-byte SHA-256 file records. Exit `2` reports CLI, path, unsafe-entry, mutation, or read failure on stderr. Built-in cache/VCS exclusions and user exclusions must be recorded; the tool does not execute artifact code, verify licenses, hash the outer archive, or establish authenticity.

### 2. Construct the environment

Pin OS image/VM and digest, compiler/interpreter, dependency lock and hashes, physics library, driver/runtime, CPU/GPU model, memory, precision mode, locale, and relevant environment variables. Installation and image construction remain readiness evidence, not claim evidence.

Keep exact commands as an ordered, shell-specific list. Never write a command as executed until its stdout, stderr, exit code, start/end time, and resource record exist.

### 3. Establish readiness, then run one claim

Keep preflight, dependency resolution, build/install, and smoke/demo launch in separate logs. None can set `pass` or satisfy `partial` by itself.

For the claim run, pin the paper anchor, scene/asset hashes, initial state, seed, timestep, horizon, resolution/budget, warm-up, timed boundary, synchronization, repetitions, metric computation, baseline, and tolerance. Match the publication or mark each deviation before interpreting results.

### 4. Compare and preserve evidence

Retain original-path output even when it fails. Patch only a copied tree. Record a unified diff or patch hash, rationale, author communication if any, and both before/after inventories. Put original and patched outputs in distinct paths; never overwrite inconvenient runs.

For finite scalar comparisons, create an input JSON with `reported`, scalar or nonempty scalar-list `observed`, and optional nonnegative `absolute_tolerance` / `relative_tolerance`, then run:

```text
python scripts/compare_reported_results.py INPUT.json
```

Exit `0` means exact/either declared tolerance passed; exit `1` means the comparison rule failed; exit `2` means CLI/input/derivation failure. Exit `1` is a scientific outcome, not a tool crash. The tool reports descriptive scalar statistics; it does not establish independence, causal validity, matched workloads, or statistical significance.

Capture raw result files plus hashes, command transcript, stdout, stderr, exit code, wall time, CPU/GPU/memory/storage/network use, comparison input/output, figure or table output, patch log, deviations, and a human-readable decision note. Every `observed_results[].evidence_path` must also appear in `evidence_paths`.

## Status decision

| Status | Required meaning |
|---|---|
| `pass` | The eligible target claim was measured and matched exactly or within a predeclared tolerance, with linked evidence. |
| `partial` | The eligible target was actually measured, but only a bounded subset or materially deviated run is defensible. Build/smoke alone never qualifies. |
| `fail` | The authorized target measurement mismatched, or an attempted pre-measurement phase failed. Use `null` only for the latter. |
| `blocked` | Permission, license, provenance, artifact, safe isolation, input, or resource prerequisites prevented measurement. |

`outcome: not-evaluated` requires `observed: null` and overall `blocked` or pre-measurement `fail`. A numeric or text placeholder is fabricated evidence. An evaluated outcome requires a finite number or nonempty result value. `partial` requires eligible evaluated target evidence; lifecycle success is insufficient.

## Honest blocked-record example

This example assumes the evaluator actually saved the stated blocker note at `evidence/preflight-blocked.json`. It records an author-reported expectation, not an observation. The command is explicitly planned and unexecuted.

```json
{
  "schema_version": "1",
  "target": {
    "claim_id": "table-3-speedup",
    "source_anchor": {"kind": "table", "locator": "Table 3"},
    "category": "reported-performance-result",
    "description": "Reported performance speedup for the declared scene"
  },
  "reproduction_mode": "artifact-rerun",
  "artifact": {"name": "author artifact", "commit": "unverified: artifact not acquired"},
  "inventory_hashes": {"state": "unavailable: artifact not acquired"},
  "environment": {"state": "not constructed: acquisition and execution not approved"},
  "commands": ["NOT EXECUTED: claim command pending verified artifact and explicit approval"],
  "inputs": {"state": "scene, assets, and seed not supplied"},
  "expected_results": [
    {
      "claim_id": "table-3-speedup",
      "result_type": "performance-comparison",
      "metric": "performance speedup",
      "expected": 1.8,
      "unit": "x"
    }
  ],
  "observed_results": [
    {
      "claim_id": "table-3-speedup",
      "result_type": "performance-comparison",
      "metric": "performance speedup",
      "observed": null,
      "outcome": "not-evaluated",
      "evidence_path": "evidence/preflight-blocked.json",
      "unit": "x"
    }
  ],
  "tolerances": {"state": "not declared by source or evaluator"},
  "patch_log": ["none: artifact not acquired or modified"],
  "deviations": ["target was not evaluated; no numeric observation exists"],
  "evidence_paths": ["evidence/preflight-blocked.json"],
  "status": "blocked"
}
```

Validate the saved final record:

```text
python scripts/validate_research_artifact.py reproduction-run RUN.json
```

Exit `0` means the record satisfies the validator. Exit `2` means usage, JSON parsing, or deterministic schema/semantic diagnostics failed. Validation does not execute commands, inspect evidence files, verify hashes, prove provenance, or establish scientific truth.
