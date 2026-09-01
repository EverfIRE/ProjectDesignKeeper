---
name: destruction-fracture-fields
description: Use when destruction/fracture/debris/clustering/support graph/damage/strain/field/cache/network or 破坏、断裂、碎块、支撑图、应变、损伤、场、残骸 problems need diagnosis.
---

Sources: primary fracture/destruction, support-graph, rigid-clustering, damage/strain/field, networking literature; official backends. APIs adapter-owned.

## Destruction contract

- Gameplay/cosmetic role, unique authority, stable asset/cluster/piece IDs, ordered events, seeds, checkpoints, runtime-fracture authorization.
- prefracture/runtime/hybrid; define rest topology, hierarchy/clusters, bonds/support graph, anchored/world supports, material/damage/strain/fatigue, thresholds/hysteresis.
- Units/gravity/scale; mass/density/COM/inertia; fixed dt, render-input/event sampling, interpolation, deterministic/replay scope.
- Intact/cluster/fragment bodies; collision proxies/filters/CCD; contacts/manifolds/islands, activation/sleep, separation impulses, initial-overlap handling, measured fragment-fragment policy.
- Mass/momentum/energy accounting, duplicate events, cache invalidation, canonical-topology, stable-child IDs, atomic commit/rollback.
- Fields' shape/frame/falloff/channel/magnitude/duration/order, candidate-filtering, overlap-composition, impulse/work/damage; forbid an unbounded global loop.
- debris lifecycle/state machine: gameplay/cosmetic/sleeping/pooled/despawned; gameplay-safe deactivation, pooling/caching, render/physics separation, dust/VFX, tiers/hysteresis, restoration/checkpoint.
- Piece/cluster/contact/query/field/tear-event/active-body caps, CPU/memory/network budgets, observables, tolerances, cap hits. Unknown topology, gameplay scale, concurrency, network, memory, error, and material decisions block tuning and acceptance. Never infer solver/GPU/rate/cap/lifetime.

## Staged build and diagnosis

1. freeze one server gameplay authority with active request cadence; bundled evaluation: 60-Hz fixed tick.
2. validate intact mass/inertia/collision and static support graph; remove support; recompute connectivity/islands.
3. validate hierarchy/bonds without secondary fracture.
4. add authorized runtime fracture once on authority.
5. add collision from coarse clusters to bounded fragments.
6. add one field channel at a time.
7. add debris lifecycle and replication tiers.
8. stress the worst concurrent chain; profile.

## Authority, budgets, and degradation

- Replicate fracture/damage/release tick/ID/parameters/seed/order; checkpoint gameplay bodies. Cosmetic debris local; never damage/blocking/scoring.
- No 60-Hz cosmetic transforms. Admit before mutation; expose cap hits. Lifecycle follows relevance/visibility/budgets, never universal duration.
- Reversible degradation: coarsen clusters/proxies, cap fracture, use VFX, sleep/pool, reduce fields. Preserve supports/gameplay collision/damage/event order/recoverable state.

## Acceptance

First identical-seed/input A/B: A=current independent client/server fracture + 60-Hz all-piece transforms + permanent detailed rigid/dust + magic solver/GPU/lifetime; B=staged authoritative events + gameplay/cosmetic partition.

Cover single-support removal; below/above-threshold damage; ordered simultaneous hits; progressive collapse; runtime secondary fracture; overlapping directional/radial fields; worst concurrent explosion chain; near/far observers; join-in-progress/checkpoint; packet delay/loss/reorder.

Record support/bond/connectivity/island; damage/strain/fatigue; duplicate/out-of-order events/first replay-divergence tick; topology/cluster/piece counts/stable-ID errors; mass/momentum/energy/work; proxy-error/penetration/CCD; contacts/manifolds/islands/cap hits; active/sleep/pool/despawn counts/transitions; field-candidates/order/impulse; correction-error/delay; bytes/event/bandwidth; memory; CPU p50/p95/p99.

Honor active request budget; undeclared values block acceptance. Bundled evaluation: accept declared finite gameplay/visual/collision/replay/network/memory tolerances, ordered recovery, and worst-case server physics CPU p95 <=3 ms. Ordinary reject nonfatal tolerance/cap failure. Fatal stop and roll back on nonfinite state, corrupt/duplicate topology/IDs, growing penetration/energy, inconsistent support, unauthorized truth, silent cap loss, unrecoverable divergence, or p95 failure.
