import { useEffect, useState } from "react";

import {
  extractTraceEvents,
  mergeTraceEvents,
  type TraceEvent,
} from "../types";
import { resolveRuntimeBase } from "../runtime-url";
import {
  fetchWithTimeout,
  RequestTimeoutError,
} from "../request-timeout";

export type StreamState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "unsupported";

export interface TraceStreamState {
  events: TraceEvent[];
  latestLiveEventId: string | null;
  streamState: StreamState;
  recentState: "loading" | "ready" | "error";
  recentError: string | null;
  streamError: string | null;
}

export function useTraceStream(
  configuredBase = __EVENTS_BASE_URL__,
): TraceStreamState {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [latestLiveEventId, setLatestLiveEventId] =
    useState<string | null>(null);
  const [streamState, setStreamState] =
    useState<StreamState>("connecting");
  const [recentState, setRecentState] =
    useState<TraceStreamState["recentState"]>("loading");
  const [recentError, setRecentError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = resolveRuntimeBase(configuredBase);
    const controller = new AbortController();
    let source: EventSource | null = null;
    let disposed = false;

    const ingest = (items: TraceEvent[], live = false) => {
      if (!disposed && items.length > 0) {
        setEvents((current) => mergeTraceEvents(current, items, 600));
        if (live) setLatestLiveEventId(items.at(-1)?.id ?? null);
      }
    };

    fetchWithTimeout(
      baseUrl + "/events/recent",
      {
        signal: controller.signal,
        cache: "no-store",
      },
      5000,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Event history returned HTTP " + response.status + ".");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        ingest(extractTraceEvents(payload));
        if (!disposed) {
          setRecentState("ready");
          setRecentError(null);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || disposed) return;
        setRecentState("error");
        setRecentError(
          error instanceof RequestTimeoutError
            ? "Loading event history timed out."
            : error instanceof Error &&
                error.message.startsWith("Event history returned HTTP")
              ? error.message
              : "Event history is unavailable.",
        );
      });

    if (typeof EventSource === "undefined") {
      setStreamState("unsupported");
      return () => controller.abort();
    }

    source = new EventSource(baseUrl + "/events/stream");
    const consume = (message: MessageEvent<string>) => {
      try {
        ingest(extractTraceEvents(JSON.parse(message.data) as unknown), true);
        setStreamError(null);
      } catch {
        setStreamError("Event Hub sent invalid SSE data.");
      }
    };

    source.onopen = () => {
      if (!disposed) {
        setStreamState("live");
        setStreamError(null);
      }
    };
    source.onmessage = consume;
    source.addEventListener("trace", consume as EventListener);
    source.addEventListener("trace-event", consume as EventListener);
    source.onerror = () => {
      if (!disposed) {
        setStreamState("reconnecting");
        setStreamError(
          "Event stream disconnected. Reconnecting.",
        );
      }
    };

    return () => {
      disposed = true;
      controller.abort();
      source?.close();
    };
  }, [configuredBase]);

  return {
    events,
    latestLiveEventId,
    streamState,
    recentState,
    recentError,
    streamError,
  };
}
