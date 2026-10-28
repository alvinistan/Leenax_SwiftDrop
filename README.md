# Leenax SwiftDrop.lk

A full-stack e-commerce and delivery platform for customers in Sri Lanka and
abroad. It starts as a single-seller store and is designed to grow into a
multi-seller marketplace.

It is also a step-by-step programming-learning project.

> **Status:** Phase 1 (project foundation). The backend and frontend start, but there are no store features yet.

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

### 4. Start the frontend (terminal 2)

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173.

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
| `Set DB_PASSWORD in the .env file` | `.env` is missing. Run `Copy-Item .env.example .env`. |
| `password authentication failed for user "swiftdrop"` | (a) The backend can't find `.env`. Start it from `backend/` or the repository root. (b) The password in `.env` differs from the one the database was first created with. Put the old one back, or reset with `docker compose down -v` (deletes local data). |
| `port 5432 is already allocated` / `bind: ... in use` | PostgreSQL is already installed on your PC. Set `DB_PORT=5433` in `.env`. |
| `Connection to localhost:5432 refused` | The database isn't running. Run `docker compose up -d --wait`. |
| Backend tests fail with `Could not find a valid Docker environment` | Docker Desktop isn't running. Start it and try again. |
| `Port 8080 was already in use` | Another program uses 8080. Stop it, or set `SERVER_PORT=8081` in `.env`. |
