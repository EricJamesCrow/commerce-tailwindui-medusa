# Production Hardening External Validation

This runbook covers the parts of template hardening that cannot be fully verified from local repo access alone.

## Landed In Repo

- `storefront/app/api/health/route.ts` exposes a deterministic storefront health endpoint for preview and production checks.
- `.github/scripts/check-deployment-health.sh` validates backend `/health`, storefront `/api/health`, and storefront homepage responses.
- `.github/workflows/deployment-health-check.yml` adds a manual GitHub Actions entry point for deployment health checks once real URLs are available.
- Existing storefront Sentry build config already trims whitespace and trailing newlines from `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` via `storefront/lib/sentry.ts`.
- Existing catalog revalidation wiring already runs through `backend/src/subscribers/storefront-product-revalidate.ts`, `backend/src/subscribers/storefront-collection-revalidate.ts`, and `storefront/app/api/revalidate/route.ts`.

## Still Requires External Validation

- Vercel preview and production URLs must be available before the deployment health workflow can be run meaningfully.
- Railway or another public backend environment must expose `/health` for deployment verification.
- Vercel dashboard env vars still need human confirmation and correction for the Sentry project/org pairing.
- Production catalog revalidation still needs a real Medusa product or collection mutation against a deployed backend and storefront.

## Preview And Deployment Health Checks

Use this after a real Vercel preview or production deployment exists.

1. Gather the public storefront URL and backend URL.
2. Run the GitHub Actions workflow `Deployment Health Check` with:
   - `storefront_url=https://<storefront-domain>`
   - `backend_url=https://<backend-domain>`
   - `expected_storefront_environment=preview` for previews, or `production` for production.
3. Confirm the workflow passes all three checks:
   - `GET <backend>/health`
   - `GET <storefront>/api/health`
   - `GET <storefront>/`
4. If the backend check fails:
   - Confirm the backend deployment is healthy in Railway.
   - Confirm the public backend domain is correct and not redirecting somewhere unexpected.
5. If the storefront health check fails:
   - Confirm the Vercel deployment finished successfully.
   - Confirm `NEXT_PUBLIC_SENTRY_ENVIRONMENT` or Vercel env detection is set the way the workflow expects.
6. If the homepage check fails but `/api/health` passes:
   - Inspect Vercel runtime logs and CSP headers first.
   - Pay special attention to `MEDUSA_BACKEND_URL` formatting, since a trailing newline can break CSP generation in `storefront/next.config.ts`.

You can also run the same checks locally with:

```bash
STOREFRONT_URL=https://<storefront-domain> \
BACKEND_URL=https://<backend-domain> \
EXPECTED_STOREFRONT_ENVIRONMENT=preview \
bash .github/scripts/check-deployment-health.sh
```

## Vercel Sentry Env Validation

This repo cannot fix Vercel dashboard values directly. Use this checklist against the actual Vercel project.

1. Run `vercel env pull --environment=production` from `storefront/`.
2. Inspect the pulled values and confirm:
   - `SENTRY_AUTH_TOKEN` has no leading or trailing whitespace.
   - `SENTRY_ORG` is the exact org slug for the storefront Sentry project.
   - `SENTRY_PROJECT` is the exact storefront project slug.
   - `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production` in production and `preview` in preview environments.
3. If any value contains a newline or whitespace padding, delete and recreate it in Vercel instead of editing mentally.
4. Trigger a fresh Vercel production deployment.
5. Inspect the build logs and confirm there is no `Project not found` or `invalid value for --project` error from `sentry-cli`.
6. Confirm the deployment uploads source maps and creates a release successfully.

If the build still fails after trimming the values, the remaining issue is almost certainly the wrong org or project slug in Vercel, not local repo code.

## Production Catalog Revalidation Verification

This repo already has the subscriber and webhook plumbing. The remaining work is an operational verification against deployed services.

1. Confirm Railway has both `STOREFRONT_URL` and `REVALIDATE_SECRET` set.
2. Confirm Vercel has the same `REVALIDATE_SECRET` value.
3. In Medusa admin on the deployed backend, create or update:
   - a product
   - a product collection
4. Confirm backend logs contain a success line like:
   - `[StorefrontRevalidate] Revalidated product cache for <id>`
   - `[StorefrontRevalidate] Revalidated collection cache for <id>`
5. Confirm the storefront reflects the change without waiting for the catalog TTL to expire.
6. If it does not:
   - Check backend warnings for missing `STOREFRONT_URL` or `REVALIDATE_SECRET`.
   - Check for non-200 responses from `POST /api/revalidate`.
   - Confirm the deployed storefront is the same project that owns the configured `REVALIDATE_SECRET`.
   - Confirm the change affects catalog surfaces backed by `TAGS.products` or `TAGS.collections`.

## Exact Repo-Side Follow-Up If More Automation Is Wanted

These are not blocked by code design, only by environment ownership and deployment inputs:

- Wire the deployment health workflow into a future preview-status event once Vercel and Railway publish stable per-PR URLs into GitHub.
- Add a protected production-only workflow input set for catalog revalidation checks if operators want a standard runbook execution path from Actions.
- Add log-based alerting in Sentry or Railway for repeated `[StorefrontRevalidate] Failed` warnings after production verification is complete.
