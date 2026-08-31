---
name: constraints-ragdolls-active-physics
description: Use when diagnosing constraints/joints/motors/drives/ragdolls/physical animation/PBD/XPBD and 约束、关节、布娃娃、主动物理.
---

# Constraints, Ragdolls & Active Physics

Core principle: remove pose-ownership, frame, collision, and energy-injection conflicts before tuning gains or iterations.

Output `Model contract`, `Isolation ladder`, `Drive/recovery plan`, and `Acceptance`.

Response completeness: every answer must enumerate every Model contract field, every ladder stage in order, the complete First experiment including accept/reject/stop, every Acceptance metric, both unknown declarations, and all four rollback triggers (energy, persistent saturation, failed/nonreproducible recovery, p95 above budget); never silently compress/omit them.

## Model contract

At the fixed tick, establish animation-versus-physics pose ownership at the fixed tick; parent/child body mapping and local constraint frames/axes/rest pose; angular/linear limits; collision shapes, adjacent-body filters, ground contacts and initial overlap; mass/inertia/COM ratios; constraint formulation and PBD/XPBD compliance; motor/drive target convention and quaternion shortest-arc error; force/torque/impulse/target-velocity limits; timestep/substeps/iterations; network/gameplay authority; and transition momentum/target continuity. Animation may provide targets but must not overwrite simulated transforms.

## Isolation ladder

Use passive bodies -> limits without drives -> one joint -> one chain -> full ragdoll -> ground/support -> recovery. At every stage retain the same seed/initial state, add one mechanism, and do not proceed while errors/energy grow. Recovery ramps targets/limits only after support and pose feasibility are measured.

## Drive/recovery plan

Derive stiffness/damping/compliance from body inertia, fixed dt, desired response and backend semantics. A drive starts bounded, records saturation, and is tuned only after frames/limits/masses/collisions are correct. XPBD-style compliance may reduce timestep/iteration dependence but never removes revalidation. Do not prescribe global 32 iterations, unbounded stiffness/torque, arbitrary substeps, damping-only masking, or a magic recovery duration.

First experiment: identical seeded fall/recovery input; A/B direct animation writes on/off, then passive versus bounded single-joint drive; inspect frames and collision overlap; decide accept/reject/stop from error, energy, saturation, recovery, and budget evidence.

## Acceptance

Honor active request cadence/budget; undeclared values block acceptance. Record per-joint max/RMS angular and linear constraint error; limit violations; drive torque/impulse saturation; injected/kinetic energy; penetration; residual linear/angular speed; support/contact state; recovery time/failure; active/sleeping bodies; p50/p95/p99 CPU. Bundled evaluation: accept declared project tolerances, no nonfinite/explosive energy growth, reproducible recovery, and p95 <=2 ms for this 60 Hz scenario. Undeclared tolerances remain unknown; if no recovery duration is declared, recovery duration remains unknown. Stop and roll back any trial with growing energy, persistent drive saturation, failed/nonreproducible recovery, or p95 CPU above the active request budget.

Source anchors: primary PBD/XPBD/constraint stabilization literature, adapter-owned documentation, shipped source lock/audits. Common mistakes: mismatched frames; dual pose ownership; extreme mass ratios; overlapping adjacent shapes; gain tuning before limits; timestep-dependent stiffness assumptions; unlimited motors; global solver escalation.
