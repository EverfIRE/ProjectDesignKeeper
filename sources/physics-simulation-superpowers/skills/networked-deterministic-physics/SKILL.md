---
name: networked-deterministic-physics
description: Use when multiplayer physics, rollback, lockstep, prediction, snapshots, reconciliation, or cross-platform determinism need an explicit network contract.
---

Sources: audit `references/networked-deterministic-physics-source-audit.md`.

## Network contract

Choose server-authoritative gameplay: client prediction/rollback, snapshot interpolation. Server validation is anti-cheat; authoritative convergence is not deterministic replay. Declare authority model; platform/compiler/build/backend matrix; active body/contact/constraint caps; RTT, jitter, loss, reorder; bandwidth/history-memory budgets; permitted correction; rollback window; snapshot/hash rates; determinism tier. Unknowns block acceptance.

Run active request gameplay tick; bundled evaluation uses a 60 Hz gameplay tick. Pack schema/version, player/entity, sequence/tick/ack, input quantization, stable ordering. Buffer late/duplicate/reordered inputs and deduplicate. Parameterize missing-input policy/window/backlog. RTT/jitter/loss/reorder fault-injection evidence under bandwidth/history-memory/CPU budgets selects each missing-input policy, wait window, and backlog treatment; each stays blocked until selected. Never set numeric/example defaults for undeclared rates, thresholds, tolerances, caps, cadences, or windows. Drop stale presentation only; resync when history is missed. Render interpolation reads snapshots.

## Determinism and state contract

Tiers: one local run; same build/config; same binary/architecture/platform; cross-build/platform reproducibility; authority convergence, not deterministic replay. Never collapse qualifiers. Same seed, IEEE floating point, disabled threading, and rounding live state are not proof of cross-platform determinism. Do not round live simulation position/velocity to three decimals.

Restore gameplay state; rigid pose; linear/angular velocity; mass/inertia; flags/sleep; shapes/material/filter; constraints/motors/warm-start; contact/CCD/query caches; RNG streams/substreams; authority/event cursors. If engine-internal state cannot be captured or deterministically rebuilt, full rollback/lockstep is blocked.

Precision, rounding mode, denormals, FMA/SIMD, math-library/compiler fast-math, asset cooking, backend/version. Stable IDs/order for objects, shapes, constraints, contacts, inputs, events, RNG streams, broadphase/manifold/island/solver work, jobs, callbacks. schema/version, units, quantization, byte order, NaN policy, stable field/entity order. Hash inputs, gameplay, physics, events, checkpoints. For evidence, use `scripts/compare_replay_hashes.py`; report first divergent tick, smallest differing layer, smallest differing state component.

## Prediction, rollback, and correction

Tick-indexed inputs/full restorable states. Restore target tick, discard/rebuild invalid caches, resimulate ordered inputs; authoritative side effects are idempotent/tick-keyed, cosmetics separate. Apply authoritative gameplay immediately; smooth only presentation. Hard-resync on missed history, incompatible/non-finite state, exceeded caps, untrusted peer.

## Acceptance

A/B: A=current input-only cross-platform lockstep plus no-thread/three-decimal/single-seed/IEEE claims and no authoritative states. B=server authority + client prediction/rollback + snapshot interpolation. Cover rest, piles, joint chains and motors, sleep/wake, CCD/high-speed impact, simultaneous contacts, spawn/despawn, moving platforms, RNG and events, authority transfer if supported, join-in-progress/reconnect, history boundary, loss/reorder/duplicates, and every declared platform/build.

Honor active request budget; undeclared values block acceptance. Measure layered hashes; state diffs including caches/RNG/events; correction error; rollback depth and resimulation ticks; side-effect duplicates/cancellations; snapshot bytes, bandwidth and history memory; active bodies/contacts/constraints/islands; CPU distributions for capture/hash/restore/resimulation; cap misses and hard resyncs. Bundled evaluation: accept declared limits and server physics CPU p95 <= 4 ms. Reject diagnostic misses; fatal-stop/resync on non-finite/incompatible state, untrusted input, unrecoverable divergence, or budget breach. Unknown thresholds/rates/windows remain blockers.
