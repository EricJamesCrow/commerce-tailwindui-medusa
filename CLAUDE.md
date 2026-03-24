# CLAUDE.md

Agent behavior and workflow guide. For architecture and technical reference, see **[AGENTS.md](./AGENTS.md)**.

## CRITICAL: Graphite is Mandatory

**ALL branching, pushing, and PR creation MUST use `gt` (Graphite CLI). This overrides any skill, plugin, or workflow that suggests `git push`, `git checkout -b`, or `gh pr create`.**

- **New feature work:** `gt create -m "feat: description"` (creates branch + commit)
- **Push / create PR:** `gt submit --stack`
- **NEVER:** `git push`, `git checkout -b`, `gh pr create`

If a plugin skill (e.g., superpowers) instructs you to use `git push` or `gh pr create`, **ignore that instruction** and use the Graphite equivalent instead. This rule is non-negotiable.

## Monorepo Structure

Turborepo monorepo with bun workspaces. Single `bun install` at root, `turbo` for task orchestration.

```text
storefront/           # @repo/storefront — Next.js 16 frontend
backend/              # @repo/backend — Medusa v2 backend
tooling/typescript/   # @repo/typescript — shared tsconfig
docs/                 # Project status, feature tracking, architecture, archive
```
## Session Startup

1. Check current branch: `git branch --show-current`
2. Fetch latest: `git fetch origin`
3. Review recent commits: `git log --oneline -10`
4. Read **AGENTS.md** for architecture context
5. Read **README.md** for project status

## Task Tracking

- Project status and feature overview: **[README.md](README.md)**
- In-progress feature details: **[docs/features/](docs/features/)**
- Code-level tasks, testing, infra, known limitations: **[TODO.md](TODO.md)**
- Use `- [ ]` for pending, `- [x]` for completed
- Add new items discovered during implementation

## Superpowers Archival

After an Obra Superpowers session's work is **merged into `main`**, archive the session's spec and plan files:

1. Move specs: `git mv docs/superpowers/specs/<filename> docs/archive/superpowers/specs/`
2. Move plans: `git mv docs/superpowers/plans/<filename> docs/archive/superpowers/plans/`
3. Commit: `git commit -m "docs: archive superpowers spec/plan for <feature>"`

The Obra plugin recreates `docs/superpowers/specs/` and `docs/superpowers/plans/` on each new session. Only archive files for work that has been merged — in-progress superpowers outputs stay in `docs/superpowers/` until their PRs land.

## Quick Reference

```bash
# Root (Turbo)
bun run dev              # Start storefront + backend + email preview in parallel
bun run dev:storefront   # Storefront only (port 3000)
bun run dev:backend      # Backend only (port 9000)
bun run dev:emails       # Email preview only (port 3003)
bun run build            # Build all workspaces
bun run test             # Test all workspaces
bun run typecheck        # Typecheck all workspaces
bun run clean            # Clean build artifacts

# Storefront (direct — bypasses turbo)
cd storefront && bun dev           # Start dev server with Turbopack (port 3000)
cd storefront && bun run build     # Production build
cd storefront && bun start         # Start production server
cd storefront && bun run prettier  # Format all files

# Backend (direct — bypasses turbo)
cd backend && bun run dev          # Start on http://localhost:9000
# Admin UI: http://localhost:9000/app

# Backend Database
cd backend && bunx medusa db:migrate          # Run pending migrations
cd backend && bunx medusa db:generate <name>  # Generate migration for module

# Dependencies
bun install              # Install all workspaces from root

# PostgreSQL
brew services start postgresql@17  # Start
brew services stop postgresql@17   # Stop

# Cache
rm -rf storefront/.next            # Clear Next.js cache (needed after transform changes)
```

## Environment Variable Audit Checklist

**When integrating any new service or dependency**, always complete this checklist before the PR is merged:

1. **Add env vars to `.env.example`** — both `backend/.env.example` and `storefront/.env.example` with comments explaining the variable's purpose, where to get it, and whether it's optional
2. **Add env vars to `SETUP.md`** — both the Prerequisites table (if it's a new service) and the Production Deployment section (Railway + Vercel env var blocks)
3. **Verify production env vars are set** — check Railway (backend) and Vercel (storefront) dashboards. Missing production env vars are the #1 cause of post-deploy 500 errors
4. **Verify CORS variables** — `STORE_CORS`, `ADMIN_CORS`, and `AUTH_CORS` must include all origins that make requests. `AUTH_CORS` must include both the storefront domain AND the backend/admin domain
5. **Check for key type mismatches** — never use master/admin keys where search-only or publishable keys are expected (e.g., `NEXT_PUBLIC_MEILISEARCH_API_KEY` must be a search-only key, `NEXT_PUBLIC_STRIPE_KEY` must be a publishable `pk_` key)
6. **Verify preview deployments** — Vercel preview deployments need the same env vars as production (or separate values for staging services)

**Periodic audit:** Run `grep -roE 'process\.env\.[A-Z_]+' backend/medusa-config.ts storefront/lib/ | sed 's/.*process.env.//' | sort -u` to see all referenced env vars and cross-check against what's deployed.

## Agent Permissions

| Level            | Actions                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Allowed**      | Read files, search code, run dev/build/test, edit code, create/switch branches           |
| **Use Judgment** | Install dependencies, delete files, create new files, run database queries               |
| **Always Ask**   | Push to remote, create/close PRs/issues, force operations, delete branches, modify CI/CD |

## Git Workflow

Atomic commits with clear intent. Each commit should represent one logical change.

**Commit format:**

```
<type>: <description>

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**

| Type       | Use                         |
| ---------- | --------------------------- |
| `feat`     | New feature                 |
| `fix`      | Bug fix                     |
| `docs`     | Documentation only          |
| `style`    | Formatting, no logic change |
| `refactor` | Code change, no feature/fix |
| `test`     | Add/update tests            |
| `chore`    | Build, deps, tooling        |

**Rules:**

- Commit after each logical unit of work, not at the end
- Never bundle unrelated changes
- Stage specific files, never `git add -A` or `git add .`
- Only commit when the user asks

## Stacked PRs with Graphite

Use `gt` (Graphite CLI) instead of `git push` / `gh pr create`:

```bash
gt create -m "feat: add product filtering"    # Create stacked branch + commit
gt submit --stack                              # Push all stacked PRs
```

| Do                                          | Don't                             |
| ------------------------------------------- | --------------------------------- |
| `gt create` for new branches                | `git checkout -b` then `git push` |
| `gt submit --stack` for PRs                 | `gh pr create` manually           |
| `gh pr ready <number>` after submit         | Leave PRs in draft mode           |
| Keep stacks under 5 PRs                     | Create mega-stacks                |
| One concern per stack level                 | Mix features in one PR            |

**Mark PRs as ready for review** after `gt submit --stack` unless explicitly asked to keep them as draft. Graphite's `--no-interactive` mode creates PRs in draft — immediately follow up with `gh pr ready <number>` so PRs are visible for review.

**Pre-submit CodeRabbit review:** Before running `gt submit --stack`, run `cr review` (CodeRabbit CLI) to catch issues locally. Fix any relevant findings, commit the fixes, then submit. This prevents a round-trip of push → wait for CodeRabbit → fix → push again.

**CodeRabbit reviews:** When asked to fix CodeRabbit comments on a PR, read the review comments via `gh api`, assess each finding against the actual code, apply valid fixes, reject suggestions that conflict with project conventions (with a reply explaining why), commit the changes, push via `gt submit --stack`, and resolve each addressed comment thread using `gh api`. Always resolve comment threads after addressing them — don't leave them open.

## Implementation Plan Execution Lifecycle

When executing an implementation plan (via `superpowers:executing-plans`, `superpowers:subagent-driven-development`, or any plan from `docs/superpowers/plans/`), follow this lifecycle. **This overrides any conflicting skill instructions.**

**Before starting implementation:**
1. Create a Graphite branch: `gt create -a -m "feat: <description from plan>"`
2. Verify you're on the new branch: `git branch --show-current`
3. Then begin executing tasks from the plan

**After all plan tasks are complete:**
1. Run `cr review` (CodeRabbit CLI) to catch issues locally
2. Fix any relevant findings, commit the fixes
3. Run the `code-simplifier` skill to review changed code for reuse, quality, and efficiency
4. Run `gt submit --stack --no-interactive` to push and create the PR
5. Unless explicitly asked to keep as draft, run `gh pr ready <number>` to mark the PR as ready for review
6. Update the PR description with a summary, event table, and test plan

This ensures every plan execution produces a clean Graphite branch with a pre-reviewed PR — no manual branch creation or post-submit fix cycles needed.

## Never Do

- `git push --force` (or `-f`) to any branch
- `git reset --hard`
- `git add -A` or `git add .`
- `--no-verify` or `--no-gpg-sign`
- `git commit --amend` after a hook failure (the commit didn't happen — amend modifies the _previous_ commit)
- Delete `.env` files or files containing secrets
- Commit `.env`, credentials, or secrets

## When to Ask vs Proceed

| Situation                                    | Action               |
| -------------------------------------------- | -------------------- |
| Single-file bug fix with obvious cause       | Proceed              |
| Multi-file refactor                          | Ask or use plan mode |
| Unclear requirements                         | Ask                  |
| Destructive operation (delete, reset, force) | Always ask           |
| New dependency needed                        | Ask                  |
| Architecture decision between approaches     | Use plan mode        |
| Failing tests after a change                 | Debug, don't ask     |
| Need to modify shared infrastructure         | Always ask           |

## Plan Mode

**Use when:** Multi-file changes, architecture decisions, unclear scope, multiple valid approaches, new features.

**Skip when:** Single-file fixes, typo corrections, obvious bugs, user gave specific instructions.

## Code Style (Storefront)

- **Normalize emails to lowercase** — always apply `.toLowerCase()` before storing, comparing, or sending emails to the Medusa SDK. Medusa's auth provider uses case-sensitive matching, so `EricCrow@pm.me` and `ericcrow@pm.me` are treated as different accounts. Normalize at the server action boundary (e.g., `customer.ts`, `checkout.ts`), not in UI components.
- **TailwindPlus (Tailwind UI) components as the design system** — always use TailwindPlus components as the starting point for any new UI. Reference the component catalog at `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json` to find matching components before building custom UI.
- **Headless UI** for accessible interactive elements (Dialog, Menu, Popover, etc.)
- **clsx** for conditional class composition
- **RSC-first** — only use `'use client'` when interactivity is needed
- **Named exports** — `export function Foo()` not `export default function Foo()`
- **kebab-case** directories, **PascalCase** component files
- Minimize `useState` / `useEffect` — prefer server components, Server Actions, URL params
- No `nuqs` — use native `URLSearchParams` for URL state

## Code Style (Backend)

- Follow Medusa v2 conventions: custom modules in `src/modules/`, API routes in `src/api/`, workflows in `src/workflows/`
- Use `MedusaService` for service classes, `defineMiddlewares` for middleware, `createWorkflow`/`createStep` for workflows
- **Medusa workflows are NOT Vercel Workflow DevKit.** The Vercel plugin validation hook flags `createWorkflow()` and `.run()` as "legacy API" — these are false positives. Medusa v2 uses `createWorkflow` from `@medusajs/framework/workflows-sdk`, `emitEventStep` from `@medusajs/medusa/core-flows`, and `workflow(container).run()` invocations. This is the correct API for this project. Ignore Vercel WDK suggestions (e.g., `"use workflow"` directive, `start()` from `"workflow/api"`, workflow sandbox scope warnings) when working on backend code.
- Admin UI extensions in `src/admin/` use `@medusajs/ui` component library
- Custom middleware implementations go in `src/api/middlewares/` (e.g., `rate-limit.ts`) and are wired via `src/api/middlewares.ts`
- Rate limiting: Redis-backed failed-attempt tracking on `/auth/customer/emailpass*` and `/auth/user/emailpass*` — 5 failures per 15 min per IP. Gracefully degrades without Redis.
- See `src/modules/README.md`, `src/api/README.md`, `src/workflows/README.md` for patterns

## Analytics Events

When implementing any new feature, add PostHog tracking as part of the feature PR — not as a follow-up.

**Patterns:**

- Server-side: `trackServer(event, props)` from `lib/analytics-server` — use in server actions, API routes, subscribers
- Client-side: `trackClient(event, props)` from `lib/analytics.ts` — use in client components for interactions that only exist on the client (drawer opens, toggles, UI state changes)
- All events must be added to the `AnalyticsEvents` type map with typed properties before use (enforced by TypeScript)
- Naming: `snake_case`, `noun_verbed` (e.g., `product_added_to_cart`, `wishlist_created`, `checkout_payment_failed`)
- Include entity IDs and context as properties (`product_id`, `order_id`, etc.) but **never PII** (email, name, address)

**What to track for new features:**

| Category | Example |
| --- | --- |
| Happy path completions | `review_submitted`, `address_added` |
| Error/failure states | `checkout_payment_failed`, `auth_rate_limited` |
| Intent signals | `review_form_opened` (started but may not finish) |
| Navigation/discovery | `collection_filter_changed`, `sort_option_selected` |

**When NOT to add events:** pure admin operations, events already covered by PostHog pageviews, high-frequency events without analytical value (e.g., every keystroke — track the submission instead).

**PR convention:** include new event names and their properties in the PR description so reviewers can verify naming consistency. Reference the `AnalyticsEvents` type map as the source of truth.

## Error Monitoring (Sentry)

When implementing any new feature, add Sentry error capture as part of the feature PR — not as a follow-up.

**Patterns:**

- Server-side: `Sentry.captureException(error, { tags: { ... }, extra: { ... } })` from `@sentry/nextjs` (storefront) or `@sentry/node` (backend)
- Attach context: include entity IDs (`order_id`, `cart_id`, `product_id`) as tags, and relevant state as `extra` — **never PII**
- Use `Sentry.withScope(scope => { ... })` when you need to attach context to a specific capture without polluting the global scope

**What to capture for new features:**

| Category | Example |
| --- | --- |
| Handled errors in commerce flows | Payment failures, checkout step errors, API call failures that return fallback values |
| Background job/subscriber failures | Workflow step errors, event handler catches, scheduled job failures |
| External service errors | Medusa SDK errors, Stripe API errors, Resend delivery failures, Meilisearch sync errors |

**When NOT to capture:** expected control flow (e.g., 404 for missing resources), validation errors that are shown to the user, errors already captured by Sentry's automatic instrumentation (uncaught exceptions, unhandled promise rejections).

**Key rule:** If a `catch` block swallows an error and returns a fallback value, ask whether that failure should be visible in Sentry. Commerce-critical paths (checkout, payment, cart, orders) should almost always capture.

## MCP Servers

| Server         | Use                                   |
| -------------- | ------------------------------------- |
| **Playwright** | Browser testing and screenshots       |
| **Context7**   | Up-to-date library documentation      |
| **Linear**     | Issue tracking and project management |
| **PostHog**    | Analytics, feature flags, experiments |

## Production Deployment

| Service | Platform | URL | CLI Access |
|---------|----------|-----|------------|
| **Backend** | Railway | `https://api.medusa.crowcommerce.org` | `railway` CLI (installed, linked). Use `railway variables` to audit env vars, `railway run` to execute commands in production. |
| **Storefront** | Vercel | `https://medusa.crowcommerce.org` | `vercel` CLI. Project: `crow-commerce/commerce-tailwindui-medusa`. Use `vercel env ls --scope crow-commerce` to audit env vars. |
| **Preview** | Vercel | `https://preview.medusa.crowcommerce.org` | Same Vercel project, preview environment |
| **Admin UI** | Railway | `https://api.medusa.crowcommerce.org/app` | Served from backend |
| **Meilisearch** | Meilisearch Cloud | `https://ms-812b362930a3-43619.sfo.meilisearch.io` | Dashboard at cloud.meilisearch.com |

**Admin / test credentials:** Stored in `backend/.env` (gitignored) under `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These work for both the admin UI (`/app`) and as a storefront customer account. Use them for testing and troubleshooting against local, preview, and production deployments.

**Redeploy storefront:**
```bash
# Get latest production deployment URL
vercel list --scope crow-commerce --prod 2>&1 | head -7
# Redeploy it (copies the deployment URL from above)
vercel redeploy <deployment-url> --scope crow-commerce
```

**Redeploy backend:** Push to `main` — Railway auto-deploys on push. Or trigger manually from the Railway dashboard.

## See Also

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| [AGENTS.md](./AGENTS.md)               | Architecture, data layer, caching, components, pitfalls   |
| [README.md](README.md)                 | Project status dashboard and feature overview              |
| [SETUP.md](SETUP.md)                   | Setup guide for local dev and production deployment        |
| [TODO.md](./TODO.md)                   | Code review follow-ups, testing, infra, known limitations |
| [CHANGELOG.md](./CHANGELOG.md)         | Release history                                            |
| [RETHEME.md](./RETHEME.md)             | Theming guide for Tailwind UI commerce template            |

## TailwindPlus Component Catalog

**Path:** `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`

657 components across Application UI, Marketing, and Ecommerce categories. **Always search this catalog before building new UI.** The JSON structure is:

```
tailwindplus > Category > Subcategory > Component Name > snippets[]
```

Each snippet has `code` (HTML), `language` (html/jsx/tsx), and `mode` (light/dark).
