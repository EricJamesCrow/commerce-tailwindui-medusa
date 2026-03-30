export function stripUnsubscribeTokenFromPath(url: string): string {
  const parsed = new URL(url, "http://localhost");
  parsed.searchParams.delete("token");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
