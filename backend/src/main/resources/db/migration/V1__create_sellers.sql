-- A seller owns products. The store starts with exactly one seller (the owner);
-- the table exists from day one so that adding more sellers later does not
-- require changing existing products.
CREATE TABLE sellers (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(150) NOT NULL,
    slug             VARCHAR(100) NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    default_currency CHAR(3)      NOT NULL DEFAULT 'LKR',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_sellers_slug UNIQUE (slug),
    CONSTRAINT ck_sellers_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT ck_sellers_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    -- ISO 4217 currency code, e.g. LKR, USD
    CONSTRAINT ck_sellers_currency_format CHECK (default_currency ~ '^[A-Z]{3}$')
);

-- The single initial seller. A fixed, well-known id lets later migrations
-- and tests refer to it reliably.
INSERT INTO sellers (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Leenax SwiftDrop', 'leenax-swiftdrop');
