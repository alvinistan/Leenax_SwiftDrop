# Requirements — Leenax SwiftDrop.lk

Status: draft from Phase 0. Update this file when a decision is made.

## 1. Product vision

A trustworthy, mobile-friendly online store with delivery. It has **one seller
(the owner)** at first and serves customers in **Sri Lanka and abroad**. It is
built so that more sellers can be added later without a rewrite.

It is also a learning project, so clarity is preferred over cleverness.

## 2. Actors

| Actor | First release? | Notes |
|---|---|---|
| Guest visitor | Yes | Browses the catalogue, uses the cart |
| Customer | Yes | Registers, checks out, sees only their own orders |
| Administrator (owner) | Yes | Manages store, categories, products, stock and orders. **No public admin registration.** |
| Delivery staff | Later (Phase 10) | Updates only the deliveries assigned to them |
| Additional sellers | Later (Phase 15) | Data model is ready; no onboarding UI in the first release |

## 3. Functional requirements

### 3.1 Catalogue
- FR-1 The admin creates, edits, activates and deactivates **categories**. No categories are hard-coded.
- FR-1a Each category has an **image uploaded by the admin** when the category is created (upload in Phases 6–7). The storefront shows categories as a "Shop by category" carousel: a round image with the name below, swipe on touch screens, and Previous/Next buttons (built in Phase 2).
- FR-2 The admin creates, edits, activates and deactivates **products**. Each product belongs to a seller (initially the single default seller).
- FR-3 Products have a name, slug, description, price, currency, category, images and status.
- FR-3a Products can have **variants** (for example size and colour). Each variant has its own SKU and stock, and can have its own price (decision D-2).
- FR-4 Customers browse, filter by category, search and page through active products.
- FR-5 Sample or demo products must be clearly marked as samples and never presented as real stock.

### 3.2 Inventory
- FR-6 Stock is tracked per product (and later per seller).
- FR-7 Checkout must never sell more than the available stock, even when two customers order at the same moment.

### 3.3 Cart and checkout
- FR-8 Guests and customers can add, update and remove cart items.
- FR-9 **All prices, fees and totals are calculated on the server.** Prices sent by the browser are ignored.
- FR-10 Checkout requires a valid shipping address in a supported destination.
- FR-11 The first payment method is **Cash on Delivery (COD)**, and only where it is allowed.
- FR-12 Each order stores a **snapshot** of item prices, names and the address at order time.
- FR-13 Submitting checkout twice must not create two orders (idempotency).

### 3.4 Orders, payments and delivery
- FR-14 Customers see their order history and status. Only their own orders.
- FR-15 Order status follows defined transitions, with a history of every change.
- FR-16 Online payments go through a provider abstraction. Callbacks are signature-verified and processed idempotently.
- FR-17 Delivery records track assignment, status, tracking ID, proof of delivery and failures.

### 3.5 Administration
- FR-18 Admin dashboard for store settings, catalogue, inventory, orders and deliveries.
- FR-19 Destructive actions need confirmation.
- FR-20 Important admin actions are recorded in an audit log.

## 4. International requirements

- IR-1 **LKR** is the default currency.
- IR-2 Supported display currencies are configurable.
- IR-3 Every order stores its **transaction currency** explicitly.
- IR-4 Money is stored as exact decimals (`NUMERIC` / `BigDecimal`) or integer minor units. **Never** `float` or `double`.
- IR-5 Exchange rates are never invented. If a display conversion is shown, it states its source and that it is approximate.
- IR-6 Shipping destinations, country availability and delivery fees are configurable.
- IR-7 Timestamps are stored in UTC and shown in the user's time zone.
- IR-8 The address model supports countries without postcodes and varying address formats.

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | OWASP Top 10 awareness, backend authorization, validated input, no secrets in Git, narrow CORS, HTTPS when deployed |
| Privacy | No personal data in logs; no raw card data or CVV is ever stored |
| Accessibility | WCAG 2.2 AA as the target: contrast, keyboard navigation, labels, focus states |
| Performance | Fast on mobile networks: optimized images, pagination, lazy loading |
| Reliability | Database migrations under version control (Flyway); backups tested before launch |
| Maintainability | Modular monolith, tests on business rules, consistent API and error formats |
| Cost | Stay well inside the ~USD 100 AWS credit. Every cloud resource is approved first and has a budget alert. |

## 6. Open business decisions

None of these block Phase 1. Each one blocks the phase listed.

| # | Decision | Needed by | Notes |
|---|---|---|---|
| D-1 | What will you sell first? (product types, categories) | Phase 3 (sample data); real data before launch | Affects attributes such as size, colour and weight |
| D-2 | Do products have variants (size, colour)? | Phase 3 | **Decided 2026-10-28: Yes.** See FR-3a. |
| D-3 | Which countries do you ship to at launch? | Phase 8 | Start with Sri Lanka only? |
| D-4 | How are delivery fees calculated? (flat, by district, by weight, by country) | Phase 8 | |
| D-5 | Where is COD allowed? (Sri Lanka only?) | Phase 8 | |
| D-6 | Which online payment provider? (for example PayHere, Stripe, or a bank gateway) | Phase 9 | Needs merchant-account approval. Check that it supports your business type and LKR. |
| D-7 | Who delivers? (yourself, a courier company, or both) | Phase 10 | |
| D-8 | Can guests check out without an account? | Phase 8 | |
| D-9 | Do prices include tax? Are you VAT-registered? | Phase 8 | Ask an accountant; the system must not guess |
| D-10 | Domain name (`swiftdrop.lk`?) and business registration | Phase 14 | `.lk` domains are registered through the LK Domain Registry |
| D-11 | Return, refund and privacy policies | Before launch | Legal text written by you |
| D-12 | Languages: English only, or also Sinhala and Tamil? | Phase 2 | **Decided 2026-10-28: English only, permanently.** No translation framework needed. |
