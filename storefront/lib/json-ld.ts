/**
 * Safely serialize data for JSON-LD script tags.
 * Escapes `</script>` sequences to prevent script tag breakout.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
}
