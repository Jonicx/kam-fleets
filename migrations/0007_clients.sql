CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(254),
    address VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_name ON clients (lower(btrim(name)));
ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_trips_client_id ON trips (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices (client_id);
