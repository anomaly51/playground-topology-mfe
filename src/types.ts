export type Transport =
  | "http"
  | "kafka"
  | "rabbitmq"
  | "redis"
  | "postgresql"
  | "mysql"
  | "airflow"
  | "sse";

export type TraceStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "retrying"
  | "queued";

export interface TraceEvent {
  id: string;
  traceId: string;
  runId?: string;
  orderId?: string;
  correlationId?: string;
  causationId?: string;
  timestamp: string;
  source: string;
  target?: string;
  transport: Transport;
  stage: string;
  status: TraceStatus;
  summary: string;
  payload?: unknown;
}

const transports = new Set<Transport>([
  "http",
  "kafka",
  "rabbitmq",
  "redis",
  "postgresql",
  "mysql",
  "airflow",
  "sse",
]);

const statuses = new Set<TraceStatus>([
  "started",
  "succeeded",
  "failed",
  "retrying",
  "queued",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadString(
  payload: unknown,
  key: string,
): string | undefined {
  return isRecord(payload) ? optionalString(payload, key) : undefined;
}

export function parseTraceEvent(value: unknown): TraceEvent | null {
  if (!isRecord(value)) return null;

  const requiredStrings = [
    "id",
    "traceId",
    "timestamp",
    "source",
    "transport",
    "stage",
    "status",
    "summary",
  ] as const;
  if (
    requiredStrings.some(
      (key) => typeof value[key] !== "string" || value[key].length === 0,
    )
  ) {
    return null;
  }

  const transport = value.transport as Transport;
  const status = value.status as TraceStatus;
  if (!transports.has(transport) || !statuses.has(status)) return null;
  if (value.target !== undefined && typeof value.target !== "string") {
    return null;
  }

  const payload = value.payload;
  const runId = optionalString(value, "runId") ?? payloadString(payload, "runId");
  const orderId = optionalString(value, "orderId") ?? payloadString(payload, "orderId");
  const correlationId = optionalString(value, "correlationId") ?? payloadString(payload, "correlationId");
  const causationId = optionalString(value, "causationId") ?? payloadString(payload, "causationId");

  return {
    id: value.id as string,
    traceId: value.traceId as string,
    timestamp: value.timestamp as string,
    source: value.source as string,
    transport,
    stage: value.stage as string,
    status,
    summary: value.summary as string,
    ...(value.target ? { target: value.target as string } : {}),
    ...(runId ? { runId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(causationId ? { causationId } : {}),
    ...(payload !== undefined ? { payload } : {}),
  };
}

export function extractTraceEvents(value: unknown): TraceEvent[] {
  const candidate = isRecord(value)
    ? value.events ?? value.data ?? value
    : value;
  const values = Array.isArray(candidate) ? candidate : [candidate];
  return values
    .map(parseTraceEvent)
    .filter((event): event is TraceEvent => event !== null);
}

export function mergeTraceEvents(
  current: TraceEvent[],
  incoming: TraceEvent[],
  limit = 600,
): TraceEvent[] {
  const byId = new Map<string, TraceEvent>();
  [...current, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()]
    .sort(
      (left, right) =>
        Date.parse(right.timestamp) - Date.parse(left.timestamp),
    )
    .slice(0, limit);
}
