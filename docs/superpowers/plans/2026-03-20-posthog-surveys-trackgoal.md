# PostHog Surveys & trackGoal() — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two PostHog surveys (post-purchase NPS, checkout abandonment) and the `trackGoal()` experiment infrastructure wrapper.

**Architecture:** Surveys are configured entirely in PostHog (no storefront code). `trackGoal()` is a single function added to `analytics-server.ts`. Total code change: ~10 lines.

**Tech Stack:** PostHog surveys (dashboard-configured), `posthog-node` (server-side tracking)

**Spec:** `docs/superpowers/specs/2026-03-20-posthog-surveys-trackgoal-design.md`

---

## File Map

### Modified files

| File | Change |
|------|--------|
| `storefront/lib/analytics-server.ts` | Add `trackGoal()` function |

### No new files

Surveys are created in PostHog, not in code.

---

## Task 1: Add `trackGoal()` to analytics-server.ts

**Files:**
- Modify: `storefront/lib/analytics-server.ts`

- [ ] **Step 1: Add the `trackGoal()` function**

Add this function after the existing `trackServer()` function in `storefront/lib/analytics-server.ts`:

```typescript
export async function trackGoal<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  experiment: { flagKey: string; variant: string },
): Promise<void> {
  // Cast: the spread adds a `$feature/<key>` property that isn't part of
  // AnalyticsEvents[E]. PostHog expects it but our strict type map can't
  // model dynamic keys. The cast is intentional — don't remove it.
  await trackServer(event, {
    ...properties,
    [`$feature/${experiment.flagKey}`]: experiment.variant,
  } as AnalyticsEvents[E])
}
```

The `AnalyticsEvents` import is already available (imported from `./analytics` at the top of the file).

- [ ] **Step 2: Verify build**

```bash
cd storefront && bun run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add storefront/lib/analytics-server.ts
git commit -m "feat(storefront): add trackGoal() for PostHog experiment conversion tracking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create post-purchase NPS survey in PostHog

- [ ] **Step 1: Create NPS survey via PostHog MCP**

Use `mcp__posthog__survey-create` to create:

```json
{
  "name": "Post-purchase NPS",
  "type": "popover",
  "questions": [
    {
      "type": "rating",
      "question": "How likely are you to recommend us to a friend or colleague?",
      "display": "number",
      "scale": 10,
      "lowerBoundLabel": "Not likely",
      "upperBoundLabel": "Very likely"
    },
    {
      "type": "open",
      "question": "What's the main reason for your score?"
    }
  ],
  "conditions": {
    "url": "/order/confirmed/"
  },
  "appearance": {
    "displayThankYouMessage": true,
    "thankYouMessageHeader": "Thank you for your feedback!"
  }
}
```

> **Note:** The exact MCP parameter schema may differ. If `mcp__posthog__survey-create` doesn't accept this format or fails, add the survey config to `TODO.md` instead with the settings above for manual creation in the PostHog dashboard.

- [ ] **Step 2: Verify survey is active**

Use `mcp__posthog__surveys-get-all` to confirm the survey was created.

---

## Task 3: Create checkout abandonment exit survey in PostHog

- [ ] **Step 1: Create exit survey via PostHog MCP**

Use `mcp__posthog__survey-create` to create:

```json
{
  "name": "Checkout abandonment",
  "type": "popover",
  "questions": [
    {
      "type": "single_choice",
      "question": "What stopped you from completing your purchase?",
      "choices": [
        "Just browsing",
        "Price too high",
        "Shipping costs/options",
        "Found it cheaper elsewhere",
        "Payment method not available",
        "Technical issue",
        "Other"
      ]
    }
  ],
  "conditions": {
    "url": "/checkout"
  }
}
```

> **Same fallback:** If MCP fails, add to `TODO.md` for manual creation.

- [ ] **Step 2: Verify survey is active**

Use `mcp__posthog__surveys-get-all` to confirm both surveys exist.

---

## Task 4: Final verification

- [ ] **Step 1: Verify build**

```bash
cd storefront && bun run build
```

- [ ] **Step 2: Verify `trackGoal` export**

```bash
grep -n "export async function trackGoal" storefront/lib/analytics-server.ts
```

Expected: One match showing the function signature.

- [ ] **Step 3: Verify surveys in PostHog**

Use `mcp__posthog__surveys-get-all` — should return 2 surveys (or check TODO.md if MCP creation failed).

---

## Summary

| Task | What | Files touched |
|------|------|---------------|
| 1 | `trackGoal()` function | `storefront/lib/analytics-server.ts` |
| 2 | Post-purchase NPS survey | PostHog dashboard (no code) |
| 3 | Checkout abandonment survey | PostHog dashboard (no code) |
| 4 | Final verification | Build check |
