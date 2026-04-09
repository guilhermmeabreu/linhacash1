# AI Studio UI Foundation Integration (Safe Port Plan)

## Summary
This phase ports only foundational UI/design-system pieces from the AI Studio React/Vite frontend into LinhaCash's existing Next.js architecture. No backend/auth/admin/billing/API logic was touched.

## Current frontend audit (LinhaCash)
- Runtime/framework: Next.js App Router (`app/`) with route handlers in `app/api/*`.
- Live flows run on App Router entrypoints (`/`, `/app`).
- Existing UI primitives/layout abstractions already exist under:
  - `components/ui/*`
  - `components/layout/*`
- Design tokens are centralized in:
  - `app/globals.css` (CSS variables + utility classes)
  - `lib/design-system/tokens.ts` (TypeScript token object)

## Safest integration path
1. Keep Next.js architecture and routing model untouched.
2. Keep all business logic and API routes untouched.
3. Port UI foundation into existing primitive components only.
4. Normalize primitives so they consume shared tokenized CSS classes (`lc-*`) instead of page-specific utility styling.
5. Use deterministic local/system font stacks to avoid network-coupled builds.

## Exact implementation in this phase
- Root layout now uses local/system font stacks defined in global tokens.
- Primitive components aligned to tokenized base classes:
  - `Button` → `lc-btn*`
  - `Badge` → `lc-badge*`
  - `Input` → `lc-input`
  - `Surface` → `lc-surface*`
  - `Tabs` → `lc-tabs*`

## What was preserved
- Next.js app architecture and bootstrapping.
- Existing route handlers and server-side/business logic.
- Existing auth/admin/billing/support/API route paths and behavior.
- Existing design token naming for backward compatibility (`--bg`, `--s1`, etc.).

## What was intentionally NOT imported from AI Studio project
- Vite config and Vite build/bootstrap entrypoints.
- Full page implementations/screens.
- AI Studio-specific runtime scaffolding or package-specific app wiring.
- Any backend, data-fetching, auth, or API implementation from the generated project.
