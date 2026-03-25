# Storefront Vitest Coverage Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing storefront Vitest suite so the highest-value deterministic helpers have real regression coverage. This is a coverage-expansion plan, not a Vitest setup plan.

**Architecture:** Add fast unit tests under `storefront/tests/unit/` against pure helper modules only. No network access, no Medusa backend dependency, no browser automation, and no CI workflow changes in this plan.

**Tech Stack:** Vitest 4.x, TypeScript, existing `storefront/vitest.config.ts`, existing unit-test patterns under `storefront/tests/unit/`

---

## File Map

| Action   | Path                                       | Responsibility                                                                     |
| -------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Create   | `storefront/tests/unit/transforms.test.ts` | Regression coverage for Medusa-to-internal type transforms                         |
| Create   | `storefront/tests/unit/analytics.test.ts`  | PII redaction tests for analytics-safe search queries                              |
| Create   | `storefront/tests/unit/validation.test.ts` | Password validation boundary coverage                                              |
| Optional | `storefront/tests/unit/*.test.ts[x]`       | One additional isolated helper/render test only if it stays fast and deterministic |

---

## Scope

- Add or extend unit tests for `storefront/lib/medusa/transforms.ts`
- Add tests for `storefront/lib/analytics.ts` redaction behavior
- Add tests for `storefront/lib/validation.ts`
- Optionally add one small render/helper test only if it stays fast and isolated

## Out of Scope

- Backend Jest-to-Vitest migration
- Playwright or E2E changes
- GitHub Actions workflow changes
- Medusa integration or browser-driven tests

---

## Task 1: Audit the existing test surfaces

**Files:**

- Review: `storefront/lib/medusa/transforms.ts`
- Review: `storefront/lib/analytics.ts`
- Review: `storefront/lib/validation.ts`
- Review: `storefront/tests/unit/`

- [ ] Confirm the exported surfaces and current test conventions
- [ ] Capture edge cases worth locking down before writing specs:
  - `transformProduct()` fallback prices, images, tags, and SEO metadata
  - `transformCollection()` metadata-driven description/SEO/image fallbacks
  - `transformCart()` line-item totals, selected options, and featured-image fallback behavior
  - `redactPiiFromQuery()` trimming, truncation, email replacement, phone replacement, and mixed-content handling
  - `validatePassword()` min/max boundary behavior

---

## Task 2: Add transform coverage

**Files:**

- Create: `storefront/tests/unit/transforms.test.ts`

- [ ] Add `transformProduct()` tests covering:
  - populated product with calculated prices and inventory
  - missing thumbnail fallback to first image
  - missing image/title/tag values
  - metadata-driven SEO values and defaults
  - min/max price range derivation
- [ ] Add `transformCollection()` tests covering:
  - metadata description and SEO fallbacks
  - optional image handling
  - expected `path` shape
- [ ] Add `transformCart()` tests covering:
  - subtotal/total/tax formatting
  - line-item quantity aggregation
  - selected option mapping
  - product/thumbnail fallback behavior when partial item data is returned
- [ ] Keep fixtures local to the test file unless reuse is clearly justified

---

## Task 3: Add analytics redaction coverage

**Files:**

- Create: `storefront/tests/unit/analytics.test.ts`

- [ ] Add `redactPiiFromQuery()` tests covering:
  - exact email replacement with `[email]`
  - US phone replacement with `[phone]`
  - mixed text preserving non-PII search terms
  - whitespace trimming
  - 80-character truncation after replacement
  - inputs without PII remaining unchanged except normalization/truncation
- [ ] Do not add tests for PostHog runtime integration in this plan; only cover the pure redaction helper

---

## Task 4: Add validation coverage

**Files:**

- Create: `storefront/tests/unit/validation.test.ts`

- [ ] Add `validatePassword()` tests for:
  - one character below `MIN_PASSWORD_LENGTH`
  - exactly `MIN_PASSWORD_LENGTH`
  - exactly `MAX_PASSWORD_LENGTH`
  - one character above `MAX_PASSWORD_LENGTH`
- [ ] Assert against the current user-facing error strings so future message churn is intentional

---

## Task 5: Optional small isolated helper/render test

**Files:**

- Optional: one additional `storefront/tests/unit/*.test.ts[x]`

- [ ] Only add this if there is a clear fast win and it stays deterministic
- [ ] Keep it isolated from routing, network calls, Medusa SDK calls, and full page rendering
- [ ] Skip this step entirely if the three core helper files already provide enough value for the PR

---

## Verification

- [ ] Run:

```bash
cd storefront && bun run test:unit
```

- [ ] Confirm the new tests are deterministic:
  - no network calls
  - no Medusa backend dependency
  - no browser automation

## Acceptance Criteria

- `cd storefront && bun run test:unit` passes
- The new coverage meaningfully protects `transforms`, analytics PII redaction, and password validation behavior
- The suite remains fast and deterministic
