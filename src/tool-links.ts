import type { ServiceId } from "./journey/journey";

export interface LocationLike {
  hostname: string;
}

export type TopologyToolLinks = Partial<Record<ServiceId, string>>;

function hostForUrl(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[")
    ? "[" + hostname + "]"
    : hostname;
}

export function buildTopologyToolLinks(
  location: LocationLike,
): TopologyToolLinks {
  if (typeof __ENABLE_TOOL_LINKS__ !== "undefined" && !__ENABLE_TOOL_LINKS__) {
    return {};
  }
  const host = hostForUrl(location.hostname || "localhost");
  const url = (port: number, path = "/") => "http://" + host + ":" + port + path;
  const ports = { kafka: 8083, rabbitmq: 15672, adminer: 8082, redis: 5540, airflow: 8088 };

  return {
    kafka: url(ports.kafka, "/ui/clusters/flashdrop/all-topics/flashdrop.orders.v1"),
    rabbitmq: url(ports.rabbitmq, "/#/queues/%2F/flashdrop.inventory-worker.commands.v1"),
    postgresql: url(ports.adminer, "/?pgsql=postgres&username=airflow&db=airflow"),
    mysql: url(ports.adminer, "/?server=mysql&username=message_lab&db=message_lab"),
    redis: url(ports.redis),
    airflow: url(ports.airflow),
  };
}
