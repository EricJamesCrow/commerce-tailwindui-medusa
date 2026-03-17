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
docs/plans/           # Design docs and implementation plans
```
## Session Startup

1. Check current branch: `git branch --show-current`
2. Fetch latest: `git fetch origin`
3. Review recent commits: `git log --oneline -10`
4. Read **AGENTS.md** for architecture context
5. Read **TODO.md** for pending work

## Task Tracking

- Track deferred work and known issues in **TODO.md**
- Use `- [ ]` for pending, `- [x]` for completed
- Add new items discovered during implementation
- Never delete completed items — they serve as history

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

| Do                           | Don't                             |
| ---------------------------- | --------------------------------- |
| `gt create` for new branches | `git checkout -b` then `git push` |
| `gt submit --stack` for PRs  | `gh pr create` manually           |
| Keep stacks under 5 PRs      | Create mega-stacks                |
| One concern per stack level  | Mix features in one PR            |

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
- Admin UI extensions in `src/admin/` use `@medusajs/ui` component library
- Custom middleware implementations go in `src/api/middlewares/` (e.g., `rate-limit.ts`) and are wired via `src/api/middlewares.ts`
- Rate limiting: Redis-backed failed-attempt tracking on `/auth/customer/emailpass*` and `/auth/user/emailpass*` — 5 failures per 15 min per IP. Gracefully degrades without Redis.
- See `src/modules/README.md`, `src/api/README.md`, `src/workflows/README.md` for patterns

## MCP Servers

| Server         | Use                                   |
| -------------- | ------------------------------------- |
| **Playwright** | Browser testing and screenshots       |
| **Context7**   | Up-to-date library documentation      |
| **Linear**     | Issue tracking and project management |
| **PostHog**    | Analytics, feature flags, experiments |

## See Also

| File                       | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| [AGENTS.md](./AGENTS.md)   | Architecture, data layer, caching, components, pitfalls |
| [TODO.md](./TODO.md)       | Deferred features, testing tasks, known limitations     |
| [RETHEME.md](./RETHEME.md) | Theming guide for Tailwind UI commerce template         |

## TailwindPlus Component Catalog

**Path:** `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`

657 components across Application UI, Marketing, and Ecommerce categories. **Always search this catalog before building new UI.** The JSON structure is:

```
tailwindplus > Category > Subcategory > Component Name > snippets[]
```

Each snippet has `code` (HTML), `language` (html/jsx/tsx), and `mode` (light/dark).
