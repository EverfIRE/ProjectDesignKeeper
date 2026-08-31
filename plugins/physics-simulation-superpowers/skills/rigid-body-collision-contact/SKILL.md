---
name: rigid-body-collision-contact
description: Use when diagnosing rigid bodies, collision/contact, tunneling, CCD, jitter, stacking, or 刚体、碰撞、接触、穿透、抖动.
---

# Rigid Body Collision & Contact

Core principle: Classify the failure and reduce it to the smallest reproducible contact before changing solver parameters.

Output four sections: `Diagnosis`, `Minimal experiments`, `Scoped change`, and `Acceptance`.

## Diagnosis

Record deterministic seed and initial state. Trace, in order: body type and authority; units/shape thickness/convexity; collision filters; broad-phase candidate generation; narrow-phase/TOI; manifold/contact normal persistence; friction/restitution/material combine; penetration recovery; mass, center of mass and inertia/mass ratios; sleeping/islands; fixed step/substeps; CCD mode/limits; solver residual/iterations; and numerical invalids.

For tunneling, compute per-step travel `speed * fixed_dt`, then compare that travel plus shape sweep radius with the thinnest feature. Separate gameplay ray/shape-query projectiles from simulated rigid projectiles. Apply sweep/TOI/speculative CCD only to justified fast pairs/layers; document initial-overlap, rotation, multiple-impact, dynamic-target, and cost limitations. CCD does not cure stack jitter.

## Minimal experiments

Run one-projectile/one-wall, then one body, two bodies, and a full stack using 2-box and 20-box scenes. A/B discrete versus targeted-CCD with identical seed, geometry, initial state, and input. Record miss count/first failed tick; contact/manifold count and lifetime; max penetration; max constraint/contact error; residual linear/angular speed after settling; active/sleeping bodies; and p50/p95/p99 physics CPU.

## Scoped change

Do not prescribe blanket CCD, global substeps, or global iteration increases under an unmeasured budget. For a measured fast pair, scope CCD/query layers and verify its limits. For a stack, use simple supported collision representations, plausible scale/mass/inertia, zero/controlled restitution, persistent manifolds, bounded penetration recovery, sleeping, and island telemetry before increasing only relevant solver work. Do not hide instability with damping alone.

## Acceptance

Honor active request cadence/budget; undeclared values block acceptance. Accept zero tolerated missed hits for the tested envelope; declare project-specific penetration and jitter tolerances explicitly, leaving unknown tolerances unknown. Bundled evaluation: p95 physics CPU at or below 2 ms. Report the chosen scoped change, A/B evidence, limitations, and rollback condition.

Source anchors: primary CCD/contact/solver literature, adapter-owned official backend documentation, shipped source lock/audits. Common mistakes: non-convex dynamic meshes without support; extreme mass ratios; using visual scale as collision scale; variable delta; excessive restitution; global CCD/iterations; random parameter churn; average-only timing.
