# Storefront Attribution + Consent Foundation

This storefront foundation adds two versioned, template-safe primitives:

- `storefront/lib/utm/*` persists `utm_*`, `gclid`, and `fbclid` in a first-party cookie and rehydrates those values into the URL on internal navigation.
- `storefront/lib/consent/*` stores the analytics consent decision in a first-party cookie that both server and client code can read.

The consent layer is gated by `NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED` and defaults to enabled. Setting it to `false` disables the consent banner, footer preferences link, and consent-gated PostHog startup. Attribution persistence and the standard analytics pipeline remain active in both modes.

## Site-wide wiring

- `NuqsAdapter` is installed in [`storefront/app/layout.tsx`](../../storefront/app/layout.tsx) so query-state helpers are available across the App Router tree.
- [`storefront/components/consent/attribution-persistence.tsx`](../../storefront/components/consent/attribution-persistence.tsx) merges live query params with the persisted attribution cookie and restores missing params after internal route changes.
- [`storefront/components/consent/consent-provider.tsx`](../../storefront/components/consent/consent-provider.tsx) renders the cookie banner, persists the decision, and exposes a reusable consent context.
- [`storefront/components/providers/posthog-provider.tsx`](../../storefront/components/providers/posthog-provider.tsx) now initializes PostHog only after analytics consent is granted and opts out / stops replay if consent is later denied.

## How future code should read this data

- Server code: import `getPersistedAttribution()` or `getRequestAttribution()` from `storefront/lib/utm/server.ts`, and `getStorefrontConsentState()` from `storefront/lib/consent/server.ts`.
- Client code: import `useStorefrontConsent()` from `storefront/components/consent/consent-provider.tsx` or the document helpers from `storefront/lib/utm/client.ts` and `storefront/lib/consent/client.ts`.

## Template notes

- Both cookies are versioned so downstream forks can extend the payload shape without breaking existing readers.
- The consent state currently covers analytics only, but the payload is structured so additional categories can be added later.
- Attribution persistence is intentionally first-party and framework-local, so future forms or server actions can reuse it without depending on PostHog being enabled.
