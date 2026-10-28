# Progress Record

Running log so work can resume at any time. Newest entry first.

## Phase 0 — Repository audit and requirements

- **Status:** Awaiting owner review
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
