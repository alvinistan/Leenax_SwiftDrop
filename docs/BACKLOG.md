# Phase Backlog — Leenax SwiftDrop.lk

Each phase follows the workflow in the master prompt: explain → plan →
implement → test → review → report → commit → **stop and wait for approval**.

Status values: `Not started` · `In progress` · `Awaiting review` · `Done`

| Phase | Title | Depends on | Status |
|---|---|---|---|
| 0 | Repository audit and requirements | — | Done |
| 1 | Development environment and project foundation | 0 | Done |
| 2 | React fundamentals and design system | 1 | Done |
| 3 | Spring Boot REST API and ResponseEntity | 1 | Done |
| 4 | React Router and navigation | 2 | Done |
| 5 | Axios and backend integration | 3, 4 | Done |
| 6 | Authentication and administration (6A + 6B) | 5 | Done |
| 7 | AWS S3 product images | 6 | Awaiting review (real AWS awaiting approval) |
| 8 | Shopping cart and checkout (COD) | 6 | Awaiting review |
| 9 | Orders and payments | 8 | Not started |
| 10 | Delivery management | 9 | Not started |
| 11 | Quality, security and performance | 10 | Not started |
| 12 | Docker production-like environment | 11 | Not started |
| 13 | GitHub Actions CI/CD | 12 | Not started |
| 14 | AWS staging and production readiness | 13 | Not started |
| 15 | Future marketplace expansion | Stable release | Not planned yet |

## Phase 1 — scope (implemented; see the phase report)

Backend:
- [x] Spring Boot project in `backend/` with Maven Wrapper, Java 21
- [x] Dependencies: Web, Validation, Data JPA, PostgreSQL driver, Flyway, Actuator, Test
- [x] `application.yml` reading database settings from environment variables
- [x] `docker-compose.yml` with PostgreSQL only (and a named volume)
- [x] First Flyway migration, `V1__create_sellers.sql`, with the default seller row
- [x] `/actuator/health` reports UP, including the database
- [x] One Testcontainers smoke test proving the app starts and migrations run

Frontend:
- [x] Vite + React + TypeScript project in `frontend/`
- [x] Tailwind CSS installed
- [x] Linting (oxlint, the template default, instead of ESLint) and Prettier; Vitest with one sample test
- [x] npm scripts: `dev`, `build`, `test`, `lint`

Project:
- [x] `.env.example` (no real secrets)
- [x] GitHub Actions workflow: build and test the backend and frontend on every push and PR
- [x] Create the `main` branch from approved work (created 2026-10-28)
- [x] README "How to run locally on Windows" section

Not in Phase 1: entities other than `sellers`, UI design, authentication, AWS.

## Shipping and courier management (owner request 2026-11-14)

Design: [shipping/SHIPPING_DESIGN.md](shipping/SHIPPING_DESIGN.md). Sub-phases:

| Sub-phase | Title | Depends on | Status |
|---|---|---|---|
| A | Repository audit and shipping design | — | Done (approved 2026-11-14) |
| B | Product shipping attributes (weight, dimensions, category, customs) | A | Done (owner continued to C) |
| C | Settings, weight engine, markup rules + audit, rate cards, country restrictions, quote API | B | Done (owner continued to E) |
| E | DEX manual provider: capabilities, manual shipments (AWB), manual tracking | C | Done (owner continued to Phase 8) |
| F | Shipments, idempotent booking, tracking, expenses | master Phase 8 (orders) | Not started |
| G | Dispatch eligibility and checkout integration | F, Phase 9 for card payments | Not started |
| D | DHL Express (verified capabilities only) | DHL credentials + network access | Blocked |
| H | Overview and report pages | F | Not started |
| I | Security review, documentation, regression | all | Not started |

## Items parked for later

- Category image upload by the admin: form in Phase 6, S3 storage in Phase 7 (FR-1a)
- Product variants (D-2 = yes): design in Phase 3, admin in Phase 6, stock per variant in Phase 8
- Product text search (`?q=`): Phase 5 or later
- Production hosting must fall back to index.html for client-side routes: Phases 12–14
- "From" price rule for products mixing PIECE and KG variants: owner to decide
- ETag / If-Match using Product.version: optional, with the admin UI (Phase 6)
- **Login rate limiting / lockout: required before going live (Phase 11)**
- Admin password change and "forgot password": later
- Audit log of admin actions: candidate for Phase 6B/11
- Inventory history (stock movements) and low-stock alerts: later
- **Strip EXIF metadata and resize images: required before going live**
- Reorder photos / edit alt text; CloudFront for images (Phase 14); orphaned-file clean-up job
- Email notifications (order confirmation): candidate for Phase 9
- SEO (server rendering or pre-rendering): review before launch
- **Rate limiting for the public shipping quote endpoint: required before going live (Phase 11)**
- Clean-up job for expired, unused shipping quotes (Shipping Phase F)
