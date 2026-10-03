export type ServiceId =
  | "traffic-mfe"
  | "airflow"
  | "order-api"
  | "redis"
  | "pricing"
  | "postgresql"
  | "outbox-relay"
  | "kafka"
  | "analytics"
  | "rabbitmq"
  | "inventory-worker"
  | "mysql"
  | "order-finalizer"
  | "event-hub";

export type MapNodeId = ServiceId | "browser-clients";

export type JourneyEdgeId =
  | "traffic-order-api"
  | "airflow-order-api"
  | "airflow-postgresql"
  | "order-api-redis"
  | "order-api-pricing"
  | "pricing-order-api"
  | "order-api-postgresql"
  | "order-api-inventory-worker"
  | "postgresql-outbox-relay"
  | "outbox-relay-kafka"
  | "outbox-relay-rabbitmq"
  | "kafka-analytics"
  | "analytics-kafka"
  | "analytics-postgresql"
  | "postgresql-analytics"
  | "rabbitmq-inventory-worker"
  | "inventory-worker-mysql"
  | "mysql-inventory-worker"
  | "inventory-worker-rabbitmq"
  | "rabbitmq-order-finalizer"
  | "order-finalizer-postgresql"
  | "kafka-event-hub"
  | "rabbitmq-event-hub"
  | "event-hub-browser-clients";

export type ServiceKind =
  | "microfrontend"
  | "node"
  | "python"
  | "broker"
  | "database"
  | "orchestrator";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  runtime: string;
  role: string;
  kind: ServiceKind;
  metricLabel: string;
  aliases: string[];
}

export interface JourneyEdgeDefinition {
  id: JourneyEdgeId;
  source: MapNodeId;
  target: MapNodeId;
  action: string;
  transport: string;
  kind: "request" | "durable" | "event" | "command" | "result" | "observe";
  path: string;
  labelX: number;
  labelY: number;
}

export const serviceCatalog: Record<ServiceId, ServiceDefinition> = {
  "traffic-mfe": {
    id: "traffic-mfe",
    name: "Traffic MFE",
    runtime: "React / single-spa",
    role: "Creates orders and load runs",
    kind: "microfrontend",
    metricLabel: "In flight",
    aliases: ["traffic", "traffic-mfe", "browser"],
  },
  airflow: {
    id: "airflow",
    name: "Airflow",
    runtime: "Python",
    role: "Runs load and reconciles stale orders",
    kind: "orchestrator",
    metricLabel: "Running",
    aliases: ["airflow", "reconciliation"],
  },
  "order-api": {
    id: "order-api",
    name: "Order API",
    runtime: "Node.js",
    role: "Validates and durably accepts orders",
    kind: "node",
    metricLabel: "In flight",
    aliases: ["gateway", "api-gateway", "order-api", "order-service"],
  },
  redis: {
    id: "redis",
    name: "Redis Guard",
    runtime: "Redis",
    role: "Idempotency and rate limiting",
    kind: "database",
    metricLabel: "Active",
    aliases: ["redis", "redis-guard", "redis-cache"],
  },
  pricing: {
    id: "pricing",
    name: "Pricing",
    runtime: "Python / HTTP",
    role: "Returns a typed price quote",
    kind: "python",
    metricLabel: "In flight",
    aliases: ["processor", "python-processor", "pricing", "pricing-service"],
  },
  postgresql: {
    id: "postgresql",
    name: "PostgreSQL",
    runtime: "Orders + projections",
    role: "Atomic order and outbox transaction; analytics projections",
    kind: "database",
    metricLabel: "Outbox",
    aliases: ["postgres", "postgresql", "order-store", "analytics-store"],
  },
  "outbox-relay": {
    id: "outbox-relay",
    name: "Outbox Relay",
    runtime: "Node.js",
    role: "Publishes committed outbox rows",
    kind: "node",
    metricLabel: "In flight",
    aliases: ["outbox-relay", "relay", "gateway-relay", "order-service-relay"],
  },
  kafka: {
    id: "kafka",
    name: "Kafka",
    runtime: "Order event log",
    role: "Fan-out to independent consumers",
    kind: "broker",
    metricLabel: "Lag",
    aliases: ["kafka", "apache-kafka"],
  },
  analytics: {
    id: "analytics",
    name: "Sales Analytics",
    runtime: "Python",
    role: "Builds an order projection",
    kind: "python",
    metricLabel: "In flight",
    aliases: ["analytics", "python-analytics", "sales-analytics"],
  },
  rabbitmq: {
    id: "rabbitmq",
    name: "RabbitMQ",
    runtime: "Inventory commands",
    role: "Buffers work, retries and DLQ",
    kind: "broker",
    metricLabel: "Ready",
    aliases: ["rabbit", "rabbitmq", "rabbitmq-dlq"],
  },
  "inventory-worker": {
    id: "inventory-worker",
    name: "Inventory Worker",
    runtime: "Node.js",
    role: "Reserves stock idempotently",
    kind: "node",
    metricLabel: "In flight",
    aliases: ["rabbit-worker", "node-rabbit-worker", "inventory-worker"],
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    runtime: "Inventory ledger",
    role: "Atomic stock decrement",
    kind: "database",
    metricLabel: "Writes",
    aliases: ["mysql", "inventory-store"],
  },
  "order-finalizer": {
    id: "order-finalizer",
    name: "Order Finalizer",
    runtime: "Node.js",
    role: "Applies inventory results to orders",
    kind: "node",
    metricLabel: "In flight",
    aliases: ["order-finalizer", "result-consumer", "order-result-consumer"],
  },
  "event-hub": {
    id: "event-hub",
    name: "Event Hub",
    runtime: "Node.js / SSE",
    role: "Streams facts to the live topology",
    kind: "node",
    metricLabel: "SSE clients",
    aliases: ["event-hub", "eventhub"],
  },
};

export const serviceIds = Object.keys(serviceCatalog) as ServiceId[];

// Primary paths read left to right; reverse, control and observation paths use
// separate ports and gutters. Long observation routes go around inventory cards.
export const journeyEdges: JourneyEdgeDefinition[] = [
  { id: "traffic-order-api", source: "traffic-mfe", target: "order-api", action: "order request", transport: "HTTP/JSON", kind: "request", path: "M 202 390 H 288", labelX: 245, labelY: 365 },
  { id: "airflow-order-api", source: "airflow", target: "order-api", action: "load replay", transport: "HTTP/JSON", kind: "request", path: "M 202 184 H 230 Q 242 184 242 196 V 304 Q 242 316 254 316 H 314 Q 326 316 326 328 V 334", labelX: 242, labelY: 265 },
  { id: "airflow-postgresql", source: "airflow", target: "postgresql", action: "reconcile", transport: "PostgreSQL/SQL", kind: "durable", path: "M 54 216 V 250 Q 54 262 42 262 H 20 Q 8 262 8 274 V 504 Q 8 516 20 516 H 588 Q 600 516 600 504 V 446", labelX: 320, labelY: 494 },
  { id: "order-api-redis", source: "order-api", target: "redis", action: "idempotency", transport: "Redis/RESP", kind: "request", path: "M 380 334 V 216", labelX: 433, labelY: 268 },
  { id: "order-api-pricing", source: "order-api", target: "pricing", action: "quote", transport: "HTTP/JSON", kind: "request", path: "M 422 334 V 278 Q 422 266 434 266 H 596 Q 608 266 608 254 V 216", labelX: 516, labelY: 246 },
  { id: "pricing-order-api", source: "pricing", target: "order-api", action: "reply", transport: "HTTP/JSON", kind: "result", path: "M 636 216 V 290 Q 636 302 624 302 H 460 Q 448 302 448 314 V 334", labelX: 520, labelY: 313 },
  { id: "order-api-postgresql", source: "order-api", target: "postgresql", action: "commit", transport: "PostgreSQL/SQL", kind: "durable", path: "M 472 390 H 558", labelX: 515, labelY: 365 },
  { id: "order-api-inventory-worker", source: "order-api", target: "inventory-worker", action: "inventory control", transport: "HTTP/JSON", kind: "request", path: "M 410 446 V 602 Q 410 614 422 614 H 1138 Q 1150 614 1150 626 V 634", labelX: 865, labelY: 586 },
  { id: "postgresql-outbox-relay", source: "postgresql", target: "outbox-relay", action: "claim outbox", transport: "PostgreSQL/SQL", kind: "durable", path: "M 742 390 H 828", labelX: 785, labelY: 365 },
  { id: "outbox-relay-kafka", source: "outbox-relay", target: "kafka", action: "order event", transport: "Kafka", kind: "event", path: "M 1012 390 H 1098", labelX: 1055, labelY: 365 },
  { id: "outbox-relay-rabbitmq", source: "outbox-relay", target: "rabbitmq", action: "inventory command", transport: "AMQP 0-9-1", kind: "command", path: "M 920 446 V 634", labelX: 981, labelY: 540 },
  { id: "kafka-analytics", source: "kafka", target: "analytics", action: "consume", transport: "Kafka", kind: "event", path: "M 1282 374 H 1368", labelX: 1325, labelY: 349 },
  { id: "analytics-kafka", source: "analytics", target: "kafka", action: "projection event", transport: "Kafka", kind: "event", path: "M 1368 406 H 1282", labelX: 1325, labelY: 466 },
  { id: "analytics-postgresql", source: "analytics", target: "postgresql", action: "upsert projection", transport: "PostgreSQL/SQL", kind: "durable", path: "M 1480 334 V 266 Q 1480 254 1468 254 H 692 Q 680 254 680 266 V 334", labelX: 1070, labelY: 234 },
  { id: "postgresql-analytics", source: "postgresql", target: "analytics", action: "projection stored", transport: "PostgreSQL/SQL", kind: "result", path: "M 704 334 V 302 Q 704 290 716 290 H 1424 Q 1436 290 1436 302 V 334", labelX: 1070, labelY: 308 },
  { id: "rabbitmq-inventory-worker", source: "rabbitmq", target: "inventory-worker", action: "deliver", transport: "AMQP 0-9-1", kind: "command", path: "M 1012 674 H 1098", labelX: 1055, labelY: 648 },
  { id: "inventory-worker-mysql", source: "inventory-worker", target: "mysql", action: "reserve", transport: "MySQL/SQL", kind: "durable", path: "M 1282 674 H 1368", labelX: 1325, labelY: 648 },
  { id: "mysql-inventory-worker", source: "mysql", target: "inventory-worker", action: "result", transport: "MySQL/SQL", kind: "result", path: "M 1368 714 H 1282", labelX: 1325, labelY: 732 },
  { id: "inventory-worker-rabbitmq", source: "inventory-worker", target: "rabbitmq", action: "ack / retry / DLQ", transport: "AMQP 0-9-1", kind: "result", path: "M 1098 714 H 1012", labelX: 1055, labelY: 768 },
  { id: "rabbitmq-order-finalizer", source: "rabbitmq", target: "order-finalizer", action: "result delivery", transport: "AMQP 0-9-1", kind: "result", path: "M 828 690 H 742", labelX: 785, labelY: 665 },
  { id: "order-finalizer-postgresql", source: "order-finalizer", target: "postgresql", action: "update status", transport: "PostgreSQL/SQL", kind: "durable", path: "M 650 634 V 446", labelX: 710, labelY: 524 },
  { id: "kafka-event-hub", source: "kafka", target: "event-hub", action: "observe events", transport: "Kafka", kind: "observe", path: "M 1250 446 V 522 Q 1250 534 1262 534 H 1558 Q 1570 534 1570 546 V 844 Q 1570 856 1558 856 H 1262 Q 1250 856 1250 868 V 894", labelX: 1430, labelY: 513 },
  { id: "rabbitmq-event-hub", source: "rabbitmq", target: "event-hub", action: "observe results", transport: "AMQP 0-9-1", kind: "observe", path: "M 980 746 V 938 Q 980 950 992 950 H 1098", labelX: 1034, labelY: 865 },
  { id: "event-hub-browser-clients", source: "event-hub", target: "browser-clients", action: "live stream", transport: "SSE/HTTP", kind: "observe", path: "M 1282 950 H 1368", labelX: 1325, labelY: 925 },
];

const aliases = new Map<string, ServiceId>();
serviceIds.forEach((id) => {
  serviceCatalog[id].aliases.forEach((alias) => aliases.set(alias, id));
});

export function normalizeServiceId(value: string | undefined): ServiceId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s.]+/g, "-");
  return aliases.get(normalized) ?? null;
}

export function findJourneyEdge(
  source: string | undefined,
  target: string | undefined,
): JourneyEdgeDefinition | null {
  const sourceId = normalizeServiceId(source);
  const targetId = normalizeServiceId(target);
  if (!sourceId || !targetId) return null;
  return journeyEdges.find((edge) => edge.source === sourceId && edge.target === targetId) ?? null;
}

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === "string" && value in serviceCatalog;
}
