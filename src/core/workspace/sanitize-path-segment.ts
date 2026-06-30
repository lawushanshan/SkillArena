import { createHash } from "node:crypto";

export function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.length > 0 ? sanitized : "unnamed";
}

export function createStablePathSegment(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return `${sanitizePathSegment(value)}-${hash}`;
}
