ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS access_approved_at TIMESTAMPTZ;

UPDATE app_users
SET access_approved_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE access_approved_at IS NULL
  AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'pending_account',
        'missing_invoice',
        'delay',
        'budget_exceeded',
        'overdue_invoice'
    )),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('team_member', 'trip', 'invoice')),
    entity_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_active
    ON admin_notifications (resolved_at, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_notification_reads (
    notification_id UUID NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    expiration_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_user
    ON admin_push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS admin_notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES admin_push_subscriptions(id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notification_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_deliveries_pending
    ON admin_notification_deliveries (next_attempt_at)
    WHERE sent_at IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kam_fleets_api') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON admin_notifications, admin_notification_reads, admin_push_subscriptions, admin_notification_deliveries TO kam_fleets_api';
    END IF;
END
$$;
