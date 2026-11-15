# Security, performance and quality (Phase 11)

How SwiftDrop protects itself and its customers, what to set in production, and what is still open.

## Already in place (earlier phases)
- **Login and sessions:**
  - logins are kept in a server-side session in an HttpOnly cookie (`SameSite=Lax`; `Secure` in production, Phase 14);
  - every change needs the CSRF token;
  - passwords are stored only as bcrypt hashes.
- **Access:**
  - deny by default;
  - `/api/admin/**` is for the owner, `/api/orders/**` for customers, `/api/delivery/**` for delivery staff;
  - **EndpointAuthorizationTest** checks every endpoint.
- **Prices:** money uses exact decimals, all prices are worked out on the server, and orders keep snapshots of what was charged.
- **PayHere:** notifications are accepted only with a valid signature, and the secret stays on the server.
- **Logs:** personal data stays out of them.

## Added in Phase 11
### Request limits (429 Too Many Requests)
Limits apply per client IP address and are refilled evenly ("token bucket"). Settings are `app.rate-limit.*` in `application.yml`.

| What | Limit |
|---|---|
| Log in, change password | 10 per minute |
| Sign up | 5 per hour |
| Delivery prices (quotes) | 30 per minute |
| Cart prices | 60 per minute |
| Place order | 10 per minute |
| PayHere notifications | 60 per minute |
| All API requests together | 300 per minute |

- The answer carries a `Retry-After` header and a plain message, which the website shows as it is.
- **Behind a load balancer (Phase 14)**, set `FORWARD_HEADERS_STRATEGY=native`. Otherwise every customer looks like the load balancer and they share one limit.
  - Never turn this on for a server that is reachable directly: anyone could then fake their address.
- The limits live in the server's memory. That is right for one server. With several servers, each one counts on its own (or move the counters to Redis).
- `RATE_LIMIT_ENABLED=false` turns the limits **and the lockout** off. Use it for tests only.

### Account lockout
- After **5 wrong passwords** for one email within 15 minutes, that email can't log in for **15 minutes**, even with the right password.
- It works the same for emails without an account, so it never reveals which accounts exist.
- A successful login resets the count.
- Note: someone could deliberately lock the owner out for 15 minutes. The IP limits slow this down. If it happens, wait 15 minutes; restarting the server clears it too.

### Change password
- Every account (owner, staff, customer) can change its password at **/account/password**. The current password is required.
- After the change, the session gets a new id.

### Security headers
- API answers:
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`;
  - `Referrer-Policy: no-referrer`;
  - `X-Content-Type-Options: nosniff`;
  - `X-Frame-Options: DENY`;
  - `Cache-Control: no-store`.
- HTTPS answers also carry `Strict-Transport-Security` (1 year).
- The website's own CSP is set by the web server in Phase 12.

### Photos
Uploads were already checked by their real content type (JPEG, PNG or WebP only; no SVG) and stored under random names. Now, before a photo is stored:
- **metadata is removed:** EXIF and XMP can hold the GPS position where a phone photo was taken;
- the photo is **turned upright** using the phone's EXIF orientation;
- it is **shrunk** to at most 2000 px on its longest side;
- it is **refused** if it claims more than 40 megapixels (a "decompression bomb" that would fill the memory).

JPEG and PNG are saved again with only their pixels. For WebP, the EXIF and XMP chunks are cut out.

### Dependencies
- **Dependabot** (`.github/dependabot.yml`) opens weekly pull requests for Maven and npm updates, and monthly ones for GitHub Actions.
- CI runs `npm audit` on the packages shipped to browsers.

## Performance
- **Query-count test** (`QueryCountIntegrationTest`): main pages may not need more SQL queries when they show more rows (no "N+1").
  - It found that the dispatch page ran one query per order. Fixed: one query for all orders.
- **Indexes (V16):** orders by status, and quotes by expiry date.
- **Compression:** JSON over 2 KB is gzip-compressed.
- **Measured locally:** product list (20 products) median 14 ms, slowest 5 % 27 ms; 20 requests at once in 0.11 s.
- **Website:** the first download is 135 KB of gzipped JavaScript. Admin pages, charts and form checks load only when needed.

## Quality gates in CI
- **Backend:** all tests, and line coverage of at least **85 %**. It is 91 % today; the report is `backend/target/site/jacoco/index.html`.
- **Frontend:** lint, format, tests with coverage floors (lines and statements 80 %, functions 80 %, branches 70 %; lines are 86 % today), `npm audit`, and the build.

## Still open (later phases)
- HTTPS, `Secure` cookies and the website CSP: Phases 12–14.
- "Forgot password" and email verification: need the email provider (D-13).
- Two-factor login for the owner: recommended before going live.
- An audit log of all admin actions (shipping, staff and cash changes are already recorded).
