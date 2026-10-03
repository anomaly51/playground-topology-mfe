import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTopologyToolLinks } from "./tool-links";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildTopologyToolLinks", () => {
  it("does not create infrastructure tool links when disabled", () => {
    vi.stubGlobal("__ENABLE_TOOL_LINKS__", false);

    expect(buildTopologyToolLinks({ hostname: "playground.example.com" })).toEqual({});
  });

  it("uses standard local tool ports", () => {
    const links = buildTopologyToolLinks({
      hostname: "localhost",
    });

    expect(links.kafka).toContain("localhost:8083/");
    expect(links.rabbitmq).toContain("localhost:15672/");
    expect(links.postgresql).toContain("localhost:8082/");
    expect(links.mysql).toContain("localhost:8082/");
    expect(links.redis).toBe("http://localhost:5540/");
    expect(links.airflow).toBe("http://localhost:8088/");
    expect(links.kafka).toContain("flashdrop.orders.v1");
  });

  it("preserves an IPv6 host with standard tool ports", () => {
    const links = buildTopologyToolLinks({ hostname: "::1" });

    expect(links.kafka).toContain("http://[::1]:8083/");
    expect(links.rabbitmq).toContain("http://[::1]:15672/");
    expect(links.postgresql).toContain("http://[::1]:8082/");
    expect(links.redis).toBe("http://[::1]:5540/");
    expect(links.airflow).toBe("http://[::1]:8088/");
  });
});
