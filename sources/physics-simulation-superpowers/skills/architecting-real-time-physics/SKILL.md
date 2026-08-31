---
name: architecting-real-time-physics
description: Use when designing or changing real-time physics architecture, units/scale, fixed timestep, authority, budgets, 物理架构、固定步长 or 单位比例.
---

# Architecting Real-Time Physics

Core principle: Validate the physics contract before selecting tuning constants.

## Physics Contract

Produce this compact contract before implementation or coefficient advice:

- gameplay authority and cosmetic boundaries;
- coordinate system, units/scale, and plausible mass/speed ranges;
- render FPS, physics_hz, fixed_dt_seconds, and real seconds;
- max substeps and overload/catch-up policy;
- body/collision/CCD representation;
- network authority, prediction, and determinism scope;
- target platform plus CPU/GPU/memory/active-body/contact budgets;
- seed and observable trace metrics;
- acceptance scenes/tolerances; and
- degradation ladder and stop conditions.

Completeness rule: Even under a direct-tuning request, enumerate all ten Physics Contract fields, marking each unknown, assumption, or decision needed; never substitute a partial checklist. For multiplayer, explicitly define the server-authoritative gameplay vs client-predicted/cosmetic boundary. For the budget field, spell out each budget dimension separately: CPU ms, GPU ms, memory MB, active bodies, and contacts; never collapse or omit memory.

Always end with a concrete `First experiment`: seed; fixed scene/input; baseline/control; measured metrics; declared tolerances/budgets (mark unknown rather than invent); and accept/reject/stop decision.

Start from a measured 60 FPS product target and a 60 Hz physics starting hypothesis, not an invariant law. Decouple render cadence from fixed simulation: a 30 FPS renderer may retain 60 Hz physics when gameplay needs it. 120 Hz physics is adopted only when measured benefit justifies roughly doubled step work. Do not naively multiply forces, impulses, damping, or solver iterations with frame rate; revalidate stability, compliance, controller gains, and budgets whenever the step changes.

## Decision Rule

Do not emit magic coefficients while scale, timestep, authority, or budget is unknown. State assumptions, request only decision-changing facts, and propose instrumentation and acceptance tests. Offer dimensioned formulas or ranges only after the contract is bounded. Route versioned API symbols to the relevant adapter; this skill stays engine-neutral.

## Evidence and Boundaries

Trace fixed-step timing, CPU/GPU cost, active bodies, contacts, error/penetration, dropped/capped catch-up, and state divergence where the determinism scope requires it. Test representative load, explosion, network, and overload scenes against declared tolerances; then escalate degradation before violating stop conditions. Source anchors are primary fixed-timestep/numerical-stability literature, versioned official engine/backend documentation owned by adapters, `references/sources.lock.json`, and the claim-scoped source audits shipped with this plugin.

## Common Mistakes

- variable-delta authoritative stepping;
- treating render FPS as physics Hz;
- tuning around unit errors;
- unlimited catch-up/substeps;
- claiming deterministic networking without a defined scope; and
- using average FPS as the only budget evidence.
