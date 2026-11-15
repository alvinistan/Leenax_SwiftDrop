-- Master Phase 9: online card payments through PayHere (owner decision D-6).
-- Verified against the official PayHere Checkout API page (last updated 4 Sep 2026).

ALTER TABLE orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('COD', 'ARRANGE_LATER', 'CARD'));

-- One row per attempt to pay an order online. Card numbers are never stored.
CREATE TABLE payments (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    provider             VARCHAR(20)    NOT NULL CHECK (provider IN ('PAYHERE')),
    status               VARCHAR(20)    NOT NULL CHECK (status IN
                             ('STARTED', 'PENDING', 'SUCCEEDED', 'CANCELLED', 'FAILED', 'CHARGED_BACK')),
    amount               NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    currency             CHAR(3)        NOT NULL,
    -- From PayHere's verified notification
    provider_payment_id  VARCHAR(40),
    provider_method      VARCHAR(20),
    provider_status_code INTEGER,
    provider_message     VARCHAR(300),
    version              BIGINT         NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX ix_payments_order ON payments (order_id, created_at);
CREATE UNIQUE INDEX uq_payments_provider_payment
    ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
