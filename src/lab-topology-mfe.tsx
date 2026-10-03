import "./set-public-path";
import "./styles.css";

import React from "react";
import ReactDOM from "react-dom";
import singleSpaReact from "single-spa-react";

import { RemoteErrorBoundary } from "./RemoteErrorBoundary";
import { TopologyApp } from "./TopologyApp";

function Root() {
  return (
    <RemoteErrorBoundary>
      <TopologyApp />
    </RemoteErrorBoundary>
  );
}

const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: Root,
  errorBoundary(error) {
    return (
      <section className="topology-crash" role="alert">
        <strong>Topology MFE failed to start</strong>
        <p>{error.message}</p>
      </section>
    );
  },
});

export const { bootstrap, mount, unmount } = lifecycles;
