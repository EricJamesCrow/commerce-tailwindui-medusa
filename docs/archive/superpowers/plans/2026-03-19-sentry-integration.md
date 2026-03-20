# Sentry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sentry error monitoring, performance tracing, session replay, and profiling to both the Medusa backend and Next.js storefront.

**Architecture:** Two independent Sentry integrations — `@sentry/node` v9 for the backend (via Medusa's OpenTelemetry support) and `@sentry/nextjs` for the storefront (browser + server + edge). Each app gets its own Sentry project/DSN. Distributed tracing links requests across both via W3C headers.

**Tech Stack:** `@sentry/node` ^9, `@sentry/nextjs` ^9, `@sentry/profiling-node` ^9, Medusa `registerOtel()`, Next.js 16 instrumentation API.

**Spec:** `docs/superpowers/specs/2026-03-19-sentry-integration-design.md`

**Branch workflow:** This project uses Graphite (`gt`) for all branching and PRs. Before starting Task 1, create the feature branch:

```bash
gt create -m "feat: add Sentry error monitoring and tracing"
```

After all tasks are complete and verified, submit the PR:

```bash
gt submit --stack
gh pr ready <number>
```

**Lockfile note:** This is a bun workspaces monorepo with a single root lockfile (`bun.lockb`). Running `bun add` in any workspace updates the root `bun.lockb`, not a per-workspace lockfile.

---

## File Map

### Backend (files to modify)

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/package.json` | Modify | Add `@sentry/node`, `@sentry/profiling-node` |
| `backend/instrumentation.ts` | Replace | Sentry init + `registerOtel()` with OTel tracing |
| `backend/src/api/middlewares.ts` | Modify | Add `errorHandler` for `Sentry.captureException()` |
| `backend/.env.example` | Modify | Document `SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE` |

### Storefront (files to create/modify)

| File | Action | Responsibility |
|------|--------|---------------|
| `storefront/package.json` | Modify | Add `@sentry/nextjs`, `@sentry/profiling-node` |
| `storefront/instrumentation-client.ts` | Create | Browser: errors, tracing, replay, profiling |
| `storefront/sentry.server.config.ts` | Create | Node.js server: errors, tracing, profiling |
| `storefront/sentry.edge.config.ts` | Create | Edge runtime: errors, tracing |
| `storefront/instrumentation.ts` | Create | Dispatches to server/edge configs + `onRequestError` |
| `storefront/app/global-error.tsx` | Create | App Router error boundary → Sentry |
| `storefront/next.config.ts` | Modify | Wrap with `withSentryConfig()` |
| `storefront/.env.example` | Modify | Document `NEXT_PUBLIC_SENTRY_DSN` and sample rate vars |

### Shared (documentation)

| File | Action | Responsibility |
|------|--------|---------------|
| `storefront/.gitignore` | Modify | Add `.env.sentry-build-plugin` |
| `.gitignore` | Modify | Add `.env.sentry-build-plugin` safeguard |
| `SETUP.md` | Modify | Add Sentry env vars to both app sections |
| `README.md` | Modify | Add Sentry to infrastructure table |

---

## Task 1: Backend — Install Dependencies and Configure Instrumentation

**Files:**
- Modify: `backend/package.json`
- Replace: `backend/instrumentation.ts` (lines 1-24, entire file)

- [ ] **Step 1: Install Sentry dependencies in backend**

```bash
cd backend && bun add @sentry/node@^9 @sentry/profiling-node@^9
```

- [ ] **Step 2: Verify packages installed**

Run: `cd backend && cat package.json | grep -A1 sentry`
Expected: `@sentry/node` and `@sentry/profiling-node` appear in dependencies.

- [ ] **Step 3: Replace `backend/instrumentation.ts`**

Replace the entire contents of `backend/instrumentation.ts` (currently all commented-out code) with:

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

> **Critical:** `Sentry.init()` MUST be called before `registerOtel()`. Sentry v9 auto-registers its span processor and propagator with the OpenTelemetry global API. If this auto-integration doesn't work (Sentry traces don't appear), consult the spec's Architecture section for fallback approaches.

- [ ] **Step 4: Verify backend starts without errors**

Run: `cd backend && bun run dev`
Expected: Server starts on port 9000. Look for `info: OTEL registered` in terminal output confirming OpenTelemetry initialization. If `SENTRY_DSN` is not set, Sentry enters no-op mode silently — this is expected.

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json bun.lockb backend/instrumentation.ts
git commit -m "feat(backend): add Sentry SDK with OpenTelemetry instrumentation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Backend — Add Error Handler Middleware

**Files:**
- Modify: `backend/src/api/middlewares.ts` (lines 1-6 imports, line 38 `defineMiddlewares`)

- [ ] **Step 1: Add Sentry import to `backend/src/api/middlewares.ts`**

Add this import at the top of the file, after the existing imports:

```ts
import * as Sentry from "@sentry/node"
```

- [ ] **Step 2: Add `errorHandler` to `defineMiddlewares()`**

In `backend/src/api/middlewares.ts`, the `defineMiddlewares()` call currently starts at line 38 with only a `routes` property. Add `errorHandler` as a top-level property before `routes`:

```ts
export default defineMiddlewares({
  errorHandler: (error, req, res, next) => {
    Sentry.captureException(error)
    next(error)
  },
  routes: [
    // ... all existing routes remain unchanged ...
  ],
})
```

> **Do NOT** import or invoke `errorHandler()` from `@medusajs/framework/http`. The framework applies its own default handler after yours. Calling `next(error)` delegates to it.

- [ ] **Step 3: Verify backend starts and existing routes work**

Run: `cd backend && bun run dev`
Expected: Server starts normally. Test an existing route:
```bash
curl -s http://localhost:9000/health | head -c 100
```
Expected: `200` response. The error handler should not affect normal request flow.

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/middlewares.ts
git commit -m "feat(backend): add Sentry error handler middleware

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Backend — Add Environment Variable Documentation

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add Sentry env vars to `backend/.env.example`**

Add a `# Sentry` section at the end of the file:

```
# Sentry — Error monitoring and performance tracing
# Create a project at sentry.io, select Node.js, copy the DSN
SENTRY_DSN=
# Trace sample rate (0.0 to 1.0). Default 0.2 (20%). Set to 1.0 for local dev.
SENTRY_TRACES_SAMPLE_RATE=
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs(backend): add Sentry env vars to .env.example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Storefront — Install Dependencies

**Files:**
- Modify: `storefront/package.json`

- [ ] **Step 1: Install Sentry dependencies in storefront**

```bash
cd storefront && bun add @sentry/nextjs@^9 @sentry/profiling-node@^9
```

- [ ] **Step 2: Verify packages installed**

Run: `cd storefront && cat package.json | grep -A1 sentry`
Expected: `@sentry/nextjs` and `@sentry/profiling-node` appear in dependencies.

- [ ] **Step 3: Commit**

```bash
git add storefront/package.json bun.lockb
git commit -m "feat(storefront): add Sentry Next.js SDK dependencies

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Storefront — Create Browser Runtime Config

**Files:**
- Create: `storefront/instrumentation-client.ts`

- [ ] **Step 1: Create `storefront/instrumentation-client.ts`**

```ts
import * as Sentry from "@sentry/nextjs"
import { browserProfilingIntegration } from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.2"
  ),
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

- [ ] **Step 2: Commit**

```bash
git add storefront/instrumentation-client.ts
git commit -m "feat(storefront): add Sentry browser runtime config

Session Replay (10% sessions, 100% on error), browser profiling,
performance tracing. All text masked, all media blocked for privacy.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Storefront — Create Server and Edge Runtime Configs

**Files:**
- Create: `storefront/sentry.server.config.ts`
- Create: `storefront/sentry.edge.config.ts`

- [ ] **Step 1: Create `storefront/sentry.server.config.ts`**

```ts
import * as Sentry from "@sentry/nextjs"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"
  ),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV || "development",
})
```

> **Note:** Server-side uses `SENTRY_TRACES_SAMPLE_RATE` (no `NEXT_PUBLIC_` prefix) because server env vars don't need to be exposed to the client bundle.

- [ ] **Step 2: Create `storefront/sentry.edge.config.ts`**

```ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"
  ),
})
```

- [ ] **Step 3: Commit**

```bash
git add storefront/sentry.server.config.ts storefront/sentry.edge.config.ts
git commit -m "feat(storefront): add Sentry server and edge runtime configs

Server: error monitoring, tracing, profiling.
Edge: error monitoring, tracing only (no native addon support).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Storefront — Create Instrumentation Hook

**Files:**
- Create: `storefront/instrumentation.ts`

- [ ] **Step 1: Create `storefront/instrumentation.ts`**

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

> **`onRequestError`:** Next.js 15+ calls this for server component, route handler, and server action errors. If `@sentry/nextjs` v9 handles this automatically via `withSentryConfig()`, this export is harmless (double-capture is deduplicated). Verify against current docs.

- [ ] **Step 2: Commit**

```bash
git add storefront/instrumentation.ts
git commit -m "feat(storefront): add Next.js instrumentation hook with onRequestError

Dispatches to server/edge Sentry configs based on runtime.
Exports onRequestError for server-side error capture.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Storefront — Create Global Error Boundary

**Files:**
- Create: `storefront/app/global-error.tsx`

- [ ] **Step 1: Create `storefront/app/global-error.tsx`**

```tsx
"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

// TODO: Replace minimal fallback with styled TailwindUI error page
// after Sentry integration is verified working.
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
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  )
}
```

> **Scope:** This only catches errors in layouts and pages. Server action and route handler errors are captured by `onRequestError` in `instrumentation.ts`.

- [ ] **Step 2: Commit**

```bash
git add storefront/app/global-error.tsx
git commit -m "feat(storefront): add global error boundary for Sentry

Catches unhandled App Router errors, reports to Sentry, shows fallback UI.
TODO: style with TailwindUI components.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Storefront — Wrap `next.config.ts` with Sentry

**Files:**
- Modify: `storefront/next.config.ts` (entire file)

- [ ] **Step 1: Read current `storefront/next.config.ts`**

Current contents (for reference):
```ts
export default {
  cacheComponents: true,
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    // ... image config ...
  },
};
```

- [ ] **Step 2: Wrap with `withSentryConfig()`**

Replace the entire file with:

```ts
import { withSentryConfig } from "@sentry/nextjs"

export default withSentryConfig(
  {
    cacheComponents: true,
    reactCompiler: true,
    experimental: {
      serverActions: {
        bodySizeLimit: "15mb",
      },
    },
    images: {
      formats: ["image/avif", "image/webp"],
      remotePatterns: [
        {
          protocol: "http",
          hostname: "localhost",
        },
        {
          protocol: "https",
          hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "medusa-server-testing.s3.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "via.placeholder.com",
        },
        {
          protocol: "https",
          hostname: "tailwindcss.com",
          pathname: "/plus-assets/**",
        },
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
        ...(process.env.S3_IMAGE_HOSTNAME
          ? [
              {
                protocol: "https" as const,
                hostname: process.env.S3_IMAGE_HOSTNAME,
              },
            ]
          : []),
        ...(process.env.NODE_ENV !== "production"
          ? [{ protocol: "https" as const, hostname: "placehold.co" }]
          : []),
      ],
    },
  },
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
  }
)
```

> **Compatibility:** If `withSentryConfig()` conflicts with `cacheComponents: true` or `reactCompiler: true` in Next.js 16, check the `@sentry/nextjs` changelog for a compatible version. These are the most likely friction points.

- [ ] **Step 3: Verify storefront builds**

Run: `cd storefront && bun run build`
Expected: Build completes without errors. Source map upload will be skipped if `SENTRY_AUTH_TOKEN` is not set — this is expected for now.

- [ ] **Step 4: Commit**

```bash
git add storefront/next.config.ts
git commit -m "feat(storefront): wrap next.config with withSentryConfig

Enables automatic source map upload during builds.
Org and project read from env vars for flexibility.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Storefront — Add Environment Variable Documentation

**Files:**
- Modify: `storefront/.env.example`

- [ ] **Step 1: Add Sentry env vars to `storefront/.env.example`**

Add a `# Sentry` section at the end of the file:

```
# Sentry — Error monitoring, performance tracing, session replay
# Create a project at sentry.io, select Next.js, copy the DSN
# DSN is safe to expose client-side (public by design, rate limiting is server-side)
NEXT_PUBLIC_SENTRY_DSN=
# Trace sample rate (0.0 to 1.0). Default 0.2 (20%). Set to 1.0 for local dev.
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=
# Server-side trace sample rate (defaults to NEXT_PUBLIC value if not set)
SENTRY_TRACES_SAMPLE_RATE=
# Source map uploads (build-time only) — generate token at sentry.io/settings/auth-tokens/
# These can also go in .env.sentry-build-plugin (gitignored) instead
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 2: Commit**

```bash
git add storefront/.env.example
git commit -m "docs(storefront): add Sentry env vars to .env.example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Gitignore and Source Map Auth

**Files:**
- Modify: `storefront/.gitignore`
- Modify: `.gitignore` (root)

- [ ] **Step 1: Add `.env.sentry-build-plugin` to `storefront/.gitignore`**

Append to `storefront/.gitignore`:

```
.env.sentry-build-plugin
```

- [ ] **Step 2: Add `.env.sentry-build-plugin` to root `.gitignore`**

Add to the `# local env files` section in the root `.gitignore` (after line 30):

```
.env.sentry-build-plugin
```

> The root `.gitignore` already has `.env*` which would catch this, but an explicit entry is a safeguard and documents the file's existence.

- [ ] **Step 3: Commit**

```bash
git add storefront/.gitignore .gitignore
git commit -m "chore: gitignore .env.sentry-build-plugin

Contains SENTRY_AUTH_TOKEN for source map uploads (build-time only).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Update SETUP.md

**Files:**
- Modify: `SETUP.md` (lines 38-61 backend table, lines 70-80 storefront table, lines 167-184 production backend, lines 200-209 production storefront)

- [ ] **Step 1: Add Sentry vars to backend env table (local dev section)**

In the backend environment variables table (around line 60, after the S3 variables), add:

```
| `SENTRY_DSN` | No | — | Sentry project DSN for error monitoring |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.2` | Trace sample rate (0.0-1.0) |
```

- [ ] **Step 2: Add Sentry vars to storefront env table (local dev section)**

In the storefront environment variables table (around line 80, after `CART_RECOVERY_SECRET`), add:

```
| `NEXT_PUBLIC_SENTRY_DSN` | No | — | Sentry DSN (safe to expose client-side) |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | No | `0.2` | Client-side trace sample rate |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.2` | Server-side trace sample rate |
```

- [ ] **Step 3: Add Sentry vars to production backend section**

In the production backend env vars (around line 183, after S3 vars), add:

```
SENTRY_DSN=              # Sentry project DSN
```

- [ ] **Step 4: Add Sentry vars to production storefront section**

In the production storefront env vars (around line 208, after existing vars), add:

```
NEXT_PUBLIC_SENTRY_DSN=                  # Sentry project DSN
SENTRY_AUTH_TOKEN=                       # Source map uploads (sentry.io/settings/auth-tokens/)
SENTRY_ORG=                              # Sentry organization slug
SENTRY_PROJECT=                          # Sentry project slug
```

- [ ] **Step 5: Commit**

```bash
git add SETUP.md
git commit -m "docs: add Sentry env vars to SETUP.md

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Update README.md

**Files:**
- Modify: `README.md` (infrastructure table, around line 26)

- [ ] **Step 1: Add Sentry to infrastructure table**

Add a row to the `Infrastructure & Tooling` table:

```
| Sentry error monitoring | ✅ Shipped | Backend + storefront, performance tracing, session replay |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Sentry to infrastructure status table

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Verification — Backend Error Capture

This task requires a `SENTRY_DSN` to be set. If you don't have one yet, create a Sentry project (select Node.js) and copy the DSN.

- [ ] **Step 1: Set `SENTRY_DSN` in `backend/.env`**

```
SENTRY_DSN=https://your-dsn@o12345.ingest.us.sentry.io/67890
SENTRY_TRACES_SAMPLE_RATE=1.0
```

- [ ] **Step 2: Start the backend**

Run: `cd backend && bun run dev`
Expected: Server starts. Look for `info: OTEL registered`.

- [ ] **Step 3: Trigger a test error**

```bash
curl http://localhost:9000/store/products/nonexistent-id
```

Expected: A 404 error response. Check Sentry dashboard — the error should appear within 30 seconds.

- [ ] **Step 4: Verify traces**

Navigate to the Sentry Traces page. You should see HTTP request traces with spans for middleware, route handling, and database queries.

- [ ] **Step 5: Stop dev server**

If Sentry shows the error and traces: verification passed.
If not: check the spec's Architecture section for fallback approaches (manual wiring or bypassing `registerOtel()`).

---

## Task 15: Verification — Storefront Error Capture

This task requires a `NEXT_PUBLIC_SENTRY_DSN` to be set (different Sentry project, select Next.js).

- [ ] **Step 1: Set Sentry vars in `storefront/.env.local`**

```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o12345.ingest.us.sentry.io/99999
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=1.0
```

- [ ] **Step 2: Start the storefront**

Run: `cd storefront && bun dev`
Expected: Dev server starts on port 3000 without errors.

- [ ] **Step 3: Trigger a client-side error**

Open `http://localhost:3000` in a browser. Open the browser console and run:
```js
throw new Error("Sentry test error from browser")
```

Check the storefront Sentry project — the error should appear within 30 seconds.

- [ ] **Step 4: Check Session Replay**

In the Sentry dashboard, navigate to Session Replays. If a recording appears for your session, replay is working.

- [ ] **Step 5: Trigger a server-side error**

Navigate to a non-existent page (e.g., `http://localhost:3000/this-does-not-exist`). Check Sentry for the server-side error.

- [ ] **Step 6: Verification complete**

If both client-side and server-side errors appear in Sentry: storefront integration is working.

---

## Task 16: Verification — Distributed Tracing

Requires both backend and storefront running with their respective `SENTRY_DSN` values set and `SENTRY_TRACES_SAMPLE_RATE=1.0`.

- [ ] **Step 1: Start both apps**

```bash
bun run dev
```

- [ ] **Step 2: Trigger a cross-app request**

Open `http://localhost:3000` in a browser. Browse to a product page and add it to cart. This triggers storefront → backend API calls.

- [ ] **Step 3: Check storefront Sentry traces**

Find the trace for the add-to-cart action. It should show the browser-side spans and link to the backend trace.

- [ ] **Step 4: Check backend Sentry traces**

Find the corresponding trace in the backend Sentry project. It should show HTTP handler, middleware, and database spans.

- [ ] **Step 5: Verify trace correlation**

Both traces should share the same trace ID (visible in the trace detail view). If they do, distributed tracing is working.

If traces don't correlate: check the spec's "Distributed Tracing — Verification note" about Node `fetch` instrumentation. The Medusa JS SDK may need manual header propagation for server action calls.

- [ ] **Step 6: Verify server action path**

Trigger a server action that calls the backend (e.g., log in, update customer profile, or add an address). This path goes through a Next.js server action → Node `fetch` → Medusa API, which is the most likely path to fail for trace propagation.

Check both Sentry projects for the trace. If the server action trace doesn't link to the backend trace, Sentry's Node.js instrumentation may not be patching `fetch` to propagate `traceparent` headers in this runtime context.
