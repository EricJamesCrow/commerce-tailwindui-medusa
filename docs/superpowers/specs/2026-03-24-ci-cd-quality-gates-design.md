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
    types: [opened, ready_for_review, synchronize, reopened]
```

- `push` to `main` — catches direct commits and merged PRs
- `pull_request` types:
  - `opened` — fires when a PR is opened already in ready state (not as a draft)
  - `ready_for_review` — fires when `gh pr ready <number>` is called (Graphite workflow — transitions from draft to ready)
  - `synchronize` — fires on subsequent pushes to a ready PR
  - `reopened` — fires when a closed PR is reopened

Draft PRs are intentionally excluded — CI runs only once a PR is opened in ready state or marked ready from draft. Note: `ready_for_review` only fires on the *transition* from draft to ready, not on initial open — hence `opened` is also required.

---

## Concurrency

Cancel redundant runs on rapid pushes to PR branches, but let every `main` push complete:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

Using `cancel-in-progress: true` unconditionally would cancel mid-flight runs on `main` when two commits land quickly, meaning CI would not complete for every main commit. The conditional preserves cancellation for PR branches (where only the latest push matters) while ensuring every main push gets a completed run.

---

## Workflow Structure

**File:** `.github/workflows/ci.yml`

```
ci-storefront (ubuntu-latest)     ci-backend (ubuntu-latest)
──────────────────────────────    ──────────────────────────────
1. Checkout                       1. Checkout
2. Setup Bun 1.1.18               2. Setup Bun 1.1.18
3. Cache ~/.bun/install/cache     3. Cache ~/.bun/install/cache
4. bun install (root)             4. bun install (root)
5. turbo typecheck                5. turbo typecheck
   --filter=@repo/storefront         --filter=@repo/backend
6. prettier:check (direct)        6. bun run test:unit (direct)
7. bun run test:unit (direct)
```

Both jobs run concurrently. Total wall time is bounded by the slower of the two.

**Note on test commands:** Unit tests are run via workspace scripts directly (`cd <workspace> && bun run test:unit`) rather than through `turbo test`, because the `test` turbo task has `"dependsOn": ["^build"]` which would trigger dependency builds unnecessarily in CI. Running tests directly is faster and correct.

**Note on prettier:** Prettier is run directly (`cd storefront && bun run prettier:check`) because it is not a turbo pipeline task — this is intentional. The diagram above uses shorthand labels; the step table below is authoritative for exact commands.

---

## Job Details

### Shared setup (both jobs)

- **Runner:** `ubuntu-latest`
- **Bun version:** `1.1.18` (pinned to match `packageManager` in `package.json`)
- **Bun setup action:** `oven-sh/setup-bun@v2`
- **Lockfile:** `bun.lockb` (binary format — this repo uses Bun 1.1.18 which predates the YAML lockfile migration)
- **Dependency cache:** `~/.bun/install/cache` keyed on `hashFiles('**/bun.lockb')`
- **Install command:** `bun install` at repo root (Bun workspaces installs all packages)

### `ci-storefront` checks

| Step | Command |
|------|---------|
| Typecheck | `bunx turbo typecheck --filter=@repo/storefront` |
| Prettier | `cd storefront && bun run prettier:check` |
| Unit tests | `cd storefront && bun run test:unit` |

### `ci-backend` checks

| Step | Command |
|------|---------|
| Typecheck | `bunx turbo typecheck --filter=@repo/backend` |
| Unit tests | `cd backend && bun run test:unit` |

Backend has no `prettier:check` or `"test"` script — those steps are omitted. The backend `test:unit` script is `TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules jest --silent --runInBand --forceExit`; these flags are embedded in the script so they propagate correctly when called via `bun run test:unit`.

---

## Branch Protection

After the workflow is merged, configure branch protection on `main` in **GitHub Settings → Branches → Add rule for `main`**:

1. **Enable "Require a pull request before merging"** — this parent setting must be on for status checks to gate merges
2. **Enable "Require status checks to pass before merging"** — add `ci-storefront` and `ci-backend` as required checks
3. **Enable "Require branches to be up to date before merging"** — prevents a PR passing CI on a stale base from landing a broken merge
4. **Enable "Do not allow bypassing the above settings"** — by default GitHub administrators can bypass branch protection; enabling this ensures the rules apply to everyone including the repo owner

This is compatible with Graphite stacked PRs — each stack level is an independent PR that must pass CI before its child can merge.

---

## Deliverable

One new file: `.github/workflows/ci.yml` (~70 lines)

No changes to existing source code, package scripts, or turbo configuration are required.

---

## Future Extensions

| Extension | Trigger |
|-----------|---------|
| E2E tests | When a staging DB/backend is available in CI |
| Turborepo remote cache | When CI build times become a bottleneck |
| Deploy gating | When Vercel/Railway auto-deploy is too permissive |
| Lint (ESLint) | When ESLint is added to either workspace |
