import { describe, expect, it } from "vitest";

import { extractTraceEvents, mergeTraceEvents } from "./types";
import type { TraceEvent } from "./types";

const baseEvent: TraceEvent = {
  id: "event-1",
  traceId: "trace-1",
  timestamp: "2026-08-28T12:00:00.000Z",
  source: "gateway",
  target: "kafka",
  transport: "kafka",
  stage: "message.publish",
  status: "succeeded",
  summary: "Published",
};

describe("TraceEvent parsing", () => {
  it("accepts array and envelope responses", () => {
    expect(extractTraceEvents([baseEvent])).toHaveLength(1);
    expect(extractTraceEvents({ events: [baseEvent] })).toHaveLength(1);
    expect(
      extractTraceEvents([
        { ...baseEvent, target: "postgresql", transport: "postgresql" },
      ]),
    ).toHaveLength(1);
  });

  it("reads run and order ids from the payload during rolling upgrades", () => {
    expect(
      extractTraceEvents([{ ...baseEvent, payload: { runId: "run-1", orderId: "order-1" } }])[0],
    ).toMatchObject({ runId: "run-1", orderId: "order-1" });
  });

  it("deduplicates SSE replays and keeps newest first", () => {
    const newer = {
      ...baseEvent,
      id: "event-2",
      timestamp: "2026-08-28T12:00:01.000Z",
    };

    expect(mergeTraceEvents([baseEvent], [baseEvent, newer])).toEqual([
      newer,
      baseEvent,
    ]);
  });
});
