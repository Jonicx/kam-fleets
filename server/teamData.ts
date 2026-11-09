import type { PoolClient } from 'pg';
import { DatabaseSnapshot, FleetDomain, MAX_AUDIT_LOGS } from '../src/db/domain.ts';
import type { AuditLog, DelayLog, Payment, Trip } from '../src/types/database.ts';

type Row = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);

interface TableSpec {
  table: string;
  /** domain key -> database column */
  columns: Record<string, string>;
  numeric?: string[];
  /** column populated with the acting user on insert */
  actorColumn?: string;
}

const TRUCKS: TableSpec = {
  table: 'trucks',
  columns: {
    id: 'id', license_plate: 'license_plate', model: 'model', status: 'status', year: 'year',
    capacity_tons: 'capacity_tons', current_mileage: 'current_mileage', created_at: 'created_at', updated_at: 'updated_at',
  },
  numeric: ['capacity_tons'],
};
const DRIVERS: TableSpec = {
  table: 'drivers',
  columns: {
    id: 'id', full_name: 'full_name', license_number: 'license_number', phone: 'phone', status: 'status',
    experience_years: 'experience_years', created_at: 'created_at', updated_at: 'updated_at',
  },
};
const CLIENTS: TableSpec = {
  table: 'clients',
  columns: {
    id: 'id', name: 'name', tin_number: 'tin_number', contact_person: 'contact_person', phone: 'phone', email: 'email',
    address: 'address', notes: 'notes', created_at: 'created_at', updated_at: 'updated_at',
  },
};
const TRIPS: TableSpec = {
  table: 'trips',
  columns: {
    id: 'id', truck_id: 'truck_id', driver_id: 'driver_id', client_id: 'client_id', status: 'status', origin: 'origin', destination: 'destination',
    scheduled_start: 'scheduled_start', scheduled_end: 'scheduled_end', budget_allocated: 'budget_allocated',
    driver_pay: 'driver_pay', start_mileage: 'start_mileage', end_mileage: 'end_mileage',
    cargo_type: 'cargo_type', notes: 'notes', final_profit_loss: 'final_profit_loss',
    total_expenses_cost: 'total_expenses_cost', total_spare_parts_cost: 'total_spare_parts_cost',
    financial_flag: 'financial_flag', completed_at: 'completed_at', created_at: 'created_at', updated_at: 'updated_at',
  },
  numeric: ['budget_allocated', 'driver_pay', 'start_mileage', 'end_mileage', 'final_profit_loss', 'total_expenses_cost', 'total_spare_parts_cost'],
  actorColumn: 'created_by',
};
const SERVICE_RECORDS: TableSpec = {
  table: 'truck_service_records',
  columns: {
    id: 'id', truck_id: 'truck_id', record_type: 'record_type', item_name: 'item_name', price: 'price',
    mechanic_name: 'mechanic_name', service_location: 'service_location', timestamp: 'serviced_at', created_at: 'created_at',
  },
  numeric: ['price'],
  actorColumn: 'recorded_by',
};
const DELAY_LOGS: TableSpec = {
  table: 'trip_delay_logs',
  columns: {
    id: 'id', trip_id: 'trip_id', reason: 'reason', severity: 'severity', location: 'location',
    duration_minutes: 'duration_minutes', timestamp: 'occurred_at',
  },
  actorColumn: 'recorded_by',
};
const EXPENSES: TableSpec = {
  table: 'expenses',
  columns: {
    id: 'id', trip_id: 'trip_id', expense_type: 'expense_type', amount: 'amount', description: 'description',
    timestamp: 'occurred_at', created_at: 'created_at',
  },
  numeric: ['amount'],
  actorColumn: 'recorded_by',
};
const SPARE_PARTS: TableSpec = {
  table: 'spare_parts',
  columns: {
    id: 'id', trip_id: 'trip_id', part_name: 'part_name', price: 'price', description: 'description',
    replaced_by: 'replaced_by', timestamp: 'occurred_at', created_at: 'created_at',
  },
  numeric: ['price'],
  actorColumn: 'recorded_by',
};
const INVOICES: TableSpec = {
  table: 'invoices',
  columns: {
    id: 'id', trip_id: 'trip_id', client_id: 'client_id', driver_id: 'driver_id', invoice_number: 'invoice_number',
    amount: 'amount', issued_at: 'issued_at', due_at: 'due_at', reason: 'reason', created_at: 'created_at',
    voided_at: 'voided_at', void_reason: 'void_reason',
  },
  numeric: ['amount'],
  actorColumn: 'recorded_by',
};
const PAYMENTS: TableSpec = {
  table: 'payments',
  columns: {
    id: 'id', invoice_id: 'invoice_id', amount: 'amount', method: 'method', paid_at: 'paid_at',
    reference: 'reference', notes: 'notes', created_at: 'created_at',
  },
  numeric: ['amount'],
  actorColumn: 'recorded_by',
};

function toDomain(row: Row, spec: TableSpec): Row {
  const result: Row = {};
  for (const [key, column] of Object.entries(spec.columns)) {
    const value = row[column];
    if (value === null || value === undefined) continue;
    if (value instanceof Date) result[key] = value.toISOString();
    else if (spec.numeric?.includes(key)) result[key] = Number(value);
    else result[key] = value;
  }
  return result;
}

async function selectAll(client: PoolClient, spec: TableSpec, orderBy = 'created_at DESC') {
  const columns = Array.from(new Set(Object.values(spec.columns)));
  const { rows } = await client.query(`SELECT ${columns.join(', ')} FROM ${spec.table} ORDER BY ${orderBy}, id`);
  return (rows as Row[]).map((row) => toDomain(row, spec));
}

export async function loadSnapshot(client: PoolClient): Promise<DatabaseSnapshot> {
  const [trucks, drivers, clients, trips, serviceRecords, delayLogs, expenses, spareParts, invoices, payments] = await Promise.all([
    selectAll(client, TRUCKS),
    selectAll(client, DRIVERS),
    selectAll(client, CLIENTS),
    selectAll(client, TRIPS),
    selectAll(client, SERVICE_RECORDS),
    selectAll(client, DELAY_LOGS, 'occurred_at DESC'),
    selectAll(client, EXPENSES),
    selectAll(client, SPARE_PARTS),
    selectAll(client, INVOICES),
    selectAll(client, PAYMENTS),
  ]);
  const reversals = await client.query('SELECT payment_id, reason, reversed_at FROM payment_reversals');
  const reversalByPayment = new Map<string, Row>((reversals.rows as Row[]).map((row) => [String(row.payment_id), row]));
  const audit = await client.query(
    `SELECT id, actor_name, action, entity_type, entity_id, related_trip_id, summary, details, occurred_at
     FROM audit_logs ORDER BY occurred_at DESC, id DESC LIMIT $1`,
    [MAX_AUDIT_LOGS],
  );

  const logsByTrip = new Map<string, DelayLog[]>();
  for (const log of delayLogs as unknown as DelayLog[]) {
    logsByTrip.set(log.trip_id, [...(logsByTrip.get(log.trip_id) ?? []), log]);
  }

  return {
    trucks: trucks as never,
    drivers: drivers as never,
    clients: clients as never,
    trips: (trips as unknown as Trip[]).map((trip) => ({ ...trip, delay_logs: logsByTrip.get(trip.id) ?? [] })),
    truckServiceRecords: serviceRecords as never,
    expenses: expenses as never,
    spareParts: spareParts as never,
    invoices: invoices as never,
    payments: (payments as unknown as Payment[]).map((payment) => {
      const reversal = reversalByPayment.get(payment.id);
      return reversal
        ? { ...payment, reversed_at: (reversal.reversed_at as Date).toISOString(), reversal_reason: String(reversal.reason) }
        : payment;
    }),
    auditLogs: (audit.rows as Row[]).map(toAuditLog),
    auditActor: '',
  };
}

export interface AuditHistoryCursor {
  id: string;
}

export interface AuditHistoryPage {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

function toAuditLog(row: Row): AuditLog {
  const timestamp = row.occurred_at instanceof Date
    ? row.occurred_at.toISOString()
    : new Date(String(row.occurred_at)).toISOString();
  const log: AuditLog = {
    id: String(row.id),
    actor: String(row.actor_name),
    action: String(row.action),
    entity_type: row.entity_type as AuditLog['entity_type'],
    entity_id: String(row.entity_id),
    summary: String(row.summary),
    timestamp,
  };
  if (row.related_trip_id) log.related_trip_id = String(row.related_trip_id);
  if (row.details !== null && row.details !== undefined) log.details = JSON.stringify(row.details);
  return log;
}

export async function loadOlderAuditHistory(
  client: PoolClient,
  cursor: AuditHistoryCursor | null,
): Promise<AuditHistoryPage> {
  const [countResult, pageResult] = await Promise.all([
    client.query('SELECT COUNT(*)::text AS total FROM audit_logs'),
    client.query(
      `SELECT page.id, page.actor_name, page.action, page.entity_type, page.entity_id,
              page.related_trip_id, page.summary, page.details, page.occurred_at
       FROM audit_logs AS page
       WHERE $1::uuid IS NULL OR EXISTS (
         SELECT 1 FROM audit_logs AS cursor_log
         WHERE cursor_log.id = $1::uuid
           AND (page.occurred_at, page.id) < (cursor_log.occurred_at, cursor_log.id)
       )
       ORDER BY page.occurred_at DESC, page.id DESC
       LIMIT 51`,
      [cursor?.id ?? null],
    ),
  ]);
  const rows = pageResult.rows as Row[];
  return {
    logs: rows.slice(0, 50).map(toAuditLog),
    total: Number(countResult.rows[0].total),
    hasMore: rows.length > 50,
  };
}

export async function getDataVersion(client: PoolClient): Promise<number> {
  const { rows } = await client.query('SELECT data_version FROM app_meta WHERE id');
  return Number(rows[0]?.data_version ?? 0);
}

const byId = <T extends { id: string }>(rows: readonly T[]) => new Map(rows.map((row) => [row.id, row] as const));

async function upsertRow(client: PoolClient, spec: TableSpec, record: Row, actorUserId: string) {
  const entries = Object.entries(spec.columns);
  const columns = entries.map(([, column]) => column);
  const values: unknown[] = entries.map(([key]) => record[key] ?? null);
  if (!isUuid(record.id)) throw new Error(`Invalid record id for ${spec.table}.`);
  if (spec.actorColumn) {
    columns.push(spec.actorColumn);
    values.push(actorUserId);
  }
  const updates = entries
    .map(([, column]) => column)
    .filter((column) => column !== 'id' && column !== 'created_at')
    .map((column) => `${column} = EXCLUDED.${column}`);
  await client.query(
    `INSERT INTO ${spec.table} (${columns.join(', ')})
     VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
    values,
  );
}

interface TableDiff {
  spec: TableSpec;
  upserts: Row[];
  deletes: string[];
}

function diffRows(spec: TableSpec, before: readonly Row[], after: readonly Row[], strip: (row: Row) => Row = (row) => row): TableDiff {
  const previous = byId(before as { id: string }[]);
  const next = byId(after as { id: string }[]);
  const upserts: Row[] = [];
  for (const [id, row] of next) {
    const old = previous.get(id);
    if (!old || JSON.stringify(strip(old as Row)) !== JSON.stringify(strip(row as Row))) upserts.push(row as Row);
  }
  const deletes = [...previous.keys()].filter((id) => !next.has(id));
  return { spec, upserts, deletes };
}

const withoutDelayLogs = (row: Row) => {
  const { delay_logs: _ignored, ...rest } = row;
  return rest;
};
const flattenDelayLogs = (trips: readonly Trip[]) =>
  trips.flatMap((trip) => (trip.delay_logs ?? []).map((log) => ({ ...log, trip_id: trip.id }))) as unknown as Row[];
const withoutReversal = (row: Row) => {
  const { reversed_at: _a, reversal_reason: _b, ...rest } = row;
  return rest;
};

/** Writes the difference between two snapshots and returns the new shared data version. */
export async function saveChanges(
  client: PoolClient,
  before: DatabaseSnapshot,
  after: DatabaseSnapshot,
  actorUserId: string,
  actorName: string,
): Promise<number> {
  const asRows = (rows: unknown) => rows as Row[];
  const diffs = {
    trucks: diffRows(TRUCKS, asRows(before.trucks), asRows(after.trucks)),
    drivers: diffRows(DRIVERS, asRows(before.drivers), asRows(after.drivers)),
    clients: diffRows(CLIENTS, asRows(before.clients ?? []), asRows(after.clients ?? [])),
    trips: diffRows(TRIPS, asRows(before.trips), asRows(after.trips), withoutDelayLogs),
    serviceRecords: diffRows(SERVICE_RECORDS, asRows(before.truckServiceRecords), asRows(after.truckServiceRecords)),
    delayLogs: diffRows(DELAY_LOGS, flattenDelayLogs(before.trips), flattenDelayLogs(after.trips)),
    expenses: diffRows(EXPENSES, asRows(before.expenses), asRows(after.expenses)),
    spareParts: diffRows(SPARE_PARTS, asRows(before.spareParts), asRows(after.spareParts)),
    invoices: diffRows(INVOICES, asRows(before.invoices), asRows(after.invoices)),
    payments: diffRows(PAYMENTS, asRows(before.payments), asRows(after.payments), withoutReversal),
  };

  const deleteOrder = [
    diffs.delayLogs, diffs.expenses, diffs.spareParts, diffs.serviceRecords, diffs.payments, diffs.invoices,
    diffs.trips, diffs.drivers, diffs.trucks, diffs.clients,
  ];
  for (const diff of deleteOrder) {
    if (diff.deletes.length === 0) continue;
    if (diff.spec === PAYMENTS) {
      await client.query('DELETE FROM payment_reversals WHERE payment_id = ANY($1::uuid[])', [diff.deletes]);
    }
    await client.query(`DELETE FROM ${diff.spec.table} WHERE id = ANY($1::uuid[])`, [diff.deletes]);
  }

  const upsertOrder = [
    diffs.trucks, diffs.drivers, diffs.clients, diffs.trips, diffs.serviceRecords, diffs.delayLogs, diffs.expenses,
    diffs.spareParts, diffs.invoices, diffs.payments,
  ];
  const previousPayments = byId(before.payments);
  const previousInvoices = byId(before.invoices);
  for (const diff of upsertOrder) {
    for (const row of diff.upserts) {
      if (diff.spec === PAYMENTS && previousPayments.has(String(row.id))) continue;
      await upsertRow(client, diff.spec, row, actorUserId);
      if (diff.spec === INVOICES && row.voided_at && !previousInvoices.get(String(row.id))?.voided_at) {
        await client.query('UPDATE invoices SET voided_by = $2 WHERE id = $1', [row.id, actorUserId]);
      }
    }
  }

  for (const payment of after.payments) {
    if (payment.reversed_at && !previousPayments.get(payment.id)?.reversed_at) {
      await client.query(
        'INSERT INTO payment_reversals (payment_id, reason, reversed_at, recorded_by) VALUES ($1, $2, $3, $4)',
        [payment.id, payment.reversal_reason, payment.reversed_at, actorUserId],
      );
    }
  }

  const knownAuditIds = new Set(before.auditLogs.map((log) => log.id));
  const newAuditLogs = after.auditLogs.filter((log) => !knownAuditIds.has(log.id)).reverse();
  for (const log of newAuditLogs) {
    let details: unknown = null;
    if (log.details !== undefined) {
      try {
        details = JSON.parse(log.details);
      } catch {
        details = { text: log.details };
      }
    }
    await client.query(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, action, entity_type, entity_id, related_trip_id, summary, details, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        isUuid(log.id) ? log.id : crypto.randomUUID(),
        actorUserId,
        actorName,
        log.action,
        log.entity_type,
        log.entity_id,
        isUuid(log.related_trip_id) ? log.related_trip_id : null,
        log.summary,
        details === null ? null : JSON.stringify(details),
        log.timestamp,
      ],
    );
  }

  const { rows } = await client.query(
    'UPDATE app_meta SET data_version = data_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id RETURNING data_version',
  );
  return Number(rows[0].data_version);
}

/** Replays a client command on the authoritative server state, reusing the client's generated ids when safe. */
export class ServerDomain extends FleetDomain {
  private readonly usedIds: Set<string>;

  constructor(snapshot: DatabaseSnapshot, actorName: string, private readonly suggestedIds: string[]) {
    super();
    this.applySnapshot(structuredClone({ ...snapshot, auditActor: actorName }));
    this.usedIds = new Set(
      [
        ...snapshot.trucks, ...snapshot.drivers, ...(snapshot.clients ?? []), ...snapshot.trips, ...snapshot.truckServiceRecords,
        ...snapshot.expenses, ...snapshot.spareParts, ...snapshot.invoices, ...snapshot.payments, ...snapshot.auditLogs,
        ...snapshot.trips.flatMap((trip) => trip.delay_logs ?? []),
      ].map((row) => row.id),
    );
  }

  protected generateId(): string {
    const suggested = this.suggestedIds.shift();
    const id = isUuid(suggested) && !this.usedIds.has(suggested) ? suggested : crypto.randomUUID();
    this.usedIds.add(id);
    return id;
  }
}