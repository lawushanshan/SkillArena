export function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.length > 0 ? sanitized : "unnamed";
}

