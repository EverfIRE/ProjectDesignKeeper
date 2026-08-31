# Physics profiling and scaling source audit

Read on 2026-08-27. These primary or official sources were actually read for an engine-independent method; they are not API prescriptions and do not supply undeclared project values.

| Source read | Authority and use | Claims used in SKILL.md |
| --- | --- | --- |
| [Box2D Simulation](https://box2d.org/documentation/md_simulation.html) | Official physics-backend documentation. | A fixed step, sleep, staged simulation work, pairs, contacts, islands, CCD, and worker configuration make useful workload/cost dimensions. It does not set a project tick, quality threshold, or budget. |
| [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) | Official Google SRE book. | Averages can hide distribution tails; percentiles require a declared measurement window and policy. It motivates p50/p95/p99 reporting, not physics-specific acceptance values or confidence rules. |
| [CUDA asynchronous execution](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html) | Official vendor programming guide. | Host/device transfer, compute, and synchronization may overlap or serialize; end-to-end timelines must include them. It does not establish that GPU solve is correct, deterministic, or faster for this workload. |
| [WebGPU specification](https://gpuweb.github.io/gpuweb/) | Primary public API specification. | Timestamp queries and queue completion are queue-timeline evidence with availability/precision limits. This supports measuring queue work without treating CPU wall time as GPU time. |
| [GPUView Main Window](https://learn.microsoft.com/uk-ua/windows-hardware/drivers/display/gpuview-main-window) | Official Windows driver documentation. | CPU idle, hardware queues, and timeline views are relevant to cross-CPU/GPU attribution. The tooling is Windows-specific and therefore is not named in the skill. |

## Claims used in SKILL.md

The audit supports fixed-step capture, staged counter attribution, distribution rather than average-only evidence, CPU/GPU timelines, and transfer/synchronization accounting. Workload axes, fault/load sweeps, authority semantics, state conservation, quality-tier hysteresis, and all acceptance thresholds are project-policy requirements. Client budgets, sample counts, tier values, quality error limits, residency, and confidence rules remain unknown blockers until declared and measured.
