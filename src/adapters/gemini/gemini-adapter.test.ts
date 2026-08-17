import { describe, expect, it } from "vitest";
import { createGeminiAdapter } from "../agent-adapter.js";

describe("createGeminiAdapter", () => {
  it("returns an adapter with name 'gemini'", () => {
    const adapter = createGeminiAdapter();
    expect(adapter.name).toBe("gemini");
  });

  it("declares expected capabilities", () => {
    const adapter = createGeminiAdapter();
    expect(adapter.capabilities.has("skill_read_trace")).toBe(true);
    expect(adapter.capabilities.has("command_trace")).toBe(true);
    expect(adapter.capabilities.has("file_change_detection")).toBe(true);
  });

  it("exposes execute, parseTrace, and detectVersion methods", () => {
    const adapter = createGeminiAdapter();
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.parseTrace).toBe("function");
    expect(typeof adapter.detectVersion).toBe("function");
  });
});
