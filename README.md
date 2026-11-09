# Leenax SwiftDrop.lk

A full-stack e-commerce and delivery platform for customers in Sri Lanka and
abroad. It starts as a single-seller store and is designed to grow into a
multi-seller marketplace.

It is also a step-by-step programming-learning project.

> **Status:** Phase 6 (administration). Admins log in and manage categories, products, variants (piece or by weight) and stock; the store shows real data. Next: product images (Phase 7).

## Planned stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, React Router, Axios, Tailwind CSS |
| Backend | Java 21 (language level), Spring Boot 4.1.x, Spring Security, Spring Data JPA |
| Database | PostgreSQL + Flyway migrations |
| Storage | AWS S3 (private bucket) for product images |
| Testing | JUnit 5, Mockito, Testcontainers, Vitest, React Testing Library, Playwright |
| DevOps | Docker, Docker Compose, GitHub Actions |

## Documentation

- [Requirements](docs/REQUIREMENTS.md): what the system must do, plus open business decisions
- [Architecture](docs/ARCHITECTURE.md): how it is structured and why
- [Backlog](docs/BACKLOG.md): phases and their scope
- [Learning roadmap](docs/LEARNING_ROADMAP.md): what to study for each phase
- [Progress](docs/PROGRESS.md): what has been completed
- [Phase reports](docs/phase-reports/)

## Project layout

```
backend/            Spring Boot API (Java 21, Maven Wrapper)
frontend/           React + TypeScript + Vite app
docs/               Requirements, architecture, phase reports
docker-compose.yml  Local PostgreSQL database
.env.example        Template for your local settings (copy to .env)
.github/workflows/  GitHub Actions CI
```

## Running locally on Windows

You need Java 21 or newer, Node.js 22.12 or newer, Git, and Docker Desktop
(running). Use **PowerShell** in the repository folder.

### 1. First time only

```powershell
git clone https://github.com/alvinistan/Leenax_SwiftDrop.git
cd Leenax_SwiftDrop
Copy-Item .env.example .env      # then open .env and set DB_PASSWORD
cd frontend; npm install; cd ..
```

### 2. Start the database

```powershell
docker compose up -d --wait      # starts PostgreSQL in the background
docker compose ps                # STATUS should say "healthy"
```

### 3. Start the backend (terminal 1)

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Check it at http://localhost:8080/actuator/health. You should see
`"status":"UP"` and `"db":{"status":"UP"}`.

Explore and try the API in **Swagger UI**: http://localhost:8080/swagger-ui.html

### Admin login

The admin area is at http://localhost:5173/admin. There is no public sign-up:
the first administrator is created from `.env` when the backend starts.

1. Make sure `.env` has these lines (copy them from `.env.example` if your
   `.env` is older), with your own email and a password of **12+ characters**:
   ```
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=a-long-password-only-you-know
   ```
2. Restart the backend. The log shows `Initial administrator account created.`
   This happens only once; changing these lines later does not change the account.
3. Log in at http://localhost:5173/login.

Swagger UI uses the same login: after logging in to the app, the admin
endpoints work in Swagger's "Try it out".

### 4. Start the frontend (terminal 2)

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. The storefront loads its categories and products
from the backend, so the backend (step 3) must be running. Add products in
Swagger UI and they appear in the shop.

**Frontend settings** (optional): copy `frontend/.env.example` to
`frontend/.env.local` and edit it.

- If you changed `SERVER_PORT` in the root `.env` (e.g. to 8081), set
  `VITE_API_URL=http://localhost:8081`.
- To work on the design **without** the backend, set `VITE_USE_SAMPLE_DATA=true`
  (built-in sample products, labelled "Sample").

Restart `npm run dev` after changing these files.

### 5. Run the checks (the same checks CI runs)

```powershell
cd backend;  .\mvnw.cmd verify;  cd ..     # needs Docker Desktop running
cd frontend; npm run lint; npm test; npm run build; cd ..
```

### Stopping

- Backend and frontend: press `Ctrl+C` in their terminals.
- Database: `docker compose down`. Your data is kept in a Docker volume.
- `docker compose down -v` **deletes the database data**. Use it only to start over.

### Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `Set DB_PASSWORD in the .env file` | `.env` is missing. Run `Copy-Item .env.example .env`. Check the name with `Get-ChildItem -Force .env*`: Notepad sometimes saves it as `.env.txt`. |
| `password authentication failed for user "swiftdrop"` | (a) The backend can't find `.env`. Start it from `backend/` or the repository root. (b) The password in `.env` differs from the one the database was first created with. Put the old one back, or reset with `docker compose down -v` (deletes local data). |
| `port 5432 is already allocated` / `bind: ... in use`, or `password authentication failed` even though `.env` is correct | PostgreSQL is also installed on Windows and is using port 5432 (check with `Get-Service *postgres*`). Set `DB_PORT=5433` in `.env`, then `docker compose down` and `docker compose up -d --wait`. |
| `Connection to localhost:5432 refused` | The database isn't running. Run `docker compose up -d --wait`. |
| Backend stops with `ADMIN_PASSWORD must be at least 12 characters long` | Choose a longer `ADMIN_PASSWORD` in `.env`. |
| Log says `No administrator exists yet` | Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `.env` and restart the backend. |
| Admin login always says "incorrect" | The account was created with the password `.env` had at the **first** start. Changing `.env` later doesn't change it. For a local test database: `docker compose down -v` (deletes local data) and start again. |
| Shop says "We couldn't reach the store" | (a) The backend isn't running: start it (step 3). (b) Wrong address: `VITE_API_URL` in `frontend/.env.local` must match the backend port. (c) CORS: open the browser console (F12). A "CORS policy" error means the page's address isn't in `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`). |
| Backend tests fail with `Could not find a valid Docker environment` | Docker Desktop isn't running. Start it and try again. |
| `Port 8080 was already in use` | See what uses it: `Get-NetTCPConnection -LocalPort 8080 -State Listen \| ForEach-Object { Get-Process -Id $_.OwningProcess }`. If it is `java`, an earlier backend is still running: press `Ctrl+C` in its window or `Stop-Process -Id <Id>`. Otherwise set `SERVER_PORT=8081` in `.env`. |
