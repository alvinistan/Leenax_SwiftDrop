-- Products belong to a seller and a category. The price and the SKU live on
-- variants: every product has at least one variant (a simple product has one
-- variant with no options; a T-shirt has one per size/colour).
CREATE TABLE products (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   UUID          NOT NULL REFERENCES sellers (id),
    category_id UUID          NOT NULL REFERENCES categories (id),
    name        VARCHAR(200)  NOT NULL,
    slug        VARCHAR(200)  NOT NULL,
    description TEXT,
    status      VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    currency    CHAR(3)       NOT NULL DEFAULT 'LKR',
    -- Optimistic locking: incremented on every update (see Product.version).
    version     BIGINT        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT ck_products_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT ck_products_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_products_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

-- PostgreSQL does not index foreign keys automatically. These support
-- "products in category X" and "products of seller Y" queries.
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_seller_id ON products (seller_id);
CREATE INDEX idx_products_status_created_at ON products (status, created_at DESC);

CREATE TABLE product_variants (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sku         VARCHAR(64)    NOT NULL,
    -- Exact decimal, never float. Currency is the product's currency.
    price       NUMERIC(19, 4) NOT NULL,
    active      BOOLEAN        NOT NULL DEFAULT TRUE,
    sort_order  INTEGER        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT uq_product_variants_sku UNIQUE (sku),
    CONSTRAINT ck_product_variants_price CHECK (price >= 0)
);

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);

-- Option values of a variant, e.g. (Size, M) and (Colour, Red).
CREATE TABLE product_variant_options (
    variant_id   UUID         NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
    option_name  VARCHAR(50)  NOT NULL,
    option_value VARCHAR(100) NOT NULL,

    PRIMARY KEY (variant_id, option_name)
);
