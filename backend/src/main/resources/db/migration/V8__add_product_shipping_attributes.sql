-- Shipping attributes (Shipping Phase B). Used later to calculate parcel
-- weight, volumetric weight and courier prices on the server.

-- Packed weight of ONE sale unit: one piece, or one kilogram sold for KG
-- variants (e.g. 1 kg of dry fish weighs 1.05 kg with its packaging).
-- So the shipped weight is always shipping_weight_kg × quantity.
-- Packed size of one unit (optional; all three or none) for volumetric weight.
ALTER TABLE product_variants
    ADD COLUMN shipping_weight_kg NUMERIC(10, 3),
    ADD COLUMN length_cm          NUMERIC(8, 1),
    ADD COLUMN width_cm           NUMERIC(8, 1),
    ADD COLUMN height_cm          NUMERIC(8, 1);

ALTER TABLE product_variants
    ADD CONSTRAINT ck_product_variants_shipping_weight CHECK (shipping_weight_kg IS NULL OR shipping_weight_kg > 0),
    ADD CONSTRAINT ck_product_variants_dimensions CHECK (
        (length_cm IS NULL AND width_cm IS NULL AND height_cm IS NULL)
        OR (length_cm > 0 AND width_cm > 0 AND height_cm > 0));

-- What kind of goods (decides where a product may be shipped) and the data
-- customs needs for international parcels.
ALTER TABLE products
    ADD COLUMN shipping_category   VARCHAR(30)  NOT NULL DEFAULT 'GENERAL',
    -- Harmonized System code, e.g. 0305.59 (dried fish) or 1905.90 (cakes).
    ADD COLUMN hs_code             VARCHAR(13),
    ADD COLUMN country_of_origin   CHAR(2)      NOT NULL DEFAULT 'LK',
    -- Plain-language description for customs, e.g. "Dried fish, vacuum packed".
    ADD COLUMN customs_description VARCHAR(200);

ALTER TABLE products
    ADD CONSTRAINT ck_products_shipping_category CHECK (
        shipping_category IN ('GENERAL', 'FOOD_SHELF_STABLE', 'FOOD_PERISHABLE', 'FRAGILE')),
    ADD CONSTRAINT ck_products_hs_code CHECK (hs_code IS NULL OR hs_code ~ '^[0-9]{4}(\.?[0-9]{2}){1,3}$'),
    ADD CONSTRAINT ck_products_country_of_origin CHECK (country_of_origin ~ '^[A-Z]{2}$');
