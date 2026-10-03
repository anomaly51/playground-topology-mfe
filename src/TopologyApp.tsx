import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  JourneyView,
  type FlowPulse,
  type MapMetric,
  type NodeMetric,
  type ServiceVisualState,
} from "./JourneyView";
import { useOperationsSnapshot } from "./hooks/useOperationsSnapshot";
import { useTraceStream } from "./hooks/useTraceStream";
import {
  directEdgeForEvent,
  eventTouchesService,
  reduceJourneyActivity,
  type TraceSelection,
} from "./journey/activity";
import {
  customEventDetail,
  ORDER_SELECTED_EVENT,
  parseOrderSelectedDetail,
  parseRunStateDetail,
  RUN_STATE_EVENT,
  type RunStateDetail,
} from "./journey/event-contract";
import { serviceIds, type ServiceId } from "./journey/journey";
import { emptyNodeMetric } from "./operations";
import { buildTopologyToolLinks } from "./tool-links";
import type { TraceEvent } from "./types";

const MAX_PULSES = 20;
const MAX_SEEN_EVENTS = 2400;
const PULSE_LIFETIME_MS = 820;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
}

function formatLatency(value: number | undefined): string {
  return value === undefined ? "N/A" : Math.round(value) + " ms";
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function runStatusText(run: RunStateDetail | null): string {
  if (!run) return "Run a scenario in Traffic MFE to scope the map.";
  const done = run.counters.confirmed + run.counters.soldOut + run.counters.rejected;
  if (run.phase === "started" || run.phase === "progress") {
    return run.profile + " / " + run.scenario + " / " + done + " terminal, " + run.counters.inFlight + " in flight";
  }
  if (run.phase === "completed") {
    return "Run complete / " + done + " terminal outcomes";
  }
  if (run.phase === "cancelled") return "Run cancelled. Accepted orders continue asynchronously.";
  return "Ready for a FlashDrop run.";
}

function recentEventText(event: TraceEvent | null): string {
  if (!event) return "No direct interaction observed for the current scope.";
  const route = event.target ? event.source + " → " + event.target : event.source;
  return formatTime(event.timestamp) + " / " + route + " / " + event.stage;
}

function rememberBounded(ids: Set<string>, id: string): boolean {
  if (ids.has(id)) return false;
  ids.add(id);
  while (ids.size > MAX_SEEN_EVENTS) {
    const oldest = ids.values().next().value;
    if (oldest === undefined) break;
    ids.delete(oldest);
  }
  return true;
}

export function TopologyApp() {
  const trace = useTraceStream();
  const operations = useOperationsSnapshot();
  const [run, setRun] = useState<RunStateDetail | null>(null);
  const [selection, setSelection] = useState<TraceSelection | null>(null);
  const [pulses, setPulses] = useState<FlowPulse[]>([]);
  const seenEventIds = useRef(new Set<string>());
  const pulseTimers = useRef(new Set<number>());
  const activeRunId = useRef<string | null>(null);
  const traceEvents = useRef(trace.events);

  useEffect(() => {
    traceEvents.current = trace.events;
  }, [trace.events]);

  const clearPulses = useCallback(() => {
    pulseTimers.current.forEach((timer) => window.clearTimeout(timer));
    pulseTimers.current.clear();
    setPulses([]);
  }, []);

  useEffect(() => () => clearPulses(), [clearPulses]);

  useEffect(() => {
    const onRunState = (event: Event) => {
      const detail = parseRunStateDetail(customEventDetail(event));
      if (!detail) return;
      setRun(detail);
      const nextRunId = detail.phase === "idle" ? null : detail.runId;
      if (activeRunId.current !== nextRunId) {
        activeRunId.current = nextRunId;
        setSelection(nextRunId ? { runId: nextRunId } : null);
        seenEventIds.current = new Set(traceEvents.current.map((item) => item.id));
        clearPulses();
      }
    };
    const onOrderSelected = (event: Event) => {
      const detail = parseOrderSelectedDetail(customEventDetail(event));
      if (!detail) return;
      setSelection({
        orderId: detail.orderId,
        ...(detail.traceId ? { traceId: detail.traceId } : {}),
        ...(detail.runId ? { runId: detail.runId } : {}),
      });
      seenEventIds.current = new Set(trace.events.map((item) => item.id));
      clearPulses();
    };
    window.addEventListener(RUN_STATE_EVENT, onRunState);
    window.addEventListener(ORDER_SELECTED_EVENT, onOrderSelected);
    return () => {
      window.removeEventListener(RUN_STATE_EVENT, onRunState);
      window.removeEventListener(ORDER_SELECTED_EVENT, onOrderSelected);
    };
  }, [clearPulses]);

  const activity = useMemo(
    () => reduceJourneyActivity(trace.events, selection),
    [selection, trace.events],
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const fresh = activity.scopedEvents.filter((event) => {
      const edge = directEdgeForEvent(event);
      return edge !== null && rememberBounded(seenEventIds.current, event.id);
    });
    if (fresh.length === 0) return;

    fresh.slice(-MAX_PULSES).forEach((event, index) => {
      const edgeId = directEdgeForEvent(event);
      if (!edgeId) return;
      const timer = window.setTimeout(() => {
        pulseTimers.current.delete(timer);
        const pulse: FlowPulse = {
          id: event.id + ":" + edgeId,
          edgeId,
          status: event.status,
        };
        setPulses((current) => [...current, pulse].slice(-MAX_PULSES));
        const removal = window.setTimeout(() => {
          pulseTimers.current.delete(removal);
          setPulses((current) => current.filter((item) => item.id !== pulse.id));
        }, PULSE_LIFETIME_MS);
        pulseTimers.current.add(removal);
      }, index * 45);
      pulseTimers.current.add(timer);
    });

    const liveEvent = activity.scopedEvents.find(
      (event) => event.id === trace.latestLiveEventId,
    );
    if (liveEvent && rememberBounded(seenEventIds.current, "sse:" + liveEvent.id)) {
      const timer = window.setTimeout(() => {
        pulseTimers.current.delete(timer);
        const pulse: FlowPulse = {
          id: "sse:" + liveEvent.id,
          edgeId: "event-hub-browser-clients",
          status: liveEvent.status,
        };
        setPulses((current) => [...current, pulse].slice(-MAX_PULSES));
        const removal = window.setTimeout(() => {
          pulseTimers.current.delete(removal);
          setPulses((current) => current.filter((item) => item.id !== pulse.id));
        }, PULSE_LIFETIME_MS);
        pulseTimers.current.add(removal);
      }, Math.min(fresh.length, MAX_PULSES) * 45);
      pulseTimers.current.add(timer);
    }
  }, [activity.scopedEvents, trace.latestLiveEventId]);

  const nodeMetrics = useMemo<Record<ServiceId, NodeMetric>>(() => {
    const metrics = Object.fromEntries(
      serviceIds.map((id) => {
        const metric = operations.snapshot?.nodes[id] ?? emptyNodeMetric();
        return [id, {
          primary: metric.inFlight,
          total: metric.total,
          healthy: metric.healthy,
        }];
      }),
    ) as Record<ServiceId, NodeMetric>;

    metrics["traffic-mfe"] = {
      primary: run?.counters.inFlight ?? 0,
      total: run?.counters.started ?? 0,
      healthy: null,
    };
    if (operations.snapshot) {
      metrics.kafka.primary = operations.snapshot.kafka.lag;
      metrics.rabbitmq.primary = operations.snapshot.rabbit.ready;
      metrics.postgresql.primary = operations.snapshot.postgres.pendingOutbox;
      metrics["event-hub"].primary = operations.snapshot.sseClients;
    }
    return metrics;
  }, [operations.snapshot, run]);

  const stateForService = useCallback(
    (service: ServiceId): ServiceVisualState => {
      const metric = nodeMetrics[service];
      if (metric.healthy === false) return "failed";
      if (metric.primary !== null && metric.primary > 0) return "active";
      const latest = [...activity.scopedEvents]
        .reverse()
        .find((event) => eventTouchesService(event, service));
      if (!latest) return "idle";
      return latest.status === "started" || latest.status === "queued"
        ? "active"
        : latest.status;
    },
    [activity.scopedEvents, nodeMetrics],
  );

  const metrics = useMemo<MapMetric[]>(() => {
    const accepted = run?.counters.accepted ?? 0;
    const terminal = run
      ? run.counters.confirmed + run.counters.soldOut + run.counters.rejected
      : 0;
    const kafkaLag = operations.snapshot?.kafka.lag;
    const rabbitReady = operations.snapshot?.rabbit.ready;
    return [
      { label: "Accepted", value: String(accepted) },
      { label: "Terminal", value: String(terminal) },
      { label: "Throughput", value: run ? formatNumber(run.throughputPerSecond) + " req/s" : "N/A" },
      { label: "p95", value: formatLatency(run?.latency.p95Ms) },
      { label: "Kafka lag", value: kafkaLag === null || kafkaLag === undefined ? "N/A" : String(kafkaLag) },
      { label: "Rabbit ready", value: rabbitReady === null || rabbitReady === undefined ? "N/A" : String(rabbitReady) },
    ];
  }, [operations.snapshot, run]);

  const toolLinks = useMemo(
    () => buildTopologyToolLinks(window.location),
    [],
  );
  const scopeText = selection?.orderId
    ? "Order " + selection.orderId
    : selection?.runId
      ? "Run " + selection.runId
      : "All recent traffic";
  const errors = [
    operations.error,
    trace.recentError,
    trace.streamError,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="topology-mfe" aria-label="FlashDrop live topology microfrontend">
      <JourneyView
        activity={activity}
        pulses={pulses}
        metrics={metrics}
        nodeMetrics={nodeMetrics}
        streamState={trace.streamState}
        operationsState={operations.state}
        statusText={runStatusText(run)}
        latestEventText={recentEventText(activity.latestEvent)}
        scopeText={scopeText}
        errors={errors}
        toolLinks={toolLinks}
        stateForService={stateForService}
      />
    </section>
  );
}
