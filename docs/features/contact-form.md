# Contact Form

Last updated: 2026-03-30

## Overview

The `/contact` page now uses a real submission pipeline:

1. The storefront server action validates the form and calls `POST /store/contact`.
2. The backend route applies honeypot validation and contact-form rate limiting.
3. A Medusa workflow renders the contact email with the existing React Email stack and sends it through Resend.
4. The storefront only shows the success state after the backend send succeeds.

## Protections

- Server-side validation on both the storefront action and backend route
- Honeypot field (`company`) rejected before the workflow runs
- IP-based rate limiting on `POST /store/contact`
- `contact_form_submitted` and `contact_form_failed` analytics events
- Sentry capture on unexpected backend/send failures with non-PII context only

## Manual Verification

### Happy Path

1. Start the stack with working `RESEND_API_KEY` and `RESEND_FROM_EMAIL` values.
2. Confirm the support inbox in [`backend/src/modules/resend/templates/_config/email-config.ts`](../../backend/src/modules/resend/templates/_config/email-config.ts) points to an inbox you can inspect for the current fork.
3. Open `/contact` and submit a valid message.
4. Verify the page only shows the success panel after the request finishes successfully.
5. Verify the email arrived in the configured support inbox or appears as delivered in the Resend dashboard/logs.

### Failure Path

1. Break the send path intentionally by unsetting `RESEND_API_KEY` or using an invalid value, then submit the form again.
2. Verify `/contact` stays on the form and shows the generic failure message instead of the success panel.
3. Verify Sentry captured the failure with route/action tags but without message text, names, or email addresses.
4. Submit the form more than three times within ten minutes from the same IP and verify the request is rejected with the rate-limit message.
5. Fill the hidden `company` field in DevTools and verify the request is rejected instead of sending an email.
