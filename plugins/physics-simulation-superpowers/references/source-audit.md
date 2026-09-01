# Physics Simulation Source Audit

This plugin-level audit consolidates the claim-scoped audits kept beside the engine and research skills. It records source identity and admission decisions; it does not turn a documentation page, repository, paper, badge, or benchmark into proof about a user's build.

## Admission policy

- Score each candidate on six 0–5 dimensions, for a maximum of 30.
- Adopt only sources scoring at least **24/30**, with nonzero `correctness` and `licensing`.
- Prefer official documentation, immutable upstream releases, standards, and primary papers. Community material must meet the same 24/30 threshold and cannot overrule pinned primary evidence.
- Use third-party material as `reference-only` unless its license is explicitly approved for direct adaptation. Direct adaptation is limited to Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, and CC-BY-4.0 with attribution.
- A source with an unknown or noncommercial license is rejected. Lack of a reuse grant is not repaired by public availability.

## Scoring rubric

| Dimension | 0 | 3 | 5 |
| --- | --- | --- | --- |
| `correctness` | contradicted or unverifiable | claim-scoped but incomplete | pinned, internally consistent primary evidence |
| `licensing` | unknown/incompatible | usable only under explicit reference terms | clear permissive or public-domain status |
| `authority` | anonymous/derivative | credible community or secondary source | official owner, standards body, or primary authors |
| `real-time relevance` | unrelated | transferable method | directly addresses interactive simulation constraints |
| `actionability` | no reproducible action | informs a bounded check | supplies a concrete API, protocol, or verification seam |
| `maintainability` | drifting/unversioned | dated snapshot with caveats | immutable identity plus maintained validation evidence |

`maintainability` includes maintenance state, version clarity, and available test evidence. The machine-readable authority is `sources.lock.json`; a score admits a source for its stated scope only.

## Audited sources

| ID | Identity and license | Score / decision | Claim scope |
| --- | --- | --- | --- |
| `epic-unreal-chaos-5-8` | [Unreal Engine 5.8 physics documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-in-unreal-engine); LicenseRef-Epic-Documentation-Terms, reference-only | 28/30, adopted | Chaos domains, version gates, Unreal-first transfer boundary |
| `unity-physics-6000-3` | [Unity 6000.3 Physics Manual](https://docs.unity3d.com/6000.3/Documentation/Manual/PhysicsSection.html); LicenseRef-Unity-Documentation-Terms, reference-only | 28/30, adopted | Concise Unity 3D/2D/DOTS adapter routing |
| `godot-4-7-2` | [Godot 4.7.2-stable archive](https://godotengine.org/download/archive/4.7.2-stable/), commit `ed1daf0bf001b61586d9930840f2f1394092c079`; MIT verified at pinned source, reference-only | 28/30, adopted | Godot/Jolt version and backend gate |
| `jolt-physics-5-6-0` | [Jolt Physics v5.6.0](https://github.com/jrouwe/JoltPhysics/tree/v5.6.0), commit `e77f175595e64cb44218cc9d9d56fc365ad0e36a`; MIT, reference-only | 30/30, adopted | Native Jolt lifecycle, state, determinism, tests; Godot upstream boundary |
| `nvidia-physx-5-9-0` | [PhysX 5.9.0](https://github.com/NVIDIA-Omniverse/PhysX/tree/110.1-omni-and-physx-5.9.0), commit `517a0073715120e114ee055b63b26c95e00d9039`; BSD-3-Clause, reference-only | 30/30, adopted | Native PhysX ownership, CPU/GPU feature and migration contracts |
| `rapier-rust-0-35-3` | [Rapier v0.35.3](https://github.com/dimforge/rapier/tree/v0.35.3), commit `b82079ac41310a8af438af95b49b8fa551ce650f`; Apache-2.0, reference-only | 30/30, adopted | Rust Rapier API, features, determinism and validation seeds |
| `rapier-js-0-20-0` | [Rapier JavaScript 0.20.0](https://github.com/dimforge/rapier/tree/js-v0.20.0), commit `3e12c2679cb1940a876bde93af9cec0cf2f57944`; Apache-2.0 verified in pinned tree and npm metadata, reference-only | 30/30, adopted | JavaScript/WASM package identity, snapshot API and deterministic-flavor boundaries |
| `box2d-3-1-1` | [Box2D v3.1.1](https://github.com/erincatto/box2d/tree/v3.1.1), commit `8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3`; MIT, reference-only | 30/30, adopted | Box2D C API, stepping, ownership and deterministic test seed |
| `crossref-rest-api` | [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/); LicenseRef-Crossref-Terms, reference-only | 27/30, adopted | Reproducible scholarly discovery metadata |
| `acm-artifact-badging-1-1` | [ACM Artifact Review and Badging v1.1](https://www.acm.org/publications/policies/artifact-review-and-badging-current); LicenseRef-ACM-Publication-Policy, reference-only | 27/30, adopted | Artifact versus independent-results evidence levels |
| `neurips-paper-checklist` | [NeurIPS Paper Checklist](https://neurips.cc/public/guides/PaperChecklist); LicenseRef-NeurIPS-Website-Terms, reference-only | 27/30, adopted | Claims, limitations, compute, versions and license reporting |
| `nist-factorial-design` | [NIST full factorial designs](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3331.htm); LicenseRef-NIST-Reference-Only, no blanket public-domain claim | 28/30, adopted | Experimental factors, interactions, randomization and replication |
| `nist-confidence-limits` | [NIST confidence limits for a mean](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm); LicenseRef-NIST-Reference-Only, no blanket public-domain claim | 28/30, adopted | Correct unit-of-analysis and uncertainty reporting |
| `nist-sp-800-190` | [NIST SP 800-190](https://doi.org/10.6028/NIST.SP.800-190); LicenseRef-NIST-Reference-Only, no blanket public-domain claim | 27/30, adopted | Isolation and least-privilege boundary for untrusted artifacts |
| `difftaichi-arxiv-v2` | [DiffTaichi arXiv:1910.00935v2](https://arxiv.org/abs/1910.00935v2); LicenseRef-arXiv-Distribution-Terms, reference-only | 26/30, adopted | Primary differentiable-simulation claims and transfer limits |
| `nasa-std-7009b` | [NASA-STD-7009B](https://standards.nasa.gov/standard/NASA/NASA-STD-7009); LicenseRef-NASA-Reference-Only, no blanket public-domain claim | 28/30, adopted | Model credibility, validation and decision-context discipline |
| `rapier-pr-994` | [Rapier PR #994](https://github.com/dimforge/rapier/pull/994); unknown contribution-license scope, excluded | 19/30, rejected | Narrow community leak report; cannot authorize shipped guidance or adaptation |
| `tinyvbd-unlicensed-snapshot` | [TinyVBD snapshot](https://github.com/AnkaChan/TinyVBD/tree/dcd011a5d945172e247ecced90a6c2c4b4313520); no explicit license observed, excluded | 15/30, rejected | Artifact-presence boundary only; no reuse authority |

## Excluded-content rule

The plugin contains original workflow instructions, schemas, and tests. It does not bundle third-party source code, paper text, figures, datasets, models, or assets. Unknown-license and noncommercial material may be logged as rejected discovery evidence, but it cannot authorize shipped instructions or be copied into the package. Re-check the exact source, identity, terms, and claim boundary before any future direct adaptation.
