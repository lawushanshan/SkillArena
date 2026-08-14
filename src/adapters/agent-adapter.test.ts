import { describe, expect, it } from "vitest";

import { createCodexAdapter } from "./agent-adapter.js";

describe("createCodexAdapter", () => {
  it("returns an adapter with the codex agent name", () => {
    const adapter = createCodexAdapter();
    expect(adapter.name).toBe("codex");
  });

  it("declares all three trace capabilities", () => {
    const adapter = createCodexAdapter();
    expect(adapter.capabilities.has("skill_read_trace")).toBe(true);
    expect(adapter.capabilities.has("command_trace")).toBe(true);
    expect(adapter.capabilities.has("file_change_detection")).toBe(true);
  });

  it("exposes execute and parseTrace methods", () => {
    const adapter = createCodexAdapter();
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.parseTrace).toBe("function");
  });
});
