# Track 4 Security Audit Notes

Date: 2026-03-28

## Scope

- Newsletter unsubscribe flow
- Invoice store download route
- Product review submission path
- Wishlist guest/share access paths

## Findings and actions

### Fixed

1. Newsletter unsubscribe links used a reversible HMAC bearer token that exposed a reusable secret-bearing value in the browser URL and analytics pipelines.
   - Replaced with a server-stored opaque `unsubscribe_nonce` on the subscriber record.
   - Nonces are rotated when welcome/welcome-back emails are issued.
   - Nonces are cleared on unsubscribe and on reactivation before a new welcome email is sent.
   - The storefront unsubscribe page now strips the `token` query parameter from the address bar after hydration.

2. Public review submission still overrode the model default and force-created reviews as `approved`.
   - Removed the override so new reviews follow the documented moderation path.
   - Updated the storefront review UI/tests to show a moderation message instead of optimistically publishing the review.

3. The backend customer invoice download route relied on ownership checks but did not validate the route param format at the backend boundary.
   - Added order ID format validation to the backend route as defense in depth.

### Reviewed, no additional P0/P1 issues found in this pass

- Wishlist guest ownership verification uses an HMAC-signed httpOnly cookie and confirms the wishlist is guest-owned before access.
- Wishlist share links use signed JWTs with expiry and customer ownership checks before issuing the token.
- Invoice download already enforced customer ownership and returned not found for non-owners to avoid order enumeration.

## Remaining follow-up outside this launch slice

- Build a full email preferences page for footer `preferences` links.
- Add a dedicated automated integration test for successful unsubscribe using the stored nonce path in a full local stack run.
- Consider a broader second-pass audit on non-launch custom routes after release.
