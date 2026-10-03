import { describe, expect, it } from "vitest";

import type { TraceEvent } from "../types";
import {
  directEdgeForEvent,
  reduceJourneyActivity,
  selectTraceEvents,
} from "./activity";

function event(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    id: "event-1",
    traceId: "trace-1",
    runId: "run-1",
    orderId: "order-1",
    timestamp: "2026-08-30T12:00:00.000Z",
    source: "order-api",
    target: "postgresql",
    transport: "postgresql",
    stage: "order.accepted",
    status: "succeeded",
    summary: "Order and outbox committed",
    ...overrides,
  };
}

describe("truthful journey activity", () => {
  it("keeps factual reply telemetry directional", () => {
    expect(
      directEdgeForEvent(event({ source: "mysql", target: "inventory-worker" })),
    ).toBe("mysql-inventory-worker");
    expect(
      directEdgeForEvent(event({ source: "postgresql", target: "analytics" })),
    ).toBe("postgresql-analytics");
    expect(
      directEdgeForEvent(event({ source: "inventory-worker", target: "rabbitmq-dlq" })),
    ).toBe("inventory-worker-rabbitmq");
  });

  it("maps only an explicit source and target pair", () => {
    expect(directEdgeForEvent(event())).toBe("order-api-postgresql");
    expect(
      directEdgeForEvent(
        event({
          source: "analytics",
          target: "event-hub",
          transport: "kafka",
        }),
      ),
    ).toBeNull();
  });

  it("does not infer a PostgreSQL write from an analytics event", () => {
    const analytics = event({
      source: "kafka",
      target: "analytics",
      transport: "kafka",
      stage: "order.projected",
    });
    const activity = reduceJourneyActivity([analytics], null);

    expect(activity.edgeCounts["kafka-analytics"]).toBe(1);
    expect(activity.edgeCounts["analytics-postgresql"]).toBeUndefined();
  });

  it("scopes events by run, order or trace identifiers", () => {
    const other = event({
      id: "event-2",
      traceId: "trace-2",
      runId: "run-2",
      orderId: "order-2",
    });

    expect(selectTraceEvents([event(), other], { runId: "run-1" })).toHaveLength(1);
    expect(selectTraceEvents([event(), other], { orderId: "order-2" })).toEqual([other]);
    expect(selectTraceEvents([event(), other], { traceId: "trace-1" })).toEqual([event()]);
    expect(selectTraceEvents([event(), other], {
      runId: "run-1",
      orderId: "order-2",
      traceId: "trace-2",
    })).toEqual([other]);
  });
});
