# Reviewing simulation papers: portable source audit

Audit date: 2026-08-30. This reference records claim-scoped primary sources and a worked boundary example. Links establish source identity or policy authority only within the stated scope; they do not substitute for reading the exact manifestation used in a review.

## Primary-source and policy map

| ID | Source | Revision / access | Supports | Boundary |
|---|---|---|---|---|
| `paper-acm` | [Vertex Block Descent publisher record](https://doi.org/10.1145/3658179) | DOI 10.1145/3658179 | Publication identity and final article | DOI identity does not establish artifact identity or independent correctness |
| `paper-author-pdf` | [Author PDF](https://graphics.cs.utah.edu/research/projects/vbd/vbd-siggraph2024.pdf) | Published PDF SHA-256 `4ba65c4e49e8e8740aca491c2bf466b6eeb6f8824a152c12d1f7800828959132`, CC BY 4.0 | Printed pages, equations, figures, tables, algorithm | Preserve the manifestation and check for corrections |
| `paper-arxiv-v4` | [arXiv v4](https://arxiv.org/abs/2403.06321v4) | v4, 2024-06-01 | Versioned open full text | Do not cite the unversioned latest URL for exact wording |
| `project-utah` | [Official project page](https://graphics.cs.utah.edu/research/projects/vbd/) | accessed 2026-08-30 | Author linkage among paper, video, and code | Promotional summary is not independent evaluation |
| `gaia` | [Gaia snapshot](https://github.com/AnkaChan/Gaia/tree/c229692045465a76233f9fba9197fb22bbfb3694) | `c229692045465a76233f9fba9197fb22bbfb3694` | Apache-2.0 code and README at a pinned tree | No paper release/tag; current snapshot is not proven publication code |
| `rejected-demo` | Unknown-license author-demo candidate | rejected at discovery | No artifact or technical claim admitted | Public availability without explicit reuse terms is insufficient |
| `acm-badging` | [ACM artifact review and badging](https://www.acm.org/publications/policies/artifact-review-badging) | accessed 2026-08-30 | Official badge meanings | Never infer a badge from repository presence |
| `sigsim-guidance` | [ACM SIGSIM artifact evaluation](https://sigsim.acm.org/conf/pads/2026/blog/artifact-evaluation/) | accessed 2026-08-30 | Simulation artifact inventory and result packaging | Guidance is not a badge or result validation |
| `neurips-checklist` | [NeurIPS paper checklist](https://neurips.cc/public/guides/PaperChecklist) | accessed 2026-08-30 | Claim, limitation, compute, version, and license checks | Author checklist, not independent artifact certification |
| `grsi` | [Graphics Replicability Stamp](https://www.replicabilitystamp.org/) | accessed 2026-08-30 | Graphics compilation/result-replication scope | Stamp is not scientific-quality or production-readiness proof |

## Vertex Block Descent contract example

Use Vertex Block Descent to keep mathematical claims attached to the path actually evaluated:

- Equation 5 defines the exact argmin local coordinate update. [S:paper-acm@doi:10.1145/3658179#page=3;sec=3.1;eq=5] Equations 7-9 are one Newton step; it need not reduce local energy, and the optional backtracking line search would enforce descent. Reported results omit line search after the authors measured about 40% overhead without benefit in their tests. [S:paper-acm@doi:10.1145/3658179#page=4;sec=3.2;eq=7-9]
- The implementation accepts directions with an indefinite Hessian, skips nearly rank-deficient vertex updates, and discusses an unimplemented conjugate-gradient fallback. Do not extend the exact-minimization guarantee over these boundaries. [S:paper-acm@doi:10.1145/3658179#page=4;sec=3.2;eq=7-9]
- Chebyshev acceleration begins from a smooth, near-quadratic assumption. [S:paper-acm@doi:10.1145/3658179#page=6;sec=3.8;eq=18] Its spectral-radius recurrence is Equation 19; collision energy is stiff/discontinuous and collision-vertex skipping is a heuristic introduced to reduce overshoot. [S:paper-acm@doi:10.1145/3658179#page=7;sec=3.8;eq=19] [S:paper-acm@doi:10.1145/3658179#page=7;sec=3.8;fig=7]
- The evaluated protocol fixes frame time, substeps/iterations and threads, omits line search, applies CCD only on the first iteration unless stated otherwise, runs collision handling through CPU Embree, and runs the two parallel loops in CUDA. [S:paper-acm@doi:10.1145/3658179#page=8;sec=5;para=1-2] Hardware is Ryzen 5950X, 64 GB DDR3, and RTX 4090. [S:paper-acm@doi:10.1145/3658179#page=8;sec=4]
- Stability is not convergence or physical accuracy. Figure 13 compares fixed iteration counts against a converged Newton result. [S:paper-acm@doi:10.1145/3658179#page=9;sec=5.2;fig=13] Section 5.2 says visually stiff behavior at too few iterations can quickly diverge from the converged motion because residual remains. [S:paper-acm@doi:10.1145/3658179#page=10;sec=5.2;para=1]
- Timing is nonuniform: Table 1 contains millisecond tests and multi-second steps, so no paper-wide real-time label is justified. [S:paper-acm@doi:10.1145/3658179#page=12;sec=5.4;table=1] Figure 19 reports the VBD configuration at 0.031 seconds/frame while preserving distinct XPBD timestep, iteration, and collision-cadence configurations. [S:paper-acm@doi:10.1145/3658179#page=13;sec=5.5;fig=19]
- Algorithm 1 marks local line search at row 15 and accelerated iterations at rows 22-24 as optional; its CCD cadence is a separate loop condition. [S:paper-acm@doi:10.1145/3658179#page=10;alg=1;row=15,22-24]
- Preserve the expected Newton crossover for stiff/high-resolution systems and the Figure 24 1:10,000 stiffness-ratio failure. [S:paper-acm@doi:10.1145/3658179#page=15;sec=7;fig=24] Penalty contact cannot guarantee penetration-free results and generally needs some penetration to maintain force. [S:paper-acm@doi:10.1145/3658179#page=15;sec=7;para=3]
- Detailed evidence covers elastic-body dynamics. Particle and rigid-body sections are brief application guides, not equally comprehensive validation. [S:paper-acm@doi:10.1145/3658179#page=13;sec=6]

## Artifact boundary for VBD

Gaia is present and author-authenticated, but the pinned snapshot has no paper release, archival DOI/SWHID, or established identity with the code that produced the paper results. Its README says Windows/Visual Studio was the tested platform and parameter generators cover most experiments. That is not complete paper input, baseline, raw-output, or figure/table-script evidence. [S:gaia@c229692045465a76233f9fba9197fb22bbfb3694#path=README.md;lines=185-245] An unknown-license author-demo candidate was rejected at discovery and contributes no artifact or technical evidence.

Report artifact presence, authenticity, publication revision identity, archive, licenses, dependencies, build instructions, smoke testing, paper inputs, baselines, raw outputs, scripts, independent reproduction, and official artifact badge status independently. Public GitHub availability does not imply any missing state.

## ChainQueen verified anchor map

Use the [ICRA paper PDF](https://jiajunwu.com/papers/chainqueen_icra.pdf) with DOI `10.1109/ICRA.2019.8794333`. Here `page` is the one-based PDF page index:

- Exact mathematics, Equations 1-6: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=2;sec=III;eq=1-6]
- Numerical updates, Equations 7-10: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=3;sec=III;eq=7-10]
- Table II, including the author-reported 64k and 512k forward/backward timings: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=3;sec=IV.A;table=II]
- Flex fairness paragraph; this is prose, not Figure 3: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=4;sec=IV.A;para=1]
- Table III gradient checks: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=4;sec=IV.B;table=III]
- Unnumbered stability restriction; do not invent an equation identifier: [S:chainqueen-icra@doi:10.1109/ICRA.2019.8794333#page=6;sec=VI;para=2]

The [author derivation PDF](https://cdfg.mit.edu/assets/files/chain_queen_0.pdf) was observed as a 13-page snapshot with SHA-256 `25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d`. That hash identifies the observed snapshot, not a named publisher revision. Its friction projection is: [S:chainqueen-derivation@sha256:25ccfcce8e614c9f8cb35a18507de65f129cd00bdc1e70777420265435e31b6d#page=12;sec=XI;eq=102-116]

## ChainQueen evaluation boundary

For a ChainQueen review, keep the ICRA paper, the author PDF with gradient derivation, the project page, and the author repository as separate source records. Bind `Real-Time` to the reported scene/workload/hardware, forward/backward timing boundary, and complete pipeline rather than to the title. Audit Flex comparison target, substeps/iterations, collision cadence, parameter mismatch, qualitative material match, baseline provenance, and modern-hardware transfer.

Record the explicit-step stability restriction and contact-gradient discontinuities or conventions; analytic backward code does not make every contact transition smooth or exact. The legacy repository, dependency age, missing or unclear license, and absent full publication commit SHA are independent blockers. Until a full immutable repository revision and paper relationship are established, label repository facts and reproducibility as unknown rather than inventing identity.

## Badge and reproduction boundary

`Artifacts Available`, `Artifacts Evaluated - Functional`, `Artifacts Evaluated - Reusable`, `Results Reproduced`, and a Graphics Replicability Stamp have different scopes. Only an official program can award them. A build or smoke test is not independent reproduction; one reproduced figure does not validate every equation, baseline, real-time claim, or transfer scenario.
