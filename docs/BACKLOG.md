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
| 4 | React Router and navigation | 2 | Awaiting review |
| 5 | Axios and backend integration | 3, 4 | Not started |
| 6 | Authentication and administration | 5 | Not started |
| 7 | AWS S3 product images | 6 | Not started |
| 8 | Shopping cart and checkout (COD) | 6 | Not started |
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

## Items parked for later

- Category image upload by the admin: form in Phase 6, S3 storage in Phase 7 (FR-1a)
- Product variants (D-2 = yes): design in Phase 3, admin in Phase 6, stock per variant in Phase 8
- Variant add/edit/delete endpoints and admin screens: Phase 6
- Product text search (`?q=`): Phase 5 or later
- Production hosting must fall back to index.html for client-side routes: Phases 12–14
- "From" price rule for products mixing PIECE and KG variants: owner to decide
- ETag / If-Match using Product.version: optional, with the admin UI (Phase 6)
- Email notifications (order confirmation): candidate for Phase 9
- SEO (server rendering or pre-rendering): review before launch
