import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Alert, Badge } from "react-bootstrap";

import type { StreamState } from "./hooks/useTraceStream";
import type { JourneyActivity } from "./journey/activity";
import {
  journeyEdges,
  serviceCatalog,
  serviceIds,
  type JourneyEdgeId,
  type MapNodeId,
  type ServiceId,
} from "./journey/journey";
import type { TopologyToolLinks } from "./tool-links";
import type { TraceStatus } from "./types";
import { MAP_HEIGHT, MAP_WIDTH, NODE_HEIGHT, NODE_WIDTH, nodePositions } from "./journey/layout";

export interface FlowPulse {
  id: string;
  edgeId: JourneyEdgeId;
  status: TraceStatus;
}

export interface MapMetric {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
}

export interface NodeMetric {
  primary: number | null;
  total: number | null;
  healthy: boolean | null;
}

export type ServiceVisualState =
  | "idle"
  | "active"
  | "succeeded"
  | "failed"
  | "retrying";

interface JourneyViewProps {
  activity: JourneyActivity;
  pulses: FlowPulse[];
  metrics: MapMetric[];
  nodeMetrics: Record<ServiceId, NodeMetric>;
  streamState: StreamState;
  operationsState: "loading" | "live" | "stale" | "error";
  statusText: string;
  latestEventText: string;
  scopeText: string;
  errors: string[];
  toolLinks: TopologyToolLinks;
  stateForService: (service: ServiceId) => ServiceVisualState;
}

// Keep return and maintenance paths available without overwhelming the main flow.
const secondaryEdges = new Set<JourneyEdgeId>([
  "airflow-postgresql", "pricing-order-api", "order-api-inventory-worker",
  "analytics-kafka", "analytics-postgresql", "postgresql-analytics",
  "mysql-inventory-worker", "inventory-worker-rabbitmq", "kafka-event-hub",
]);

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const streamLabels: Record<StreamState, string> = {
  connecting: "Events connecting",
  live: "Events connected",
  reconnecting: "Events reconnecting",
  unsupported: "Live events unsupported",
};

const operationsLabels: Record<JourneyViewProps["operationsState"], string> = {
  loading: "Snapshot loading",
  live: "Snapshot current",
  stale: "Snapshot stale",
  error: "Snapshot unavailable",
};

function nodeStyle(id: MapNodeId): CSSProperties {
  const position = nodePositions[id];
  return {
    left: position.x,
    top: position.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

function displayCount(value: number | null): string {
  return value === null ? "N/A" : compactNumber.format(Math.max(0, value));
}

function healthText(healthy: boolean | null): string {
  if (healthy === true) return "Ready";
  if (healthy === false) return "Check failed";
  return "No data";
}

function healthVariant(healthy: boolean | null): "success" | "danger" | "secondary" {
  if (healthy === true) return "success";
  if (healthy === false) return "danger";
  return "secondary";
}

function NodeMetrics({
  id,
  metric,
}: {
  id: ServiceId;
  metric: NodeMetric;
}) {
  const service = serviceCatalog[id];
  return (
    <dl className="node-metrics" aria-label={"Operational metrics for " + service.name}>
      <div>
        <dt>{service.metricLabel}</dt>
        <dd data-node-metric="primary">{displayCount(metric.primary)}</dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd data-node-metric="total">{displayCount(metric.total)}</dd>
      </div>
    </dl>
  );
}

function MapNode({
  id,
  state,
  metric,
  href,
  onHover,
  onFocus,
  dimmed,
}: {
  id: ServiceId;
  state: ServiceVisualState;
  metric: NodeMetric;
  href?: string;
  onHover: (id: MapNodeId | null) => void;
  onFocus: (id: MapNodeId | null) => void;
  dimmed: boolean;
}) {
  const service = serviceCatalog[id];
  const readiness = healthText(metric.healthy);
  const body: ReactNode = (
    <>
      <span className="map-node__heading">
        <strong>{service.name}</strong>
        {href ? <span aria-hidden="true">↗</span> : null}
      </span>
      <span className="map-node__meta">
        <span className="map-node__runtime">{service.runtime}</span>
        <Badge bg={healthVariant(metric.healthy)}>{readiness}</Badge>
      </span>
      <NodeMetrics id={id} metric={metric} />
    </>
  );
  const shared = {
    className: "map-node",
    "data-service-id": id,
    "data-kind": service.kind,
    "data-state": state,
    "data-dimmed": dimmed,
    style: nodeStyle(id),
    title: service.role,
    onMouseEnter: () => onHover(id),
    onMouseLeave: () => onHover(null),
    onFocus: () => onFocus(id),
    onBlur: () => onFocus(null),
  } as const;

  return href ? (
    <a
      {...shared}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={service.name + ". " + readiness + ". " + service.role + ". Open tool"}
    >
      {body}
    </a>
  ) : (
    <article {...shared} tabIndex={0} aria-label={service.name + ". " + readiness + ". " + service.role}>
      {body}
    </article>
  );
}

function BrowserClients({ metric, streamState, onHover, onFocus, dimmed }: {
  metric: NodeMetric;
  streamState: StreamState;
  onHover: (id: MapNodeId | null) => void;
  onFocus: (id: MapNodeId | null) => void;
  dimmed: boolean;
}) {
  const readiness = streamState === "live" ? true : streamState === "unsupported" ? false : null;
  return (
    <article className="browser-clients" style={nodeStyle("browser-clients")} tabIndex={0}
      aria-label="Topology MFE. Live browser updates"
      data-dimmed={dimmed}
      onMouseEnter={() => onHover("browser-clients")} onMouseLeave={() => onHover(null)}
      onFocus={() => onFocus("browser-clients")} onBlur={() => onFocus(null)}
      data-state={metric.primary !== null && metric.primary > 0 ? "active" : "idle"}>
      <strong>Topology MFE</strong>
      <span className="map-node__meta">
        <span className="map-node__runtime">React / single-spa</span>
        <Badge bg={healthVariant(readiness)}>{healthText(readiness)}</Badge>
      </span>
      <dl className="node-metrics">
        <div>
          <dt>SSE clients</dt>
          <dd>{displayCount(metric.primary)}</dd>
        </div>
      </dl>
    </article>
  );
}

function EdgeLayer({
  activity,
  pulses,
  focusedNode,
}: {
  activity: JourneyActivity;
  pulses: FlowPulse[];
  focusedNode: MapNodeId | null;
}) {
  const edgeAttributes = (edge: typeof journeyEdges[number]) => ({
    "data-secondary": secondaryEdges.has(edge.id),
    "data-emphasis": focusedNode === null ? "default"
      : edge.source === focusedNode || edge.target === focusedNode ? "related" : "muted",
    "data-seen": Boolean(activity.edgeCounts[edge.id]),
  });
  return (
    <svg
      className="map-connections"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      role="img"
      aria-label="Verified connections with actions and transport protocols in parentheses"
      preserveAspectRatio="xMidYMid meet"
    >
      <desc>Each connection shows its action and transport protocol in parentheses.</desc>
      <defs>
        <marker id="map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {journeyEdges.map((edge) => (
        <g
          className="map-edge"
          data-edge-id={edge.id}
          data-kind={edge.kind}
          {...edgeAttributes(edge)}
          key={edge.id}
        >
          <path className="map-edge__path" d={edge.path} markerEnd="url(#map-arrow)" />
        </g>
      ))}
      {journeyEdges.map((edge) => (
        <text
          className="map-edge__label"
          data-edge-label-id={edge.id}
          {...edgeAttributes(edge)}
          key={edge.id + "-label"}
          textAnchor="middle"
          x={edge.labelX}
        >
          <tspan className="map-edge__action" x={edge.labelX} y={edge.labelY}>
            {edge.action}
          </tspan>
          <tspan className="map-edge__transport" x={edge.labelX} y={edge.labelY + 14}>
            ({edge.transport})
          </tspan>
        </text>
      ))}
      {pulses.map((pulse) => {
        const edge = journeyEdges.find((candidate) => candidate.id === pulse.edgeId);
        if (!edge) return null;
        return (
          <circle
            className="map-pulse"
            data-status={pulse.status}
            data-pulse-id={pulse.id}
            key={pulse.id}
            r="5"
          >
            <animateMotion dur="720ms" path={edge.path} fill="freeze" />
          </circle>
        );
      })}
    </svg>
  );
}

export function JourneyView({
  activity,
  pulses,
  metrics,
  nodeMetrics,
  streamState,
  operationsState,
  statusText,
  latestEventText,
  scopeText,
  errors,
  toolLinks,
  stateForService,
}: JourneyViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(MAP_WIDTH);
  const [zoom, setZoom] = useState<number | "auto" | "fit">("auto");
  const [allConnections, setAllConnections] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<MapNodeId | null>(null);
  const [focusedNode, setFocusedNode] = useState<MapNodeId | null>(null);
  const focusNode = (id: MapNodeId | null) => {
    setFocusedNode(id);
    // Keyboard navigation takes over even if the pointer remains on another card.
    if (id !== null) setHoveredNode(null);
  };
  const inspectedNode = hoveredNode ?? focusedNode;
  const fitScale = Math.min(1, Math.max(0.2, (viewportWidth - 2) / MAP_WIDTH));
  const scale = zoom === "fit" ? fitScale : zoom === "auto" ? Math.max(0.78, fitScale) : zoom;
  const connectedNodes = inspectedNode === null ? null : new Set<MapNodeId>([
    inspectedNode,
    ...journeyEdges.filter((edge) => edge.source === inspectedNode || edge.target === inspectedNode)
      .flatMap((edge) => [edge.source, edge.target]),
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      if (viewport.clientWidth > 0) setViewportWidth(viewport.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const clientMetric: NodeMetric = {
    primary: nodeMetrics["event-hub"].primary,
    total: null,
    healthy: streamState === "live" ? true : streamState === "unsupported" ? false : null,
  };
  const snapshotLabel =
    operationsState === "live" && errors.length > 0
      ? "Snapshot partial"
      : operationsLabels[operationsState];

  return (
    <section className="live-map" aria-labelledby="live-map-title" data-testid="live-flow-map">
      <header className="live-map__header">
        <div>
          <h2 id="live-map-title">Order topology</h2>
          <p className="live-map__status" role="status" aria-live="polite">{statusText}</p>
        </div>
        <div className="live-map__signals" aria-label="Live data sources">
          <Badge bg={streamState === "live" ? "success" : streamState === "unsupported" ? "danger" : "secondary"}>
            {streamLabels[streamState]}
          </Badge>
          <Badge bg={operationsState === "live" && errors.length === 0 ? "success" : operationsState === "error" ? "danger" : "secondary"}>
            {snapshotLabel}
          </Badge>
        </div>
      </header>

      <div className="live-map__context">
        <strong>{scopeText}</strong>
        <span>HTTP 202 follows the PostgreSQL commit. Broker delivery continues asynchronously.</span>
      </div>

      <dl className="live-map__metrics" aria-label="Current run summary">
        {metrics.map((metric) => (
          <div key={metric.label} data-tone={metric.tone ?? "neutral"}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>

      {errors.length > 0 ? (
        <Alert className="live-map__warning" variant="warning" role="status">
          <strong>Partial data.</strong> {errors.join(" ")}
        </Alert>
      ) : null}

      <div className="map-toolbar" aria-label="Diagram controls">
        <div className="map-toolbar__views" role="group" aria-label="Connection detail">
          <button type="button" aria-pressed={!allConnections} onClick={() => setAllConnections(false)}>Main flow</button>
          <button type="button" aria-pressed={allConnections} onClick={() => setAllConnections(true)}>All connections <span>{journeyEdges.length}</span></button>
        </div>
        <div className="map-toolbar__zoom" role="group" aria-label="Diagram zoom">
          <button type="button" aria-label="Zoom out" disabled={scale <= 0.4} onClick={() => setZoom(Math.max(0.4, scale - 0.1))}>−</button>
          <button type="button" aria-label="Reset zoom to 100%" onClick={() => setZoom(1)}>{Math.round(scale * 100)}%</button>
          <button type="button" aria-label="Zoom in" disabled={scale >= 1.5} onClick={() => setZoom(Math.min(1.5, scale + 0.1))}>+</button>
          <button type="button" onClick={() => { setZoom("fit"); viewportRef.current?.scrollTo?.(0, 0); }}>Fit</button>
        </div>
      </div>
      <div className="map-guide">
        <span>{inspectedNode ? `Connections for ${inspectedNode === "browser-clients" ? "Topology MFE" : serviceCatalog[inspectedNode].name}` : "Follow the order left to right. Hover or focus a service to trace its connections."}</span>
        <span className="map-guide__legend"><i aria-hidden="true" /> Observed in this scope</span>
      </div>
      <div className="map-scroll" ref={viewportRef} tabIndex={0} role="region" aria-label="Order architecture diagram. Scroll to explore, or use Fit to see the whole diagram.">
        <div className="map-size" style={{ width: MAP_WIDTH * scale, height: MAP_HEIGHT * scale }}>
        <div className="map-canvas" data-detail={allConnections ? "all" : "main"}
          style={{ width: MAP_WIDTH, height: MAP_HEIGHT, transform: `scale(${scale})` }}>
          <div className="map-lane map-lane--support" aria-hidden="true"><span>Supporting services</span><p>Scheduled jobs, cache & pricing</p></div>
          <div className="map-lane map-lane--order" aria-hidden="true"><span><b>01</b> Accept & publish</span><p>Request → durable order → events</p></div>
          <div className="map-lane map-lane--inventory" aria-hidden="true"><span><b>02</b> Reserve & confirm</span><p>Inventory commands and order results</p></div>
          <div className="map-lane map-lane--live" aria-hidden="true"><span><b>03</b> Live updates</span><p>Event stream → browser</p></div>
          <EdgeLayer activity={activity} pulses={pulses} focusedNode={inspectedNode} />
          {serviceIds.map((id) => (
            <MapNode
              id={id}
              state={stateForService(id)}
              metric={nodeMetrics[id]}
              href={toolLinks[id]}
              onHover={setHoveredNode}
              onFocus={focusNode}
              dimmed={connectedNodes !== null && !connectedNodes.has(id)}
              key={id}
            />
          ))}
          <BrowserClients metric={clientMetric} streamState={streamState}
            onHover={setHoveredNode} onFocus={focusNode}
            dimmed={connectedNodes !== null && !connectedNodes.has("browser-clients")} />
        </div>
        </div>
      </div>

      <footer className="live-map__footer">
        <span>{latestEventText}</span>
        <span className="live-map__truth">Highlighted paths were observed in this scope. Counts use the latest runtime snapshot.</span>
      </footer>
    </section>
  );
}
