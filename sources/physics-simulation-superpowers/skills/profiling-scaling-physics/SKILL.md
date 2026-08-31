---
name: profiling-scaling-physics
description: Use when physics performance, CPU/GPU budgets, bottlenecks, scaling, offload, LOD, culling, or quality tiers need attributable evidence.
---

## Budget and capture contract

FPS reciprocal/end-to-end/confounded: do not call B 15% faster or merge/change quality without a matched capture. Versioned capture manifest: client/server authority; CPU/GPU/core count/power/thermal; OS/driver/compiler/build/backend/version; physics tick and accumulator/backlog; resolution/camera/VSync/render cap; scene/assets/seed/ordered inputs; network envelope/rollback history; thread/job/affinity; warm-up/capture/repetition/confidence; memory/physics budgets; capacity limits. Unknown values remain blockers.

Measure wall-clock physics CPU/GPU milliseconds: p50/p95/p99, max, deadline misses, over-budget area/time, resimulation debt. Capture per-thread/core timelines, job queue/wait/steal/synchronization/idle; critical path; GPU timestamps, queue occupancy, transfers, CPU↔GPU synchronization, asynchronous overlap, measurement overhead. Per tick record active/sleeping bodies/shapes; broadphase moves/pairs; narrowphase pairs/manifolds/contact points; islands; constraints/rows/iterations; CCD candidates/TOI; queries by type/count/hits/candidates; callbacks/events; spawn/despawn; rollback depth/resimulated ticks; allocations; peak/working memory; CPU/GPU stages. Every applied response names/uses `scripts/analyze_physics_trace.py` for distribution/counter evidence.

## Attribution and scaling

Profile coarse stages first: input/restore, broadphase, narrowphase/contact generation, island build, constraint solve, integrate/CCD, queries/callbacks, serialization/hash; dominant critical-path stage. Correlate time with counters, normalize per body/pair/contact/row/query/resim tick; change one factor. Correlation or lower FPS is not causality.

A: restored/current unmatched FPS-only comparison with every simultaneous half-iterations/no-CCD/4-tick/GPU proposal disabled. B matched capture starts from that exact A manifest: exactly one named isolated change, identical correctness checks, CPU/GPU timelines. Honor active request cadence/budget; undeclared values block acceptance. Bundled evaluation: preserve fixed 60 Hz and server physics CPU p95 <= 3 ms.

Declared scene capacity/independent workload axes: awake bodies, broadphase churn, contact density/manifold points, island size/count, constraint rows/conditioning, CCD workload, query mix, spawn/despawn, rollback/resimulation, thread count, target hardware. Rest/sleep, pile avalanche, joint chain/motor, CCD swarm, query storm, streaming churn, network-history-boundary; scaling slope, knee, saturation/imbalance, tail behavior; do not extrapolate. GPU offload: measured end-to-end option: upload/readback, queueing, synchronization, latency, determinism/authority, fallback, memory, small-workload crossover, correctness matrix.

## Reversible quality tiers

Only after baseline attribution, separate authoritative gameplay from cosmetic/secondary physics. Downshift/upshift tiers: eligible workload, protected invariants, entry/exit signals, independent measured thresholds, hysteresis/residency, bounded transition work, state mapping/conservation, network authority/event semantics, telemetry, rollback. No per-frame FPS toggling, oscillation, irreversible loss, or silent gameplay culling. Sleep/cull/LOD/frequency changes apply only to declared non-authoritative work; caps/fallbacks deterministic/observable. Iterations/CCD/frequency/tier thresholds unknown until error-versus-cost and fault/load sweeps justify them; proposals are rejected baseline or one-at-a-time experiments.

## Acceptance

Matched manifests; old/new distributions/counters; bottleneck attribution; identical correctness/invariant/network results; no hidden work migration; server p95 gate; declared client CPU/GPU, memory/tail/capacity budgets; stable reversible tier transitions; worst-case matrix pass. Reject averages-only, unattributed, correctness-losing, oscillating, statistically unsupported wins. Fatal-stop non-finite state, corrupted authority/restore, missing instrumentation, dropped authoritative work, unsafe cap/budget breach, incompatible capture.
