# Physics debugging and testing source audit

Read on 2026-08-27. These are sources actually read for this engine-independent skill; they are evidence for method selection, not copied API advice.

| Source read | Authority and use | Claims used in SKILL.md |
| --- | --- | --- |
| [Box2D Simulation](https://box2d.org/documentation/md_simulation.html) | Official backend documentation. | Fixed stepping makes debugging repeatable; substeps trade accuracy, cost, contact behavior, and constraint response, so they are diagnostic variables rather than blanket fixes. |
| [Jolt Architecture](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md) | Official backend documentation. | Stable ordering, thread callback ordering, state recording/restoration limits, per-step determinism checks, and platform-qualified replay evidence. |
| [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html) | Official LLVM documentation. | First detected corruption should preserve a useful report and stop rather than continue from an inconsistent state; sanitizer builds are diagnostic evidence, not production acceptance. |
| [Hypothesis documentation](https://hypothesis.readthedocs.io/en/latest/) | Official project documentation. | Property tests generate varied and edge-case inputs; they complement targeted regressions. |
| [Metamorphic Testing: A New Approach for Generating Next Test Cases](https://arxiv.org/abs/2002.12543) | Primary paper by Chen, Cheung, and Yiu. | Metamorphic tests derive related follow-up cases when a direct oracle is incomplete; they are distinct from golden and replay comparisons. |
| [Simplifying and Isolating Failure-Inducing Input](https://pm.st.cs.uni-sb.de/papers/tse2002/?lang=en) | Primary research paper by Zeller and Hildebrandt. | Repeated, controlled input deletion/minimization preserves a failure predicate while isolating a minimal reproducer. |

## Claims used in SKILL.md

The audit supports fixed-step and solver sensitivity, collision/constraint state capture, deterministic replay, first-fault termination, delta debugging, property testing, and metamorphic testing. World-unit/scale declarations, golden traces, fuzzing, performance budgets, and acceptance criteria are project test-policy requirements: their tolerance, duration, repetitions, and platform equivalence remain undeclared blockers until measured. The bundled analyzers are local repository tools, not external-source claims.
