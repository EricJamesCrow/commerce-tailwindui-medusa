# PostHog Surveys & trackGoal() — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Storefront only — no backend changes
**Depends on:** PostHog integration (PR #29, merged)

## Problem

The PostHog integration shipped 45 typed events, feature flags, session replay, and web vitals — but two features were explicitly deferred:

1. **Surveys** — post-purchase NPS and cart abandonment exit surveys. These were deferred because they require loading the PostHog surveys extension, which adds to the client bundle. The extension loads lazily now (PostHog changed this since the original spec), so the bundle concern is resolved.

2. **`trackGoal()`** — a thin wrapper for tagging events as experiment conversion goals. Without this, feature flags exist but there's no way to measure experiment outcomes. This completes the experiments infrastructure.

## Solution

### 1. Enable surveys extension

**File:** `storefront/components/providers/posthog-provider.tsx`

Add `opt_in_site_apps: true` to the `posthog.init()` config object. This enables PostHog's surveys widget. The surveys JS is loaded lazily by PostHog only when an active survey targets the current page — no upfront bundle cost.

One line change. No new files.

### 2. Post-purchase NPS survey

**Created in:** PostHog dashboard (or via MCP `survey-create` if available)

| Setting | Value |
|---------|-------|
| **Name** | Post-purchase NPS |
| **Type** | NPS (0-10 rating scale, built-in PostHog type) |
| **Question 1** | "How likely are you to recommend us to a friend or colleague?" |
| **Question 2** | Open text — "What's the main reason for your score?" |
| **Targeting** | URL contains `/order/confirmed/` |
| **Display** | Show once per user (PostHog deduplicates by `distinct_id`) |
| **Delay** | 2 seconds after page load |

No storefront code needed. PostHog JS renders the survey widget automatically when targeting conditions match.

### 3. Cart abandonment exit survey

**Created in:** PostHog dashboard (or via MCP `survey-create` if available)

| Setting | Value |
|---------|-------|
| **Name** | Checkout abandonment |
| **Type** | Multiple choice |
| **Question** | "What stopped you from completing your purchase?" |
| **Choices** | "Just browsing", "Price too high", "Shipping costs/options", "Found it cheaper elsewhere", "Payment method not available", "Technical issue", "Other" |
| **Targeting** | URL is `/checkout` |
| **Display conditions** | Show on page leave (`$pageleave` event) |
| **Frequency** | Once per user per 30 days |

No storefront code needed.

### 4. `trackGoal()` wrapper

**File:** `storefront/lib/feature-flags.ts`

Add a `trackGoal()` function that wraps `trackServer` and tags events with PostHog's `$feature_flag_response` property for experiment metric calculation:

```typescript
export async function trackGoal<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  value?: number,
): Promise<void> {
  await trackServer(event, {
    ...properties,
    $feature_flag_response: value,
  } as AnalyticsEvents[E])
}
```

Requires adding an import for `trackServer` from `./analytics-server` and `AnalyticsEvents` from `./analytics`.

No callers yet — this is infrastructure. When experiments are created in the PostHog dashboard, `trackGoal()` will be wired into the relevant server actions (e.g., `trackGoal('order_completed', props, orderTotal)` for revenue experiments).

## Files Changed

| File | Change |
|------|--------|
| `storefront/components/providers/posthog-provider.tsx` | Add `opt_in_site_apps: true` to `posthog.init()` |
| `storefront/lib/feature-flags.ts` | Add `trackGoal()` function + imports |

## Survey Fallback

If surveys cannot be created via the PostHog MCP server (`mcp__posthog__survey-create`), add the survey configurations to `TODO.md` with exact settings so they can be created manually in the PostHog dashboard.

## Testing

1. Run `cd storefront && bun run build` — must pass with no type errors
2. Visit `/order/confirmed/[any-order-id]` — verify NPS survey appears after 2 seconds (requires survey to be active in PostHog)
3. Visit `/checkout` and navigate away — verify exit survey appears (requires survey to be active in PostHog)
4. Verify `trackGoal` is exported from `lib/feature-flags.ts` and accepts typed events
5. Verify no Lighthouse regression — surveys extension should load lazily

## Out of Scope

- Wiring `trackGoal()` into specific server actions (no experiments running yet)
- Custom survey UI (PostHog's built-in widget is sufficient)
- Survey analytics dashboards (created in PostHog UI as responses come in)
