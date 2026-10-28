# Progress Record

Running log so work can resume at any time. Newest entry first.

## Phase 1 — Development environment and project foundation

- **Status:** Awaiting owner review
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
