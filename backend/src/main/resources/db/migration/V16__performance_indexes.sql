-- Master Phase 11: indexes for queries that grow with the shop.
-- (Earlier migrations are never changed; see docs/ARCHITECTURE.md.)

-- Admin order list filtered by status, the dispatch queue (PLACED / CONFIRMED,
-- oldest first) and the unpaid-card-order job.
CREATE INDEX ix_orders_status_created ON orders (status, created_at);

-- Nightly clean-up of expired shipping quotes (QuoteCleanupJob).
CREATE INDEX ix_shipping_quotes_expires ON shipping_quotes (expires_at);
