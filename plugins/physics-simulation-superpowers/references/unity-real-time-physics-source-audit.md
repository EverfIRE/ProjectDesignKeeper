# Unity real-time physics source audit

Read on 2026-08-28. This audit uses only official Unity authorities and their visible **Unity 6.3 LTS (6000.3)** documentation snapshot. It does not establish the user's unknown editor patch, project packages, exact APIs/settings/UI, platform behavior, or performance; inspect and compile the frozen project before asserting those surfaces.

| Official source | Claim admitted | Limitation retained |
| --- | --- | --- |
| [Unity 6 release support](https://unity.com/releases/unity-6/support) | Unity 6.3 LTS has the documented LTS support context. | Support context is not project-version evidence. |
| [Physics](https://docs.unity3d.com/6000.3/Documentation/Manual/PhysicsSection.html) | 6000.3 labels separate Unity physics integrations, including Built-in 3D. | The overview does not verify a project's backend or settings. |
| [Physics integrations](https://docs.unity3d.com/6000.3/Documentation/Manual/physics-integrations.html) | The 6000.3 snapshot maps Built-in 3D to Nvidia PhysX, Built-in 2D to Box2D, and DOTS to Unity Physics. | This snapshot does not prove the unknown project's selected backend, installed packages, patch behavior, or exact API surface. |
| [Rigidbody](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody.html) | `Rigidbody` is the current 3D rigid-body surface and physics work belongs on the physics cadence. | Exact project behavior must compile/run in the frozen build. |
| [Rigidbody.linearVelocity](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody-linearVelocity.html) | The 6.3 snapshot documents `linearVelocity`. | Do not migrate an unknown project by text replacement. |
| [Rigidbody.linearDamping](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody-linearDamping.html) | The 6.3 snapshot documents `linearDamping`. | Patch and package compatibility remain unproven. |
| [Rigidbody.angularDamping](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody-angularDamping.html) | The 6.3 snapshot documents `angularDamping`. | It does not prescribe tuning values. |
| [Physics.simulationMode](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Physics-simulationMode.html) | The 6.3 snapshot exposes `Physics.simulationMode`. | Manual simulation ownership and exact settings need project verification. |
| [CPU optimization and fixed timestep](https://docs.unity3d.com/6000.3/Documentation/Manual/physics-optimization-cpu-frequency.html) | Fixed-step frequency changes physics work and catch-up behavior. | It does not establish a universal step, cap, or solver value. |
| [Rigidbody.interpolation](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody-interpolation.html) | Interpolation is a Rigidbody presentation surface. | It is not collision, authority, or replay proof. |
| [Rigidbody.collisionDetectionMode](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody-collisionDetectionMode.html) | 3D Rigidbody has collision-detection modes. | Select CCD only from measured motion/collision evidence. |
| [Rigidbody 2D introduction](https://docs.unity3d.com/6000.3/Documentation/Manual/2d-physics/rigidbody/introduction-to-rigidbody-2d.html) | Built-in 2D has its own Rigidbody workflow. | It is not interchangeable with 3D physics. |
| [Rigidbody2D](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody2D.html) | `Rigidbody2D` is a separate current API surface. | Exact version and package compatibility are project-specific. |
| [Physics Profiler](https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerPhysics.html) | The Profiler exposes physics profiling evidence. | Editor FPS alone cannot attribute target-player cost. |
| [2D Physics Profiler](https://docs.unity3d.com/6000.3/Documentation/Manual/2d-physics/physics-2d-profiler-module-reference.html) | 2D profiling has a distinct module/reference. | Capture availability and counters depend on the build. |
| [Unity Physics package](https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.physics.html) | The 6000.3 snapshot lists `com.unity.physics` 1.4.7. | Manifest/lockfile decide the installed package, not this snapshot. |
| [Unity Physics 1.4 manual](https://docs.unity3d.com/Packages/com.unity.physics@1.4/manual/index.html) | Unity Physics is the DOTS/ECS package named `com.unity.physics`. | Entities and package symbols must be gated to the lockfile. |
| [Unity Physics collision queries](https://docs.unity3d.com/Packages/com.unity.physics@1.4/manual/collision-queries.html) | Queries use a broadphase state; update timing changes what they observe. | Query/system names and tick ordering require exact-package verification. |

No community source was used to establish a technical claim. Scenario p95 budgets are acceptance constraints, not sourced Unity performance promises.
