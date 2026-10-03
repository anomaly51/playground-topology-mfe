import { normalizeServiceId, serviceIds, type ServiceId } from "./journey/journey";
import { isRecord } from "./types";

export interface NodeOperationalMetric {
  inFlight: number | null;
  total: number | null;
  healthy: boolean | null;
}

export interface KafkaPartitionMetric {
  partition: number;
  currentOffset: string | null;
  endOffset: string | null;
  lag: number | null;
}

export interface OperationsSnapshot {
  nodes: Partial<Record<ServiceId, NodeOperationalMetric>>;
  kafka: {
    lag: number | null;
    partitions: KafkaPartitionMetric[];
  };
  rabbit: {
    ready: number | null;
    unacked: number | null;
    dlq: number | null;
    consumers: number | null;
  };
  postgres: {
    pendingOutbox: number | null;
  };
  sseClients: number;
  sampledAt: string;
  fresh: boolean;
  errors: Array<{
    source: "kafka" | "rabbitmq" | "postgresql" | "services";
    message: string;
  }>;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function nullableBoolean(value: unknown): boolean | null | undefined {
  return value === null || typeof value === "boolean" ? value : undefined;
}

function parseNodeMetric(value: unknown): NodeOperationalMetric | null {
  if (!isRecord(value)) return null;
  const inFlight = nullableNumber(value.inFlight);
  const total = nullableNumber(value.total);
  const healthy = nullableBoolean(value.healthy);
  if (inFlight === undefined || total === undefined || healthy === undefined) {
    return null;
  }
  return { inFlight, total, healthy };
}

function parsePartition(value: unknown): KafkaPartitionMetric | null {
  if (!isRecord(value)) return null;
  const lag = nullableNumber(value.lag);
  if (
    typeof value.partition !== "number" ||
    !Number.isInteger(value.partition) ||
    lag === undefined ||
    !(value.currentOffset === null || typeof value.currentOffset === "string") ||
    !(value.endOffset === null || typeof value.endOffset === "string")
  ) {
    return null;
  }
  return {
    partition: value.partition,
    currentOffset: value.currentOffset,
    endOffset: value.endOffset,
    lag,
  };
}

export function parseOperationsSnapshot(value: unknown): OperationsSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    !isRecord(value.nodes) ||
    !isRecord(value.kafka) ||
    !isRecord(value.rabbit) ||
    !isRecord(value.postgres) ||
    typeof value.sseClients !== "number" ||
    typeof value.sampledAt !== "string" ||
    typeof value.fresh !== "boolean" ||
    !Array.isArray(value.errors)
  ) {
    return null;
  }

  const nodesRecord = value.nodes;
  const kafkaRecord = value.kafka;
  const rabbitRecord = value.rabbit;
  const postgresRecord = value.postgres;

  const kafkaLag = nullableNumber(kafkaRecord.lag);
  const rabbitReady = nullableNumber(rabbitRecord.ready);
  const rabbitUnacked = nullableNumber(rabbitRecord.unacked);
  const rabbitDlq = nullableNumber(rabbitRecord.dlq);
  const rabbitConsumers = nullableNumber(rabbitRecord.consumers);
  const pendingOutbox = nullableNumber(postgresRecord.pendingOutbox);
  if (
    kafkaLag === undefined ||
    rabbitReady === undefined ||
    rabbitUnacked === undefined ||
    rabbitDlq === undefined ||
    rabbitConsumers === undefined ||
    pendingOutbox === undefined ||
    !Array.isArray(kafkaRecord.partitions)
  ) {
    return null;
  }

  const partitions = kafkaRecord.partitions.map(parsePartition);
  if (partitions.some((partition) => partition === null)) return null;

  const nodes: Partial<Record<ServiceId, NodeOperationalMetric>> = {};
  Object.entries(nodesRecord).forEach(([key, candidate]) => {
    const id = normalizeServiceId(key);
    const metric = parseNodeMetric(candidate);
    if (id && metric) nodes[id] = metric;
  });
  serviceIds.forEach((id) => {
    const direct = parseNodeMetric(nodesRecord[id]);
    if (direct) nodes[id] = direct;
  });

  const errorSources = new Set(["kafka", "rabbitmq", "postgresql", "services"]);
  const errors = value.errors.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.source !== "string" ||
      !errorSources.has(candidate.source) ||
      typeof candidate.message !== "string"
    ) {
      return [];
    }
    return [{
      source: candidate.source as OperationsSnapshot["errors"][number]["source"],
      message: candidate.message,
    }];
  });

  return {
    nodes,
    kafka: {
      lag: kafkaLag,
      partitions: partitions as KafkaPartitionMetric[],
    },
    rabbit: {
      ready: rabbitReady,
      unacked: rabbitUnacked,
      dlq: rabbitDlq,
      consumers: rabbitConsumers,
    },
    postgres: { pendingOutbox },
    sseClients: Math.max(0, Math.trunc(value.sseClients)),
    sampledAt: value.sampledAt,
    fresh: value.fresh,
    errors,
  };
}

export function emptyNodeMetric(): NodeOperationalMetric {
  return { inFlight: null, total: null, healthy: null };
}
