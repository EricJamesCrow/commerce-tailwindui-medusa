# Fork-Per-Client Ownership Model

This repository is the base template for downstream site forks.

The immediate goal is not full bidirectional automation. The goal is to keep fork-specific code isolated enough that:

- template updates can be merged into a site fork with low conflict risk
- generic improvements made in a site fork can be identified and backported into the template
- a human or LLM can reliably tell which changes are fork-specific versus template-worthy

## Principles

1. Use a real Git fork, not a GitHub template-generated repo.
2. Keep site-specific code in reserved paths the template does not own.
3. Keep shared/template files extension-oriented, not client-branded.
4. Prefer explicit ownership boundaries over hidden `.gitignore` rules.
5. Start with manual sync and backport workflows. Add automation later only if the boundaries hold up.

## Current Repo Shape

This repo already has four workspace roots:

- `storefront`
- `backend`
- `packages/*`
- `tooling/*`

The active fork-per-client scaffold in this repo is:

```text
packages/
  site-config/
    src/brand.ts
    src/features.ts
    src/navigation.ts
    src/integrations.ts

storefront/
  site/
    components/
    content/
    lib/
    routes/
    theme.css

backend/
  src/site/
    api/
    lib/
    modules/
    subscribers/
    workflows/
```

## Ownership Boundaries

### Template-Owned Paths

These paths are owned by the base template and are the default candidates for upstream improvement and downstream syncing:

- `storefront/app/**`
- `storefront/components/**`
- `storefront/lib/**`
- `storefront/tests/**`
- `backend/src/api/**`
- `backend/src/modules/**`
- `backend/src/subscribers/**`
- `backend/src/workflows/**`
- `backend/src/admin/**`
- `tooling/**`
- `docs/**`
- root config files such as `package.json`, `turbo.json`, `README.md`, `SETUP.md`

### Site-Owned Paths

These paths are reserved for site-specific behavior and should be treated as out of scope for template backports unless a change is intentionally generalized:

- `packages/site-config/**`
- `storefront/site/**`
- `backend/src/site/**`

### Safe Shared Files

Some shared files will still need site-specific edits because they wire the app together. These are allowed, but changes should stay thin and declarative:

- `package.json`
- `turbo.json`
- `storefront/package.json`
- `storefront/tsconfig.json`
- `storefront/app/layout.tsx`
- `storefront/app/globals.css`
- `backend/package.json`
- `backend/medusa-config.ts`

Rule: use these files to register or delegate to site-owned code, not to hold site business logic directly.

## What Goes Where

### `packages/site-config`

Use for mostly declarative, cross-app concerns:

- brand tokens
- theme values
- feature flags
- navigation definitions
- integration identifiers
- site copy or content maps

If this package grows substantial runtime logic, rename it to `packages/site-features` or split the runtime code into a separate site-owned package.

### `storefront/site`

Use for Next.js-specific site customizations:

- site-only routes
- branded sections and blocks
- site-specific providers
- storefront-specific hooks and helpers
- site theme overrides

### `backend/src/site`

Use for Medusa-specific site customizations:

- site-only API routes
- site business modules
- workflow handlers
- event subscribers
- backend integration helpers

## Shared Code Rules

When touching template-owned files in a site fork, prefer one of these patterns:

1. Add an extension point.
2. Read config from `packages/site-config`.
3. Delegate into `storefront/site` or `backend/src/site`.
4. Generalize the behavior so it remains template-safe.

Avoid:

- hardcoding site branding into shared components
- embedding site-specific business rules in shared Medusa modules
- mixing generic and site-specific logic in the same file when a delegation boundary is possible

## Manual Sync Strategy

For now, keep syncing intentionally simple:

1. The template repo remains the source of truth for shared improvements.
2. Each downstream repo is a real fork with `origin` pointing to the site repo and `upstream` pointing to the template repo.
3. Pull template changes into the site fork with regular merge-based syncs.
4. If a site fork gains generic improvements, backport them manually into the template.

The initial operating model is:

- sync template to client frequently
- do not automate bidirectional sync yet
- use structure and documentation to make later automation possible

## LLM Backport Rules

When comparing a site fork against the base template:

1. Ignore `packages/site-config/**`, `storefront/site/**`, and `backend/src/site/**` unless explicitly asked to generalize them.
2. Treat edits in template-owned paths as potential template improvements.
3. Reject changes that only encode site branding, site content, or site-specific business rules.
4. If a shared file mixes generic and site-specific changes, extract the site-specific portion behind a config or delegation boundary before backporting.

## Scaffold Status

Already in place:

- [x] `packages/site-config` is part of the root workspaces
- [x] `storefront/site/` exists as the storefront override zone
- [x] `backend/src/site/` exists as the backend override zone
- [x] shared storefront code already reads brand/navigation/theme config from `@repo/site-config`
- [x] the sync/backport workflow is documented in `README.md` and this file

Still to improve:

- [ ] move more branding and client-owned behavior out of shared files where practical
- [ ] add at least one concrete shared-code delegation example that executes through `storefront/site` and `backend/src/site`

## Non-Goals For Phase 1

These are intentionally deferred:

- automatic upstream-to-client sync
- automatic client-to-template backporting
- custom Git merge drivers
- repository generation tooling
- per-site package publishing

If the ownership boundaries remain clean over time, those can be added later.
