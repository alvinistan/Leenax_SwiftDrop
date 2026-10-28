# Phase Backlog — Leenax SwiftDrop.lk

Each phase follows the workflow in the master prompt: explain → plan →
implement → test → review → report → commit → **stop and wait for approval**.

Status values: `Not started` · `In progress` · `Awaiting review` · `Done`

| Phase | Title | Depends on | Status |
|---|---|---|---|
| 0 | Repository audit and requirements | — | Done |
| 1 | Development environment and project foundation | 0 | Awaiting review |
| 2 | React fundamentals and design system | 1 | Not started |
| 3 | Spring Boot REST API and ResponseEntity | 1 | Not started |
| 4 | React Router and navigation | 2 | Not started |
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
- [ ] Create the `main` branch from approved work (**waiting for owner approval**)
- [x] README "How to run locally on Windows" section

Not in Phase 1: entities other than `sellers`, UI design, authentication, AWS.

## Items parked for later

- Internationalization (Sinhala and Tamil): decide by Phase 2 (D-12)
- Product variants: decide by Phase 3 (D-2)
- Email notifications (order confirmation): candidate for Phase 9
- SEO (server rendering or pre-rendering): review before launch
