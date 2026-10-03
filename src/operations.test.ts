import { describe, expect, it } from "vitest";

import { parseOperationsSnapshot } from "./operations";

const snapshot = {
  nodes: {
    "order-api": { inFlight: 2, total: 100, healthy: true },
    "pricing-service": { inFlight: null, total: null, healthy: null },
  },
  kafka: {
    lag: 4,
    partitions: [
      { partition: 0, currentOffset: "10", endOffset: "14", lag: 4 },
    ],
  },
  rabbit: { ready: 3, unacked: 1, dlq: 0, consumers: 1 },
  postgres: { pendingOutbox: 2 },
  sseClients: 2,
  sampledAt: "2026-08-30T12:00:00.000Z",
  fresh: true,
  errors: [],
};

describe("operations snapshot", () => {
  it("preserves real values and nullable unknowns", () => {
    const parsed = parseOperationsSnapshot(snapshot);
    expect(parsed?.nodes["order-api"]).toEqual({ inFlight: 2, total: 100, healthy: true });
    expect(parsed?.nodes.pricing).toEqual({ inFlight: null, total: null, healthy: null });
    expect(parsed?.kafka.lag).toBe(4);
    expect(parsed?.rabbit.ready).toBe(3);
  });

  it("rejects malformed queue metrics", () => {
    expect(
      parseOperationsSnapshot({
        ...snapshot,
        rabbit: { ...snapshot.rabbit, ready: "3" },
      }),
    ).toBeNull();
  });
});
