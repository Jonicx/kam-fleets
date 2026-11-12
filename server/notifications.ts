import type { Pool, PoolClient } from 'pg';
import * as webPush from 'web-push';
import type { DatabaseSnapshot } from '../src/db/domain.ts';

export type NotificationCategory =
  | 'pending_account'
  | 'missing_invoice'
  | 'delay'
  | 'budget_exceeded'
  | 'overdue_invoice';

export interface AdminNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  entity_type: 'team_member' | 'trip' | 'invoice';
  entity_id: string;
  created_at: string;
  resolved_at: string | null;
  read_at: string | null;
}

interface NotificationCondition {
  key: string;
  category: NotificationCategory;
  title: string;
  body: string;
  entityType: AdminNotification['entity_type'];
  entityId: string;
}

interface PushLogger {
  error: (context: Record<string, unknown>, message: string) => void;
}

const categories: NotificationCategory[] = [
  'pending_account',
  'missing_invoice',
  'delay',
  'budget_exceeded',
  'overdue_invoice',
];

const amount = (value: unknown) => Number(value || 0);

async function writeNotification(db: Pool | PoolClient, condition: NotificationCondition) {
  const { rows } = await db.query(
    `INSERT INTO admin_notifications (dedupe_key, category, title, body, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dedupe_key) DO UPDATE
       SET resolved_at = NULL
       WHERE admin_notifications.resolved_at IS NOT NULL
     RETURNING id`,
    [condition.key, condition.category, condition.title, condition.body, condition.entityType, condition.entityId],
  );
  const notificationId = rows[0]?.id as string | undefined;
  if (!notificationId) return;

  await db.query(
    `INSERT INTO admin_notification_deliveries (notification_id, subscription_id)
     SELECT $1, subscriptions.id
     FROM admin_push_subscriptions AS subscriptions
     JOIN app_users AS users ON users.user_id = subscriptions.user_id
     WHERE users.role = 'Admin' AND users.is_active
     ON CONFLICT (notification_id, subscription_id) DO NOTHING`,
    [notificationId],
  );
}

export async function syncPendingAccountNotifications(db: Pool | PoolClient) {
  const { rows } = await db.query(
    `SELECT user_id, email, full_name
     FROM app_users
     WHERE NOT is_active AND access_approved_at IS NULL`,
  );
  const keys = (rows as Array<{ user_id: string; email: string; full_name: string | null }>).map((member) => `pending-account:${member.user_id}`);

  for (const member of rows as Array<{ user_id: string; email: string; full_name: string | null }>) {
    await writeNotification(db, {
      key: `pending-account:${member.user_id}`,
      category: 'pending_account',
      title: 'Account needs approval',
      body: `${member.full_name || member.email} is waiting for fleet access.`,
      entityType: 'team_member',
      entityId: member.user_id,
    });
  }

  await db.query(
    `UPDATE admin_notifications
     SET resolved_at = CURRENT_TIMESTAMP
     WHERE category = 'pending_account'
       AND resolved_at IS NULL
       AND NOT (dedupe_key = ANY($1::text[]))`,
    [keys],
  );
}

export async function reconcileAdminNotifications(db: Pool | PoolClient, snapshot: DatabaseSnapshot) {
  await syncPendingAccountNotifications(db);

  const active = new Map<string, NotificationCondition>();
  const liveInvoices = snapshot.invoices.filter((invoice) => !invoice.voided_at);
  const validPayments = snapshot.payments.filter((payment) => !payment.reversed_at);

  for (const trip of snapshot.trips) {
    if (trip.status === 'Completed' && !liveInvoices.some((invoice) => invoice.trip_id === trip.id)) {
      const key = `missing-invoice:${trip.id}`;
      active.set(key, {
        key,
        category: 'missing_invoice',
        title: 'Completed trip needs an invoice',
        body: `${trip.origin} to ${trip.destination} has no active invoice.`,
        entityType: 'trip',
        entityId: trip.id,
      });
    }

    if (trip.status === 'Ongoing') {
      for (const delay of trip.delay_logs ?? []) {
        const key = `delay:${delay.id}`;
        active.set(key, {
          key,
          category: 'delay',
          title: `${delay.severity} trip delay reported`,
          body: `${trip.origin} to ${trip.destination}: ${delay.reason}`,
          entityType: 'trip',
          entityId: trip.id,
        });
      }
    }

    if (trip.status === 'Ongoing' || trip.status === 'Completed') {
      const budget = amount(trip.budget_allocated);
      const recordedCosts = amount(trip.driver_pay)
        + snapshot.expenses.filter((expense) => expense.trip_id === trip.id).reduce((sum, expense) => sum + amount(expense.amount), 0)
        + snapshot.spareParts.filter((part) => part.trip_id === trip.id).reduce((sum, part) => sum + amount(part.price), 0);
      const variance = trip.status === 'Completed' && Number.isFinite(Number(trip.final_profit_loss))
        ? Number(trip.final_profit_loss)
        : budget - recordedCosts;

      if (budget > 0 && variance < 0) {
        const key = `budget-exceeded:${trip.id}`;
        active.set(key, {
          key,
          category: 'budget_exceeded',
          title: 'Trip has exceeded its budget',
          body: `${trip.origin} to ${trip.destination} is over its estimate by Tsh ${Math.round(Math.abs(variance)).toLocaleString()}.`,
          entityType: 'trip',
          entityId: trip.id,
        });
      }
    }
  }

  for (const invoice of liveInvoices) {
    const paid = validPayments
      .filter((payment) => payment.invoice_id === invoice.id)
      .reduce((sum, payment) => sum + amount(payment.amount), 0);
    const balance = amount(invoice.amount) - paid;
    if (balance > 0 && Number.isFinite(Date.parse(invoice.due_at)) && Date.parse(invoice.due_at) < Date.now()) {
      const key = `overdue-invoice:${invoice.id}`;
      active.set(key, {
        key,
        category: 'overdue_invoice',
        title: 'Invoice is overdue',
        body: `${invoice.invoice_number} has an overdue balance of Tsh ${Math.round(balance).toLocaleString()}.`,
        entityType: 'invoice',
        entityId: invoice.id,
      });
    }
  }

  for (const condition of active.values()) await writeNotification(db, condition);

  await db.query(
    `UPDATE admin_notifications
     SET resolved_at = CURRENT_TIMESTAMP
     WHERE resolved_at IS NULL
       AND category = ANY($1::text[])
       AND NOT (dedupe_key = ANY($2::text[]))`,
    [categories.filter((category) => category !== 'pending_account'), [...active.keys()]],
  );
}

export async function listAdminNotifications(db: Pool | PoolClient, userId: string): Promise<AdminNotification[]> {
  await syncPendingAccountNotifications(db);
  const { rows } = await db.query(
    `SELECT n.id, n.category, n.title, n.body, n.entity_type, n.entity_id,
            n.created_at, n.resolved_at, r.read_at
     FROM admin_notifications AS n
     LEFT JOIN admin_notification_reads AS r
       ON r.notification_id = n.id AND r.user_id = $1
     WHERE n.created_at >= CURRENT_TIMESTAMP - INTERVAL '180 days' OR n.resolved_at IS NULL
     ORDER BY (n.resolved_at IS NULL) DESC, n.created_at DESC
     LIMIT 100`,
    [userId],
  );
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    category: row.category as NotificationCategory,
    title: String(row.title),
    body: String(row.body),
    entity_type: row.entity_type as AdminNotification['entity_type'],
    entity_id: String(row.entity_id),
    created_at: new Date(String(row.created_at)).toISOString(),
    resolved_at: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    read_at: row.read_at ? new Date(String(row.read_at)).toISOString() : null,
  }));
}

export async function setNotificationRead(db: Pool | PoolClient, userId: string, notificationId: string, read: boolean) {
  if (read) {
    const result = await db.query(
      `INSERT INTO admin_notification_reads (notification_id, user_id)
       SELECT id, $2 FROM admin_notifications WHERE id = $1
       ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
      [notificationId, userId],
    );
    return result.rowCount !== 0;
  }
  const exists = await db.query('SELECT 1 FROM admin_notifications WHERE id = $1', [notificationId]);
  if (!exists.rowCount) return false;
  await db.query('DELETE FROM admin_notification_reads WHERE notification_id = $1 AND user_id = $2', [notificationId, userId]);
  return true;
}

export async function markAllNotificationsRead(db: Pool | PoolClient, userId: string) {
  await db.query(
    `INSERT INTO admin_notification_reads (notification_id, user_id)
     SELECT id, $1 FROM admin_notifications
     WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '180 days' OR resolved_at IS NULL
     ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
    [userId],
  );
}

const allowedPushHosts = (hostname: string) =>
  hostname === 'fcm.googleapis.com'
  || hostname === 'web.push.apple.com'
  || hostname.endsWith('.push.services.mozilla.com')
  || hostname.endsWith('.notify.windows.com');

export function validatePushSubscription(value: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationAt: Date | null;
} {
  if (typeof value !== 'object' || value === null) throw new Error('Push subscription is invalid.');
  const subscription = value as Record<string, unknown>;
  const keys = subscription.keys;
  if (
    typeof subscription.endpoint !== 'string'
    || typeof keys !== 'object'
    || keys === null
    || typeof (keys as Record<string, unknown>).p256dh !== 'string'
    || typeof (keys as Record<string, unknown>).auth !== 'string'
  ) {
    throw new Error('Push subscription is incomplete.');
  }
  let endpoint: URL;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    throw new Error('Push endpoint must be a valid HTTPS URL.');
  }
  if (endpoint.protocol !== 'https:' || endpoint.port !== '' || endpoint.username || endpoint.password || !allowedPushHosts(endpoint.hostname.toLowerCase())) {
    throw new Error('Push endpoint host is not supported.');
  }
  const p256dh = String((keys as Record<string, unknown>).p256dh);
  const auth = String((keys as Record<string, unknown>).auth);
  if (Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(auth, 'base64url').length !== 16) {
    throw new Error('Push subscription keys are invalid.');
  }
  const expirationAt = typeof subscription.expirationTime === 'number' && Number.isFinite(subscription.expirationTime)
    ? new Date(subscription.expirationTime)
    : null;
  return { endpoint: endpoint.toString(), p256dh, auth, expirationAt };
}

export async function dispatchPendingPushes(pool: Pool, logger: PushLogger) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;

  webPush.setVapidDetails(subject, publicKey, privateKey);

  // Claim deliveries in a short transaction with a 5-minute lease
  const claimedDeliveries = await pool.query(
    `UPDATE admin_notification_deliveries
     SET next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
     WHERE id IN (
       SELECT d.id
       FROM admin_notification_deliveries AS d
       JOIN admin_push_subscriptions AS s ON s.id = d.subscription_id
       JOIN admin_notifications AS n ON n.id = d.notification_id
       WHERE d.sent_at IS NULL
         AND d.attempts < 8
         AND d.next_attempt_at <= CURRENT_TIMESTAMP
         AND n.resolved_at IS NULL
       ORDER BY d.created_at
       LIMIT 25
       FOR UPDATE SKIP LOCKED
     )
     RETURNING d.id AS delivery_id, d.attempts, s.id AS subscription_id,
              s.endpoint, s.p256dh, s.auth, n.id AS notification_id,
              n.title, n.body, n.entity_type, n.entity_id`,
  );

  // Send pushes outside the transaction (lease held for 5 minutes)
  for (const row of claimedDeliveries.rows as Array<Record<string, unknown>>) {
    const deliveryId = String(row.delivery_id);
    try {
      await webPush.sendNotification(
        {
          endpoint: String(row.endpoint),
          keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
        },
        JSON.stringify({
          notificationId: String(row.notification_id),
          title: String(row.title),
          body: String(row.body),
          entityType: String(row.entity_type),
          entityId: String(row.entity_id),
        }),
        {
          TTL: 86_400,
        },
      );
      await pool.query('UPDATE admin_notification_deliveries SET sent_at = CURRENT_TIMESTAMP WHERE id = $1', [deliveryId]);
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await pool.query('DELETE FROM admin_push_subscriptions WHERE id = $1', [row.subscription_id]);
        continue;
      }
      const attempt = Number(row.attempts) + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Push delivery failed.';
      await pool.query(
        `UPDATE admin_notification_deliveries
         SET attempts = attempts + 1,
             next_attempt_at = CURRENT_TIMESTAMP + (LEAST(3600, 30 * power(2, attempts)) * INTERVAL '1 second'),
             last_error = $2
         WHERE id = $1`,
        [deliveryId, message],
      );
      logger.error({ deliveryId, attempt, statusCode }, 'Push delivery failed; retry is scheduled');
    }
  }
}
