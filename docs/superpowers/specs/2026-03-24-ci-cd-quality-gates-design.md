# CI/CD Quality Gates — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** GitHub Actions CI workflow with parallel per-workspace quality gates

---

## Overview

Add a GitHub Actions CI workflow that enforces quality gates on PRs before merge. Vercel and Railway continue to handle deploys automatically — this workflow is purely a quality gate, not a deployment pipeline.

---

## Goals

- Block merges to `main` when typecheck, formatting, or unit tests fail
- Surface failures per-workspace (storefront vs backend) so the source is immediately obvious
- Run checks in parallel to minimize wall time
- Require zero external secrets or services

## Non-Goals

- E2E tests (require a live backend + DB — deferred to a future phase)
- Vercel/Railway deploy gating (platforms auto-deploy; this is a future extension)
- Turborepo remote caching (can be layered in later via `TURBO_TOKEN`)

---

## Trigger Conditions

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [ready_for_review, synchronize, reopened]
```

- `push` to `main` — catches direct commits and merged PRs
- `pull_request` types:
  - `ready_for_review` — fires when `gh pr ready <number>` is called (Graphite workflow)
  - `synchronize` — fires on subsequent pushes to a ready PR
  - `reopened` — fires when a closed PR is reopened

Draft PRs are intentionally excluded — CI runs only once a PR is marked ready.

---

## Workflow Structure

**File:** `.github/workflows/ci.yml`

**Concurrency:** One run per branch per workflow. Redundant runs on rapid pushes are cancelled automatically.

```
ci-storefront (ubuntu-latest)     ci-backend (ubuntu-latest)
──────────────────────────────    ──────────────────────────────
1. Checkout                       1. Checkout
2. Setup Bun 1.1.18               2. Setup Bun 1.1.18
3. Cache ~/.bun/install/cache     3. Cache ~/.bun/install/cache
4. bun install (root)             4. bun install (root)
5. turbo typecheck                5. turbo typecheck
   --filter=@repo/storefront         --filter=@repo/backend
6. prettier:check (storefront)    6. turbo test
7. turbo test                        --filter=@repo/backend
   --filter=@repo/storefront
```

Both jobs run concurrently. Total wall time is bounded by the slower of the two.

---

## Job Details

### Shared setup (both jobs)

- **Runner:** `ubuntu-latest`
- **Bun version:** `1.1.18` (pinned to match `packageManager` in `package.json`)
- **Bun setup action:** `oven-sh/setup-bun@v2`
- **Dependency cache:** `~/.bun/install/cache` keyed on hash of `bun.lockb`
- **Install command:** `bun install` at repo root (Bun workspaces installs all packages)

### `ci-storefront` checks

| Step | Command |
|------|---------|
| Typecheck | `bunx turbo typecheck --filter=@repo/storefront` |
| Prettier | `cd storefront && bun run prettier:check` |
| Unit tests | `bunx turbo test --filter=@repo/storefront` |

### `ci-backend` checks

| Step | Command |
|------|---------|
| Typecheck | `bunx turbo typecheck --filter=@repo/backend` |
| Unit tests | `bunx turbo test --filter=@repo/backend` |

Backend has no prettier script — that step is omitted.

---

## Branch Protection

After the workflow is merged, configure branch protection on `main` in **GitHub Settings → Branches**:

1. **Require status checks to pass before merging** — add `ci-storefront` and `ci-backend`
2. **Require branches to be up to date before merging** — prevents a PR passing CI on a stale base from landing a broken merge

This is compatible with Graphite stacked PRs — each stack level is an independent PR that must pass CI before its child can merge.

---

## Deliverable

One new file: `.github/workflows/ci.yml` (~60 lines)

No changes to existing source code, package scripts, or turbo configuration are required.

---

## Future Extensions

| Extension | Trigger |
|-----------|---------|
| E2E tests | When a staging DB/backend is available in CI |
| Turborepo remote cache | When CI build times become a bottleneck |
| Deploy gating | When Vercel/Railway auto-deploy is too permissive |
| Lint (ESLint) | When ESLint is added to either workspace |
