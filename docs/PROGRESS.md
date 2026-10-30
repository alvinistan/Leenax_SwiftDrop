# Progress Record

Running log so work can resume at any time. Newest entry first.

## Phase 4 — React Router and frontend navigation

- **Status:** Awaiting owner review
- **Date:** 2026-10-30
- **Branch:** `claude/create-projects-s4blmr`
- **Done:**
  - React Router 8: layout route, home, product list, product details, cart placeholder, 404, error page
  - Category filter, sorting and pagination kept in the URL
  - Product page: variant choice plus quantity or weight stepper (PIECE/KG rules), exact estimated total
  - `catalogApi` module with sample data in the exact API shape (ready to swap for Axios in Phase 5)
  - `useAsync` hook with race-condition protection
  - 46 frontend tests (12 new full-app route tests); checked in Chromium at desktop and mobile widths
- **Waiting on owner:** review, exercises, approval
- **Report:** [phase-reports/phase-4-routing.md](phase-reports/phase-4-routing.md)

## Phase 3 — Spring Boot REST API and ResponseEntity

- **Status:** Done (approved 2026-10-30, merged into `main`; owner ran it locally: health UP)
- **Date:** 2026-10-28
- **Branch:** `claude/create-projects-s4blmr`
- **Done:**
  - Flyway V2 (categories) and V3 (products, variants, variant options)
  - Category and product APIs: public read endpoints and admin CRUD endpoints
  - Product variants (D-2): SKU, price and options per variant
  - DTOs, Bean Validation, RFC 9457 error responses, pagination with a sort whitelist
  - OpenAPI / Swagger UI at `/swagger-ui.html`
  - 23 backend tests (unit, web slice, Testcontainers integration); N+1 check: 2 queries per product page
  - Owner feedback: sell by piece or by weight (`saleUnit` PIECE/KG with min/max/step, Flyway V4); 27 backend tests
- **Important:** `/api/admin/**` is NOT secured until Phase 6. Local use only.
- **Report:** [phase-reports/phase-3-catalog-api.md](phase-reports/phase-3-catalog-api.md)

## Phase 2 — React fundamentals and design system

- **Status:** Done (approved 2026-10-28, merged into `main`)
- **Date:** 2026-10-28
- **Branch:** `claude/create-projects-s4blmr`
- **Done:**
  - Design tokens (Tailwind `@theme`, teal brand, Inter font)
  - UI components: Button, Input, Card, Badge, Skeleton, EmptyState, ErrorState
  - Layout: skip link, header with mobile menu and cart count, footer
  - Home page: hero, sample banner, categories, product grid with loading/empty/error states, launch-updates form
  - Clearly labelled sample data only
  - 21 frontend tests passing; lint, format and build clean; checked in Chromium at desktop and mobile widths
  - Owner feedback: category carousel with round images, swipe and Previous/Next buttons (24 tests passing)
- **Decided by owner:** product variants = yes (D-2); English only (D-12); `main` branch created; commits now authored as `alvinistan`
- **Report:** [phase-reports/phase-2-design-system.md](phase-reports/phase-2-design-system.md)

## Phase 1 — Development environment and project foundation

- **Status:** Done (owner continued to Phase 2)
- **Date:** 2026-10-28
- **Branch:** `claude/create-projects-s4blmr`
- **Done:**
  - Spring Boot 4.1.2 backend (Java 21, Maven Wrapper) with PostgreSQL, Flyway, Actuator health
  - First migration: `sellers` table and the default seller
  - Testcontainers smoke tests (2 passing)
  - React 19 + TypeScript + Vite 8 + Tailwind 4 frontend with Vitest (1 passing), oxlint, Prettier
  - `docker-compose.yml` (PostgreSQL 17) and `.env.example`
  - GitHub Actions CI for the backend and frontend
  - README Windows run guide and troubleshooting
  - First GitHub Actions run (commit `9af37f2`): backend ✅ and frontend ✅
- **Waiting on owner:**
  1. Run the project on the Windows PC (exercise 1) and report the result
  2. Approve creating a `main` branch
  3. Decision D-12 (Sinhala and Tamil) before Phase 2
- **Report:** [phase-reports/phase-1-foundation.md](phase-reports/phase-1-foundation.md)

## Phase 0 — Repository audit and requirements

- **Status:** Done (approved 2026-10-28)
- **Date:** 2026-10-28
- **Branch:** `claude/create-projects-s4blmr`
- **Done:**
  - Found that the GitHub repository is empty (no commits, no branches, no files)
  - Recorded cloud-container tool versions and checked current dependency versions
  - Wrote the requirements, architecture, backlog and learning roadmap
  - Added `.gitignore` and `.gitattributes`
- **Commit:** `d665aa3` pushed to GitHub
- **Decided:**
  - Spring Boot 4.1.x with Java 21 language level (AD-12): approved
  - Windows PC toolchain checked (audit §5): JDK 25, Node 22.14, npm 11.6, Git 2.48, Docker 29.9, Compose 5.6, WSL 2
  - Workflow: Claude builds in the cloud session and pushes to GitHub; the owner runs `git pull` and starts the app on the PC
- **Still open:**
  1. Open decisions in `REQUIREMENTS.md` §6 (D-2 variants and D-12 languages matter soonest)
- **Report:** [phase-reports/phase-0-repository-audit.md](phase-reports/phase-0-repository-audit.md)
