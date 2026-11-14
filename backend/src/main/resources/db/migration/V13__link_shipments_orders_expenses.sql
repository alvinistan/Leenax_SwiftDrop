-- Shipping Phase F: shipments linked to website orders, courier expenses.

-- NULL = a shipment for an order taken outside the website (text reference only).
ALTER TABLE shipments ADD COLUMN order_id UUID REFERENCES orders (id);
CREATE INDEX ix_shipments_order ON shipments (order_id);

-- Extra courier charges after booking (the base charge is shipments.courier_cost).
CREATE TABLE courier_expenses (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID           NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
    kind         VARCHAR(20)    NOT NULL CHECK (kind IN ('SURCHARGE', 'RETURN', 'ADJUSTMENT')),
    -- Only an ADJUSTMENT may be negative (a refund or correction from the courier).
    amount       NUMERIC(19, 2) NOT NULL CHECK (amount <> 0),
    reference    VARCHAR(60),
    incurred_on  DATE           NOT NULL,
    note         VARCHAR(300),
    recorded_by  VARCHAR(255)   NOT NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_expense_sign CHECK (kind = 'ADJUSTMENT' OR amount > 0)
);

CREATE INDEX ix_courier_expenses_shipment ON courier_expenses (shipment_id);
CREATE INDEX ix_courier_expenses_incurred ON courier_expenses (incurred_on);

-- The nightly quote clean-up checks whether an order uses a quote option.
CREATE INDEX ix_orders_quote_option ON orders (shipping_quote_option_id);
