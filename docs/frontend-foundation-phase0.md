# Frontend Foundation — Phase 0

## Audit snapshot
- **Styling sources today**
  - `app/globals.css` is loaded by Next.js app routes.
  - `public/app.html` and `public/landing.html` contain large inline `<style>` blocks and keep the live product UI flow.
  - `app/admin/page.tsx` also injects inline style rules local to the admin screen.
- **Tailwind status**
  - Tailwind v4 packages are installed (`tailwindcss`, `@tailwindcss/postcss`) and PostCSS is configured.
  - Tailwind utilities are not yet broadly adopted in app screens, so Phase 0 avoids forcing a migration.
- **Routing/runtime model**
  - The root page redirects to static HTML (`/landing.html`) via `app/page.tsx`.
  - Product flow also relies on static route `/app.html`.
  - App Router routes coexist for legal pages, auth callback, admin, and APIs.

## Phase 0 safety strategy
- Introduce a new design system layer in parallel.
- Add reusable UI and layout primitives under dedicated folders only.
- Keep existing pages, route behavior, and static HTML untouched.
- Preserve backward-compatible CSS variables in `app/globals.css` to reduce visual risk on current App Router pages.

## Adoption strategy for next phases
- Start adopting `components/ui` and `components/layout` screen by screen.
- Migrate visual sections incrementally with feature flags or isolated PRs.
- Avoid editing auth, checkout, admin logic, and API contracts during UI migration.
