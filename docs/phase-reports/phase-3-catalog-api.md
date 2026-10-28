# Phase 3 — Spring Boot REST API and ResponseEntity

Date: 2026-10-28 · Branch: `claude/create-projects-s4blmr`

## A. Implementation summary

**Delivered:** a tested catalogue API for categories and products with
variants, backed by PostgreSQL, with consistent errors, pagination and
Swagger UI.

> ⚠️ **`/api/admin/**` has no login yet.** Anyone who can reach the server can
> change the catalogue. That's acceptable on your own PC for learning;
> Phase 6 adds Spring Security. **Do not deploy before Phase 6.**

### Database (Flyway)

| Migration | Creates |
|---|---|
| `V2__create_categories.sql` | `categories`: unique slug, sort order, active flag |
| `V3__create_products.sql` | `products` (→ sellers, → categories; status; currency; version), `product_variants` (unique SKU, `NUMERIC(19,4)` price ≥ 0), `product_variant_options` (Size=M, Colour=Red) and foreign-key indexes |

**Variants (decision D-2):** every product has at least one variant. A
simple mug has one variant with no options; a T-shirt has one per
size/colour, each with its own SKU and price. Stock per variant comes in the
inventory phases.

### API

| Method | URL | Success | Errors |
|---|---|---|---|
| GET | `/api/categories` | 200 list of active categories | |
| GET | `/api/products?category=&page=&size=&sort=` | 200 page of ACTIVE products | 400 bad sort |
| GET | `/api/products/{slug}` | 200 product with active variants | 404 |
| GET | `/api/admin/categories`, `/{id}` | 200 | 404 |
| POST | `/api/admin/categories` | **201 + `Location`** | 400, 409 slug taken |
| PUT | `/api/admin/categories/{id}` | 200 | 400, 404, 409 |
| DELETE | `/api/admin/categories/{id}` | **204** | 404, 409 still has products |
| GET | `/api/admin/products`, `/{id}` | 200 (all statuses, all variants) | 404 |
| POST | `/api/admin/products` (with variants) | **201 + `Location`** | 400, 404 category, 409 slug or SKU taken |
| PUT | `/api/admin/products/{id}` | 200 | 400, 404, 409 |
| DELETE | `/api/admin/products/{id}` | **204** | 404 |

Sorting is allowed only by `createdAt` and `name`. Pages hold at most 100 items.

Try it: start the backend and open **http://localhost:8080/swagger-ui.html**.

### Files

```
backend/src/main/java/lk/swiftdrop/
├─ common/error/    GlobalExceptionHandler, ResourceNotFoundException (404),
│                   ConflictException (409), BadRequestException (400)
├─ common/web/      PageResponse, SortWhitelist
├─ common/money/    MoneyResponse ({"amount":"2900.00","currency":"LKR"})
├─ store/           StoreDefaults (default seller id, LKR)
├─ config/          OpenApiConfig
└─ catalog/
   ├─ category/     Category (entity), CategoryRepository, CategoryService,
   │                CategoryRequest/Response (DTOs), CategoryController,
   │                AdminCategoryController
   └─ product/      Product, ProductVariant, ProductStatus, repositories,
                    ProductService, ProductRequest, ProductUpdateRequest,
                    VariantRequest, ProductResponses, ProductController,
                    AdminProductController
```

### Design decisions

| Decision | Why |
|---|---|
| Controller → Service → Repository | Controllers handle HTTP only; services hold business rules and transactions; repositories handle SQL. Each layer can be tested on its own. |
| DTOs (records) in and out, never entities | The API shape stays stable when the database changes; internal fields can't leak; no lazy-loading surprises during JSON writing. |
| Separate `/api/...` and `/api/admin/...` | Customers only ever see ACTIVE products and active variants. Phase 6 can secure everything under `/api/admin/**` with one rule. |
| Money: `BigDecimal` + `NUMERIC(19,4)`; sent as a string | Exact arithmetic; no floating-point rounding in JavaScript |
| Prices accept at most 2 decimals | Matches LKR and USD. Currencies with 3 decimals aren't supported yet (documented limitation). |
| Errors as RFC 9457 `ProblemDetail` | One error format for every endpoint, including Spring's own errors |
| Duplicate checks in the service **and** unique constraints in the DB | The service gives a friendly 409; the database guarantees correctness even when two requests race (also mapped to 409). |
| `@Version` on Product | Optimistic locking: two admins editing at once can't silently overwrite each other |
| Sort whitelist | Unknown or internal sort fields give a clear 400, not a 500 or a slow query |
| `default_batch_fetch_size: 50` + `@EntityGraph` | A page of products takes 2 SQL queries instead of 1 + N (measured: 6 products = 2 queries) |
| Hard delete for products, for now | No orders exist yet. From Phase 8, ordered products should be ARCHIVED instead. |

## B. Programming lessons

### ResponseEntity, in practice
`ResponseEntity<T>` = **status code + headers + body**. Each controller method
picks the response that matches what happened:

```java
return ResponseEntity.ok(body);                       // 200 OK: here is the data
return ResponseEntity.created(location).body(body);   // 201 Created + Location header
return ResponseEntity.noContent().build();            // 204 No Content: done, nothing to return
```

Errors are **not** built in controllers. The service throws an exception and
`GlobalExceptionHandler` turns it into the right response:

| Code | Meaning | In this project |
|---|---|---|
| 200 OK | Success, with a body | GET, PUT |
| 201 Created | A new resource exists; `Location` says where | POST |
| 204 No Content | Success, no body | DELETE |
| 400 Bad Request | The client sent something invalid | Validation errors, malformed JSON, bad UUID, bad sort |
| 401 Unauthorized | Not logged in | Phase 6 |
| 403 Forbidden | Logged in, but not allowed | Phase 6 |
| 404 Not Found | It doesn't exist (or the customer may not see it) | Unknown id or slug; DRAFT products for customers |
| 409 Conflict | Valid request, but it clashes with current data | Duplicate slug or SKU; deleting a category that has products |
| 500 Internal Server Error | Our bug | Logged; the client only gets a generic message |

**400 vs 409:** 400 = "your request is wrong no matter what" (empty name).
409 = "your request is fine, but the data right now says no" (that slug is taken).

### Java and Spring
- **Records** (`CategoryRequest`): immutable data classes with less code. Ideal for DTOs.
- **Enums** (`ProductStatus`): a fixed set of values. Stored as text (`@Enumerated(STRING)`), so reordering the enum can't corrupt data.
- **Encapsulation:** entities have no public setters. Changes go through `update(...)` and `addVariant(...)`, which keep both sides of the product–variant relationship correct.
- **Dependency injection:** services receive repositories through their constructor. Spring wires the real ones; tests pass mocks.
- **`@Transactional`:** a product and its variants are saved together, or not at all. `readOnly = true` on the class marks reads as reads.
- **JPA relationships:** `@ManyToOne` (variant → product), `@OneToMany(mappedBy, cascade, orphanRemoval)` (product → variants), `@ElementCollection` (variant options). `FetchType.LAZY` loads related data only when used.
- **Bean Validation:** `@NotBlank`, `@Size`, `@Pattern`, `@Digits`, `@DecimalMin`, `@Valid` on nested lists, and a cross-field rule with `@AssertTrue`.
- **Access modifiers:** a class without `public` is *package-private*. That caused the first compile error (fix 1 below).

### Testing pyramid used
| Kind | Example | Speed | What it proves |
|---|---|---|---|
| Unit (Mockito) | `ProductServiceTest` | milliseconds | Business rules, e.g. duplicate slug → 409 and nothing saved |
| Web slice (`@WebMvcTest`) | `AdminCategoryControllerTest` | ~3 s | HTTP contract: status codes, Location header, error JSON |
| Integration (Testcontainers) | `CatalogApiIntegrationTest` | ~10 s | Everything together on real PostgreSQL |

### Problems hit during this phase, and the fixes
1. **Compile error: `TestcontainersConfiguration is not public`.** A test in another package used a package-private class. Fix: make it `public`.
2. **Integration tests: "Could not find a valid Docker environment".** Docker wasn't running on the cloud machine. Same fix as on your PC: start Docker.
3. **`Schema validation: wrong column type … currency … found bpchar, expecting varchar(3)`.** The SQL says `CHAR(3)`, while Hibernate assumed `VARCHAR`. `ddl-auto: validate` stopped the app at startup instead of failing later. Fix: `@JdbcTypeCode(SqlTypes.CHAR)`.
4. **`?sort=doesNotExist` returned 500, not 400** (caught by a test). Custom `@Query` methods throw a different exception for unknown fields. Fix: an explicit sort whitelist, which is also more secure.

### Interview-style questions
- When do you return 201 instead of 200? What goes in the `Location` header?
- What's the difference between 400 and 409? Between 401 and 403?
- Why not return JPA entities from controllers?
- What is the N+1 query problem, and how did we avoid it?
- What does `@Transactional` guarantee? Why `readOnly = true`?
- Why `BigDecimal` and not `double` for prices?
- What does `@Version` protect against?

## C. Verification

| Check | Result |
|---|---|
| `mvn verify` | ✅ **23 tests passed** (7 web, 4 unit, 8 integration, 2 money, 2 smoke) |
| Real app + Docker PostgreSQL + `curl` | ✅ 201 with Location, paged list, 400 with field errors, 409 on delete |
| Swagger UI and OpenAPI | ✅ `/swagger-ui.html` 200; all 7 paths documented |
| N+1 check (SQL logging) | ✅ 2 queries to list 6 products with variants |
| Frontend | Unchanged; still 24 tests passing |

### Known limitations
- **No authentication on admin endpoints** (Phase 6).
- Variants can be created only together with a new product; adding or editing variants later comes with the admin screens (Phase 6).
- No stock or inventory yet (Phases 6 and 8). No images yet (Phase 7).
- No product search by text yet (Phase 4/5 will decide: simple `ILIKE` vs PostgreSQL full-text).
- Prices support up to 2 decimal places.
- The frontend still uses sample data; connecting it is Phase 5.

## D. Git status
See `docs/PROGRESS.md` and the chat summary.

## E. Exercises

1. **Easy: try every status code.** Start the backend, open Swagger UI, and
   produce a **201, 200, 204, 400, 404 and 409**. Write down which request
   caused each. (Hint: try deleting a category that has a product.)
2. **Intermediate: a new validation rule.** Category names must be at least
   2 characters. Add the annotation and a `@WebMvcTest` that expects 400 for
   `"name": "A"`. Run `.\mvnw.cmd test`.
3. **Debugging: read a stack trace.** In `Category.java`, change
   `@Column(nullable = false, length = 100)` on `name` to `length = 50`, then
   start the app. Will it start? Find the line in the error that explains
   why. (Hint: `ddl-auto: validate` checks types, not every length; predict
   first, then test.) Put it back afterwards.

## F. Improvements

**Required before deployment:** secure `/api/admin/**` (Phase 6).

**Optional**
1. Add `ETag` headers using the product `version`, so the admin UI can detect edits made elsewhere (HTTP 412).
2. Return `Cache-Control` headers on public catalogue endpoints.
3. Text search on product names.
4. Configure Mockito as a Java agent (the dynamic-agent warning from Phase 1 is still there).

## G. Next phase preview — Phase 4: React Router and frontend navigation

You'll learn routes, route parameters (`/products/:slug`), nested and layout
routes, not-found pages, and keeping filters and page numbers in the URL.
Phase 4 builds a product listing page, a product details page (with variant
selection, using sample data shaped exactly like this API's responses),
category filtering via the carousel, pagination controls, and a 404 page.
It depends on Phase 2's components and on this phase's response shapes.
