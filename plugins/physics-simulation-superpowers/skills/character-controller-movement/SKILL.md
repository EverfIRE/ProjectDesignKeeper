---
name: character-controller-movement
description: Use when character/controller/locomotion/grounding/slopes/steps/moving platforms/crouch/pushing/fixed tick or 角色控制器、接地、斜坡、台阶、移动平台、蹲起 problems need diagnosis.
---

Preserve pre-tuning-representation; fixed-tick-state-machine; explicit-shape-queries.

Output exactly: `Controller contract`, `Query/state pipeline`, `Platform/crouch/push plan`, `Acceptance`. Engine-specific/versioned-API-symbols: adapters-only; emit-none.

## Controller contract

- kinematic/dynamic/hybrid representation; single simulation-pose-owner;
- Choose gameplay/network authority or mark unknown/blocking. Choose one-way/two-way dynamic-body-coupling; define representation/authority-consistent reaction-semantics.
- world-up/gravity; units/scale; standing/crouching-capsule-dimensions; skin/contact-offset; walkable-slope; step/clearance;
- fixed-dt; render-input sample/cache/consume; desired-velocity/displacement; acceleration/braking/jump-semantics; render-interpolation;
- collision/query masks; triggers; one-way surfaces; initial overlaps; query/iteration-budgets/caps: unknown until measured/declared; never invent constants;
- Total declared-threshold transitions/hysteresis: ground retain/exit=normal+separation+relative-normal-velocity; steep enter/exit=slope; step=block+clearance+landing. JumpStart entry requires valid support; post-snapshot/inherit/detach Jumping persists independently until explicit world-vertical apex/ceiling/declared exit. Never cleared-support state. Non-jump support-loss -> Falling regardless world-vertical sign; total transitions, no unnamed gap. Landing/reacquire=GroundAcquire/Snap(same-candidate normal/separation/nonseparating-relative-normal/walkability/no-Jumping/no-intentional-ascent); forbid unconstrained landing-predicate alternatives. Thresholds stay unknown;
- support-body/shape/feature, point/normal/separation/relative-normal-velocity, previous/current-transforms/velocities;
- platform-discontinuity/teleport-policy; push-limits/observables/acceptance-budgets.

## Query/state pipeline

1. sample cached-render-input once/fixed-tick;
2. validate-prior-support; route previous/current-transform linear/angular-point-motion through same-collision-path;
3. validate crouch/stand-target-shape/clearance;
4. integrate declared-model desired-relative-motion;
5. capped TOI shape-casts/sweeps: initial-overlap-recovery/slide/recasts;
6. blocking-candidate only: up-clearance -> forward -> down; require clear-volume, declared-height, walkable-landing;
7. Ground/probe/snap uses candidate-support relative-normal approach velocity; include normal/separation. Snap has separate r_n<=nu_snap with declared nu_snap<=0; never reuse GroundRetain velocity bound. Snap also requires declared not-jumping/no-intentional-ascent; steep-slope/ledge policy;
8. commit state/support/velocity, bounded-authorized push, previous/current simulation-poses; then render-interpolate.

## Platform/crouch/push plan

support-local-anchor/body-shape-identity; no-parenting. Snapshot valid support-point velocity; inherit once before detach, then clear support. Transfer/loss clears stale-support/inheritance; discontinuity detach/requery absent validated teleport-policy.

Crouch/stand preserves foot/COM-anchor; stand needs target-shape overlap/cast clearance; bounded contact impulse/force exchange by representation, effective masses, authority, gameplay caps; never write dynamic-body transform/arbitrary velocity.

## Acceptance

Identical-seed A/B: current direct-transform/single-ray/downward-force/parenting baseline/fixed-tick; flat ground; 35-degree slope both ways. Scenario geometry is test input, never a tuning/acceptance threshold: test 0.3 m by the project's declared step rule plus a separately declared above-limit obstacle; undeclared step limit stays unknown. Translating/rotating platforms' walk/jump; ceiling crouch; declared light/heavy pushes.

State-transition/chatter counts; ground-separation/normal-angle/relative-normal-velocity; penetration/depenetration; step candidates/success/failure; local-anchor drift/platform slip; takeoff-velocity error and duplicate inheritance; crouch false accepts/rejects; push impulse/body speed/penetration; query/cast/recast/overlap counts and cap hits; active-contacts; p50/p95/p99 CPU.

Honor active request cadence/budget; undeclared values block acceptance. Bundled evaluation: accept declared tolerances, stable classification, exactly-once inheritance, bounded pushes, finite motion, and p95 <= 1 ms. Undeclared tolerances remain unknown. Stop/roll back: nonfinite state; penetration/depenetration growth; persistent chatter; platform discontinuity/duplicate inheritance; cap exhaustion; p95 failure.

Primary collision-query/controller material; adapter-owned versioned docs; shipped audits. Ray-only grounding; render/simulation dual ownership; normal-only ground; ascending snap; unchecked step clearance/landing; stale support; double inheritance; parenting; unchecked resize; unbounded pushes; average-only timing.
