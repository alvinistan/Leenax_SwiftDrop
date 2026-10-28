# Phase 1 — Development Environment and Project Foundation

Date: 2026-10-28 · Branch: `claude/create-projects-s4blmr`

## A. Implementation summary

**Delivered:** a reproducible local project. PostgreSQL runs in Docker, the
Spring Boot backend connects to it and runs Flyway migrations, the React
frontend builds and tests, and GitHub Actions runs the same checks.

| Area | Files | Notes |
|---|---|---|
| Backend | `backend/pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/` | Spring Boot 4.1.2, compiled for Java 21. Maven Wrapper pins Maven 3.9.11. |
| | `backend/src/main/java/lk/swiftdrop/SwiftDropApplication.java` | Entry point |
| | `backend/src/main/resources/application.yml` | All settings come from environment variables or `.env`. No password default. |
| | `backend/src/main/resources/db/migration/V1__create_sellers.sql` | First table plus the single default seller |
| | `backend/src/test/java/lk/swiftdrop/*` | Testcontainers smoke tests |
| Frontend | `frontend/` (Vite `react-ts` template) | React 19.3, TypeScript 7, Vite 8, Tailwind 4, Vitest 5, oxlint, Prettier |
| | `frontend/src/App.tsx`, `App.test.tsx`, `test/setup.ts`, `vite.config.ts` | Placeholder page and its first test |
| Project | `docker-compose.yml`, `.env.example` | Local PostgreSQL 17 with a named volume |
| | `.github/workflows/ci.yml` | Backend and frontend CI jobs |
| | `README.md` | Windows run guide and troubleshooting |

### Design decisions

| Decision | Why |
|---|---|
| One `.env` file at the repository root, read by both Docker Compose and Spring Boot (`spring.config.import: optional:file:.env[.properties]`) | One place for local settings; it's git-ignored. Real environment variables still win, which is how staging and production will be configured. |
| `spring.datasource.password` has **no default** | A default would put a credential in Git. The app fails fast instead. |
| PostgreSQL port bound to `127.0.0.1` | Other devices on your Wi-Fi can't reach your dev database. |
| `ddl-auto: validate` | Flyway creates the schema; Hibernate only checks it. Schema changes are always reviewed SQL files. |
| `open-in-view: false` | Database work stays in the service layer. This prevents hidden queries during JSON rendering. |
| Only `/actuator/health` exposed | Endpoints such as `/actuator/env` can leak configuration. Verified: they return 404. |
| Fixed UUID `00000000-0000-0000-0000-000000000001` for the default seller | Later migrations (products) and tests can refer to it reliably. |
| Tests use Testcontainers, not your local database | Tests always start from an empty, known database and never damage your dev data. |
| Kept the template's **oxlint** instead of ESLint | The current Vite template ships oxlint, and it's much faster. ESLint can be added later if a rule we need is missing. |
| PostgreSQL 17 (not 18) | Mature and well-supported by every tool we use. Upgrading later is a normal maintenance task. |

## B. Programming lessons

**Maven, `pom.xml` and the wrapper**
- `<parent>spring-boot-starter-parent</parent>` manages the versions. That's why most dependencies have no `<version>`, and why the versions are known to work together.
- A **starter** is a bundle of dependencies plus auto-configuration. For example, `spring-boot-starter-flyway` gives you Flyway and makes it run at startup.
- `<scope>test</scope>`: available only to tests and not packaged into the app. `runtime`: needed when running, but not when compiling (JDBC drivers).
- **Maven Wrapper** (`mvnw.cmd`): downloads the exact Maven version the project needs, so you don't have to install Maven.
- Phases: `compile` → `test` → `package` (builds `target/*.jar`) → `verify`. Running a phase runs every phase before it.

**Spring Boot structure**
- `@SpringBootApplication` scans `lk.swiftdrop` and everything below it. A class outside that package is invisible to Spring.
- `src/main/resources/application.yml`: configuration. `${DB_PORT:5432}` means "use `DB_PORT`, or `5432` if it isn't set".

**Flyway**
- File name format: `V<version>__<description>.sql`, with **two** underscores.
- Flyway records applied migrations in the `flyway_schema_history` table.
- **Never edit a migration that has already run.** Flyway stores a checksum and refuses to start if the file changes. Create `V2__...` instead.

**npm**
- `package.json` scripts are shortcuts: `npm run dev`, `npm test`.
- `package-lock.json` records exact versions. `npm ci` installs exactly those, which is why CI uses it.
- `dependencies` ship to the browser; `devDependencies` are build and test tools only.

**Docker basics**
- **Image:** a template (`postgres:17-alpine`). **Container:** a running copy of an image.
- **Volume:** storage that survives container removal. Your data lives in the `swiftdrop_postgres-data` volume.
- **Port mapping** `127.0.0.1:5432:5432`: your PC's port → the container's port.

**Environment variables:** configuration that changes per environment (laptop, CI, cloud) without changing code. Secrets belong there, never in Git.

### Common mistakes
1. Editing `V1__create_sellers.sql` after it ran → Flyway checksum error. Fix: add `V2__...`.
2. Committing `.env`. Prevented by `.gitignore`, but always check `git status` before committing.
3. Running `docker compose down -v` without knowing that `-v` deletes the data.
4. Starting the backend before the database is healthy.

### Interview-style questions
- What is the difference between `mvn package` and `mvn verify`?
- Why are database migrations better than `ddl-auto: update`?
- What is the difference between a Docker image and a container?
- Why should a password have no default value in `application.yml`?

## C. Verification

| Check | Command | Result |
|---|---|---|
| Backend build and tests | `mvn -B verify` | ✅ BUILD SUCCESS, 2 tests passed, 0 failed |
| Flyway migration | Seen in the test and app logs | ✅ `Successfully applied 1 migration … now at version v1` |
| App against Compose DB | `java -jar target/…jar` + `curl /actuator/health` | ✅ `{"status":"UP", "db":{"status":"UP"} …}` |
| Default seller row | `psql … select * from sellers` | ✅ 1 row: Leenax SwiftDrop / `leenax-swiftdrop` / ACTIVE / LKR |
| Actuator lock-down | `curl /actuator/env` | ✅ 404 |
| Missing `.env` | Start the app without it | Fails fast: `password authentication failed` (documented in the README) |
| Maven Wrapper | `./mvnw -v` | ✅ Maven 3.9.11 |
| Frontend clean install | `npm ci` | ✅ 0 vulnerabilities |
| Frontend lint and format | `npm run lint`, `npm run format:check` | ✅ |
| Frontend tests | `npm test` | ✅ 1 passed |
| Frontend build | `npm run build` | ✅ |
| CI and Compose YAML | YAML parse | ✅ Valid. **The CI workflow itself first runs after this push.** |

### How this was verified in the cloud session (workarounds, not committed)
- Maven Central and Docker Hub were rate-limiting the cloud machine (HTTP 429). Maven used Google's Maven Central mirror via `~/.m2/settings.xml`, and the `postgres:17-alpine` image was pulled from `mirror.gcr.io`. **Your PC and GitHub Actions use the normal sources**, so nothing in the project depends on these workarounds.
- These checks ran on JDK 21 in the cloud. Your PC uses JDK 25, which should behave the same because the project compiles for Java 21. Confirm it with exercise 1.

### Known limitations and warnings
- The Mockito warning `A Java agent has been loaded dynamically` appears during tests. It's harmless today. Future JDKs will block dynamic agents by default; the fix (configuring Mockito as a `-javaagent` in Surefire) is listed under improvements.
- The frontend doesn't talk to the backend yet. That comes in Phase 5 (Axios and CORS).
- No design system yet. That's Phase 2.

## D. Git status
See the commit and push result in the chat summary, and `docs/PROGRESS.md`.

## E. Exercises

1. **Easy: run it on your PC.** Follow the README "Running locally on Windows" steps. Send me the JSON from http://localhost:8080/actuator/health and a screenshot of http://localhost:5173.
2. **Intermediate: your first migration.** Create `V2__add_seller_contact_email.sql` that adds a nullable `contact_email VARCHAR(254)` column to `sellers`. Restart the backend and find the log line showing version v2. Then explain: why a new file instead of editing V1? (Don't commit it yet; show me first.)
3. **Debugging: break it on purpose.** Stop the database (`docker compose stop`), start the backend, and read the error. Which line tells you the real cause? Then restore it (`docker compose start`). Bonus: change `DB_PORT` in `.env` to a wrong value and predict the error before you run it.

## F. Improvements

**Required fixes:** none known.

**Optional improvements**
1. Configure Mockito as a Java agent in Surefire to remove the dynamic-agent warning before JDK defaults change.
2. Add `.editorconfig` so IntelliJ and VS Code use the same indentation and line endings.
3. Add Dependabot so dependency and GitHub Actions updates arrive as pull requests.

**Security and production risks (for later phases)**
- `show-components: always` on the health endpoint is fine locally; review it for production in Phase 14.
- The local database password is for development only. Staging and production will use a secret manager.

## G. Next phase preview — Phase 2: React fundamentals and design system

You'll learn components, props, state, `useState` and `useEffect`, Tailwind
utilities, responsive layout and accessibility basics. Phase 2 builds:
- design tokens (colours, typography, spacing) in Tailwind's `@theme`
- `components/ui/`: Button, Input, Card, Badge, Skeleton, EmptyState, ErrorState
- layout: Header, Footer, a container
- a home page with a ProductCard and ProductGrid using **clearly labelled mock data**

It depends only on Phase 1's frontend. The backend is untouched.

Decision needed before Phase 2: **D-12**, whether Sinhala and Tamil will be
supported. If yes, text goes through translation files from the start.
