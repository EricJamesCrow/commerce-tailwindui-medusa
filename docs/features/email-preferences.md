# Email Preferences

CrowCommerce now ships a real email-preferences flow with two entry points:

1. Logged-in customers can manage preferences from `/account`.
2. Newsletter email recipients can manage preferences from `/email-preferences?token=...` without signing in.

## What shipped

- Dedicated `/account` email-preferences section for authenticated customers
- Standalone `/email-preferences` page for email-link access
- Shared backend preference store in the newsletter subscriber module
- Footer preference links injected into newsletter emails
- Newsletter opt-in/out stored via subscriber `status`
- Order-update opt-in stored as `order_updates_enabled`
- PostHog events for successful and failed preference updates
- Sentry capture for page-load and mutation failures
- Playwright coverage for account-managed and email-link preference updates

## Current data model

- `newsletter_subscriber.status`
  - `active` means promotional/newsletter emails are enabled
  - `unsubscribed` means promotional/newsletter emails are disabled
- `newsletter_subscriber.order_updates_enabled`
  - `true` means transactional order-status emails are enabled
  - `false` means the customer asked not to receive order-status emails

## Not part of this change

- Newsletter unsubscribe-token hardening remains a separate task
- Broad rollout of tokenized preferences links to every transactional email remains deferred until token hardening lands
- Granular marketing categories beyond the existing newsletter/promotions toggle remain future work

## Verification

- `cd backend && bun run typecheck`
- `cd storefront && bun run typecheck`
- `cd storefront && bun run test:e2e tests/e2e/newsletter/preferences.spec.ts`
