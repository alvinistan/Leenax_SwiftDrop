# Phase 0 — Repository Audit and Baseline Report

Audit date: 2026-10-28

## 1. Where this audit ran

This audit ran in a **Claude Code cloud session** (a temporary Linux container),
not on the owner's Windows PC. The repository was cloned from GitHub into
`/home/user/Leenax_SwiftDrop`.

Consequences:

- The tool versions below are the **cloud container's** versions. They do not
  describe the Windows PC. Section 5 lists the commands to run on the PC.
- Files only reach the PC after they are pushed to GitHub and pulled locally.
- Docker in this container is not proof that Docker Desktop works on the PC.

## 2. Repository state

| Check | Result |
|---|---|
| Remote | `https://github.com/alvinistan/Leenax_SwiftDrop` |
| Remote branches | **None.** `git ls-remote origin` returned no refs: the GitHub repository is empty. |
| Local branch | `claude/create-projects-s4blmr` (created for this session) |
| Commits | **None** ("No commits yet") |
| Uncommitted changes | None before this phase |
| Existing source files | **None.** No backend, frontend, README, licence or `.gitignore`. |

**Conclusion:** there is no existing work to keep, review or migrate. Every
project file is new, so nothing was overwritten or deleted.

Branch note: because the repository has no `main` branch yet, the first push
of this branch will be the only branch on GitHub. Phase 1 should create `main`
from the approved Phase 0 commit and use feature branches after that (see
`docs/ARCHITECTURE.md` §9).

## 3. Toolchain found in the cloud container

| Tool | Version | Fits the planned stack? |
|---|---|---|
| Java (OpenJDK) | 21.0.12 | Yes: Java 21 LTS |
| Maven | 3.9.11 | Yes. The project will use the Maven Wrapper (`mvnw`) anyway. |
| Node.js | 22.22.0 | Works, but Node 24 is the current Active LTS. Use 24 on the PC. |
| npm | 10.9.4 | Yes |
| Git | 2.43.0 | Yes |
| Docker | 29.9.2 | Yes |
| Docker Compose | v5.6.1 | Yes |
| PostgreSQL client | 16.15 | Yes (client only; the server will run in Docker) |

## 4. Current dependency versions (checked 2026-10-28)

From Maven Central and the npm registry:

| Library | Latest stable |
|---|---|
| Spring Boot 4.x | 4.1.2 |
| Spring Boot 3.5.x | 3.5.16 |
| React | 19.3.1 |
| Vite | 8.3.5 |
| TypeScript | 7.0.2 |
| Tailwind CSS | 4.3.3 |
| React Router | 8.5.1 |
| Axios | 1.21.0 |
| Vitest | 5.0.5 |
| Playwright | 1.64.1 |

### Stack decision needing approval: Spring Boot version

The master prompt names **Spring Boot 3.5.x** "or another supported release
selected after checking compatibility".

- Spring Boot 4.x has been released, and 4.1.2 is current.
- Spring publishes a fixed open-source support window for each minor version.
  The 3.5 line is the last 3.x release, and by its published schedule its free
  (OSS) support ends in mid-2026. **Verify the current dates at
  https://spring.io/projects/spring-boot#support before Phase 1.**
- A new project should not start on a line that no longer gets free security
  fixes.

**Recommendation:** use **Spring Boot 4.1.x on Java 21**. Spring Boot 4 still
supports Java 17+, so Java 21 LTS is fine. Differences that matter to us:
Spring Framework 7, Jakarta EE 11, Hibernate 7, and some renamed starter
modules. Most tutorials and Q&A answers still show Boot 3 code. They mostly
still apply, and any differences we hit will be pointed out.

Before writing code, Phase 1 will confirm compatible versions of Flyway,
Testcontainers, springdoc-openapi and AWS SDK v2 against the chosen Boot
version.

### Frontend version note

Several frontend tools have new major versions (TypeScript 7, Vite 8, React
Router 8). Phase 1 will generate the frontend with the official Vite template
and confirm that the versions installed together build and test cleanly,
rather than pinning versions by hand.

## 5. Commands to run on the Windows PC (owner action)

Run these in **PowerShell** and paste the output back:

```powershell
java -version
git --version
node -v
npm -v
docker --version
docker compose version
wsl --status
```

Maven does not need a separate install: the project will include the Maven
Wrapper (`mvnw.cmd`).

Expected for Phase 1:

- **Java 21** (for example Eclipse Temurin 21)
- **Node.js 24 LTS**
- **Git for Windows**
- **Docker Desktop** with the WSL 2 backend (runs PostgreSQL locally)
- An editor: IntelliJ IDEA Community for Java, VS Code for React (or one of
  them for both)

## 6. Baseline build and test report

| Check | Result |
|---|---|
| Backend build | Not applicable: no backend exists yet |
| Frontend build | Not applicable: no frontend exists yet |
| Tests | None exist |
| Lint and static analysis | Not applicable |

The baseline is **an empty repository**. Phase 1 creates the first buildable
code.

## 7. Files added in Phase 0

| File | Purpose |
|---|---|
| `README.md` | Project overview and documentation index |
| `.gitignore` | Keeps secrets, `.env` files, build output and IDE files out of Git |
| `.gitattributes` | Normalizes line endings (Windows CRLF vs Linux LF) |
| `docs/REQUIREMENTS.md` | Business and technical requirements plus open decisions |
| `docs/ARCHITECTURE.md` | Modular-monolith design and the key design decisions |
| `docs/BACKLOG.md` | Phase-by-phase backlog |
| `docs/LEARNING_ROADMAP.md` | Topics to study, per phase |
| `docs/PROGRESS.md` | Running record of completed phases |
| `docs/phase-reports/phase-0-repository-audit.md` | This report |

No code was written. That is intentional for Phase 0.
