CREATE TABLE IF NOT EXISTS api_rate_limits (
    user_id TEXT NOT NULL,
    bucket TEXT NOT NULL CHECK (bucket IN ('read', 'write')),
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (user_id, bucket, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window
    ON api_rate_limits (window_started_at);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kam_fleets_api') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA public, neon_auth TO kam_fleets_api';
        EXECUTE 'GRANT SELECT ON neon_auth."user" TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON app_users TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON trucks, drivers, clients, trips, trip_delay_logs, expenses, spare_parts, truck_service_records, invoices TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, INSERT, DELETE ON payments, payment_reversals TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, INSERT ON audit_logs TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, UPDATE ON app_meta TO kam_fleets_api';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON api_rate_limits TO kam_fleets_api';
    END IF;
END
$$;
