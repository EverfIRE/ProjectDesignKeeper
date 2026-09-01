# Networked deterministic physics source audit

Read on 2026-08-27. This Task 14 audit records only sources read for the skill; it is not an engine integration recommendation.

| Source read | Authority and use | Claims used in SKILL.md |
| --- | --- | --- |
| [Jolt Architecture: Deterministic Simulation](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md) | Official project documentation; same-order/same-binary constraints, cross-platform caveats, restore limits and callback/query ordering. | Separate repeatability tiers; freeze execution environment; stable ordering/IDs; capture or rebuild continuation state before rollback. |
| [What Every Programmer Needs To Know About Game Networking](https://github.com/mas-bandwidth/gafferongames/blob/main/content/post/what_every_programmer_needs_to_know_about_game_networking.md) | Primary author’s network architecture article. | Server authority, local prediction, historical input/state replay, and correction. |
| [State Synchronization](https://gafferongames.com/post/state_synchronization/) | Primary author’s networked-physics article. | Sequence/tick identification, loss/reorder handling, state plus input synchronization, hard simulation correction versus presentation. |
| [Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/) | Primary author’s networked-physics article. | Interpolation buffers handle jitter; presentation interpolation is separate from simulation authority. |
| [Client Server Connection](https://www.gafferongames.com/post/client_server_connection/) | Primary author’s transport article. | Packets can be lost, duplicated, and reordered; application contracts need acknowledgements and duplicate handling. |

The skill deliberately leaves packet cadence, tolerances, caps, windows, and network thresholds unresolved until project measurement supplies them. The bundled comparator is the repository’s local evidence tool, not an external source claim.
