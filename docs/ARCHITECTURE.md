# Architecture — Leenax SwiftDrop.lk

Status: proposed in Phase 0. Major changes are recorded in §10.

## 1. Big picture

```
 Browser (React + TypeScript SPA)
        │  HTTPS, JSON (REST)
        ▼
 Spring Boot application  ── one deployable "modular monolith"
   ├─ identity      ├─ catalog      ├─ inventory   ├─ cart
   ├─ checkout      ├─ order        ├─ payment     ├─ delivery
   ├─ store/seller  ├─ admin        └─ audit
        │                    │
        ▼                    ▼
   PostgreSQL           AWS S3 (product images, private bucket)
   (Flyway migrations)
```

**Why a modular monolith and not microservices?**
One developer, one database and one deployment. That is far simpler to build,
test, debug and pay for. Each module keeps its own package and talks to other
modules through their **service interfaces**, never by reaching into their
repositories. If a module ever needs to become its own service, those
boundaries already exist.

## 2. Repository layout (planned for Phase 1)

```
Leenax_SwiftDrop/
├─ backend/                 Spring Boot (Maven Wrapper)
│  └─ src/main/java/lk/swiftdrop/
│     ├─ common/            error format, config, shared types (Money)
│     ├─ identity/
│     ├─ store/             sellers and store configuration
│     ├─ catalog/           categories, products, images
│     └─ ...                one package per module
├─ frontend/                React + Vite + TypeScript
│  └─ src/
│     ├─ components/ui/     design-system components (Button, Input, Card)
│     ├─ features/          catalog, cart, checkout, admin ...
│     ├─ pages/  routes/  api/  hooks/
├─ docs/                    requirements, architecture, phase reports
├─ docker-compose.yml       local PostgreSQL (Phase 1), full stack (Phase 12)
└─ .github/workflows/       CI
```

The Java package `lk.swiftdrop` is a proposal. Confirm or change it before
Phase 1.

## 3. Layers inside each backend module

```
Controller  → receives HTTP, validates the DTO, returns ResponseEntity
   │
Service     → business rules and @Transactional boundaries
   │
Repository  → Spring Data JPA, database access only
   │
Entity      → JPA mapping (never returned to the browser)
```

DTOs (Java `record`s) are the only objects that cross the HTTP boundary. That
prevents leaking internal fields, avoids lazy-loading surprises and keeps the
API stable when the database changes.

## 4. Key design decisions

| # | Decision | Reason |
|---|---|---|
| AD-1 | Modular monolith | Simplest architecture that meets the requirements (§1) |
| AD-2 | **Seller entity from day one**; one default seller row; every product has `seller_id` | Adding multi-seller later then needs no migration of existing products |
| AD-3 | UUID primary keys for public-facing entities | IDs cannot be guessed or counted; still safe if data is merged later |
| AD-4 | Money = `NUMERIC(19,4)` + ISO-4217 `currency` column; `BigDecimal` in Java | Exact arithmetic; currency always explicit |
| AD-5 | Order line and address **snapshots** | Later price or address edits must not change past orders |
| AD-6 | Flyway owns the schema; Hibernate `ddl-auto=validate` | Schema changes are reviewed, versioned and repeatable |
| AD-7 | Consistent error body (RFC 9457 `ProblemDetail`) | One error format for the frontend to handle |
| AD-8 | Server-side pricing only | Security: the browser is not trusted |
| AD-9 | Inventory updated with row locking or optimistic versioning inside a transaction | Prevents overselling under concurrency |
| AD-10 | Idempotency keys for checkout and payment webhooks | Retries and double-clicks are safe |
| AD-11 | Private S3 bucket + pre-signed URLs (Phase 7) | No public write access; least privilege |
| AD-12 | Spring Boot 4.1.x; Java 21 language level (`release` 21) | Boot 3.5 OSS support has ended (Phase 0 audit §4). Code compiled for Java 21 builds and runs on the owner's JDK 25 and on JDK 21 in CI and the cloud. |

### Authentication approach (decided in Phase 6)

The frontend and backend will be served from the same site, so the likely
choice is **server-side sessions with an HttpOnly, Secure, SameSite cookie,
plus CSRF protection**. It is simpler and safer for a browser app than storing
JWTs in `localStorage`. Phase 6 will compare the options before deciding.

## 5. Initial data model sketch

Tables are created only in the phase that needs them.

```
sellers ─< products >─ categories        (categories.image: Phases 6–7)
             │
             ├─< product_variants      (D-2: SKU, options, price, stock)
             ├─< product_images        (Phase 7)
             └── inventory              (Phase 6/8)

users ─< user_roles >─ roles            (Phase 6)
users ─< addresses
users ─< carts ─< cart_items >─ products
users ─< orders ─< order_items          (snapshots)
         orders ─< payments ─< payment_events
         orders ─< order_status_history
         orders ── deliveries
audit_logs
```

## 6. Environments

| Environment | Where | When |
|---|---|---|
| Local | Windows PC: Docker PostgreSQL + `mvnw` + `npm run dev` | Phase 1 onward |
| CI | GitHub Actions (Testcontainers for PostgreSQL) | Phase 1 (basic), Phase 13 (full) |
| Staging | Low-cost hosting, approved in Phase 14 | Phase 14 |
| Production | After the launch checklist passes | After Phase 14 |

Configuration comes from environment variables. Only safe defaults are kept in
`application.yml`. Secrets never go into Git.

## 7. Cost guardrails (AWS)

- Region: **ap-south-1 (Mumbai)** unless there is a reason to change.
- Before any resource is created: name the service, estimate the cost, get approval.
- Create an AWS Budget with email alerts (for example at USD 10, 25 and 50) **before** the first resource.
- Watch for expensive defaults: NAT gateways, idle load balancers, idle RDS instances, unattached Elastic IPs, CloudWatch log retention.

## 8. Cross-cutting concerns

- **Logging:** structured logs with no personal data, and a correlation ID per request.
- **Monitoring:** Spring Boot Actuator, exposing only `health` (and `info`) publicly.
- **API docs:** OpenAPI / Swagger UI, available only in development.
- **Testing:** unit tests (JUnit 5, Mockito), integration tests (Spring Boot Test + Testcontainers), frontend tests (Vitest + React Testing Library), end-to-end tests (Playwright).

## 9. Git workflow

- `main` is always buildable and holds approved phase work.
- Each phase or feature gets a branch, for example `phase-1/foundation` or `feat/catalog-api`.
- Conventional Commit messages, such as `feat(catalog): add product listing API`.
- Merge to `main` after the checks pass and the owner approves. No force-pushes to shared branches.

## 10. Decision log

| Date | Decision | Status |
|---|---|---|
| 2026-10-28 | AD-1 to AD-11 proposed | Proposed |
| 2026-10-28 | AD-12 Spring Boot 4.1.x, Java 21 language level | Approved by owner |
| 2026-10-28 | Product variants supported (D-2); English only (D-12) | Decided by owner |
| 2026-10-28 | Commits authored as the owner's GitHub identity (`alvinistan`, GitHub noreply email); Claude listed as co-author | Requested by owner |
| 2026-10-28 | `main` created from the last approved phase (Phase 1); each approved phase is then merged into `main` | Approved by owner |
