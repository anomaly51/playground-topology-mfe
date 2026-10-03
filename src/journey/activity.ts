import type { TraceEvent, TraceStatus } from "../types";
import {
  findJourneyEdge,
  normalizeServiceId,
  type JourneyEdgeId,
  type ServiceId,
} from "./journey";

export interface TraceSelection {
  runId?: string;
  orderId?: string;
  traceId?: string;
}

export interface JourneyActivity {
  scopedEvents: TraceEvent[];
  edgeCounts: Partial<Record<JourneyEdgeId, number>>;
  nodeStatus: Partial<Record<ServiceId, TraceStatus>>;
  latestEvent: TraceEvent | null;
}

export function directEdgeForEvent(event: TraceEvent): JourneyEdgeId | null {
  if (
    event.source.trim().toLowerCase() === "order-service-relay" &&
    event.stage === "order.status.persist"
  ) {
    return findJourneyEdge("order-finalizer", event.target)?.id ?? null;
  }
  const direct = findJourneyEdge(event.source, event.target)?.id ?? null;
  if (direct) return direct;
  return null;
}

export function eventTouchesService(
  event: TraceEvent,
  service: ServiceId,
): boolean {
  if (
    event.source.trim().toLowerCase() === "order-service-relay" &&
    event.stage === "order.status.persist" &&
    service === "order-finalizer"
  ) {
    return true;
  }
  return (
    normalizeServiceId(event.source) === service ||
    normalizeServiceId(event.target) === service
  );
}

export function selectTraceEvents(
  events: TraceEvent[],
  selection: TraceSelection | null,
): TraceEvent[] {
  if (!selection) return events;
  // A selected order is more specific than its load run. Prefer the most
  // specific identifier so the label and the visible path describe one scope.
  if (selection.traceId) {
    return events.filter((event) => event.traceId === selection.traceId);
  }
  if (selection.orderId) {
    return events.filter((event) => event.orderId === selection.orderId);
  }
  if (selection.runId) {
    return events.filter((event) => event.runId === selection.runId);
  }
  return events;
}

export function reduceJourneyActivity(
  events: TraceEvent[],
  selection: TraceSelection | null,
): JourneyActivity {
  const scopedEvents = [...selectTraceEvents(events, selection)].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const edgeCounts: Partial<Record<JourneyEdgeId, number>> = {};
  const nodeStatus: Partial<Record<ServiceId, TraceStatus>> = {};

  scopedEvents.forEach((event) => {
    const edge = directEdgeForEvent(event);
    if (edge) edgeCounts[edge] = (edgeCounts[edge] ?? 0) + 1;
    const source = normalizeServiceId(event.source);
    const target = normalizeServiceId(event.target);
    if (source) nodeStatus[source] = event.status;
    if (target) nodeStatus[target] = event.status;
  });

  return {
    scopedEvents,
    edgeCounts,
    nodeStatus,
    latestEvent: scopedEvents.at(-1) ?? null,
  };
}
