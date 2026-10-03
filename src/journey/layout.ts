import type { MapNodeId } from "./journey";

export const MAP_WIDTH = 1580;
export const MAP_HEIGHT = 1060;
export const NODE_WIDTH = 184;
export const NODE_HEIGHT = 112;

// One shared coordinate system keeps HTML cards and SVG paths aligned.
export const nodePositions: Record<MapNodeId, { x: number; y: number }> = {
  "traffic-mfe": { x: 110, y: 390 },
  airflow: { x: 110, y: 160 },
  "order-api": { x: 380, y: 390 },
  redis: { x: 380, y: 160 },
  pricing: { x: 650, y: 160 },
  postgresql: { x: 650, y: 390 },
  "outbox-relay": { x: 920, y: 390 },
  kafka: { x: 1190, y: 390 },
  analytics: { x: 1460, y: 390 },
  "order-finalizer": { x: 650, y: 690 },
  rabbitmq: { x: 920, y: 690 },
  "inventory-worker": { x: 1190, y: 690 },
  mysql: { x: 1460, y: 690 },
  "event-hub": { x: 1190, y: 950 },
  "browser-clients": { x: 1460, y: 950 },
};
