export function createRunId(date = new Date()): string {
  const timestamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${suffix}`;
}

