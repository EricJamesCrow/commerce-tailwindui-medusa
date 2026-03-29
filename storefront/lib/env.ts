export function sanitizeEnvValue(
  value: string | undefined,
): string | undefined {
  const sanitized = value?.replace(/[\r\n]+/g, "").trim();
  return sanitized ? sanitized : undefined;
}

export function sanitizeEnvUrl(
  value: string | undefined,
  fallback = "",
): string {
  return sanitizeEnvValue(value) || fallback;
}
