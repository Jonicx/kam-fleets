import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. ENUMS
// ============================================================================
export const truckStatusEnum = pgEnum('truck_status', ['Available', 'On Trip', 'Maintenance']);
export const driverStatusEnum = pgEnum('driver_status', ['Available', 'On Trip', 'Off Duty']);
export const tripStatusEnum = pgEnum('trip_status', ['Planned', 'Ongoing', 'Completed']);
export const expenseTypeEnum = pgEnum('expense_type', ['Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other']);

// ============================================================================
// 2. TRUCKS
// ============================================================================
export const trucks = pgTable('trucks', {
  id: uuid('id').defaultRandom().primaryKey(),
  licensePlate: varchar('license_plate', { length: 32 }).notNull().unique(),
  model: varchar('model', { length: 120 }).notNull(),
  status: truckStatusEnum('status').default('Available').notNull(),
  year: integer('year'),
  capacityTons: numeric('capacity_tons', { precision: 5, scale: 2 }),
  currentMileage: integer('current_mileage').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 3. DRIVERS
// ============================================================================
export const drivers = pgTable('drivers', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  licenseNumber: varchar('license_number', { length: 50 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }).notNull(),
  status: driverStatusEnum('status').default('Available').notNull(),
  experienceYears: integer('experience_years').default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  tinNumber: varchar('tin_number', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 150 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 254 }),
  address: varchar('address', { length: 500 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_clients_name').on(sql`lower(btrim(${table.name}))`),
]);

// ============================================================================
// 4. TRIPS
// ============================================================================
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    truckId: uuid('truck_id')
      .notNull()
      .references(() => trucks.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: tripStatusEnum('status').default('Planned').notNull(),
    origin: varchar('origin', { length: 255 }).notNull(),
    destination: varchar('destination', { length: 255 }).notNull(),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }).notNull(),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }).notNull(),
    budgetAllocated: numeric('budget_allocated', { precision: 12, scale: 2 }).notNull(),
    driverPay: numeric('driver_pay', { precision: 10, scale: 2 }).default('0.00').notNull(),
    startMileage: integer('start_mileage'),
    endMileage: integer('end_mileage'),
    cargoType: varchar('cargo_type', { length: 150 }),
    notes: text('notes'),
    delayReasons: jsonb('delay_reasons').$type<string[]>().default([]),
    finalProfitLoss: numeric('final_profit_loss', { precision: 12, scale: 2 }),
    totalExpensesCost: numeric('total_expenses_cost', { precision: 10, scale: 2 }),
    totalSparePartsCost: numeric('total_spare_parts_cost', { precision: 10, scale: 2 }),
    financialFlag: varchar('financial_flag', { length: 20 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_trips_truck_id').on(table.truckId),
    index('idx_trips_driver_id').on(table.driverId),
    index('idx_trips_status').on(table.status),
    index('idx_trips_scheduled_start').on(table.scheduledStart),
  ]
);

// ============================================================================
// 4b. DYNAMIC TRIP DELAY LOGS
// ============================================================================
export const tripDelayLogs = pgTable(
  'trip_delay_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reason: text('reason').notNull(),
    severity: varchar('severity', { length: 20 }).default('Medium').notNull(),
    location: varchar('location', { length: 255 }),
    durationMinutes: integer('duration_minutes').default(0),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_trip_delay_logs_trip_id').on(table.tripId),
    index('idx_trip_delay_logs_timestamp').on(table.timestamp),
  ]
);

// ============================================================================
// 5. EXPENSES
// ============================================================================
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    expenseType: expenseTypeEnum('expense_type').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    description: text('description'),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_expenses_trip_id').on(table.tripId),
    index('idx_expenses_type').on(table.expenseType),
    index('idx_expenses_timestamp').on(table.timestamp),
  ]
);

// ============================================================================
// 6. SPARE PARTS (Maintenance during trip)
// ============================================================================
export const spareParts = pgTable(
  'spare_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    partName: varchar('part_name', { length: 255 }).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    description: text('description'),
    replacedBy: varchar('replaced_by', { length: 150 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_spare_parts_trip_id').on(table.tripId),
    index('idx_spare_parts_timestamp').on(table.timestamp),
  ]
);

// ============================================================================
// 7. INVOICES, PAYMENTS & AUDIT HISTORY
// ============================================================================
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .references(() => trips.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    invoiceNumber: varchar('invoice_number', { length: 80 }).notNull().unique(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_invoices_trip_id').on(table.tripId),
    index('idx_invoices_issued_at').on(table.issuedAt),
    index('idx_invoices_due_at').on(table.dueAt),
    check('chk_invoices_amount_positive', sql`${table.amount} > 0`),
    check('chk_invoices_due_after_issue', sql`${table.dueAt} >= ${table.issuedAt}`),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    method: varchar('method', { length: 30 }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    reference: varchar('reference', { length: 120 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_invoice_id').on(table.invoiceId),
    index('idx_payments_paid_at').on(table.paidAt),
    check('chk_payments_amount_positive', sql`${table.amount} > 0`),
    check(
      'chk_payments_method_valid',
      sql`${table.method} IN ('Cash', 'Bank transfer', 'Mobile money', 'Cheque', 'Other')`,
    ),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actor: varchar('actor', { length: 100 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: varchar('entity_id', { length: 120 }).notNull(),
    relatedTripId: varchar('related_trip_id', { length: 120 }),
    summary: text('summary').notNull(),
    details: jsonb('details'),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_related_trip').on(table.relatedTripId),
    index('idx_audit_logs_timestamp').on(table.timestamp),
  ],
);

// ============================================================================
// 8. ORM RELATIONS
// ============================================================================
export const trucksRelations = relations(trucks, ({ many }) => ({
  trips: many(trips),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  trips: many(trips),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  trips: many(trips),
  invoices: many(invoices),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  truck: one(trucks, {
    fields: [trips.truckId],
    references: [trucks.id],
  }),
  driver: one(drivers, {
    fields: [trips.driverId],
    references: [drivers.id],
  }),
  client: one(clients, {
    fields: [trips.clientId],
    references: [clients.id],
  }),
  expenses: many(expenses),
  spareParts: many(spareParts),
  delayLogs: many(tripDelayLogs),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  trip: one(trips, {
    fields: [invoices.tripId],
    references: [trips.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const tripDelayLogsRelations = relations(tripDelayLogs, ({ one }) => ({
  trip: one(trips, {
    fields: [tripDelayLogs.tripId],
    references: [trips.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  trip: one(trips, {
    fields: [expenses.tripId],
    references: [trips.id],
  }),
}));

export const sparePartsRelations = relations(spareParts, ({ one }) => ({
  trip: one(trips, {
    fields: [spareParts.tripId],
    references: [trips.id],
  }),
}));

// Inferred TypeScript Model Types
export type SelectTruck = typeof trucks.$inferSelect;
export type InsertTruck = typeof trucks.$inferInsert;

export type SelectDriver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

export type SelectTrip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

export type SelectExpense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type SelectSparePart = typeof spareParts.$inferSelect;
export type InsertSparePart = typeof spareParts.$inferInsert;

export type SelectTripDelayLog = typeof tripDelayLogs.$inferSelect;
export type InsertTripDelayLog = typeof tripDelayLogs.$inferInsert;

export type SelectInvoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type SelectPayment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export type SelectAuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
