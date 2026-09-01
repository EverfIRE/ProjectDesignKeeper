# Unreal Chaos operational reference

Use only the section selected by the gated task. This snapshot maps official public Epic documentation; it is not a substitute for checking the declared build. Exact symbols, nodes, cvars, settings, paths, plugin availability, and maturity must be verified in that build.

**Applied-answer contract (mandatory):** Once this adapter is selected, the relevant version gate, domain routes, paired CVD/timing evidence, network fields, migration ledger, source matrix, exact-build verification, and fatal-stop matrix are visible answer content, not background-only guidance.

## Source/version and surface matrix

All pages below were actually read on 2026-08-27. Their visible page label was **Unreal Engine 5.8 Documentation** unless noted. No licensed Epic source checkout, tag, or commit was accessed; where the task supplies a source build, inspect that exact authorized commit separately.

| URL/path | Page/version selector or source tag/commit | Access date | Feature | Maturity/surface | Claims used | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| [Physics](https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-in-unreal-engine) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Chaos feature map | Public overview; editor/runtime concepts | Chaos covers rigid bodies, networked physics, CVD, vehicles, cloth, flesh, and destruction | Overview does not verify project plugins, symbols, or network fitness |
| [Simple versus Complex Collision](https://dev.epicgames.com/documentation/unreal-engine/simple-versus-complex-collision-in-unreal-engine) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Query/simulation geometry | Public editor concept | Simple and complex shapes have different query/simulation roles; complex-as-simple has simulation limits | Asset cooking, platform, and exact enum/UI surface remain build-specific |
| [Physics Sub-Stepping](https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-sub-stepping-in-unreal-engine) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Substeps/callbacks | Public project workflow | Substeps trade CPU for stability; callback delivery and force/target bookkeeping span substeps | Page contains legacy caveats; it does not establish async safety or correct values |
| [Networked Physics Overview](https://dev.epicgames.com/documentation/unreal-engine/networked-physics-overview?lang=en-US) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Replication/prediction/resimulation | Public conceptual/C++ workflow | Resimulation needs server authority, cached histories, correction, rewind, and re-simulation | Modes, settings, cvars, component APIs, and maturity must be rechecked per build |
| [Getting Started with CVD](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-chaos-visual-debugger) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Physics-state debugging | Editor/runtime recorder; standalone requires source build | CVD can inspect particles, geometry, collision/joint constraints, ground constraints, and scene queries | Recorded channels/configurations vary; CVD is not timing attribution |
| [Capturing Data with CVD](https://dev.epicgames.com/documentation/en-us/unreal-engine/capturing-data-with-chaos-visual-debugger) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Capture provenance | Client/server, packaged, PIE capture workflow | Data channels and build configuration affect visibility and capture cost | Exact launch commands/paths are gated; capture overhead must be measured |
| [Timing Insights](https://dev.epicgames.com/documentation/unreal-engine/timing-insights-in-unreal-engine) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | CPU/GPU timing | Unreal Insights trace-analysis surface | CPU/GPU tracks, timers, counters, tasks, threads, callers/callees support attribution | Available events/channels depend on instrumentation and build |
| [Physics Asset Editor](https://dev.epicgames.com/documentation/unreal-engine/physics-asset-editor-in-unreal-engine?lang=en-US) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Bodies/constraints/ragdolls | Editor asset workflow | Physics Assets own Skeletal Mesh collision bodies and constraints | Does not establish stable drive values or runtime/network authority |
| [Chaos Vehicles](https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-vehicles) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Vehicle system | Public system landing page; plugin/version-sensitive | Current workflow is Chaos Vehicles, not PhysX Vehicles | Exact plugin/API and network behavior require declared build verification |
| [Chaos Modular Vehicles](https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-modular-vehicles-overview) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Modular vehicle system | Separate plugin/system with stated resimulation focus and limitations | Vehicle systems coexist and differ in asset topology and network design | Do not infer availability or choose it without version, plugin, and requirements |
| [Clothing Tool](https://dev.epicgames.com/documentation/unreal-engine/clothing-tool-in-unreal-engine?lang=en-US) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Chaos Cloth | Editor cloth-authoring overview | Chaos Cloth has its own solver, assets, collisions, and debug workflow | Legacy and panel/Dataflow workflows vary by version |
| [Chaos Flesh Overview](https://dev.epicgames.com/documentation/unreal-engine/chaos-flesh-overview) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Flesh/deformables | Dataflow/solver/runtime/cache workflow | Flesh uses tetrahedral data, a solver owner, tick ordering, collision, and cache options | Plugin maturity, server behavior, and authority are not guaranteed |
| [Geometry Collections](https://dev.epicgames.com/documentation/unreal-engine/geometry-collections-user-guide) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Destruction assets | Fracture editor + runtime asset workflow | Geometry Collections are authored/fractured assets for Chaos Destruction | Replication, cache/event semantics, and budget require project evidence |
| [Chaos Fields](https://dev.epicgames.com/documentation/unreal-engine/chaos-fields-user-guide-in-unreal-engine?lang=en-US) | Page label: Unreal Engine 5.8 Documentation; no source tag/commit | 2026-08-27 | Fields | Editor/Blueprint concepts | Anchor, strain/force, and sleep/disable fields affect simulations differently | Exact Blueprint assets/nodes and network semantics are gated |
| [UE 5.8 Release Notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes) | Page label: Unreal Engine 5.8 Documentation; release 5.8, no source commit | 2026-08-27 | Change/maturity evidence | Release notes | CVD, cloth, fracture, and core Chaos surfaces continue changing | Release notes are not a complete API or plugin support contract |

Community sources may discover search terms only. They cannot establish current APIs, settings, maturity, or supported surfaces.

## Reproduction manifest and ownership

Freeze one manifest before intervention:

- **Build:** exact major/minor/patch/hotfix, Launcher versus source commit, Chaos/backend compile flags, plugins and experimental status, platform, configuration, dedicated server/client/editor/runtime.
- **Scene:** map/asset hashes, seed, ordered inputs, reproduction steps; body/contact/constraint/query/cloth/flesh/destruction counts; units, scale, mass/inertia ranges; geometry, filters, CCD, sleep/wake.
- **Cadence:** target and actual game/physics cadence, frame delta, accumulator/backlog/catch-up policy, substep/async settings, tick groups, thread/state-handoff points.
- **Network:** gameplay owner, replication/prediction model, input/state history length, correction thresholds, rewind/resimulation/replay policy, RTT/jitter/loss, event semantics.
- **Evidence:** hardware, capture ID, build/config/map/seed IDs, CVD channels, trace/timing channels, warm-up/sample/repetitions, p50/p95/p99, invariants, tolerances, budgets.

Ownership table:

| Boundary | Declare before testing |
| --- | --- |
| Gameplay | dedicated-server/client/replay roles; authoritative versus cosmetic state |
| Surface | Blueprint, C++, console/config, editor/debug owner and build availability |
| Thread | game-thread writer, physics-thread writer, async callback lifetime, buffering/state handoff |
| Domain | component, Physics Asset, cloth/flesh/vehicle/destruction asset, plugin, solver/world owner |
| Capability | current, experimental, unsupported, removed, unknown, or version-specific |

## Collision/contact/query/CCD

- **plugin/asset/runtime context:** rigid-body component and cooked collision asset; simple-versus-complex geometry; channels/profiles/query type; server/editor/runtime cooking; scale, velocity, mass/inertia, sleep, CCD eligibility.
- **evidence:** CVD particles, geometry, filters, scene queries, contact pairs/constraints, velocities, sleep/wake, first penetration/tunnel tick; matched timing capture and pair/contact/query counts.
- **core route:** `rigid-body-collision-contact`; use `debugging-testing-physics` for trace/repro and `profiling-scaling-physics` for cost.
- **version/maturity boundary:** exact enum names, C++/Blueprint query calls, cvars, UI locations, geometry support, and CVD channels are version-specific.

For pile jitter/tunneling, first test units/scale, initial overlap, simple-versus-complex choice, filters, mass/inertia ratios, velocities, geometry margins, CCD eligibility, contact normals/depths, constraint errors, sleep/wake, and cadence. Do not start by increasing iterations. Each hypothesis gets a same-manifest one-change run.

## Constraints, Physics Assets and ragdolls

- **plugin/asset/runtime context:** Skeletal Mesh and exact Physics Asset; body primitives, constraint frames/limits, collision disable pairs, profiles, drives/physical animation owner, animation-to-physics handoff, server instancing.
- **evidence:** asset revision, body/constraint hierarchy, CVD joint/contact state, target/error/impulse histories, pose ownership and transition tick, matched timing.
- **core route:** `constraints-ragdolls-active-physics`; character locomotion separately uses `character-controller-movement`.
- **version/maturity boundary:** editor fields, drive implementations, animation nodes, profiles, server options, and runtime symbols must be verified in the declared build.

Test isolated bodies/frames/limits, then passive chain, ragdoll activation, drives, animation blending, contacts, recovery, and network correction. A vehicle suspension, ragdoll drive, cloth constraint, and Flesh constraint are not one global tuning surface.

## Fixed, substepped and async scheduling

Distinguish four cases: fixed game/physics cadence; variable frame-dependent stepping; substeps within a frame; async/dedicated physics with buffered state handoff. Record actual delta, steps, backlog and dropped/capped time—not only the target.

Substeps may repeat/interpolate force and target work and defer callbacks; async changes latency, ownership, and read/write timing. Treat every callback/read/write surface as thread-unsafe until the exact build documents or source-verifies it. Identify producer, consumer, lifetime, buffer, timestamp, and synchronization for inputs, states, events, queries, and teardown. Route architecture to `architecting-real-time-physics` and evidence to `debugging-testing-physics`. Never enable async, substeps, iterations, and CCD changes together; measure correctness plus p50/p95/p99 for one variable.

## Networked physics, prediction and resimulation

Networked Chaos is a policy, not bitwise determinism. Declare server authority, predicted actors, interpolation-only actors, cosmetic systems, input/state schema, history length, frame IDs, correction thresholds, rewind/resimulation scope, and replay event policy. Replicated transforms are corrections, not proof.

Evidence matrix includes clean LAN plus RTT/jitter/loss/reorder/duplicate/drop/burst conditions; history boundary and exhaustion; late/invalid inputs; correction frequency/magnitude; first divergent frame; hash/state comparisons; create/destroy/contact/break/sleep events; replay seek; rollback through vehicle/ragdoll interactions. Preserve ordered inputs, authoritative snapshots, capture IDs, and event logs. Route to `networked-deterministic-physics`. Cloth, Flesh, and destruction remain cosmetic unless an explicit authoritative contract and tests say otherwise.

## Chaos Vehicles

- **plugin/asset/runtime context:** choose the exact Chaos vehicle system/plugin; vehicle topology, Physics Asset or Geometry Collection, wheels/modules, inputs, runtime target, authority and resimulation support.
- **evidence:** asset/plugin versions, suspension contacts, wheel loads/slip, chassis state, input/history/correction, CVD rigid/contact evidence and timing.
- **core route:** `vehicle-physics` plus `networked-deterministic-physics` when predicted.
- **version/maturity boundary:** classic and modular Chaos vehicle systems coexist with different limitations; verify plugin, nodes, C++ surface, and network claims in the target build.

Do not translate `PxVehicleDrive4W` into a guessed Chaos class. Build an explicit migration row and compile/test the selected replacement.

## Chaos Cloth and Flesh

Treat Cloth and Flesh as separate owners.

| Domain | plugin/asset/runtime context | evidence | core route | version/maturity boundary |
| --- | --- | --- | --- | --- |
| Cloth | exact cloth workflow/asset, solver/config, skeletal/static host, colliders, LOD, cache, editor/runtime/server role | asset revision, particle/collider/debug views, penetration/stretch, tick cost, authority | `cloth-rope-soft-bodies` | legacy versus panel/Dataflow workflows, nodes, debug commands, and server behavior are version-specific |
| Flesh | plugin, Dataflow/tetrahedral asset, solver actor, world interaction, tick order, cache/deformer, runtime/server role | tet/constraint/collision evidence, solver/tick order, deformation error, cache/live comparison, timing | `cloth-rope-soft-bodies` | plugin maturity, nodes, collision support, cache/runtime/network surfaces may be experimental or unknown |

Never silently make either authoritative. Validate rigid coupling and authority separately from visual quality.

## Geometry Collections, Fracture and Fields

- **plugin/asset/runtime context:** Geometry Collection revision, fracture hierarchy/clusters, collision geometry, damage/strain, cache, event generation, field type/owner, runtime and replication role.
- **evidence:** fracture/cluster state, contacts, break/collision events, field application, cache/live comparison, authoritative event log, counts and timing.
- **core route:** `destruction-fracture-fields`; network semantics also use `networked-deterministic-physics`.
- **version/maturity boundary:** Fracture Mode, Dataflow, cache, fields, nodes, event/replication surfaces, and supported geometry are version-specific.

Do not replace `UDestructibleComponent`/APEX with a guessed class. Define whether live fracture, server events, deterministic cache playback, or cosmetic playback owns gameplay.

## CVD, Insights, profiling and automation

CVD answers physics-state questions: body/geometry/filter state, scene queries, collision/joint constraints, solver/substep/resimulation context when recorded. Unreal Insights/Timing Insights or documented build statistics answer CPU/GPU thread/task/timer/counter attribution. Use both in a matched pair; CVD or rendered FPS alone is incomplete.

For every experiment preserve engine/build/config/map/seed/capture ID, target hardware, channel set and capture overhead. Run baseline A and one-change B with identical ordered inputs and correctness checks. Report physics p50/p95/p99, missed steps/backlog, domain counts, first divergence, and capture links. Automation must verify the exact symbols compile, Blueprint nodes load/execute, settings exist in the declared build, and artifacts replay on the intended runtime.

## PhysX/APEX migration ledger

Legacy names appear here only as rejected inventory.

| Old symbol/advice | Last verified context | Current Chaos concept | Supported surface | Verification source | Owner | Replacement status | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PhysXScene` / `PxScene` access | UE4/PhysX-era advice; exact last release unknown from sources read | World/solver/query access needed by the use case | unknown until build/source inspection | exact authorized build plus official Epic docs | C++ physics integration | removed/unsupported as a current UE5 prescription | compile plus runtime query/state test |
| PhysX Visual Debugger / PVD | PhysX-era debugger | CVD state/query/constraint capture plus Insights timing | version-specific editor/runtime/source-build surfaces | CVD and Timing Insights rows above | debugging/performance | removed as current Chaos evidence path | matched CVD + timing capture |
| `UDestructibleComponent` / APEX Destruction | UE4/APEX-era destruction | Geometry Collections, Fracture, Fields, cache/events | version-specific; do not guess class/node | Geometry Collections/Fields docs plus target build | destruction/assets/network | removed/unsupported; replacement pending requirements | asset conversion, fracture/event/replay test |
| `PxVehicleDrive4W` / PhysX Vehicles | PhysX vehicle workflow | declared Chaos Vehicles or Modular Vehicles design | plugin and version-specific | vehicle docs plus target build | vehicle/network | removed/unsupported; selection pending | compile/assets/input/history/correction test |
| Increase iterations + substep + async + disable CCD | unsourced multi-toggle advice | isolated hypothesis experiments | unsupported as a combined fix | matched evidence only | domain owners | rejected | one-variable correctness and cost matrix |

Use status `unsupported`, `removed`, `experimental`, `unknown`, or `version-specific` when evidence cannot prove more.

## Acceptance matrices and core/research routes

Use the active request's declared cadence and total budget unchanged; if undeclared, block acceptance. Bundled evaluation only: target-hardware 60 Hz and server physics CPU p95 <= 3 ms. Acceptance requires: exact version/plugin gate; deterministic-by-input minimal repro; domain owner and core route; no affirmative legacy path; matched one-change CVD plus timing evidence; collision/contact/constraint tolerances; packet-fault/history/correction/hash/event/replay/rollback matrix; separate vehicle, ragdoll, Cloth, Flesh, and destruction tests; exact C++ compile and Blueprint/settings verification; source matrix coverage for every version-sensitive claim.

Fatal-stop for non-finite state, authority/history corruption, thread-unsafe access, unsupported geometry/plugin/API, missing capture provenance, unsafe budget breach, or advice that cannot be reproduced in the declared build.

Core route quick reference: collision `rigid-body-collision-contact`; cadence `architecting-real-time-physics`; constraints/ragdolls `constraints-ragdolls-active-physics`; character `character-controller-movement`; network `networked-deterministic-physics`; vehicles `vehicle-physics`; deformables `cloth-rope-soft-bodies`; destruction `destruction-fracture-fields`; evidence `debugging-testing-physics`; cost `profiling-scaling-physics`. Research questions route through `surveying-real-time-physics-research`, `reviewing-simulation-papers`, `designing-simulation-experiments`, `analyzing-simulation-evidence`, `reproducing-simulation-papers`, and `translating-research-to-game-physics`; this adapter only maps UE/Chaos surfaces.
