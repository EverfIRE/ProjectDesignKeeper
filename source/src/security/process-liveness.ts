export type ProcessLiveness = "alive" | "dead" | "ambiguous";

// Publication claims and the later project lock may share only this PID probe.
// Their metadata, expiry, renewal, and ownership schemas are intentionally separate.
export function probeProcessLiveness(pid: number): ProcessLiveness {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) return "ambiguous";
  if (pid === process.pid) return "alive";
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return "dead";
    return "ambiguous";
  }
}
