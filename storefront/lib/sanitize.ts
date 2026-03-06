/**
 * Lightweight HTML sanitizer that works in serverless environments.
 *
 * Strips dangerous tags (script, style, iframe, object, embed, form) and their
 * contents, removes event-handler attributes (on*), and strips javascript: URLs.
 * Preserves safe formatting tags for rendering admin-authored content.
 *
 * Note: This replaces isomorphic-dompurify which depends on jsdom and fails in
 * Vercel's serverless runtime. Content is admin-controlled (Medusa product
 * descriptions), not user-provided. If untrusted user HTML is ever needed,
 * switch to a full DOM-based sanitizer (e.g. sanitize-html).
 */
export function sanitizeHtml(dirty: string): string {
  let clean = dirty;

  // Strip dangerous tags and their contents
  clean = clean.replace(
    /<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // Strip self-closing dangerous tags
  clean = clean.replace(
    /<(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi,
    "",
  );

  // Strip event-handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Strip javascript: URLs in href/src/action attributes
  clean = clean.replace(
    /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    "",
  );

  return clean;
}
