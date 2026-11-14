-- Shipping Phase E: DEX (and any courier) booked MANUALLY on the courier's own
-- portal, then recorded here with the AWB; tracking updates entered by hand.
--
-- Orders do not exist yet (master Phase 8), so a shipment carries the owner's
-- own order reference as text. Phase F links shipments to real orders.
-- No customer name, phone or address is stored here.

-- Optional link format for "track on the courier's website", entered by the
-- admin from the courier's official site, e.g. https://example.com/track?awb={awb}
ALTER TABLE courier_providers
    ADD COLUMN tracking_url_template VARCHAR(300)
        CHECK (tracking_url_template IS NULL
               OR (tracking_url_template LIKE 'https://%' AND tracking_url_template LIKE '%{awb}%'));

CREATE TABLE shipments (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id          UUID          NOT NULL REFERENCES courier_providers (id),
    service_id           UUID          REFERENCES courier_services (id),
    order_reference      VARCHAR(60)   NOT NULL,
    awb                  VARCHAR(40)   NOT NULL CHECK (awb ~ '^[A-Za-z0-9-]{4,40}$'),
    destination_country  CHAR(2)       NOT NULL CHECK (destination_country ~ '^[A-Z]{2}$'),
    destination_city     VARCHAR(100),
    weight_kg            NUMERIC(12, 3) CHECK (weight_kg IS NULL OR weight_kg > 0),
    -- What the courier charged us (manual entry), for margin reports later.
    courier_cost         NUMERIC(19, 4) CHECK (courier_cost IS NULL OR courier_cost >= 0),
    currency             CHAR(3)       NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
    status               VARCHAR(20)   NOT NULL CHECK (status IN (
                             'BOOKED', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE',
                             'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED')),
    booking_method       VARCHAR(10)   NOT NULL DEFAULT 'MANUAL' CHECK (booking_method IN ('MANUAL', 'API')),
    created_by           VARCHAR(255)  NOT NULL,
    version              BIGINT        NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- One AWB belongs to one shipment of a courier.
    CONSTRAINT uq_shipments_provider_awb UNIQUE (provider_id, awb)
);

CREATE INDEX ix_shipments_created_at ON shipments (created_at DESC);
CREATE INDEX ix_shipments_status ON shipments (status);
CREATE INDEX ix_shipments_order_reference ON shipments (lower(order_reference));

CREATE TABLE shipment_tracking_events (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID          NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
    status       VARCHAR(20)   NOT NULL CHECK (status IN (
                     'BOOKED', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE',
                     'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED')),
    occurred_at  TIMESTAMPTZ   NOT NULL,
    location     VARCHAR(100),
    note         VARCHAR(500),
    source       VARCHAR(10)   NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'API')),
    recorded_by  VARCHAR(255)  NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX ix_tracking_events_shipment ON shipment_tracking_events (shipment_id, occurred_at);
