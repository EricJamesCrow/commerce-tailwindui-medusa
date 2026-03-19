# S3 File Provider (Cloudflare R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Medusa's in-memory file provider with Cloudflare R2 so uploaded files (product images, review photos, invoice logos) persist across Railway container restarts.

**Architecture:** Medusa's built-in `@medusajs/medusa/file-s3` module connects to Cloudflare R2 via its S3-compatible API. The module loads conditionally when `S3_BUCKET` is set, matching the existing pattern for Stripe and Resend. The storefront's `next/image` is configured to optimize images from the R2.dev public URL.

**Tech Stack:** Medusa v2 file-s3 module (bundled, no install needed), Cloudflare R2, Next.js `remotePatterns`

**Spec:** `docs/superpowers/specs/2026-03-19-s3-file-provider-design.md`

---

### Task 1: Add S3 file module to medusa-config.ts

**Files:**
- Modify: `backend/medusa-config.ts:55-157` (modules array)

- [ ] **Step 1: Add the file module entry**

Insert the S3 file module between the custom modules (ending at line 64) and the Resend comment (line 65: `// Resend email notification provider`). It follows the same conditional spread pattern as Stripe and Resend:

```ts
    // S3 file provider for persistent storage (conditional on S3_BUCKET)
    ...(process.env.S3_BUCKET
      ? [
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
                      additional_client_config: {
                        forcePathStyle: true,
                      },
                    },
                  },
                ],
              },
            },
          ]
      : []),
```

- [ ] **Step 2: Verify the backend starts without S3 env vars**

Run: `cd backend && bun run dev`
Expected: Backend starts normally with no S3-related errors. The file module does not load (in-memory fallback remains active). You should see the usual Medusa startup output. Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add backend/medusa-config.ts
git commit -m "feat: add S3 file provider module (conditional on S3_BUCKET)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add S3 env vars to .env.example

**Files:**
- Modify: `backend/.env.example:46-48` (after the Resend section)

- [ ] **Step 1: Add the S3 section**

Insert after line 46 (`RESEND_FROM_EMAIL=noreply@crowcommerce.org`), before line 48 (`# --- Storefront URL`):

```bash

# --- S3 / Cloudflare R2 (file storage) ----------------------------------------
# Optional. When S3_BUCKET is set, the S3 file provider loads for persistent storage.
# Without this, files are stored in memory and lost on every backend restart.
# Create a bucket and API token at: https://developers.cloudflare.com/r2/
# S3_FILE_URL=https://pub-abc123.r2.dev
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_BUCKET=crowcommerce-assets
# S3_REGION=auto
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

- [ ] **Step 2: Add S3 env vars to local .env**

Add the same variables to `backend/.env` (uncommented, with placeholder values to be filled in after Cloudflare R2 bucket creation):

```bash

# S3 / Cloudflare R2
S3_FILE_URL=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=auto
S3_ENDPOINT=
```

Note: Leave values empty for now. The user will fill them in after creating the R2 bucket (Task 4).

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "docs: add S3/R2 env vars to .env.example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

Note: Do NOT commit `backend/.env` — it contains secrets and is gitignored.

---

### Task 3: Update SETUP.md with S3 documentation

**Files:**
- Modify: `SETUP.md:38-54` (backend env var table)
- Modify: `SETUP.md:160-170` (production env vars section)

- [ ] **Step 1: Add S3 variables to the backend env var table**

Add these rows to the table at line 54 (after `CART_RECOVERY_SECRET`):

```markdown
| `S3_FILE_URL` | No | — | R2 public base URL (e.g. `https://pub-abc123.r2.dev`) |
| `S3_ACCESS_KEY_ID` | No | — | Cloudflare R2 API token ID |
| `S3_SECRET_ACCESS_KEY` | No | — | Cloudflare R2 API token secret |
| `S3_BUCKET` | No | — | R2 bucket name (e.g. `crowcommerce-assets`) |
| `S3_REGION` | No | `auto` | Always `auto` for Cloudflare R2 |
| `S3_ENDPOINT` | No | — | `https://<account-id>.r2.cloudflarestorage.com` |
```

- [ ] **Step 2: Add S3 to the production deployment env vars**

Add S3 variables to the Railway production env var block before line 171 (the closing ` ``` `), after `AUTH_CORS=` on line 169:

```
   S3_FILE_URL=            # R2 public URL (e.g. https://pub-abc123.r2.dev)
   S3_ACCESS_KEY_ID=       # R2 API token ID
   S3_SECRET_ACCESS_KEY=   # R2 API token secret
   S3_BUCKET=              # Bucket name (e.g. crowcommerce-assets)
   S3_REGION=auto          # Always "auto" for Cloudflare R2
   S3_ENDPOINT=            # https://<account-id>.r2.cloudflarestorage.com
```

- [ ] **Step 3: Commit**

```bash
git add SETUP.md
git commit -m "docs: add S3/R2 env vars to setup guide

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Create Cloudflare R2 bucket (manual — user action)

This task is performed by the user in the Cloudflare dashboard, not by the agent.

- [ ] **Step 1: Create Cloudflare account**

Go to https://cloudflare.com and create an account (or log in if you already have one).

- [ ] **Step 2: Create R2 bucket**

Navigate to R2 Object Storage → Create bucket:
- Name: `crowcommerce-assets`
- Location: Automatic (Cloudflare picks nearest region)

- [ ] **Step 3: Enable public access**

In the bucket settings → Public Access → Enable `r2.dev` subdomain access. Copy the public URL (e.g., `https://pub-abc123deadbeef.r2.dev`).

- [ ] **Step 4: Create R2 API token**

Navigate to R2 → Manage R2 API Tokens → Create API Token:
- Permissions: Object Read & Write
- Scope: Apply to specific bucket → `crowcommerce-assets`
- TTL: No expiry (or your preferred rotation schedule)

Copy the Access Key ID and Secret Access Key. Also note the S3 API endpoint shown (e.g., `https://abc123.r2.cloudflarestorage.com`).

- [ ] **Step 5: Fill in local .env**

Edit `backend/.env` with the values from steps 3-4:

```bash
S3_FILE_URL=https://pub-abc123deadbeef.r2.dev
S3_ACCESS_KEY_ID=<your-access-key-id>
S3_SECRET_ACCESS_KEY=<your-secret-access-key>
S3_BUCKET=crowcommerce-assets
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

---

### Task 5: Add R2.dev hostname to storefront next.config.ts

**Files:**
- Modify: `storefront/next.config.ts:9-38` (remotePatterns array)

Now that the R2 bucket exists (Task 4), use the exact `pub-<hash>.r2.dev` hostname from the bucket's public URL.

- [ ] **Step 1: Add the R2.dev remote pattern**

Add a new entry to the `remotePatterns` array after the `images.unsplash.com` entry (line 33). Replace `pub-abc123deadbeef.r2.dev` with the actual R2.dev subdomain from Task 4, Step 3:

```ts
      {
        protocol: "https",
        hostname: "pub-abc123deadbeef.r2.dev",  // replace with actual R2.dev subdomain
      },
```

- [ ] **Step 2: Verify the storefront builds**

Run: `cd storefront && bun run build`
Expected: Build completes without errors. The new remote pattern is accepted by Next.js.

- [ ] **Step 3: Commit**

```bash
git add storefront/next.config.ts
git commit -m "feat: allow R2.dev images in next/image remote patterns

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Set Railway production env vars

- [ ] **Step 1: Set all 6 S3 env vars on Railway**

```bash
railway variable set S3_FILE_URL=<r2-public-url> --service commerce-tailwindui-medusa
railway variable set S3_ACCESS_KEY_ID=<access-key> --service commerce-tailwindui-medusa
railway variable set S3_SECRET_ACCESS_KEY=<secret-key> --service commerce-tailwindui-medusa
railway variable set S3_BUCKET=crowcommerce-assets --service commerce-tailwindui-medusa
railway variable set S3_REGION=auto --service commerce-tailwindui-medusa
railway variable set S3_ENDPOINT=<r2-endpoint> --service commerce-tailwindui-medusa
```

Note: Each `railway variable set` triggers a redeployment. Set all 6 in quick succession — Railway will batch them into one redeploy if done fast enough, or the last one will trigger the final redeploy.

- [ ] **Step 2: Verify Railway variables**

```bash
railway variable list --service commerce-tailwindui-medusa --json | grep S3
```

Expected: All 6 variables shown with correct values.

---

### Task 7: Verify end-to-end

- [ ] **Step 1: Start backend locally with S3 configured**

Run: `cd backend && bun run dev`
Expected: Backend starts. No S3 errors in console. The S3 file module loads (you may see a log line about the file provider).

- [ ] **Step 2: Upload a product image via Medusa Admin**

Open `http://localhost:9000/app`, navigate to a product, upload an image. Confirm the image URL in the response points to your R2 bucket (contains `r2.dev`).

- [ ] **Step 3: Verify image persistence**

Stop and restart the backend (`Ctrl+C`, then `bun run dev`). Navigate to the same product. Confirm the image still loads.

- [ ] **Step 4: Start storefront and verify next/image**

Run: `cd storefront && bun dev`
Open `http://localhost:3000`, navigate to the product with the uploaded image. Confirm it renders without errors (no 400 from `next/image`, no console errors about unmatched hostname).

- [ ] **Step 5: Upload a review image (if test data available)**

Create or use an existing customer account, navigate to a product with reviews enabled, submit a review with an image. Confirm the image URL points to R2 and persists across backend restarts.
