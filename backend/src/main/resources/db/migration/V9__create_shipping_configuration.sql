-- Shipping Phase C: settings, couriers, boxes, country rules, markup rules,
-- rate cards, quotes and an audit history. See docs/shipping/SHIPPING_DESIGN.md.

-- ---------------------------------------------------------------------------
-- Store shipping settings: exactly one row (id = 1).
CREATE TABLE shipping_settings (
    id                     SMALLINT      PRIMARY KEY CHECK (id = 1),
    origin_line1           VARCHAR(150)  NOT NULL,
    origin_line2           VARCHAR(150),
    origin_city            VARCHAR(100)  NOT NULL,
    origin_postal_code     VARCHAR(20),
    origin_country         CHAR(2)       NOT NULL CHECK (origin_country ~ '^[A-Z]{2}$'),
    -- Used when no box size fits or none is set up.
    default_packaging_kg   NUMERIC(10, 3) NOT NULL CHECK (default_packaging_kg >= 0),
    -- International orders: who pays import duties and taxes (owner decision: RECEIVER).
    duties_paid_by         VARCHAR(10)   NOT NULL CHECK (duties_paid_by IN ('RECEIVER', 'SENDER')),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO shipping_settings
    (id, origin_line1, origin_line2, origin_city, origin_postal_code, origin_country, default_packaging_kg, duties_paid_by)
VALUES (1, 'Sillalai South', 'Pandatharippu', 'Jaffna', '40000', 'LK', 0.250, 'RECEIVER');

-- ---------------------------------------------------------------------------
-- Couriers. Credentials are NEVER stored here (environment variables only, Phase D).
CREATE TABLE courier_providers (
    id                            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                          VARCHAR(30)   NOT NULL UNIQUE,
    name                          VARCHAR(100)  NOT NULL,
    enabled                       BOOLEAN       NOT NULL DEFAULT FALSE,
    -- Where prices come from: the courier's API (Phase D) or admin-entered rate cards.
    rates_source                  VARCHAR(10)   NOT NULL CHECK (rates_source IN ('API', 'RATE_CARD')),
    -- cm³ per kg for volumetric weight; NULL = this courier charges actual weight only.
    volumetric_divisor            INTEGER       CHECK (volumetric_divisor IS NULL OR volumetric_divisor > 0),
    -- Chargeable weight is rounded UP to a multiple of this (e.g. 0.5 kg).
    weight_rounding_increment_kg  NUMERIC(6, 3) NOT NULL CHECK (weight_rounding_increment_kg > 0),
    -- FALSE until the owner confirms the divisor and rounding from the courier contract.
    rules_verified                BOOLEAN       NOT NULL DEFAULT FALSE,
    notes                         VARCHAR(500),
    updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE courier_services (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID         NOT NULL REFERENCES courier_providers (id) ON DELETE CASCADE,
    code         VARCHAR(40)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    scope        VARCHAR(15)  NOT NULL CHECK (scope IN ('DOMESTIC', 'INTERNATIONAL')),
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_courier_services_code UNIQUE (provider_id, code)
);

-- Starting values are placeholders, marked unverified: confirm from the contracts.
INSERT INTO courier_providers (code, name, enabled, rates_source, volumetric_divisor, weight_rounding_increment_kg, notes)
VALUES ('DHL_EXPRESS', 'DHL Express', FALSE, 'API', 5000, 0.500,
        'International. Live rates need a DHL account and MyDHL API access (Shipping Phase D). Confirm divisor and rounding with DHL.'),
       ('DEX', 'Daraz Express Logistics (DEX)', TRUE, 'RATE_CARD', NULL, 1.000,
        'Domestic. Manual courier: prices from your DEX rate card; book in the DEX portal. Confirm weight rules with DEX.');

INSERT INTO courier_services (provider_id, code, name, scope)
SELECT id, 'INTERNATIONAL', 'DHL Express international', 'INTERNATIONAL' FROM courier_providers WHERE code = 'DHL_EXPRESS';
INSERT INTO courier_services (provider_id, code, name, scope)
SELECT id, 'STANDARD', 'DEX standard delivery (Sri Lanka)', 'DOMESTIC' FROM courier_providers WHERE code = 'DEX';

-- ---------------------------------------------------------------------------
-- Box sizes used to pack an order (inside size + the empty box's weight).
CREATE TABLE package_presets (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(60)   NOT NULL UNIQUE,
    length_cm     NUMERIC(8, 1) NOT NULL CHECK (length_cm > 0),
    width_cm      NUMERIC(8, 1) NOT NULL CHECK (width_cm > 0),
    height_cm     NUMERIC(8, 1) NOT NULL CHECK (height_cm > 0),
    empty_weight_kg NUMERIC(10, 3) NOT NULL CHECK (empty_weight_kg >= 0),
    max_weight_kg NUMERIC(10, 3) CHECK (max_weight_kg IS NULL OR max_weight_kg > 0),
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Example boxes: the admin should replace them with the real ones.
INSERT INTO package_presets (name, length_cm, width_cm, height_cm, empty_weight_kg, max_weight_kg) VALUES
    ('Small box (example)', 20, 15, 10, 0.200, 3),
    ('Medium box (example)', 30, 25, 15, 0.350, 10),
    ('Large box (example)', 45, 35, 25, 0.600, 25);

-- ---------------------------------------------------------------------------
-- Where each shipping category may go (owner request: block countries per category).
CREATE TABLE shipping_category_policies (
    shipping_category      VARCHAR(30) PRIMARY KEY CHECK (
        shipping_category IN ('GENERAL', 'FOOD_SHELF_STABLE', 'FOOD_PERISHABLE', 'FRAGILE')),
    international_allowed  BOOLEAN     NOT NULL
);

INSERT INTO shipping_category_policies VALUES
    ('GENERAL', TRUE), ('FOOD_SHELF_STABLE', TRUE), ('FOOD_PERISHABLE', FALSE), ('FRAGILE', TRUE);

CREATE TABLE shipping_category_blocked_countries (
    shipping_category  VARCHAR(30) NOT NULL REFERENCES shipping_category_policies (shipping_category) ON DELETE CASCADE,
    -- VARCHAR (not CHAR) because JPA maps this simple list of codes as VARCHAR.
    country_code       VARCHAR(2)  NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    PRIMARY KEY (shipping_category, country_code)
);

-- ---------------------------------------------------------------------------
-- Platform fee added to courier prices (owner decision: 2 % of the total quote).
CREATE TABLE shipping_markup_rules (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)   NOT NULL,
    type            VARCHAR(10)    NOT NULL CHECK (type IN ('PERCENT', 'FIXED', 'COMBINED')),
    percent         NUMERIC(5, 2)  CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
    fixed_amount    NUMERIC(19, 4) CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
    min_fee         NUMERIC(19, 4) CHECK (min_fee IS NULL OR min_fee >= 0),
    max_fee         NUMERIC(19, 4) CHECK (max_fee IS NULL OR max_fee >= 0),
    -- Optional scope: a courier, a destination country, both, or neither (= default).
    provider_id     UUID           REFERENCES courier_providers (id) ON DELETE CASCADE,
    country_code    CHAR(2)        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    effective_from  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    effective_to    TIMESTAMPTZ,
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    priority        INTEGER        NOT NULL DEFAULT 0,
    version         BIGINT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_markup_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_markup_min_max CHECK (min_fee IS NULL OR max_fee IS NULL OR max_fee >= min_fee),
    CONSTRAINT ck_markup_values CHECK (
        (type = 'PERCENT' AND percent IS NOT NULL)
        OR (type = 'FIXED' AND fixed_amount IS NOT NULL)
        OR (type = 'COMBINED' AND percent IS NOT NULL AND fixed_amount IS NOT NULL))
);

INSERT INTO shipping_markup_rules (name, type, percent) VALUES ('Default platform fee', 'PERCENT', 2.00);

-- ---------------------------------------------------------------------------
-- Prices the admin enters from a courier's rate sheet: one card per service and
-- destination country, with weight bands ("up to 1 kg: LKR 450").
CREATE TABLE courier_rate_cards (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id    UUID         NOT NULL REFERENCES courier_services (id) ON DELETE CASCADE,
    country_code  CHAR(2)      NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    currency      CHAR(3)      NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    version       BIGINT       NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_rate_cards_service_country UNIQUE (service_id, country_code)
);

CREATE TABLE courier_rate_card_bands (
    rate_card_id   UUID           NOT NULL REFERENCES courier_rate_cards (id) ON DELETE CASCADE,
    position       INTEGER        NOT NULL,
    max_weight_kg  NUMERIC(10, 3) NOT NULL CHECK (max_weight_kg > 0),
    price          NUMERIC(19, 4) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (rate_card_id, position)
);

-- ---------------------------------------------------------------------------
-- Shipping quotes: calculated on the server and saved, so the price a customer
-- chose can be checked later (checkout, master Phase 8). Snapshots, never edited.
CREATE TABLE shipping_quotes (
    id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_country   CHAR(2)        NOT NULL,
    destination_postal    VARCHAR(20),
    domestic              BOOLEAN        NOT NULL,
    items_weight_kg       NUMERIC(12, 3) NOT NULL,
    packaging_kg          NUMERIC(10, 3) NOT NULL,
    actual_weight_kg      NUMERIC(12, 3) NOT NULL,
    box_name              VARCHAR(60),
    length_cm             NUMERIC(8, 1),
    width_cm              NUMERIC(8, 1),
    height_cm             NUMERIC(8, 1),
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
    expires_at            TIMESTAMPTZ    NOT NULL
);

CREATE TABLE shipping_quote_options (
    id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id              UUID           NOT NULL REFERENCES shipping_quotes (id) ON DELETE CASCADE,
    service_id            UUID           NOT NULL REFERENCES courier_services (id),
    provider_code         VARCHAR(30)    NOT NULL,
    provider_name         VARCHAR(100)    NOT NULL,
    service_name          VARCHAR(100)   NOT NULL,
    volumetric_weight_kg  NUMERIC(12, 3),
    chargeable_weight_kg  NUMERIC(12, 3) NOT NULL,
    courier_price         NUMERIC(19, 4) NOT NULL,
    platform_fee          NUMERIC(19, 4) NOT NULL,
    customer_price        NUMERIC(19, 4) NOT NULL,
    currency              CHAR(3)        NOT NULL,
    -- Which markup rule was used, with its values at that moment.
    markup_rule_id        UUID,
    markup_description    VARCHAR(200)   NOT NULL,
    position              INTEGER        NOT NULL
);

CREATE INDEX idx_shipping_quote_options_quote ON shipping_quote_options (quote_id);

-- ---------------------------------------------------------------------------
-- Who changed which shipping setting, when, and from what to what.
CREATE TABLE shipping_audit_log (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(40)  NOT NULL,
    entity_id    VARCHAR(60)  NOT NULL,
    action       VARCHAR(10)  NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    actor        VARCHAR(254) NOT NULL,
    before_json  TEXT,
    after_json   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipping_audit_log_created ON shipping_audit_log (created_at DESC);
