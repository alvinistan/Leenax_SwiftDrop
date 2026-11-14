-- Master Phase 8: tax rates, COD per product, delivery countries, orders.
-- Owner decisions (2026-11-14): no guest checkout; prices INCLUDE tax with a
-- rate chosen per product; COD only in Sri Lanka and only when every product
-- allows it; otherwise the order waits while the owner arranges payment.

-- ---- tax ----
CREATE TABLE tax_rates (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(60)   NOT NULL UNIQUE,
    percent     NUMERIC(5, 2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE products
    ADD COLUMN tax_rate_id UUID REFERENCES tax_rates (id),
    ADD COLUMN cod_allowed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN products.tax_rate_id IS 'Tax included in the price; NULL = no tax';
COMMENT ON COLUMN products.cod_allowed IS 'Cash on delivery may be offered (Sri Lanka only, every item must allow it)';

-- ---- countries we deliver to (admin-editable) ----
CREATE TABLE shipping_destinations (
    country_code  VARCHAR(2)   PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sri Lanka plus countries with large Tamil communities (owner decision D-3).
INSERT INTO shipping_destinations (country_code)
VALUES ('LK'), ('IN'), ('CA'), ('GB'), ('AU'), ('CH'), ('DE'), ('FR'), ('NO'), ('MY'),
       ('SG'), ('US'), ('NZ'), ('DK'), ('NL'), ('IT'), ('SE'), ('AE');

-- ---- orders ----
CREATE SEQUENCE order_number_seq START WITH 1001;

CREATE TABLE orders (
    id                         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number               VARCHAR(20)    NOT NULL UNIQUE,
    customer_id                UUID           NOT NULL REFERENCES users (id),
    -- The same checkout submitted twice (double click, retry) returns the first order.
    idempotency_key            VARCHAR(64)    NOT NULL,
    status                     VARCHAR(20)    NOT NULL CHECK (status IN
                                   ('PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    payment_method             VARCHAR(20)    NOT NULL CHECK (payment_method IN ('COD', 'ARRANGE_LATER')),
    payment_status             VARCHAR(10)    NOT NULL CHECK (payment_status IN ('UNPAID', 'PAID')),
    currency                   CHAR(3)        NOT NULL CHECK (currency = 'LKR'),
    items_total                NUMERIC(19, 2) NOT NULL CHECK (items_total >= 0),
    tax_included               NUMERIC(19, 2) NOT NULL CHECK (tax_included >= 0),
    shipping_price             NUMERIC(19, 2) NOT NULL CHECK (shipping_price >= 0),
    grand_total                NUMERIC(19, 2) NOT NULL CHECK (grand_total >= 0),
    -- Shipping snapshot (prices never change after the order is placed)
    shipping_quote_option_id   UUID           NOT NULL,
    shipping_service_id        UUID           NOT NULL,
    shipping_provider_code     VARCHAR(30)    NOT NULL,
    shipping_provider_name     VARCHAR(100)   NOT NULL,
    shipping_service_name      VARCHAR(100)   NOT NULL,
    shipping_courier_price     NUMERIC(19, 2) NOT NULL,
    shipping_platform_fee      NUMERIC(19, 2) NOT NULL,
    shipping_markup_rule_id    UUID,
    shipping_markup_description VARCHAR(200)  NOT NULL,
    chargeable_weight_kg       NUMERIC(12, 3) NOT NULL,
    -- Delivery address snapshot (personal data: never logged)
    recipient_name             VARCHAR(100)   NOT NULL,
    recipient_phone            VARCHAR(30)    NOT NULL,
    address_line1              VARCHAR(150)   NOT NULL,
    address_line2              VARCHAR(150),
    city                       VARCHAR(100)   NOT NULL,
    region                     VARCHAR(100),
    postal_code                VARCHAR(20),
    country_code               CHAR(2)        NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    customer_note              VARCHAR(500),
    version                    BIGINT         NOT NULL DEFAULT 0,
    created_at                 TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT uq_orders_idempotency UNIQUE (customer_id, idempotency_key),
    CONSTRAINT ck_orders_total CHECK (grand_total = items_total + shipping_price)
);

CREATE INDEX ix_orders_customer ON orders (customer_id, created_at DESC);
CREATE INDEX ix_orders_created ON orders (created_at DESC);

CREATE TABLE order_items (
    order_id      UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    position      INTEGER        NOT NULL,
    variant_id    UUID           NOT NULL REFERENCES product_variants (id),
    product_name  VARCHAR(200)   NOT NULL,
    variant_label VARCHAR(200)   NOT NULL,
    sku           VARCHAR(64)    NOT NULL,
    sale_unit     VARCHAR(10)    NOT NULL CHECK (sale_unit IN ('PIECE', 'KG')),
    quantity      NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(19, 2) NOT NULL CHECK (unit_price >= 0),
    line_total    NUMERIC(19, 2) NOT NULL CHECK (line_total >= 0),
    tax_name      VARCHAR(60),
    tax_percent   NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    tax_included  NUMERIC(19, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (order_id, position)
);

CREATE TABLE order_status_events (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID          NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    status      VARCHAR(20)   NOT NULL,
    note        VARCHAR(300),
    actor       VARCHAR(255)  NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX ix_order_events_order ON order_status_events (order_id, created_at);
