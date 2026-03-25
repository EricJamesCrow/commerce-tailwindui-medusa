# Playwright Smoke CI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small Playwright smoke gate for pull requests so critical storefront user flows break in CI before merge. This is a PR-smoke plan, not a full-suite rollout.

**Architecture:** Keep the existing static quality gates (`ci-storefront`, `ci-backend`) intact and add a separate smoke job that runs a narrow Chromium-only Playwright slice against a minimal test environment. Leave the broader Playwright suite manual or nightly until runtime, seeding, and flake rate are understood.

**Tech Stack:** GitHub Actions, Playwright 1.56.x, existing `storefront/playwright.config.ts`, existing `storefront/tests/e2e/` harness, Bun/Turborepo

---

## File Map

| Action        | Path                              | Responsibility                                                                     |
| ------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| Modify        | `storefront/playwright.config.ts` | Add or expose a PR-smoke project/tagging strategy if needed                        |
| Modify/Create | `storefront/tests/e2e/**`         | Add a narrow smoke subset on top of the existing harness                           |
| Modify        | `.github/workflows/ci.yml`        | Add a separate Playwright smoke job for PRs                                        |
| Optional      | repo docs / setup docs            | Document any CI-specific seed or env requirements discovered during implementation |

---

## Scope

- Run Chromium only on PRs
- Add 3-5 smoke scenarios:
  - home/product page load
  - browse product to add to cart
  - one guest checkout happy path
  - one login plus wishlist happy path
- Wire the smoke slice into GitHub Actions as a separate job
- Keep the broader suite manual or nightly for now

## Out of Scope

- Adding Firefox to PR CI
- Gating PRs on the full E2E matrix
- Rewriting the entire Playwright harness
- Broad performance/load testing

---

## Task 1: Audit the current harness and environment needs

**Files:**

- Review: `storefront/playwright.config.ts`
- Review: `storefront/tests/e2e/`
- Review: `.github/workflows/ci.yml`

- [ ] Identify which existing helpers, fixtures, and auth flows can be reused for a smoke subset
- [ ] Document the minimum environment needed to run stable smoke tests in CI:
  - storefront server startup
  - backend availability
  - test data / seeded products
  - auth credentials for the wishlist path
- [ ] Decide whether smoke selection should be driven by:
  - a dedicated Playwright project
  - file naming convention
  - grep/tag filtering

---

## Task 2: Define the PR smoke slice

**Files:**

- Modify/Create: `storefront/tests/e2e/**`

- [ ] Add or isolate 3-5 stable smoke scenarios:
  - home page or product page loads successfully
  - browse product to add to cart
  - guest checkout happy path
  - authenticated login plus wishlist happy path
- [ ] Keep the scenarios narrow and deterministic
- [ ] Prefer reusing existing helpers over duplicating selectors or fixture setup
- [ ] Do not expand to the full wishlist/reviews matrix in this PR-smoke plan

---

## Task 3: Add the separate CI smoke job

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] Add a dedicated Playwright smoke job instead of folding E2E into `ci-storefront`
- [ ] Ensure the existing `ci-storefront` and `ci-backend` jobs remain separate from the smoke job
- [ ] Configure the smoke job for Chromium only on PRs
- [ ] Stand up whatever minimal backend/storefront test environment is required for the smoke slice
- [ ] Capture Playwright artifacts that make failures diagnosable in CI

---

## Task 4: Keep the broad suite out of the PR gate

**Files:**

- Modify if needed: workflow or Playwright config

- [ ] Leave the broader suite manual, scheduled, or otherwise non-blocking for now
- [ ] Do not add Firefox to PR CI yet
- [ ] Do not make the full current Playwright matrix a required PR check

---

## Verification

- [ ] Run the smoke slice locally against the intended minimal environment
- [ ] Verify the GitHub Actions smoke job can distinguish static-quality failures from flow failures
- [ ] Confirm failures produce actionable logs/artifacts

## Acceptance Criteria

- The smoke job is stable enough for PR gating
- Existing `ci-storefront` and `ci-backend` jobs remain separate from the smoke job
- Chromium is the only PR-browser target
- Failures clearly identify whether the break is static quality or end-to-end flow
