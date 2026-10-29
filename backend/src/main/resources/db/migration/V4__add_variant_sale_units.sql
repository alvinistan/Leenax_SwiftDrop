-- How a variant is sold (owner request: "cake by the kg or by the piece").
--   PIECE: price is per piece; quantity is a whole number (1, 2, 3 ...).
--          Fixed choices such as "Cake 1 kg" are PIECE variants with an option.
--   KG:    price is per kilogram; the customer chooses any weight between
--          min_quantity and max_quantity in steps of quantity_step (e.g. 0.5 kg).
-- Existing variants become PIECE with quantity 1, step 1 (the defaults).
ALTER TABLE product_variants
    ADD COLUMN sale_unit     VARCHAR(10)    NOT NULL DEFAULT 'PIECE',
    ADD COLUMN min_quantity  NUMERIC(10, 3) NOT NULL DEFAULT 1,
    -- NULL = no upper limit
    ADD COLUMN max_quantity  NUMERIC(10, 3),
    ADD COLUMN quantity_step NUMERIC(10, 3) NOT NULL DEFAULT 1;

ALTER TABLE product_variants
    ADD CONSTRAINT ck_product_variants_sale_unit CHECK (sale_unit IN ('PIECE', 'KG')),
    ADD CONSTRAINT ck_product_variants_min_quantity CHECK (min_quantity > 0),
    ADD CONSTRAINT ck_product_variants_quantity_step CHECK (quantity_step > 0),
    ADD CONSTRAINT ck_product_variants_max_quantity CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
    -- Pieces cannot be split: whole numbers only.
    ADD CONSTRAINT ck_product_variants_piece_whole CHECK (
        sale_unit <> 'PIECE'
        OR (min_quantity = trunc(min_quantity)
            AND quantity_step = trunc(quantity_step)
            AND (max_quantity IS NULL OR max_quantity = trunc(max_quantity))));
