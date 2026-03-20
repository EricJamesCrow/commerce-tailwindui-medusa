# ADR: PostHog as Unified Analytics Platform

- **Date:** 2026-03-20
- **Status:** Accepted
- **Context:** Evaluated PostHog against GA4, Amplitude, Mixpanel, Hotjar/FullStory, and Vercel Speed Insights for CrowCommerce analytics stack.

## Decision

Use PostHog as the single analytics platform for product analytics, web analytics, session replay, feature flags, experiments, and web vitals. Keep Sentry for error tracking only. Remove Vercel Speed Insights.

## Why PostHog Wins for This Project

PostHog consolidates 5+ paid tools (Amplitude/Mixpanel ~$0-400/mo, GA4 free but Google-locked, Hotjar ~$40/mo, FullStory ~$300/mo, Vercel Speed Insights $10/mo, LaunchDarkly ~$10/mo) into a single SDK with a free tier of 1M analytics events, 5K session recordings, 1M feature flag requests, and 1.5K survey responses per month.

For a solo developer building an e-commerce store with early-stage traffic, the all-in-one approach eliminates integration overhead, keeps all user data correlated in one place, and costs $0.

## Known Tradeoffs (and Why They Don't Matter Yet)

### Hard cutoff at free tier limit

PostHog stops ingesting data when you hit the limit — it doesn't sample or degrade. GA4 and Amplitude don't do this. **Mitigation:** add a credit card, set $0 billing limits per product (PostHog alerts at 80% and 100% usage). At early traffic volumes, 1M events/month is more than sufficient.

### No marketing attribution

GA4 integrates deeply with Google Ads, Search Console, and the Google marketing ecosystem for multi-touch attribution modeling. PostHog doesn't. This only matters when running paid acquisition campaigns. When/if we start Google Ads, add GA4 alongside PostHog specifically for the attribution layer — don't replace PostHog.

### Weaker heatmaps vs Hotjar/FullStory

FullStory has automatic frustration detection (rage clicks, dead clicks, error clicks) that surfaces problems without manual session review. PostHog has basic heatmaps but not this auto-detection. FullStory starts at ~$300/month — not justifiable at this stage. Revisit if UX research becomes a bottleneck after launch.

### Not built for non-technical users

Amplitude and Mixpanel are designed so PMs and marketers can self-serve dashboards without engineering. PostHog requires technical comfort (SQL queries, event schemas, code-level setup). Irrelevant while the team is one developer. Would matter if hiring a non-technical marketing person who needs to build their own reports.

### Query performance at scale

Mixpanel's proprietary database (Arb) and Amplitude's infrastructure are faster for complex queries at high event volumes. PostHog's ClickHouse backend can get sluggish with millions of events and complex funnels. Not a concern until traffic is 10x-100x current levels.

### Unpredictable costs at scale

PostHog's usage-based pricing makes monthly budgeting harder than fixed-price tools. Autocapture can generate thousands of low-value events that eat into the free tier. **Mitigation:** use custom capture (not autocapture), track only the events in the typed event catalog, set billing limits per product, and monitor the spend tab weekly.

## What We Keep Alongside PostHog

**Sentry** — error tracking, source maps, server-side exception handling. PostHog's own team acknowledges Sentry is better here. Sentry replay set to 0% general / 100% on-error to avoid overlap with PostHog's behavior replay.

## What We Remove

**@vercel/speed-insights** — $10/month per project for Core Web Vitals data that PostHog captures for free within the 1M event pool. Uninstall the package and remove the component from the root layout.

## When to Reconsider This Decision

- If running Google Ads / paid acquisition -> add GA4 for attribution (keep PostHog for everything else)
- If hiring non-technical team members who need self-serve analytics -> evaluate Mixpanel or Amplitude as a complement
- If monthly PostHog bill exceeds ~$200/mo consistently -> audit event volume, evaluate whether dedicated tools for specific functions would be cheaper
- If session replay UX research becomes a bottleneck -> evaluate FullStory for its frustration detection features
