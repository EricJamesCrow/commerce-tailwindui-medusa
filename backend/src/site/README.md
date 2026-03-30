# Backend Site Overrides

Use this directory for site-specific Medusa backend extensions that should stay separate from the base template's shared modules and routes.

- `api/` for site-only API route helpers or endpoints
- `lib/` for site backend helpers
- `modules/` for site-only Medusa modules
- `subscribers/` for site-only event handling
- `workflows/` for site-only workflow composition

Register site-only Medusa modules in `backend/src/site/index.ts`.
