import { isRecord } from "../types";

export const RUN_STATE_EVENT = "flashdrop:run-state";
export const ORDER_SELECTED_EVENT = "flashdrop:order-selected";

export interface RunCounters {
  started: number;
  accepted: number;
  confirmed: number;
  soldOut: number;
  duplicate: number;
  rejected: number;
  inFlight: number;
}

export interface RunStateDetail {
  version: 1;
  phase: "idle" | "started" | "progress" | "completed" | "cancelled";
  runId: string;
  profile: string;
  scenario: string;
  counters: RunCounters;
  throughputPerSecond: number;
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
}

export interface OrderSelectedDetail {
  version: 1;
  orderId: string;
  traceId?: string;
  runId?: string;
}

const phases = new Set(["idle", "started", "progress", "completed", "cancelled"]);

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseCounters(value: unknown): RunCounters | null {
  if (!isRecord(value)) return null;
  const keys = [
    "started",
    "accepted",
    "confirmed",
    "soldOut",
    "duplicate",
    "rejected",
    "inFlight",
  ] as const;
  if (keys.some((key) => !finiteNonNegative(value[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as unknown as RunCounters;
}

export function customEventDetail(event: Event): unknown {
  return event instanceof CustomEvent ? event.detail : undefined;
}

export function parseRunStateDetail(value: unknown): RunStateDetail | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.phase !== "string" ||
    !phases.has(value.phase) ||
    typeof value.runId !== "string" ||
    typeof value.profile !== "string" ||
    typeof value.scenario !== "string" ||
    !finiteNonNegative(value.throughputPerSecond) ||
    !isRecord(value.latency)
  ) {
    return null;
  }
  const counters = parseCounters(value.counters);
  if (
    !counters ||
    !finiteNonNegative(value.latency.p50Ms) ||
    !finiteNonNegative(value.latency.p95Ms) ||
    !finiteNonNegative(value.latency.p99Ms)
  ) {
    return null;
  }
  return {
    version: 1,
    phase: value.phase as RunStateDetail["phase"],
    runId: value.runId,
    profile: value.profile,
    scenario: value.scenario,
    counters,
    throughputPerSecond: value.throughputPerSecond,
    latency: {
      p50Ms: value.latency.p50Ms,
      p95Ms: value.latency.p95Ms,
      p99Ms: value.latency.p99Ms,
    },
  };
}

export function parseOrderSelectedDetail(value: unknown): OrderSelectedDetail | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.orderId !== "string" ||
    value.orderId.length === 0 ||
    !(value.traceId === undefined || typeof value.traceId === "string") ||
    !(value.runId === undefined || typeof value.runId === "string")
  ) {
    return null;
  }
  return {
    version: 1,
    orderId: value.orderId,
    ...(value.traceId ? { traceId: value.traceId } : {}),
    ...(value.runId ? { runId: value.runId } : {}),
  };
}
