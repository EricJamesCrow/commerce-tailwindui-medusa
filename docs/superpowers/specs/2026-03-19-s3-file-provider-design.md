# S3 File Provider — Cloudflare R2

**Date:** 2026-03-19
**Status:** Approved

## Problem

The Medusa backend has no file provider configured — it uses the default in-memory provider. All uploaded files (review images, invoice logos, product images) are lost on every Railway container restart. This is a production data loss issue.

Three features depend on persistent file storage:
- **Review images** — customer photo uploads via `/store/reviews/uploads` (multer → `uploadFilesWorkflow`)
- **Invoice company logo** — admin upload via Medusa Admin SDK (`sdk.admin.upload.create()`)
- **Product images** — managed through Medusa Admin UI

## Solution

Use Cloudflare R2 as an S3-compatible object store, connected via Medusa's built-in `@medusajs/medusa/file-s3` module. No custom file provider needed.

### Why R2

- **S3-compatible API** — works with Medusa's built-in S3 provider, zero custom code
- **Zero egress fees** — images served on every storefront page load; egress costs on AWS S3 add up
- **Generous free tier** — 10GB storage, 10M reads/mo, 1M writes/mo (likely covers this store long-term)
- **Global CDN** — files served from nearest Cloudflare edge node via R2.dev public URL

### Why not alternatives

| Option | Why not |
|--------|---------|
| **AWS S3** | Egress costs on every image load. Otherwise fine. |
| **Vercel Blob** | Not S3-compatible. Medusa's file-s3 module uses the AWS S3 SDK internally. Would require writing a custom Medusa file provider. |
| **Railway Volume** | Persistent disk, but no CDN, files served through backend (slow), single region only. |
| **DigitalOcean Spaces** | $5/mo minimum. R2 free tier is more generous. |

## Architecture

### Bucket structure

Single R2 bucket with path-prefixed organization:

```
crowcommerce-assets/
  products/       ← product images (via Medusa Admin)
  reviews/        ← customer review photos
  invoices/       ← invoice company logos
```

Medusa's S3 provider handles all path management. The prefix structure comes from Medusa's internal file naming.

### Data flow

```
Upload (review image example):
  Client form → multer (memory) → uploadFilesWorkflow → file-s3 module → R2 bucket
  ← Returns public URL (pub-xxx.r2.dev/reviews/image-abc.jpg)

Read (storefront):
  next/image src={r2PublicUrl} → Vercel Image Optimization → R2 edge → cached response
```

### Public access

R2 bucket uses the `r2.dev` public URL (e.g., `pub-abc123.r2.dev`). Custom subdomain (`assets.crowcommerce.org`) deferred — requires domain DNS on Cloudflare, currently on Vercel DNS.

## Environment Variables

### New variables (backend)

| Variable | Example value | Purpose |
|----------|---------------|---------|
| `S3_FILE_URL` | `https://pub-abc123.r2.dev` | Public base URL for uploaded files |
| `S3_ACCESS_KEY_ID` | R2 API token ID | Authentication |
| `S3_SECRET_ACCESS_KEY` | R2 API token secret | Authentication |
| `S3_BUCKET` | `crowcommerce-assets` | Bucket name |
| `S3_REGION` | `auto` | Cloudflare R2 convention |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | R2 S3-compatible endpoint |

These are set in `backend/.env` for local dev and in Railway for production.

## Files Modified

| File | Change |
|------|--------|
| `backend/medusa-config.ts` | Add file module with S3 provider configuration |
| `backend/.env` | Add S3 credentials for local development |
| `backend/.env.example` | Add S3 env var section with inline documentation |
| `storefront/next.config.ts` | Add R2.dev hostname to `images.remotePatterns` |
| `SETUP.md` | Add S3/R2 variables to backend env table and production deployment section |

### `medusa-config.ts` — file module config

```ts
{
  resolve: "@medusajs/medusa/file",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/file-s3",
        id: "s3",
        options: {
          file_url: process.env.S3_FILE_URL,
          access_key_id: process.env.S3_ACCESS_KEY_ID,
          secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
          region: process.env.S3_REGION,
          bucket: process.env.S3_BUCKET,
          endpoint: process.env.S3_ENDPOINT,
        },
      },
    ],
  },
}
```

No new packages needed — `@medusajs/medusa/file-s3` is bundled with Medusa.

### `storefront/next.config.ts` — image optimization

Add R2.dev to `remotePatterns` so `next/image` can optimize R2-hosted images:

```ts
{
  protocol: "https",
  hostname: "pub-*.r2.dev",
}
```

The exact hostname will be known after bucket creation. Use a wildcard pattern or the specific `pub-xxx.r2.dev` subdomain.

## Production Changes (Railway)

Set the 6 S3 env vars on the `commerce-tailwindui-medusa` service in Railway. The values come from the Cloudflare R2 dashboard after bucket and API token creation.

## Manual Setup Steps (User)

1. Create a Cloudflare account at cloudflare.com
2. Navigate to R2 Object Storage → Create bucket → name: `crowcommerce-assets`
3. Enable public access on the bucket (Settings → Public Access → Allow Access via r2.dev subdomain)
4. Create an R2 API token (R2 → Manage R2 API Tokens → Create API Token) with Object Read & Write permissions scoped to `crowcommerce-assets`
5. Copy the credentials (Access Key ID, Secret Access Key, endpoint, public r2.dev URL) into local `.env` and Railway

## Out of Scope

- **File migration** — no existing files to migrate (in-memory provider loses everything on restart)
- **Custom R2 domain** — requires DNS on Cloudflare; deferred as follow-up
- **Custom file provider** — using Medusa's built-in `file-s3`
- **Image processing/resizing** — handled by Vercel's `next/image` optimization on the storefront side

## Verification

1. After configuration, upload a product image via Medusa Admin (`localhost:9000/app`) — confirm it persists after backend restart
2. Upload a review image via the storefront — confirm the URL points to R2
3. Verify `next/image` loads R2-hosted images without errors on the storefront
4. Restart the Railway service and confirm all previously uploaded images still load
