import { describe, expect, it } from "vitest";

import { parseOrderSelectedDetail, parseRunStateDetail } from "./event-contract";

const validRun = {
  version: 1,
  phase: "progress",
  runId: "run-1",
  profile: "spike",
  scenario: "normal",
  counters: {
    started: 20,
    accepted: 18,
    confirmed: 9,
    soldOut: 3,
    duplicate: 0,
    rejected: 2,
    inFlight: 4,
  },
  throughputPerSecond: 25,
  latency: { p50Ms: 12, p95Ms: 30, p99Ms: 60 },
};

describe("FlashDrop MFE event contract", () => {
  it("accepts the versioned run state", () => {
    expect(parseRunStateDetail(validRun)).toMatchObject({
      runId: "run-1",
      profile: "spike",
    });
  });

  it("rejects partial counters instead of inventing zeroes", () => {
    expect(
      parseRunStateDetail({
        ...validRun,
        counters: { ...validRun.counters, accepted: undefined },
      }),
    ).toBeNull();
  });

  it("accepts a selected order with optional trace scope", () => {
    expect(
      parseOrderSelectedDetail({
        version: 1,
        orderId: "order-1",
        traceId: "trace-1",
      }),
    ).toEqual({ version: 1, orderId: "order-1", traceId: "trace-1" });
  });
});
