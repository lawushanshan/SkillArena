import { describe, expect, it } from "vitest";
import { createClaudeAdapter } from "../agent-adapter.js";

describe("createClaudeAdapter", () => {
  it("returns an adapter with name 'claude'", () => {
    const adapter = createClaudeAdapter();
    expect(adapter.name).toBe("claude");
  });

  it("declares expected capabilities", () => {
    const adapter = createClaudeAdapter();
    expect(adapter.capabilities.has("skill_read_trace")).toBe(true);
    expect(adapter.capabilities.has("command_trace")).toBe(true);
    expect(adapter.capabilities.has("file_change_detection")).toBe(true);
  });

  it("exposes execute, parseTrace, and detectVersion methods", () => {
    const adapter = createClaudeAdapter();
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.parseTrace).toBe("function");
    expect(typeof adapter.detectVersion).toBe("function");
  });
});
