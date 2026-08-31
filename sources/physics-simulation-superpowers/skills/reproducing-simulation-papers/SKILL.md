---
name: reproducing-simulation-papers
description: "Use when simulation-paper claims need an author-artifact rerun, an independent reimplementation, or a claim-bound reproduction-run record."
---

# Reproducing Simulation Papers

Reproduce one paper claim with permission-aware execution and an auditable evidence chain. Read [the reproduction protocol](references/reproduction-protocol.md) before planning, acquiring, executing, or reporting an artifact.

## Contract

1. Select one reported numeric, performance, or figure claim and its exact source anchor. Choose `artifact-rerun` for author artifacts or `independent-reimplementation` for a clean implementation from the publication. Do not blur the modes.
2. Treat submitted or downloaded code as untrusted. Separate acquisition and static inventory from execution. Never run it on a credentialed host or expose host secrets, credentials, SSH agents, home directories, Docker sockets, privileged mode, or host networking.
3. Obtain explicit approval before network access, downloads, GPU use, cloud use or cost, or private/confidential data access. If safe isolation or permission is missing, stop before execution and record the blocker.
4. Pin source URL or archive, license/terms, full commit or digest, raw archive hash, extracted inventory, dependencies, container/VM digest, hardware/software environment, exact commands, inputs/assets/seeds, expected result, and predeclared tolerance.
5. Preserve immutable original-path evidence before a patched copy. Keep separate inventories and outputs; log every patch and deviation. Capture command, stdout, stderr, exit code, time, resource use, and hashes without claiming unexecuted work.
6. Keep acquisition/inventory, environment construction, build/install, smoke test, target run, and claim comparison as separate phases. Build or demo launch establishes readiness only.
7. Use the bundled inventory, comparison, and manifest-validation tools with their documented exit semantics. End with exactly one fenced JSON `reproduction-run` record using only schema fields.

## Status gate

- `pass`: an eligible target comparison is exact or within the declared tolerance and has evidence.
- `partial`: the target was actually evaluated, but bounded missing work or material deviations prevent `pass`.
- `fail`: an authorized target comparison mismatched, or a pre-measurement procedure failed.
- `blocked`: permission, artifact, license, provenance, isolation, input, or resource prerequisites prevented evaluation.

For pre-measurement `fail` or `blocked`, use `outcome: not-evaluated` with `observed: null`. Never invent zero, defaults, measurements, paths, commands run, or results. Validate the final record; validation checks structure, not truth or file existence.
