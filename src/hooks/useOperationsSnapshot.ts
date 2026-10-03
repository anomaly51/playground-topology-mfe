import { useEffect, useState } from "react";

import { parseOperationsSnapshot, type OperationsSnapshot } from "../operations";
import { fetchWithTimeout } from "../request-timeout";
import { resolveRuntimeBase } from "../runtime-url";

export interface OperationsSnapshotState {
  snapshot: OperationsSnapshot | null;
  state: "loading" | "live" | "stale" | "error";
  error: string | null;
}

export function useOperationsSnapshot(
  configuredBase = __EVENTS_BASE_URL__,
  intervalMs = 2000,
): OperationsSnapshotState {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [state, setState] = useState<OperationsSnapshotState["state"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = resolveRuntimeBase(configuredBase);
    const controller = new AbortController();
    let disposed = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetchWithTimeout(
          baseUrl + "/operations/snapshot",
          { signal: controller.signal, cache: "no-store" },
          4000,
        );
        if (!response.ok) throw new Error("HTTP " + response.status);
        const parsed = parseOperationsSnapshot(await response.json());
        if (!parsed) throw new Error("invalid snapshot");
        if (!disposed) {
          setSnapshot(parsed);
          setState(parsed.fresh ? "live" : "stale");
          setError(parsed.errors[0]?.message ?? null);
        }
      } catch {
        if (!disposed && !controller.signal.aborted) {
          setState("error");
          setError("Operational snapshot is unavailable");
        }
      } finally {
        if (!disposed) timer = window.setTimeout(poll, intervalMs);
      }
    };

    void poll();
    return () => {
      disposed = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [configuredBase, intervalMs]);

  return { snapshot, state, error };
}
