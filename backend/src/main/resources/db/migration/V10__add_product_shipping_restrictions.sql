-- Shipping Phase C (owner feedback): restrictions for ONE product, on top of
-- its shipping category's rules. A product can only ADD restrictions; it can
-- never allow a country that its category blocks.

ALTER TABLE products
    ADD COLUMN shipping_domestic_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN products.shipping_domestic_only IS
    'TRUE = this product is delivered within the origin country only, whatever its category allows';

CREATE TABLE product_shipping_blocked_countries (
    product_id    UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    country_code  VARCHAR(2)  NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    PRIMARY KEY (product_id, country_code)
);
