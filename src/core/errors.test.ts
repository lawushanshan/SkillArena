import { describe, expect, it } from "vitest";

import { formatUnknownError, SkillArenaError } from "./errors.js";

describe("SkillArenaError", () => {
  it("sets the message and name", () => {
    const error = new SkillArenaError("something went wrong");
    expect(error.message).toBe("something went wrong");
    expect(error.name).toBe("SkillArenaError");
  });

  it("is an instance of Error", () => {
    const error = new SkillArenaError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SkillArenaError);
  });
});

describe("formatUnknownError", () => {
  it("returns the message of Error instances", () => {
    const error = new Error("disk full");
    expect(formatUnknownError(error)).toBe("disk full");
  });

  it("returns the message of SkillArenaError instances", () => {
    const error = new SkillArenaError("invalid config");
    expect(formatUnknownError(error)).toBe("invalid config");
  });

  it("stringifies non-Error values", () => {
    expect(formatUnknownError("plain string")).toBe("plain string");
    expect(formatUnknownError(42)).toBe("42");
    expect(formatUnknownError(null)).toBe("null");
    expect(formatUnknownError(undefined)).toBe("undefined");
  });
});
