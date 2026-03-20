# Sentry Integration Design Spec

## Overview

Add Sentry error monitoring, performance tracing, session replay, and profiling to both apps in the monorepo. Each app gets its own Sentry project and DSN within the same Sentry organization.

## Approach

**Native Sentry SDKs** — `@sentry/nextjs` for the storefront, `@sentry/node` v9 for the backend. This gives the tightest integration with each runtime, access to Sentry-specific features (Session Replay, local variable snapshots, enriched error grouping), and automatic distributed tracing across both apps via W3C `traceparent`/`baggage` headers.

Alternatives considered:
- **OTel-first with Sentry as backend** — more vendor-agnostic but loses Session Replay, local variable snapshots, and enriched error grouping.
- **Hybrid** (native SDK on storefront, OTel-only on backend) — inconsistent patterns across the monorepo.

## Features Enabled

| Feature | Storefront | Backend |
|---------|-----------|---------|
| Error monitoring | Yes | Yes |
| Performance tracing | Yes | Yes |
| Session Replay | Yes (browser only) | N/A |
| Profiling | Yes (browser + server) | Yes |
| Distributed tracing | Yes (propagates to backend) | Yes (receives from storefront) |

## Backend Integration (Medusa v2)

### SDK

`@sentry/node` v9 with native OpenTelemetry support. No legacy packages (`@sentry/opentelemetry-node`, `@opentelemetry/exporter-trace-otlp-grpc`) needed — v9 ships its own `SentrySpanProcessor` and `SentryPropagator`.

### Architecture

Sentry v9 has native OpenTelemetry support built in. When `Sentry.init()` is called before the OTel SDK starts, it registers its own `SentrySpanProcessor` and `SentryPropagator` with the OpenTelemetry global API automatically. The key is initialization order: Sentry first, then `registerOtel()`.

Medusa's `registerOtel()` accepts `Partial<NodeSDKConfiguration>` with rest-spread, so extra OTel SDK options can be passed through. However, `registerOtel()` internally creates its own `SimpleSpanProcessor(exporter)` which may conflict with Sentry's auto-registered processor. The implementation must verify one of two approaches:

1. **Auto-integration (preferred):** Call `Sentry.init()` before `registerOtel()`. Sentry v9 auto-registers with the OTel global API, and `registerOtel()` picks up the global propagator/processor. If this works, no manual wiring is needed.
2. **Manual wiring (fallback):** Import `SentrySpanProcessor` and `SentryPropagator` from `@sentry/opentelemetry` (a peer dependency of `@sentry/node` v9) and pass them explicitly via `registerOtel()`'s rest-spread. This requires verifying that the extra `spanProcessors` parameter doesn't conflict with `registerOtel()`'s hardcoded `spanProcessor`.
3. **Bypass `registerOtel()` (last resort):** Configure `@opentelemetry/sdk-node` `NodeSDK` directly with full control over processors and propagators. This loses Medusa's convenience helpers but guarantees no conflicts.

The error handler middleware captures all HTTP-layer exceptions via `Sentry.captureException()`.

### Files Changed

#### `backend/instrumentation.ts` (replace commented-out stub)

Initialize Sentry before `registerOtel()`. Sentry v9 auto-registers with the OTel global API. Enable tracing for HTTP, workflows, queries, and DB operations.

```ts
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { registerOtel } from "@medusajs/medusa"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV || "development",
})

export function register() {
  registerOtel({
    serviceName: "crowcommerce-backend",
    instrument: {
      http: true,
      workflows: true,
      query: true,
      db: true,
    },
  })
}
```

> **Implementation note:** The auto-integration approach (Sentry init before registerOtel) must be verified at implementation time. If Sentry's auto-registered span processor conflicts with registerOtel's internal SimpleSpanProcessor, fall back to manual wiring via `@sentry/opentelemetry` imports or bypass registerOtel entirely. See the Architecture section above for the three approaches. Consult `@sentry/node` v9 docs and Medusa's `registerOtel` source for the exact API.

#### `backend/src/api/middlewares.ts` (add error handler)

Add a top-level `errorHandler` property to the existing `defineMiddlewares()` call. This is separate from the `routes` array — it wraps Medusa's entire error handling layer and catches errors from all routes. The custom handler captures the error to Sentry, then calls `next(error)` to let Medusa's built-in error handler produce the HTTP response.

```ts
import * as Sentry from "@sentry/node"
// ... existing imports ...

export default defineMiddlewares({
  errorHandler: (error, req, res, next) => {
    Sentry.captureException(error)
    next(error)
  },
  routes: [
    // ... all existing routes unchanged ...
  ],
})
```

> **Why `next(error)` instead of manually invoking `errorHandler()`:** Medusa's framework applies its own default error handler after the custom one. Calling `next(error)` delegates to that built-in handler, which formats the error response correctly. Do not import and invoke `errorHandler()` manually — it creates a duplicate handler chain.

#### `backend/package.json` (add dependencies)

```
@sentry/node: ^9
@sentry/profiling-node: ^9
```

#### `backend/.env` (add variable)

```
SENTRY_DSN=  # Backend Sentry project DSN
```

### Profiling on Railway

`@sentry/profiling-node` is a native addon (compiles C++ bindings). If it causes build or cold-start issues on Railway, drop `nodeProfilingIntegration()` from the integrations array and remove the dependency. Error monitoring and tracing will continue to work without it.

## Storefront Integration (Next.js 16)

### SDK

`@sentry/nextjs` — purpose-built for Next.js, handles browser, Node.js server, and edge runtimes.

### Architecture

Four config files cover the three runtimes. `withSentryConfig()` wraps `next.config.ts` for automatic source map upload. A `global-error.tsx` boundary catches unhandled App Router errors.

### Files Created

#### `storefront/instrumentation-client.ts` (new — browser runtime)

Browser-side error monitoring, performance tracing, Session Replay, and browser profiling.

```ts
import * as Sentry from "@sentry/nextjs"
import { browserProfilingIntegration } from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    browserProfilingIntegration(),
  ],
})
```

#### `storefront/sentry.server.config.ts` (new — Node.js server runtime)

Server-side error monitoring with local variable snapshots for richer debugging context. Performance tracing and profiling.

```ts
import * as Sentry from "@sentry/nextjs"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV || "development",
})
```

#### `storefront/sentry.edge.config.ts` (new — edge runtime)

Minimal config — error monitoring and tracing only. No profiling (native addons not supported on edge).

```ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
})
```

#### `storefront/instrumentation.ts` (new — Next.js instrumentation hook)

Dispatches to the correct Sentry config based on runtime. Also exports `onRequestError` to capture server component, route handler, and server action errors.

```ts
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
```

> **`onRequestError`:** Next.js 15+ calls this hook for server-side errors (server components, route handlers, server actions). Without it, these errors might not be captured unless `@sentry/nextjs` patches them automatically. Verify against current `@sentry/nextjs` v9 docs — the SDK may handle this via `withSentryConfig()` instead.

#### `storefront/app/global-error.tsx` (new — error boundary)

Catches unhandled errors in App Router layouts and pages, reports to Sentry, shows fallback UI. Must be a Client Component and must render its own `<html>` and `<body>` tags.

```tsx
"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
```

> **TODO:** Replace the minimal fallback UI with a styled version matching the TailwindUI design language after the integration is verified working. This is the error page template buyers will see (and likely forget to customize).

> **Scope caveat:** `global-error.tsx` only catches errors in layouts and pages, not in server actions or route handlers. Server action errors are captured by `onRequestError` in `instrumentation.ts` and by Sentry's server-side instrumentation — no gap in coverage.

### Files Modified

#### `storefront/next.config.ts` (wrap with `withSentryConfig`)

Wrap the existing config export with `withSentryConfig()` for automatic source map upload during builds. Configure tunneling route to avoid ad blockers if desired.

```ts
import { withSentryConfig } from "@sentry/nextjs"

export default withSentryConfig({
  // ... existing config ...
}, {
  org: "crowcommerce",
  project: "storefront",
  silent: !process.env.CI,
})
```

> **Compatibility note:** Verify that `withSentryConfig()` works with Next.js 16's `cacheComponents: true` and `reactCompiler: true`. If there are conflicts, these can be resolved at implementation time — Sentry's Next.js SDK typically tracks Next.js releases closely.

#### `storefront/package.json` (add dependencies)

```
@sentry/nextjs: ^9
@sentry/profiling-node: ^9
```

### Environment Variables

**Runtime (both local and production):**
```
NEXT_PUBLIC_SENTRY_DSN=  # Storefront Sentry project DSN — safe to expose client-side (DSNs are public by design, rate limiting is server-side)
```

**Build-time only (`storefront/.env.sentry-build-plugin`, gitignored):**
```
SENTRY_AUTH_TOKEN=  # For source map uploads — generate at sentry.io/settings/auth-tokens/
SENTRY_ORG=crowcommerce
SENTRY_PROJECT=storefront
```

The auth token is only needed at build time for source map uploads, not at runtime. On Vercel, set `SENTRY_AUTH_TOKEN` as an environment variable for production builds. Do not put it in the runtime `.env` alongside `SENTRY_DSN`.

### Profiling on Vercel

Same native addon concern as Railway. `@sentry/profiling-node` may not work in Vercel's serverless Node.js runtime without additional configuration. Test after first deploy — if it causes build or cold-start issues, drop `nodeProfilingIntegration()` from `sentry.server.config.ts`. Browser profiling in `instrumentation-client.ts` is pure JS and will not have this problem.

## Distributed Tracing

Both SDKs propagate W3C `traceparent` and `baggage` headers automatically. When the storefront makes HTTP calls to the Medusa backend (via the Medusa JS SDK), Sentry correlates traces across both projects. A single user action (e.g., "add to cart") can be followed from browser click through storefront server action to backend API route to database query.

**Requirement:** Both Sentry projects must be in the same Sentry organization.

**Verification note:** `@sentry/nextjs` auto-instruments browser `fetch()` calls, but server-side calls in Server Actions use Node's `fetch`. Verify during implementation that Sentry's server-side instrumentation patches Node `fetch` to propagate trace headers. If not, the Medusa JS SDK calls from server actions won't produce linked traces. The browser-to-backend path (client component fetch) should work without issues.

## Sample Rates

| Rate | Storefront | Backend | Configurable via |
|------|-----------|---------|-----------------|
| `tracesSampleRate` | 0.2 (20%) | 0.2 (20%) | `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` |
| `profilesSampleRate` | 0.1 (10%) | 0.1 (10%) | Hardcoded (low overhead) |
| `replaysSessionSampleRate` | 0.1 (10%) | N/A | Hardcoded |
| `replaysOnErrorSampleRate` | 1.0 (100%) | N/A | Hardcoded |

Trace sample rate defaults to 20% and is configurable via environment variable so it can be tuned without code changes. Set to `1.0` during development for full visibility.

## Behavior Without DSN

When `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is not set (local dev without Sentry, CI, preview deployments), `Sentry.init()` enters a no-op mode — no errors are captured, no performance data is sent, no SDK overhead. This is acceptable and requires no conditional guards.

## Out of Scope

- **Sentry tunnel route** — a proxy route (`/api/sentry`) that forwards Sentry events to avoid ad blockers. Can be added later if client-side error capture rates are low.
- **Sentry Alerts** — notification rules (email, Slack) for critical issues. Configure in the Sentry dashboard after integration is verified.
- **User feedback widget** — Sentry's in-app feedback collection. Not needed at launch.

## Documentation Updates

- Add `SENTRY_DSN` to both backend and storefront sections of `SETUP.md` env var tables (local dev and production)
- Add `SENTRY_AUTH_TOKEN` to storefront production section of `SETUP.md`
- Add `.env.sentry-build-plugin` to storefront `.gitignore` (and root `.gitignore` as a safeguard)
- Update `README.md` infrastructure table with Sentry status
- Add `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` to env var docs as optional tuning knobs

## Verification

1. **Backend:** Start dev server, hit a route that throws an error, confirm it appears in the backend Sentry project within 30 seconds. Check traces page for HTTP/workflow/DB spans.
2. **Storefront:** Start dev server, trigger a client-side error (e.g., throw in a component), confirm it appears in the storefront Sentry project. Check for Session Replay recording. Trigger a server action error and confirm server-side capture.
3. **Distributed tracing (browser path):** Add item to cart from the storefront, find the trace in the storefront Sentry project, confirm it links to the corresponding backend trace.
4. **Distributed tracing (server action path):** Trigger a server action that calls the Medusa backend (e.g., update customer profile), verify the server-side trace propagates `traceparent` headers and links to the backend trace.
