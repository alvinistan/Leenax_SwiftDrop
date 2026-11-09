-- How many of each variant the shop has: pieces (whole numbers) or kilograms.
-- Existing variants start at 0 (out of stock) until the admin enters real stock.
-- Reserving stock during checkout comes in Phase 8.
ALTER TABLE product_variants
    ADD COLUMN stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE product_variants
    ADD CONSTRAINT ck_product_variants_stock_not_negative CHECK (stock_quantity >= 0),
    -- Pieces cannot be split, so their stock is a whole number.
    ADD CONSTRAINT ck_product_variants_piece_stock_whole CHECK (
        sale_unit <> 'PIECE' OR stock_quantity = trunc(stock_quantity));
