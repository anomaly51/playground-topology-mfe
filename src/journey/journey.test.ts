import { describe, expect, it } from "vitest";

import {
  findJourneyEdge,
  journeyEdges,
  normalizeServiceId,
  serviceCatalog,
  serviceIds,
} from "./journey";

describe("FlashDrop topology catalog", () => {
  it("contains one durable acceptance boundary and both async branches", () => {
    expect(serviceIds).toHaveLength(14);
    expect(serviceCatalog.postgresql.role).toContain("Atomic");
    expect(findJourneyEdge("order-api", "postgresql")?.kind).toBe("durable");
    expect(findJourneyEdge("analytics", "postgresql")?.kind).toBe("durable");
    expect(findJourneyEdge("postgresql", "analytics")?.kind).toBe("result");
    expect(findJourneyEdge("outbox-relay", "kafka")?.kind).toBe("event");
    expect(findJourneyEdge("outbox-relay", "rabbitmq")?.kind).toBe("command");
  });

  it("keeps every edge id unique", () => {
    expect(new Set(journeyEdges.map((edge) => edge.id)).size).toBe(journeyEdges.length);
  });

  it("keeps the verified interaction graph stable when the map is repositioned", () => {
    expect(
      journeyEdges.map(
        (edge) =>
          `${edge.id}|${edge.source}>${edge.target}|${edge.action}|${edge.transport}|${edge.kind}`,
      ),
    ).toEqual([
      "traffic-order-api|traffic-mfe>order-api|order request|HTTP/JSON|request",
      "airflow-order-api|airflow>order-api|load replay|HTTP/JSON|request",
      "airflow-postgresql|airflow>postgresql|reconcile|PostgreSQL/SQL|durable",
      "order-api-redis|order-api>redis|idempotency|Redis/RESP|request",
      "order-api-pricing|order-api>pricing|quote|HTTP/JSON|request",
      "pricing-order-api|pricing>order-api|reply|HTTP/JSON|result",
      "order-api-postgresql|order-api>postgresql|commit|PostgreSQL/SQL|durable",
      "order-api-inventory-worker|order-api>inventory-worker|inventory control|HTTP/JSON|request",
      "postgresql-outbox-relay|postgresql>outbox-relay|claim outbox|PostgreSQL/SQL|durable",
      "outbox-relay-kafka|outbox-relay>kafka|order event|Kafka|event",
      "outbox-relay-rabbitmq|outbox-relay>rabbitmq|inventory command|AMQP 0-9-1|command",
      "kafka-analytics|kafka>analytics|consume|Kafka|event",
      "analytics-kafka|analytics>kafka|projection event|Kafka|event",
      "analytics-postgresql|analytics>postgresql|upsert projection|PostgreSQL/SQL|durable",
      "postgresql-analytics|postgresql>analytics|projection stored|PostgreSQL/SQL|result",
      "rabbitmq-inventory-worker|rabbitmq>inventory-worker|deliver|AMQP 0-9-1|command",
      "inventory-worker-mysql|inventory-worker>mysql|reserve|MySQL/SQL|durable",
      "mysql-inventory-worker|mysql>inventory-worker|result|MySQL/SQL|result",
      "inventory-worker-rabbitmq|inventory-worker>rabbitmq|ack / retry / DLQ|AMQP 0-9-1|result",
      "rabbitmq-order-finalizer|rabbitmq>order-finalizer|result delivery|AMQP 0-9-1|result",
      "order-finalizer-postgresql|order-finalizer>postgresql|update status|PostgreSQL/SQL|durable",
      "kafka-event-hub|kafka>event-hub|observe events|Kafka|observe",
      "rabbitmq-event-hub|rabbitmq>event-hub|observe results|AMQP 0-9-1|observe",
      "event-hub-browser-clients|event-hub>browser-clients|live stream|SSE/HTTP|observe",
    ]);
  });

  it("normalizes runtime aliases without guessing unknown actors", () => {
    expect(normalizeServiceId("api_gateway")).toBe("order-api");
    expect(normalizeServiceId("python.analytics")).toBe("analytics");
    expect(normalizeServiceId("rabbitmq-dlq")).toBe("rabbitmq");
    expect(normalizeServiceId("unknown-service")).toBeNull();
  });
});
