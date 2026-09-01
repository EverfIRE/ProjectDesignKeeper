---
name: vehicle-physics
description: Use when vehicle/car/wheel/suspension/tire/drivetrain/aero/handling/telemetry/network authority/fixed tick or 车辆、汽车、车轮、悬挂、轮胎、传动、操控、联机 problems need diagnosis.
---

Vehicle-dynamics texts/papers; adapter-owned official samples; shipped source lock/audits. Render-force, unqualified-ray, world-velocity-damping, scalar-friction, missing combined-slip/low-speed-regularization, aero-contact-cure, locked-COM/inertia, ground-steering-in-air, dual-pose-owner, averages-only telemetry. APIs adapter-only.

## Vehicle contract

- arcade/hybrid/simulation fidelity and ray/sweep-or-shape-cast/rigid-contact wheels; gameplay/network authority; prediction/interpolation/correction boundaries; single authoritative simulation-pose owner.
- Unresolved fidelity OR contact representation blocks tuning AND acceptance.
- world-up/gravity/units; chassis mass/dimensions/wheelbase/tracks/COM/inertia tensor; wheel radius/width/mass/inertia; driven/steered/braked layout.
- fixed-dt; render-input sample/cache/exactly-once consumption; render interpolation. Any substep/iteration values remain measured unknowns.
- suspension hardpoints/axes/rest-length/travel/spring/damper/bump-droop stops; unsprung representation/contact filters/initial-overlap/curb-edge policy.
- tire contact-frame/normal-load/longitudinal-lateral slip/combined-slip; low-speed regularization/load-sensitivity/surface/relaxation/force-caps/signs.
- torque-curve/clutch/gears/differential/final-drive/wheel-angular dynamics; brakes/handbrake/reverse/hill-hold.
- aero application-points; drag/downforce-centers/weight-transfer; steering/assists/traction/ABS/stability/airborne policy; telemetry/budgets/reversible degradation. All missing project values stay unknown; never infer coefficients, COM, gearing, assists, queries, or tolerances from symptoms/test rates.

## Staged diagnosis

1. freeze networking/assists; verify one-authority, scale, finite-mass/inertia, transform-ownership, fixed tick, timestamped-inputs, interpolation.
2. geometry/COM/inertia/filters/contact normals-points/curbs without propulsion.
3. one-wheel-or-quarter-car suspension: compression, relative axial velocity, signs, stops, application point, energy, contact loss; never render-delta.
4. four-wheel equilibrium/drop/landing before tires; separate aliasing/discontinuity, damping regime, and energy injection.
5. longitudinal then lateral tires/combined slip/surface transitions; separate slip/load defects from suspension.
6. drivetrain/brakes/steering/assists, then aero; speed-relative aero never repairs contacts.
7. authoritative networking/prediction/interpolation/correction/cosmetic wheels; never dual-own chassis transform.
8. profile; measured query/substep/LOD tiers only after correctness.

## Forces, controls, and networking

- Relative chassis/wheel contact-point velocities projected on suspension axis; compression/force signs; equal/opposite reactions when represented; force-versus-impulse units match integration mode.
- Wheel circumferential speed versus patch-relative velocity with near-zero-speed handling; constrain forces by declared combined-slip law and available normal load. Integrate drive/brake/tire-reaction torques through declared differential flow.
- Ground steering is tire-mediated; airborne control absent unless declared arcade authority. Server-authoritative competitive chassis; client history/prediction receives explicit corrections. Cosmetic wheels never feed authoritative contacts. Degrade measured fidelity/LOD reversibly; authority/fixed-step/collision-safety/gameplay contacts never degrade.

## Acceptance

identical-seed/identical-input A/B current render-force/ray/render-delta/direct-sync versus staged; fixed geometry/surfaces/state/authority; render 30/60/120 FPS; physics 60 Hz in bundled evaluation. Honor active request cadence. straight/coast; circle/slalom; hill; two-sided-curb; drop/landing; jump; brake/reverse; surface-transition; server-correction.

per-wheel hit/point/normal/compression/travel/cap/relative-axial-speed/forces/load/slips/utilization/angular-speed/torques; chassis pose/velocities/COM/inertia/contacts/penetration/energy-work/acceleration/speed/yaw-roll; assists/airborne effect/authority-correction/replay-hash/query-substep-count/p50-p95-p99.

Honor active request budget; undeclared values block acceptance. Bundled evaluation: accept declared tolerances, bounded states, stable contact/energy, render invariance, declared controls/authority/determinism scope, and CPU p95 <= 2 ms. Reject outside tolerance. Stop and roll back on nonfinite state, growing energy/penetration, persistent unexpected saturation, cap exhaustion, duplicate authority, divergent replay outside scope, or p95 failure.
