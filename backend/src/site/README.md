# Backend Site Overrides

Use this directory for site-specific Medusa backend extensions that should stay separate from the base template's shared modules and routes.

This is a project-level exception to the default Medusa v2 layout. Standard template code should still follow the usual conventions:

- `src/modules/` for shared modules
- `src/api/` for shared API routes
- `src/workflows/` for shared workflow composition

Use `src/site/` only for fork-specific backend code that should not live in the shared template tree.

- `api/` for site-only API route helpers or endpoints
- `lib/` for site backend helpers
- `modules/` for site-only Medusa modules
- `subscribers/` for site-only event handling
- `workflows/` for site-only workflow composition

Register site-only Medusa modules in `backend/src/site/index.ts`.
