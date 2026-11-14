# Shipping and Courier Management: Audit and Design (Phase A)

Date: 2026-11-14 · Branch: `claude/create-projects-s4blmr` (commit `8e54108`)
Status: **proposal awaiting owner approval. No shipping code has been written.**

This document answers the six questions of the shipping request: what exists,
what's missing, which files change, which new files and tables are needed, how
shipping fits checkout and orders, and the phases with their tests. It ends
with **risks** and **decisions needed from the owner**.

---

## 1. What already exists (verified in the repository)

| Area | Status | Evidence |
|---|---|---|
| Architecture | Modular monolith, one Spring Boot app, packages under `lk.swiftdrop` | `catalog/`, `identity/`, `media/`, `config/`, `common/`, `store/` |
| Products | `Product` (seller, category, status, currency, `@Version`) | `catalog/product/Product.java`, `V3` |
| Variants | `ProductVariant`: SKU, price `NUMERIC(19,4)`, **sale unit PIECE/KG** with min/max/step, **stock** `NUMERIC(12,3)`, options | `V3`, `V4`, `V6` |
| **Shipping attributes** | ❌ **None**: no weight, dimensions, shipping category, HS code | — |
| Admin product UI | List (search/filter), form with `useFieldArray` variants, photos | `pages/admin/AdminProduct*.tsx` |
| Admin dashboard and routes | `/admin`, `/admin/categories/**`, `/admin/products/**`; lazy-loaded; `AdminLayout` tab bar | `routes.tsx`, `components/layout/AdminLayout.tsx` |
| Security | Session cookie + CSRF (`csrf.spa()`); `/api/admin/**` = ADMIN; deny by default; roles ADMIN, CUSTOMER, DELIVERY | `config/SecurityConfig.java`, `identity/Role.java` |
| Store settings | ⚠️ Only **constants**: default seller id and currency `LKR` (no settings table, no origin address) | `store/StoreDefaults.java` |
| Money | `BigDecimal` + `NUMERIC`; `MoneyResponse` (decimal string + ISO currency); frontend BigInt decimal maths | `common/money/MoneyResponse.java`, `frontend/src/lib/decimal.ts`, `money.ts` |
| Errors / API style | RFC 9457 `ProblemDetail`; `ResponseEntity`; `PageResponse`; `SortWhitelist`; `/api/...` public, `/api/admin/...` admin | `common/error`, `common/web` |
| Migrations | Flyway **V1–V7** applied; next is **V8** | `db/migration` |
| External HTTP client | ❌ None yet (only the AWS SDK for S3) | — |
| Scheduling | ❌ No `@EnableScheduling` | — |
| Audit log | ❌ Planned in the architecture, not built | `docs/ARCHITECTURE.md` |
| Charts (frontend) | ❌ No chart library | `frontend/package.json` |
| **Cart, checkout, orders, addresses, payments, delivery** | ❌ **Not implemented.** `/cart` is a placeholder page; these are master-plan **Phases 8–10** | `pages/CartPage.tsx`, `docs/BACKLOG.md` |
| Customer accounts | ⚠️ `users` + CUSTOMER role exist, but no registration or customer pages | `V5`, `identity/` |

**Conclusion:** shipping cannot be wired into checkout or orders yet, because they
don't exist. The parts of shipping that depend only on the catalogue (weights,
pricing, markup, rate cards, quotes, providers) can be built now. Shipment
booking and dispatch must wait for orders (and, for paid orders, payments).

## 2. Missing shipping features

1. Shipping attributes on products/variants (weight, dimensions, category, customs data).
2. Store origin address and shipping settings (packaging, default markup 2 %).
3. Courier providers and services with **per-provider** volumetric divisor and rounding.
4. Weight engine: actual, packaging, volumetric and chargeable weight.
5. Rate sources: courier API quotes (DHL) **and** admin-managed rate cards (manual fallback, e.g. DEX).
6. Markup rules (percentage/fixed/combined, scope, dates, min/max, enable/disable) with **audit history**.
7. Server-side shipping quotes with expiry and **price snapshots**.
8. Shipments, AWB/labels, normalized tracking, webhooks/polling, idempotent booking + reconciliation.
9. Courier expenses (quote vs invoice vs adjustments) and financial reports.
10. Integration logs (redacted).
11. Nine admin pages, plus customer tracking on order details (after orders exist).

## 3. Existing files that will change

| File | Change | Phase |
|---|---|---|
| `catalog/product/ProductVariant.java`, `VariantRequest.java`, `AdminProductResponses.java` | Weight and dimensions per variant | B |
| `catalog/product/Product.java`, `ProductRequest.java` | Shipping category; customs data (HS code, country of origin) | B |
| `catalog/product/ProductService.java` | Map the new fields | B |
| `frontend/src/features/admin/productSchema.ts`, `adminProductApi.ts`, `pages/admin/AdminProductFormPage.tsx` | "Shipping" fields in the product form | B |
| `config/SecurityConfig.java` | Rules for `/api/shipping/**` (quotes: public; tracking: owner only) and the webhook path (no CSRF, signature-checked) | C, F |
| `common/error/GlobalExceptionHandler.java` | Possibly a 502/503 mapping for courier failures | D |
| `SwiftDropApplication.java` or a config class | `@EnableScheduling` (tracking polling) | F |
| `components/layout/AdminLayout.tsx`, `routes.tsx` | "Shipping" menu and nine lazy routes | H (incrementally) |
| `docs/REQUIREMENTS.md`, `ARCHITECTURE.md`, `BACKLOG.md`, `PROGRESS.md`, `.env.example` | Requirements, decisions, settings | every phase |

Existing Flyway migrations (V1–V7) are **not modified**; all changes go in new migrations.

## 4. New backend files and database tables

### Package layout (follows the existing `lk.swiftdrop.<module>` style)
```
lk.swiftdrop.shipping
├─ config/     ShippingSettings (entity + service), CourierProviderConfiguration, CourierService
├─ provider/   CourierProvider (interface), ProviderCapability, DhlExpressProvider,
│              ManualCourierProvider, CourierProviderRegistry, provider DTOs
├─ parcel/     WeightCalculator, ParcelBuilder, PackagePreset   (pure Java, unit-tested)
├─ pricing/    MarkupRule, MarkupRuleService, ShippingPriceCalculator, RateCard(+Band)
├─ quote/      ShippingQuote, ShippingQuoteOption, QuoteService, ShippingQuoteController
├─ shipment/   Shipment, ShipmentParcel, ShipmentService, BookingService (idempotent)
├─ tracking/   TrackingEvent, TrackingStatus, TrackingPoller, CourierWebhookController
├─ expense/    CourierExpense, ExpenseService
├─ audit/      ShippingAuditLog, IntegrationLog (redacting writer)
└─ admin/      Admin*Controller classes, ShippingReportService
```
HTTP client for courier APIs: **Spring `RestClient`** (part of Spring Framework,
already on the classpath, no new dependency), with explicit timeouts.

### Proposed migrations (numbers are indicative)

| Migration | Tables / columns |
|---|---|
| **V8** product shipping attributes | `product_variants`: `shipping_weight_kg NUMERIC(10,3)`, `length_cm`, `width_cm`, `height_cm NUMERIC(8,1)` (nullable); `products`: `shipping_category VARCHAR(30)`, `hs_code VARCHAR(12)`, `country_of_origin CHAR(2)` |
| **V9** settings and providers | `shipping_settings` (single row: origin address, default packaging kg, default markup %), `courier_providers` (code, name, enabled, mode SANDBOX/PRODUCTION, integration API/MANUAL, capability flags, `volumetric_divisor`, `weight_rounding_increment_kg`, last connection check; **secrets are never stored here**), `courier_services` (provider, code, name, DOMESTIC/INTERNATIONAL, enabled), `package_presets` (box sizes + empty weight) |
| **V10** pricing | `shipping_markup_rules` (type PERCENT/FIXED/COMBINED, percent, fixed amount, min/max fee, scope courier/country, effective from/to, enabled, priority), `courier_rate_cards` + `courier_rate_card_bands` (manual rates by service, zone/country, weight band) |
| **V11** quotes | `shipping_quotes` (destination snapshot, parcel snapshot, weights, currency, expires_at), `shipping_quote_options` (service, courier price, markup applied, customer price, rule id/version, source API/RATE_CARD) |
| **V12** shipments and tracking | `shipments` (order ref, provider, service, status, AWB, courier reference, label object key, booking idempotency key, attempt count, last error), `shipment_parcels`, `tracking_events` (normalized status, courier status code, occurred_at, location, `UNIQUE(shipment_id, dedup_key)`) |
| **V13** money and logs | `courier_expenses` (type QUOTE/INVOICE/ADDITIONAL/ADJUSTMENT/REFUND, amount, currency, invoice no.), `shipping_audit_log` (who, what, before/after JSON, when), `integration_logs` (provider, operation, status, duration, **redacted** request/response summary, correlation id) |
| *(with master Phase 8)* | `orders.shipping_quote_option_id`, order shipping snapshot columns, `shipments.order_id` FK |

## 5. Weight and price calculation (server only)

### Where weights come from
- **PIECE variant:** `shipping_weight_kg × quantity` (e.g. a 1 kg cake box that weighs 1.3 kg packed).
- **KG variant** (sold by weight): the ordered weight itself + the variant's container weight, if any.
- **Packaging:** the chosen package preset's empty weight (or the default packaging weight from settings).
- **Dimensions:** from the package preset that fits the items. Version 1 picks the smallest preset whose volume and longest side fit; if none fits, the quote is marked **"manual review"** instead of guessing.

### Formulas (per provider settings, not hard-coded)
```
actual weight      = Σ item weights + packaging weight
volumetric weight  = (L × W × H in cm) ÷ provider.volumetric_divisor
chargeable weight  = max(actual, volumetric), rounded UP to provider.weight_rounding_increment_kg
```
Worked example (divisor and increment are **configuration**; real values come from the courier contract):
box 30 × 20 × 15 cm = 9,000 cm³ → ÷ 5,000 = **1.8 kg** volumetric; items 1.2 kg + box 0.3 kg = **1.5 kg** actual;
chargeable = max(1.5, 1.8) = 1.8 → rounded up to the next 0.5 kg = **2.0 kg**.

### Markup (platform shipping fee)
```
platform fee  = courier quote × percent + fixed        (by rule type)
              → clamped to [min fee, max fee] if set
              → rounded HALF_UP to 2 decimals (LKR)
customer pays = courier quote + platform fee
```
Example from the request: quote LKR 10,000.00, rule 2 % → fee LKR 200.00 → customer **LKR 10,200.00**.
A 0 % promotion is simply a rule with 0 % and a date range.

**Which rule applies:** only enabled rules whose dates include *now*; the most specific
wins (courier + country > courier > country > default); ties go to the highest priority,
then the latest start date. The applied rule's id and values are copied into the quote option,
so **later rule changes never alter existing quotes or orders**.
Every rule and settings change writes `shipping_audit_log` (who, before, after, when).

> Wording: reports call this **"gross shipping margin"**, never net profit. It ignores
> packaging materials, staff time, payment fees and other costs.

## 6. Couriers

### Common interface
```java
public interface CourierProvider {
    String code();                                   // "DHL_EXPRESS", "DEX"
    Set<ProviderCapability> capabilities();          // RATES, BOOK, LABEL, TRACK, PICKUP, CANCEL, WEBHOOK
    List<RateOption> quote(RateRequest request);     // only if RATES
    BookingResult book(BookingRequest request);      // only if BOOK; idempotency key in the request
    Optional<BookingResult> findBooking(String ourReference); // reconciliation, only if supported
    List<TrackingUpdate> track(String awb);          // only if TRACK
    void cancel(String awb);                          // only if CANCEL
}
```
Capabilities are **data**, so the admin UI and services know at runtime what each
courier supports. Anything a provider lacks falls back to **manual admin actions**.

### DHL Express (international): plan, **to be verified**
- The official reference is the MyDHL API (developer.dhl.com). **This environment could not reach it** (blocked by the network policy), so the endpoints, authentication, sandbox URL, rounding rules, label formats, pickup and webhook support are **not yet verified** and will **not** be coded from memory.
- Before Phase D: (1) the owner's DHL Express account and MyDHL API **sandbox** credentials; (2) network access from the development environment to the DHL developer and API hosts; (3) a reading of the official spec, recorded in `docs/shipping/DHL_VERIFIED.md` with links.
- Capabilities enabled only after a sandbox call succeeds and a recorded response exists as test data.

### Daraz Express Logistics (DEX, domestic)
- **No public API documentation is assumed.** Availability depends on a merchant/partner agreement.
- Built first as a **manual provider:**
  - rates from an admin-managed **rate card** (weight bands, zones or districts) from the DEX contract
  - the admin books in DEX's own portal, then enters the **AWB** in SwiftDrop
  - the admin updates the tracking status by hand (or uploads the label)
- If DEX later grants API access, a `DexApiProvider` replaces the manual provider for the verified capabilities only.

## 7. Integration with checkout and orders (after master Phase 8 exists)

```
Cart (server) ──▶ address ──▶ POST /api/shipping/quotes {cartId, addressId}
                                 server: load variants + quantities → parcel → domestic/international
                                 → rate options (DHL API / rate cards) → markup → save quote (expires e.g. 30 min)
Customer picks an option ──▶ order created with a SNAPSHOT: courier price, fee, customer price,
                              weights, rule id, address (never a price sent by the browser)
Payment verified (card) or COD allowed (domestic only, admin-controlled)
        ──▶ order becomes DISPATCH_ELIGIBLE (admin can also hold/release)
        ──▶ booking (automatic or "Book now"), idempotent:
              shipment row BOOKING_REQUESTED (unique per order) → call courier
              success → BOOKED + AWB + label
              clear failure → BOOKING_FAILED (safe retry)
              timeout/unknown → BOOKING_UNKNOWN → reconcile (provider lookup if supported,
                                otherwise admin confirms) → never blind retry
        ──▶ tracking (webhook if verified, else scheduled polling) → normalized statuses
        ──▶ customer sees tracking on the order page; notification (email, Phase 9)
```
- International shipments are **never** booked just because an order exists: they need verified payment and dispatch eligibility.
- Quotes are re-validated at order time: an expired quote, or a cart that changed, requires a new quote.
- **Normalized statuses:** BOOKED, LABEL_CREATED, PICKED_UP, IN_TRANSIT, CUSTOMS_CLEARANCE, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION, RETURNED, CANCELLED. Each provider maps its own codes; unknown codes are kept raw and flagged.
- **Tracking events** are deduplicated by `(shipment, courier event id or hash of code+time+location)`.
- **Webhooks:** a separate path without CSRF, accepted only with a valid signature (if the provider supports one), plus rate limiting and logging.

## 8. Admin pages (route plan)

All under the existing `AdminLayout` with a new **Shipping** tab; lazy-loaded like the other admin pages.

| Page | Route | Built in |
|---|---|---|
| Shipping Overview (KPIs, date and courier filters, charts) | `/admin/shipping` | H (data from F) |
| Courier Providers (status, capabilities, enable, mode) | `/admin/shipping/providers` | C/D |
| Courier API Configuration (masked: "key configured ••••1234", test connection) | `/admin/shipping/providers/:code` | D |
| Shipping Rate Management (markup rules, rate cards, settings, history) | `/admin/shipping/rates` | C |
| Shipment Management (search order/AWB, filters, detail, label, retry/cancel) | `/admin/shipping/shipments` | F |
| Tracking Management (events, manual status update, unknown codes) | `/admin/shipping/tracking` | F |
| Courier Expenses (invoices, adjustments) | `/admin/shipping/expenses` | F |
| Revenue and Margin Reports | `/admin/shipping/reports` | H |
| Integration Logs (redacted) | `/admin/shipping/logs` | D |

**Charts:** the frontend has no chart library. Adding a small, well-known library such as Recharts is a dependency decision for the owner (alternative: simple hand-made SVG charts).

## 9. Security

- `/api/admin/shipping/**` is covered by the existing ADMIN rule; new public paths are added explicitly (deny by default stays).
- **Courier secrets live only in environment variables or a secrets manager.** The database stores *which* variable names are configured, never values. The API returns only "configured / not configured" and a masked suffix. Secrets **cannot** be edited from the browser.
- Configuration and rule changes are recorded in `shipping_audit_log`.
- Integration logs store **redacted** summaries: no addresses, phone numbers, names or credentials.
- Booking requires an eligible order (verified payment, or allowed COD) and is checked on the server.
- Customers can only see tracking for **their own** orders (IDOR checks as in Phases 6–7).
- Webhooks: signature verification where supported, replay protection, deduplication, rate limiting.

## 10. Implementation phases and tests

| Phase | Deliverable | Depends on | Key tests |
|---|---|---|---|
| **A** | This audit and design | — | — |
| **B** | Variant weight/dimensions, product shipping category, HS code, country of origin (V8); admin form fields | — | Validation, migration, product form tests |
| **C** | Settings, providers (data), package presets, **weight engine**, **markup rules + audit**, rate cards, **quote API** using rate cards; admin "Rates" and "Providers" pages | B | **Unit tests:** volumetric/chargeable weight per divisor and increment, rounding, markup types, min/max, 0 %, rule precedence, dates; integration: quote never trusts client prices; audit rows written |
| **E** | DEX **manual** provider: rate card, manual AWB, manual tracking | C | Manual booking/tracking flow; capability-driven UI |
| *(master Phase 8)* | **Cart, addresses, checkout, orders, COD**, using the quote API and order snapshots | C | Snapshot immutability; expired-quote rejection |
| **F** | Shipments, idempotent booking, reconciliation, tracking events, polling, expenses; Shipments, Tracking and Expenses pages | Phase 8 | **Duplicate-booking and retry tests**, timeout → UNKNOWN → reconcile, event dedup, IDOR on tracking |
| **G** | Dispatch eligibility rules (payment verified / COD), automatic booking trigger, customer tracking page | F, Phase 9 (payments) for card orders | Eligibility matrix tests |
| **D** | DHL Express integration (verified capabilities only), integration logs, API configuration page | owner's DHL credentials + network access | Provider tests with **recorded sandbox responses** (MockRestServiceServer/WireMock); no live calls in CI |
| **H** | Overview and reports pages with charts | F | Report sums vs fixtures; admin page tests |
| **I** | Security review, documentation, full regression | all | Authorization tests for every endpoint; all existing tests stay green |

**Recommended order:** A → B → C → E → *(master Phase 8: cart/checkout/orders)* → F → G → D (as soon as DHL access is ready) → H → I.
Each phase follows the usual workflow (plan, implement, test, report, commit, wait for approval).

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| DEX API not available to this account | No automatic domestic booking | Manual provider and rate cards (planned as the default) |
| DHL account eligibility, contract rates, billing currency | Quotes may not be in LKR | Store the quote currency; refuse non-LKR quotes until an exchange-rate policy is decided (never invent rates) |
| **Perishable goods** (cakes) internationally | Couriers restrict food; customs rules | Product `shipping_category` (e.g. PERISHABLE → domestic only) |
| International customs (HS codes, declared values, duties) | Delayed or returned parcels | Customs fields in Phase B; decide who pays duties (sender or receiver) |
| Unknown booking outcome after a timeout | Double shipments and charges | BOOKING_UNKNOWN state + reconciliation, no blind retries |
| Volumetric rules differ by courier and contract | Wrong prices | Divisor and rounding per provider, set by the admin from the contract |
| Scope size | Long delivery time | Phases, each shippable and tested on its own |

## 12. Decisions needed from the owner

1. **Order of work:** approve the recommended order (B, C, E now; F/G after cart/checkout/orders).
2. **Origin address** for shipments (your pickup address).
3. **DHL:** do you have a DHL Express account and MyDHL API (sandbox) credentials? What is your billing currency?
4. **DEX:** do you have a DEX merchant account? Any API documentation from your account manager? Please share your **domestic rate card** (weight bands, zones).
5. **Perishables:** may cakes and other food be shipped internationally? (Recommended: **no**, domestic only.)
6. **Markup base:** apply the 2 % to the courier's **total** quote, including fuel and other surcharges but excluding import duties? (Recommended: yes.)
7. **International duties:** does the receiver pay import duties and taxes (common), or do you?
8. **Currency:** if a courier quotes in USD, should we wait for an exchange-rate policy (recommended), or only offer LKR quotes?
9. **Chart library:** approve adding Recharts for the admin charts (or plain SVG).
10. **Network access:** allow this development environment to reach the DHL developer and API hosts (needed in Phase D).
