# Learning Roadmap

Study each block **before or during** its phase. A topic is "learned" when you
can explain it in your own words and use it without copying.

| Phase | Study these topics | Check yourself: can you… |
|---|---|---|
| 0 | Git basics (repository, commit, branch, remote), what a REST API is, client vs server, what a database migration is | Draw how browser → React → Spring Boot → PostgreSQL connect? |
| 1 | Git branching; Maven (`pom.xml`, dependencies, wrapper); Spring Boot project structure; npm and `package.json` scripts; environment variables; Docker basics (image vs container) | Start PostgreSQL in Docker and explain what a volume is? |
| 2 | JS fundamentals, ES modules; React components, props, `useState`, `useEffect`; Tailwind utility classes; responsive design; accessibility basics | Build a reusable `Button` with variants, and explain props vs state? |
| 3 | Java classes, interfaces, enums, records; OOP and dependency injection; controller/service/repository; DTOs; **ResponseEntity and HTTP status codes**; Bean Validation; `@RestControllerAdvice`; JPA basics; SQL, primary and foreign keys | Explain when to return 200, 201, 204, 400, 404 and 409? |
| 4 | React Router: routes, params, nested and layout routes, not-found routes, URL search params | Explain why filters belong in the URL? |
| 5 | Promises, async/await; Axios instance and interceptors; CORS; loading, empty and error states; custom hooks | Explain what CORS protects, and why Postman ignores it? |
| 6 | Authentication vs authorization; password hashing (BCrypt/Argon2); sessions vs tokens; CSRF; role-based access; protected routes | Explain why hiding a button does not secure an endpoint? |
| 7 | Object storage; S3 buckets and keys; IAM users vs roles, least privilege; AWS SDK v2; multipart upload; pre-signed URLs | Write a minimal IAM policy for one bucket prefix? |
| 8 | Transactions (ACID); JPA relationships; `BigDecimal` money; locking (optimistic vs pessimistic); idempotency | Explain how two buyers could oversell the last item, and how we prevent it? |
| 9 | State machines; payment lifecycles; webhook signature verification; reconciliation | Explain why the success redirect page is not proof of payment? |
| 10 | Resource-based authorization; audit trails; tracking IDs | Explain an insecure direct object reference (IDOR) with an example? |
| 11 | Test pyramid; Testcontainers; Playwright; static analysis; dependency scanning; load testing | Explain what each test layer catches? |
| 12 | Dockerfiles, multi-stage builds, networks, volumes, health checks, Compose | Explain why the build stage and the runtime stage differ? |
| 13 | CI vs CD; GitHub Actions jobs and steps; secrets; branch protection; image tagging | Read a workflow file and explain each step? |
| 14 | AWS networking basics (VPC, subnets, security groups); managed databases; logs and metrics; budgets; backups and restore | Estimate the monthly cost of the staging setup? |

## How to use this roadmap with the phases

1. Read the topic list for the next phase.
2. Study it in your separate learning conversation.
3. Come back and say "proceed to Phase N", or ask questions first.
4. After the phase, do the three exercises in its report before moving on.
