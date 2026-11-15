-- Master Phase 10: delivery management (owner decision D-7, 2026-11-15:
-- couriers plus the store's own staff for nearby deliveries).

-- ---------------------------------------------------------------------------
-- A service may be limited to some postal codes (e.g. own delivery near Jaffna).
-- No rows = the service is offered everywhere in its scope (as before).
CREATE TABLE courier_service_postal_codes (
    service_id   UUID        NOT NULL REFERENCES courier_services (id) ON DELETE CASCADE,
    postal_code  VARCHAR(10) NOT NULL CHECK (postal_code ~ '^[A-Z0-9-]{3,10}$'),
    PRIMARY KEY (service_id, postal_code)
);

-- The store's own delivery staff, as a "courier". Off until the owner adds a
-- rate card, the postal codes it covers and at least one staff member.
INSERT INTO courier_providers (code, name, enabled, rates_source, volumetric_divisor, weight_rounding_increment_kg,
                               rules_verified, notes)
VALUES ('OWN_DELIVERY', 'SwiftDrop own delivery', FALSE, 'RATE_CARD', NULL, 1.000, TRUE,
        'Your own staff deliver nearby orders. Add a Sri Lanka rate card and the postal codes you cover, then turn it on.');

INSERT INTO courier_services (provider_id, code, name, scope)
SELECT id, 'LOCAL', 'Local delivery by our staff', 'DOMESTIC' FROM courier_providers WHERE code = 'OWN_DELIVERY';

-- Reference numbers for own deliveries (LD-000001), used in place of a courier AWB.
CREATE SEQUENCE own_delivery_ref_seq START 1;

-- ---------------------------------------------------------------------------
-- Which staff member delivers a parcel (own delivery only).
ALTER TABLE shipments
    ADD COLUMN assigned_to  UUID REFERENCES users (id),
    ADD COLUMN assigned_at  TIMESTAMPTZ,
    ADD CONSTRAINT ck_shipments_assignment CHECK ((assigned_to IS NULL) = (assigned_at IS NULL));

CREATE INDEX ix_shipments_assigned_to ON shipments (assigned_to) WHERE assigned_to IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Failed delivery attempts and proof of delivery (receiver's name).
ALTER TABLE shipment_tracking_events
    ADD COLUMN failure_reason VARCHAR(20) CHECK (failure_reason IN (
        'NOT_AT_HOME', 'WRONG_ADDRESS', 'PHONE_UNREACHABLE', 'REFUSED', 'NO_CASH', 'OTHER')),
    ADD COLUMN received_by    VARCHAR(100),
    ADD CONSTRAINT ck_tracking_failure_on_exception CHECK (failure_reason IS NULL OR status = 'EXCEPTION'),
    ADD CONSTRAINT ck_tracking_receiver_on_delivered CHECK (received_by IS NULL OR status = 'DELIVERED');

-- ---------------------------------------------------------------------------
-- Cash on delivery: who holds the customer's cash until it reaches the owner.
-- HELD → SETTLED (the courier or staff member handed it over); then the order is paid.
CREATE TABLE cod_collections (
    id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID           NOT NULL UNIQUE REFERENCES orders (id),
    shipment_id           UUID           NOT NULL REFERENCES shipments (id),
    amount                NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
    currency              CHAR(3)        NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
    held_by_type          VARCHAR(10)    NOT NULL CHECK (held_by_type IN ('COURIER', 'STAFF')),
    held_by_provider_id   UUID           REFERENCES courier_providers (id),
    held_by_user_id       UUID           REFERENCES users (id),
    collected_at          TIMESTAMPTZ    NOT NULL,
    status                VARCHAR(10)    NOT NULL CHECK (status IN ('HELD', 'SETTLED')),
    settled_at            TIMESTAMPTZ,
    settled_by            VARCHAR(254),
    settlement_reference  VARCHAR(60),
    version               BIGINT         NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_cod_holder CHECK (
        (held_by_type = 'COURIER' AND held_by_provider_id IS NOT NULL AND held_by_user_id IS NULL)
        OR (held_by_type = 'STAFF' AND held_by_user_id IS NOT NULL AND held_by_provider_id IS NULL)),
    CONSTRAINT ck_cod_settled CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL AND settled_by IS NOT NULL))
);

CREATE INDEX ix_cod_collections_status ON cod_collections (status, collected_at);
