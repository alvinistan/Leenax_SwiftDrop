-- Product photos. The image files live in S3 (private bucket); the database
-- stores only where each file is (its object key) and details about it.
CREATE TABLE product_images (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID         NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- e.g. products/5f1c.../9a7b....webp (never the uploaded file name)
    object_key   VARCHAR(300) NOT NULL,
    content_type VARCHAR(50)  NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    -- Describes the picture for people who cannot see it (screen readers).
    alt_text     VARCHAR(200),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_product_images_object_key UNIQUE (object_key),
    CONSTRAINT ck_product_images_content_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT ck_product_images_size CHECK (size_bytes > 0)
);

CREATE INDEX idx_product_images_product_id ON product_images (product_id);

-- One round picture per category (the "Shop by category" carousel).
ALTER TABLE categories ADD COLUMN image_object_key VARCHAR(300);
