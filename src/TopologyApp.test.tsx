import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOperationsSnapshot } from "./hooks/useOperationsSnapshot";
import { useTraceStream, type TraceStreamState } from "./hooks/useTraceStream";
import { RUN_STATE_EVENT } from "./journey/event-contract";
import { journeyEdges } from "./journey/journey";
import type { OperationsSnapshot } from "./operations";
import { TopologyApp } from "./TopologyApp";
import type { TraceEvent } from "./types";

vi.mock("./hooks/useTraceStream", () => ({ useTraceStream: vi.fn() }));
vi.mock("./hooks/useOperationsSnapshot", () => ({ useOperationsSnapshot: vi.fn() }));

const mockedTrace = vi.mocked(useTraceStream);
const mockedOperations = vi.mocked(useOperationsSnapshot);

function stream(events: TraceEvent[] = []): TraceStreamState {
  return {
    events,
    latestLiveEventId: events[0]?.id ?? null,
    streamState: "live",
    recentState: "ready",
    recentError: null,
    streamError: null,
  };
}

function snapshot(): OperationsSnapshot {
  return {
    nodes: {
      "order-api": { inFlight: 1, total: 42, healthy: true },
      pricing: { inFlight: null, total: 40, healthy: true },
      kafka: { inFlight: null, total: 39, healthy: true },
      rabbitmq: { inFlight: null, total: 38, healthy: true },
      postgresql: { inFlight: null, total: 42, healthy: true },
      "event-hub": { inFlight: null, total: 80, healthy: true },
    },
    kafka: { lag: 7, partitions: [] },
    rabbit: { ready: 3, unacked: 1, dlq: 0, consumers: 1 },
    postgres: { pendingOutbox: 2 },
    sseClients: 2,
    sampledAt: "2026-08-30T12:00:00.000Z",
    fresh: true,
    errors: [],
  };
}

function metric(container: HTMLElement, service: string, kind: "primary" | "total") {
  return container.querySelector(
    '[data-service-id="' + service + '"] [data-node-metric="' + kind + '"]',
  );
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  });
  mockedTrace.mockReturnValue(stream());
  mockedOperations.mockReturnValue({ snapshot: snapshot(), state: "live", error: null });
});

describe("TopologyApp", () => {
  it("renders one FlashDrop map and uses runtime queue values", () => {
    const { container } = render(<TopologyApp />);

    expect(screen.getAllByTestId("live-flow-map")).toHaveLength(1);
    expect(screen.getByText("Order topology")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /connections with actions and transport protocols in parentheses/i,
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".map-node")).toHaveLength(14);
    journeyEdges.forEach((edge) => {
      const label = container.querySelector(`[data-edge-label-id="${edge.id}"]`);
      expect(label).not.toBeNull();

      const lines = label?.querySelectorAll("tspan") ?? [];
      expect(lines).toHaveLength(2);
      expect(lines[0]).toHaveTextContent(edge.action);
      expect(lines[1]).toHaveTextContent(`(${edge.transport})`);
    });
    expect(metric(container, "kafka", "primary")).toHaveTextContent("7");
    expect(metric(container, "rabbitmq", "primary")).toHaveTextContent("3");
    expect(metric(container, "postgresql", "primary")).toHaveTextContent("2");
    expect(screen.getByText(/Highlighted paths were observed/)).toBeInTheDocument();
  });

  it("scopes a real run and marks only its direct edge as seen", () => {
    const traceEvent: TraceEvent = {
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
      summary: "Committed",
    };
    mockedTrace.mockReturnValue(stream([traceEvent]));
    const { container } = render(<TopologyApp />);

    act(() => {
      window.dispatchEvent(new CustomEvent(RUN_STATE_EVENT, { detail: {
        version: 1,
        phase: "progress",
        runId: "run-1",
        profile: "contention",
        scenario: "normal",
        counters: { started: 10, accepted: 8, confirmed: 3, soldOut: 1, duplicate: 0, rejected: 1, inFlight: 3 },
        throughputPerSecond: 20,
        latency: { p50Ms: 10, p95Ms: 25, p99Ms: 40 },
      } }));
    });

    expect(screen.getByText("Run run-1")).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="order-api-postgresql"]')).toHaveAttribute("data-seen", "true");
    expect(container.querySelector('[data-edge-id="analytics-postgresql"]')).toHaveAttribute("data-seen", "false");
    expect(metric(container, "traffic-mfe", "primary")).toHaveTextContent("3");
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("shows analytics writes on the shared database without replacing order metrics", () => {
    const persisted: TraceEvent = {
      id: "projection-write",
      traceId: "trace-projection",
      orderId: "order-1",
      timestamp: "2026-08-30T12:00:00.000Z",
      source: "analytics",
      target: "postgresql",
      transport: "postgresql",
      stage: "order.projection.upsert",
      status: "succeeded",
      summary: "Projection persisted",
    };
    mockedTrace.mockReturnValue(stream([
      persisted,
      { ...persisted, id: "projection-result", source: "postgresql", target: "analytics" },
    ]));
    const operations = snapshot();
    operations.nodes.analytics = { inFlight: 0, total: 12, healthy: true };
    mockedOperations.mockReturnValue({ snapshot: operations, state: "live", error: null });

    const { container } = render(<TopologyApp />);

    expect(container.querySelectorAll('[data-service-id="postgresql"]')).toHaveLength(1);
    expect(container.querySelector('[data-edge-id="analytics-postgresql"]')).toHaveAttribute("data-seen", "true");
    expect(container.querySelector('[data-edge-id="postgresql-analytics"]')).toHaveAttribute("data-seen", "true");
    expect(container.querySelector('[data-edge-id="order-api-postgresql"]')).toHaveAttribute("data-seen", "false");
    expect(metric(container, "postgresql", "total")).toHaveTextContent("42");
    expect(metric(container, "analytics", "total")).toHaveTextContent("12");
  });

  it("shows unknown operational values as N/A", () => {
    mockedOperations.mockReturnValue({ snapshot: null, state: "error", error: "No sampler" });
    const { container } = render(<TopologyApp />);

    expect(metric(container, "kafka", "primary")).toHaveTextContent("N/A");
    expect(screen.getByText("No sampler")).toBeInTheDocument();
  });

  it("reveals every connection and traces a service by pointer or keyboard without losing metrics", () => {
    const { container } = render(<TopologyApp />);
    const allConnections = screen.getByRole("button", { name: /All connections/ });
    expect(screen.getByRole("button", { name: "Main flow" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(allConnections);
    expect(allConnections).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".map-canvas")).toHaveAttribute("data-detail", "all");
    expect(container.querySelectorAll("[data-edge-id]")).toHaveLength(journeyEdges.length);

    const database = container.querySelector('[data-service-id="postgresql"]')!;
    fireEvent.mouseEnter(database);
    expect(screen.getByText("Connections for PostgreSQL")).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="analytics-postgresql"]')).toHaveAttribute("data-emphasis", "related");
    expect(container.querySelector('[data-edge-id="traffic-order-api"]')).toHaveAttribute("data-emphasis", "muted");
    expect(metric(container, "postgresql", "total")).toHaveTextContent("42");
    fireEvent.mouseLeave(database);
    fireEvent.focus(database);
    expect(screen.getByText("Connections for PostgreSQL")).toBeInTheDocument();
    fireEvent.blur(database);
    expect(container.querySelector('[data-edge-id="analytics-postgresql"]')).toHaveAttribute("data-emphasis", "default");
    fireEvent.mouseEnter(database);
    fireEvent.focus(container.querySelector('[data-service-id="order-api"]')!);
    expect(screen.getByText("Connections for Order API")).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="traffic-order-api"]')).toHaveAttribute("data-emphasis", "related");
  });
});
