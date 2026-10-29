import {
  Truck,
  Driver,
  Trip,
  Expense,
  SparePart,
  DelayLog,
  EnrichedTrip,
  DatabaseStats,
  TruckStatus,
  TruckServiceRecord,
  DriverStatus,
  TripStatus,
  ExpenseType,
  CreateTripPayload,
  Invoice,
  Payment,
  PaymentMethod,
  AuditLog,
  AuditEntityType,
} from '../types/database.ts';
import {
  INITIAL_TRUCKS,
  INITIAL_DRIVERS,
  INITIAL_TRIPS,
  INITIAL_EXPENSES,
  INITIAL_SPARE_PARTS,
  INITIAL_TRUCK_SERVICE_RECORDS,
} from './initialData.ts';
import { canEditTruckServiceRecord } from '../utils/truckService.ts';

export const DEFAULT_AUDIT_ACTOR = 'Local operator (unverified)';
export const MAX_AUDIT_LOGS = 2000;

export interface DatabaseSnapshot {
  trucks: Truck[];
  truckServiceRecords: TruckServiceRecord[];
  drivers: Driver[];
  trips: Trip[];
  expenses: Expense[];
  spareParts: SparePart[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  auditActor: string;
}

export const SNAPSHOT_COLLECTIONS = [
  'trucks',
  'truckServiceRecords',
  'drivers',
  'trips',
  'expenses',
  'spareParts',
  'invoices',
  'payments',
  'auditLogs',
] as const;

export type AppRole = 'Admin' | 'Dispatcher';

export const COMMAND_NAMES = [
  'resetToDefault',
  'createInvoice',
  'voidInvoice',
  'createPayment',
  'reversePayment',
  'createTruckServiceRecord',
  'updateTruckServiceRecord',
  'createTruck',
  'updateTruck',
  'deleteTruck',
  'createDriver',
  'updateDriver',
  'deleteDriver',
  'createTrip',
  'completeTrip',
  'updateTrip',
  'deleteTrip',
  'addDelayLog',
  'removeDelayLog',
  'createExpense',
  'updateExpense',
  'deleteExpense',
  'createSparePart',
  'updateSparePart',
  'deleteSparePart',
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

export const ADMIN_ONLY_COMMANDS: ReadonlySet<CommandName> = new Set<CommandName>([
  'resetToDefault',
  'createInvoice',
  'voidInvoice',
  'createPayment',
  'reversePayment',
  'deleteTruck',
  'deleteDriver',
  'deleteTrip',
]);

export const isCommandName = (value: unknown): value is CommandName =>
  typeof value === 'string' && (COMMAND_NAMES as readonly string[]).includes(value);

export const canRunCommand = (role: AppRole, command: CommandName) =>
  role === 'Admin' || !ADMIN_ONLY_COMMANDS.has(command);

export interface CommandRecord {
  command: CommandName;
  args: unknown[];
  ids: string[];
}

export class DomainValidationError extends Error {}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank transfer', 'Mobile money', 'Cheque', 'Other'];

const requireWholeAmount = (value: unknown, label: string, { allowZero = false } = {}) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(`${label} must be ${allowZero ? 'Tsh 0 or greater' : 'greater than Tsh 0'}.`);
  }
  if (!Number.isInteger(amount)) throw new Error(`${label} must be a whole Tanzanian shilling amount.`);
  if (amount > 9_999_999_999_999) throw new Error(`${label} is too large.`);
  return amount;
};

const requireText = (value: unknown, label: string, maxLength = 200) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text;
};

const optionalText = (value: unknown, label: string, maxLength = 2000) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text;
};

const TRUCK_STATUSES: TruckStatus[] = ['Available', 'On Trip', 'Maintenance'];
const DRIVER_STATUSES: DriverStatus[] = ['Available', 'On Trip', 'Off Duty'];
const EXPENSE_TYPES: ExpenseType[] = ['Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other'];
const DELAY_SEVERITIES: DelayLog['severity'][] = ['Low', 'Medium', 'High', 'Critical'];
const TRIP_STATUSES: TripStatus[] = ['Planned', 'Ongoing', 'Completed'];

const requireExpenseType = (value: unknown): ExpenseType => {
  if (!EXPENSE_TYPES.includes(value as ExpenseType)) throw new Error('Select a valid expense type.');
  return value as ExpenseType;
};

const requireSeverity = (value: unknown): DelayLog['severity'] => {
  if (!DELAY_SEVERITIES.includes(value as DelayLog['severity'])) throw new Error('Select a valid delay severity.');
  return value as DelayLog['severity'];
};

const requireMinutes = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1_000_000) {
    throw new Error('Delay duration must be a whole number of minutes (0 or more).');
  }
  return minutes;
};

const optionalInteger = (value: unknown, label: string, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return number;
};

const changedFields = <T extends object>(before: T, after: T) =>
  (Object.keys(after) as (keyof T)[]).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

const requireDate = (value: unknown, label: string) => {
  const time = new Date(String(value)).getTime();
  if (typeof value !== 'string' || !Number.isFinite(time)) throw new Error(`${label} must be a valid date.`);
  return new Date(time).toISOString();
};

export class FleetDomain {
  protected trucks: Truck[] = [];
  protected truckServiceRecords: TruckServiceRecord[] = [];
  protected drivers: Driver[] = [];
  protected trips: Trip[] = [];
  protected expenses: Expense[] = [];
  protected spareParts: SparePart[] = [];
  protected invoices: Invoice[] = [];
  protected payments: Payment[] = [];
  protected auditLogs: AuditLog[] = [];
  protected auditActor = DEFAULT_AUDIT_ACTOR;
  private commandDepth = 0;
  private commandIds: string[] = [];

  constructor() {
    const self = this as unknown as Record<CommandName, (...args: unknown[]) => unknown>;
    for (const name of COMMAND_NAMES) {
      const original = self[name];
      self[name] = (...args: unknown[]) => this.runCommand(name, args, () => original.apply(this, args));
    }
  }

  private runCommand<T>(command: CommandName, args: unknown[], run: () => T): T {
    if (this.commandDepth > 0) return run();
    const before = structuredClone(this.getSnapshot());
    this.commandDepth = 1;
    this.commandIds = [];
    let result: T;
    let ids: string[];
    try {
      result = run();
      ids = this.commandIds;
    } catch (error) {
      this.applySnapshot(before);
      throw error;
    } finally {
      this.commandDepth = 0;
      this.commandIds = [];
    }
    this.afterCommand({ command, args: JSON.parse(JSON.stringify(args ?? [])), ids });
    return result;
  }

  public executeCommand(command: CommandName, args: unknown[]): unknown {
    const handler = (this as unknown as Record<CommandName, (...values: unknown[]) => unknown>)[command];
    return handler(...args);
  }

  protected afterCommand(_record: CommandRecord) {}

  protected generateId(): string {
    return crypto.randomUUID();
  }

  protected newId(): string {
    const id = this.generateId();
    if (this.commandDepth > 0) this.commandIds.push(id);
    return id;
  }

  protected nowMs(): number {
    return Date.now();
  }

  protected nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  }

  public getSnapshot(): DatabaseSnapshot {
    return {
      trucks: this.trucks,
      truckServiceRecords: this.truckServiceRecords,
      drivers: this.drivers,
      trips: this.trips,
      expenses: this.expenses,
      spareParts: this.spareParts,
      invoices: this.invoices,
      payments: this.payments,
      auditLogs: this.auditLogs,
      auditActor: this.auditActor,
    };
  }

  public applySnapshot(snapshot: DatabaseSnapshot) {
    this.trucks = snapshot.trucks;
    this.truckServiceRecords = snapshot.truckServiceRecords;
    this.drivers = snapshot.drivers;
    this.trips = snapshot.trips;
    this.expenses = snapshot.expenses;
    this.spareParts = snapshot.spareParts;
    this.invoices = snapshot.invoices;
    this.payments = snapshot.payments;
    this.auditLogs = snapshot.auditLogs;
    this.auditActor = snapshot.auditActor;
  }

  public resetToDefault() {
    this.trucks = JSON.parse(JSON.stringify(INITIAL_TRUCKS));
    this.truckServiceRecords = JSON.parse(JSON.stringify(INITIAL_TRUCK_SERVICE_RECORDS));
    this.drivers = JSON.parse(JSON.stringify(INITIAL_DRIVERS));
    this.trips = JSON.parse(JSON.stringify(INITIAL_TRIPS));
    this.expenses = JSON.parse(JSON.stringify(INITIAL_EXPENSES));
    this.spareParts = JSON.parse(JSON.stringify(INITIAL_SPARE_PARTS));
    this.invoices = [];
    this.payments = [];
    this.recordAudit('reset', 'database', 'seed data', 'Restored the sample fleet database; invoices and payments were cleared.');
  }

  public getInvoices(): Invoice[] {
    return [...this.invoices];
  }

  public getPayments(): Payment[] {
    return [...this.payments];
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public getAuditActor(): string {
    return this.auditActor;
  }

  protected recordAudit(
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    summary: string,
    details?: unknown,
    relatedTripId?: string,
  ) {
    this.auditLogs.unshift({
      id: this.newId(),
      actor: this.auditActor,
      action,
      entity_type: entityType,
      entity_id: entityId,
      related_trip_id: relatedTripId,
      summary,
      details: details === undefined ? undefined : JSON.stringify(details),
      timestamp: this.nowIso(),
    });
    this.auditLogs = this.auditLogs.slice(0, MAX_AUDIT_LOGS);
  }

  public createInvoice(
    data: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'> & { invoice_number?: string },
  ): Invoice {
    const trip = this.trips.find((item) => item.id === data.trip_id);
    if (!trip) throw new Error(`Trip ${data.trip_id} not found.`);
    if (trip.status !== 'Completed') throw new Error('Invoices can only be issued for completed trips.');
    const amount = requireWholeAmount(data.amount, 'Invoice amount');
    if (!Number.isFinite(new Date(data.issued_at).getTime()) || !Number.isFinite(new Date(data.due_at).getTime())) {
      throw new Error('Invoice issue date and due date must be valid dates.');
    }
    if (new Date(data.issued_at).getTime() > this.nowMs()) throw new Error('Invoice issue date cannot be in the future.');
    if (new Date(data.due_at).getTime() < new Date(data.issued_at).getTime()) {
      throw new Error('Invoice due date cannot be earlier than its issue date.');
    }
    const invoiceNumber = data.invoice_number?.trim() || `KAM-${new Date(this.nowMs()).getFullYear()}-${this.newId().slice(0, 8).toUpperCase()}`;
    if (invoiceNumber.length > 80) throw new Error('Invoice number must be 80 characters or fewer.');
    if (this.invoices.some((invoice) => invoice.invoice_number.toLocaleLowerCase() === invoiceNumber.toLocaleLowerCase())) {
      throw new Error(`Invoice number "${invoiceNumber}" is already in use.`);
    }
    const invoice: Invoice = {
      id: this.newId(),
      trip_id: trip.id,
      invoice_number: invoiceNumber,
      amount,
      issued_at: new Date(data.issued_at).toISOString(),
      due_at: new Date(data.due_at).toISOString(),
      created_at: this.nowIso(),
    };
    this.invoices.unshift(invoice);
    this.recordAudit('created invoice', 'invoice', invoice.id, `Issued invoice ${invoice.invoice_number} for Tsh ${amount}.`, invoice, trip.id);
    return invoice;
  }

  public createPayment(
    data: Omit<Payment, 'id' | 'created_at'>,
  ): Payment {
    const invoice = this.invoices.find((item) => item.id === data.invoice_id);
    if (!invoice) throw new Error(`Invoice ${data.invoice_id} not found.`);
    if (invoice.voided_at) throw new Error(`Invoice ${invoice.invoice_number} has been voided and cannot accept payments.`);
    const amount = requireWholeAmount(data.amount, 'Payment amount');
    if (!Number.isFinite(new Date(data.paid_at).getTime())) throw new Error('Payment date must be valid.');
    if (!PAYMENT_METHODS.includes(data.method)) throw new Error('Select a valid payment method.');
    if (new Date(data.paid_at).getTime() < new Date(invoice.issued_at).getTime()) {
      throw new Error('Payment date cannot be earlier than the invoice issue date.');
    }
    if (new Date(data.paid_at).getTime() > this.nowMs()) throw new Error('Payment date cannot be in the future.');
    if (data.reference && data.reference.length > 120) throw new Error('Payment reference must be 120 characters or fewer.');
    const paidToDate = this.payments
      .filter((payment) => payment.invoice_id === invoice.id && !payment.reversed_at)
      .reduce((total, payment) => total + Number(payment.amount), 0);
    const outstanding = Number(invoice.amount) - paidToDate;
    if (amount > outstanding) {
      throw new Error(`Payment exceeds the invoice balance of Tsh ${outstanding}.`);
    }
    const payment: Payment = {
      invoice_id: invoice.id,
      method: data.method,
      id: this.newId(),
      amount,
      paid_at: new Date(data.paid_at).toISOString(),
      reference: optionalText(data.reference, 'Payment reference', 120) || undefined,
      notes: optionalText(data.notes, 'Payment notes', 1000) || undefined,
      created_at: this.nowIso(),
    };
    this.payments.unshift(payment);
    this.recordAudit(
      'recorded payment',
      'payment',
      payment.id,
      `Recorded Tsh ${amount} against invoice ${invoice.invoice_number}.`,
      payment,
      invoice.trip_id,
    );
    return payment;
  }

  public getInvoicePayments(invoiceId: string): Payment[] {
    return this.payments.filter((payment) => payment.invoice_id === invoiceId);
  }

  // --- TRUCKS (CRUD & FK integrity) ---
  public getTrucks(): Truck[] {
    return [...this.trucks];
  }

  public getTruck(id: string): Truck | undefined {
    return this.trucks.find((t) => t.id === id);
  }

  public getTruckServiceRecords(truckId?: string): TruckServiceRecord[] {
    const records = truckId
      ? this.truckServiceRecords.filter((record) => record.truck_id === truckId)
      : this.truckServiceRecords;
    return [...records];
  }

  public createTruckServiceRecord(
    data: Omit<TruckServiceRecord, 'id' | 'created_at' | 'timestamp'> & { timestamp?: string }
  ): TruckServiceRecord {
    const truck = this.trucks.find((item) => item.id === data.truck_id);
    if (!truck) throw new Error(`Foreign Key Violation: Truck ID ${data.truck_id} does not exist.`);
    if (truck.status === 'On Trip') throw new Error('Forbidden: Cannot record service for a truck that is On Trip.');
    if (!data.item_name.trim() || !data.mechanic_name.trim() || !data.service_location.trim()) {
      throw new Error('Validation Error: Service item, mechanic name, and service location are required.');
    }
    requireWholeAmount(data.price, 'Truck service price', { allowZero: true });
    if (!['Service', 'Spare Part'].includes(data.record_type)) throw new Error('Select a valid service record type.');
    if (data.timestamp && !Number.isFinite(new Date(data.timestamp).getTime())) {
      throw new Error('Validation Error: A valid service date and time are required.');
    }

    const now = this.nowIso();
    const record: TruckServiceRecord = {
      truck_id: truck.id,
      record_type: data.record_type,
      id: this.newId(),
      item_name: data.item_name.trim(),
      price: Number(data.price),
      mechanic_name: data.mechanic_name.trim(),
      service_location: data.service_location.trim(),
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : now,
      created_at: now,
    };

    this.truckServiceRecords.unshift(record);
    this.trucks = this.trucks.map((item) =>
      item.id === truck.id ? { ...item, status: 'Maintenance', updated_at: now } : item
    );
    this.recordAudit('created truck service record', 'truck service', record.id, `Recorded ${record.item_name} for truck ${truck.license_plate}: Tsh ${record.price}.`, record);
    return record;
  }

  public updateTruckServiceRecord(
    id: string,
    updates: Pick<TruckServiceRecord, 'record_type' | 'item_name' | 'price' | 'mechanic_name' | 'service_location' | 'timestamp'>
  ): TruckServiceRecord {
    const index = this.truckServiceRecords.findIndex((record) => record.id === id);
    if (index === -1) throw new Error(`Truck service record ${id} not found.`);
    if (!canEditTruckServiceRecord(this.truckServiceRecords[index])) {
      throw new Error('This service record can only be edited within 7 days of being recorded.');
    }
    if (!updates.item_name.trim() || !updates.mechanic_name.trim() || !updates.service_location.trim()) {
      throw new Error('Validation Error: Service item, mechanic name, and service location are required.');
    }
    requireWholeAmount(updates.price, 'Truck service price', { allowZero: true });
    if (!['Service', 'Spare Part'].includes(updates.record_type)) throw new Error('Select a valid service record type.');
    if (!Number.isFinite(new Date(updates.timestamp).getTime())) {
      throw new Error('Validation Error: A valid service date and time are required.');
    }

    const previousRecord = this.truckServiceRecords[index];
    const updatedRecord: TruckServiceRecord = {
      ...this.truckServiceRecords[index],
      record_type: updates.record_type,
      timestamp: new Date(updates.timestamp).toISOString(),
      item_name: updates.item_name.trim(),
      price: Number(updates.price),
      mechanic_name: updates.mechanic_name.trim(),
      service_location: updates.service_location.trim(),
    };
    this.truckServiceRecords[index] = updatedRecord;
    this.recordAudit(
      'updated truck service record',
      'truck service',
      id,
      `Updated ${updatedRecord.item_name} for truck ${this.getTruck(updatedRecord.truck_id)?.license_plate || updatedRecord.truck_id}.`,
      { before: previousRecord, after: updatedRecord },
    );
    return updatedRecord;
  }

  private readTruckFields(data: Partial<Omit<Truck, 'id' | 'created_at' | 'updated_at'>>, partial: boolean): Partial<Truck> {
    const fields: Partial<Truck> = {};
    if (!partial || data.license_plate !== undefined) {
      fields.license_plate = requireText(data.license_plate, 'License plate', 20).toUpperCase();
    }
    if (!partial || data.model !== undefined) fields.model = requireText(data.model, 'Truck model', 120);
    if (!partial || data.status !== undefined) {
      const status = data.status ?? 'Available';
      if (!TRUCK_STATUSES.includes(status)) throw new Error('Select a valid truck status.');
      fields.status = status;
    }
    if (!partial || data.year !== undefined) fields.year = optionalInteger(data.year, 'Truck year', 1950, 2100);
    if (!partial || data.capacity_tons !== undefined) {
      if (data.capacity_tons === undefined || data.capacity_tons === null || (data.capacity_tons as unknown) === '') {
        fields.capacity_tons = undefined;
      } else {
        const capacity = Number(data.capacity_tons);
        if (!Number.isFinite(capacity) || capacity <= 0 || capacity >= 10_000) {
          throw new Error('Truck capacity must be greater than 0 tons.');
        }
        fields.capacity_tons = Math.round(capacity * 100) / 100;
      }
    }
    if (!partial || data.current_mileage !== undefined) {
      fields.current_mileage = optionalInteger(data.current_mileage, 'Current mileage', 0, 100_000_000) ?? 0;
    }
    return fields;
  }

  public createTruck(truckData: Omit<Truck, 'id' | 'created_at' | 'updated_at'>): Truck {
    const fields = this.readTruckFields(truckData, false);
    if (fields.status === 'On Trip') {
      throw new Error('A new truck cannot start as On Trip. Dispatch it from a trip instead.');
    }
    const existing = this.trucks.find((t) => t.license_plate.toUpperCase().trim() === fields.license_plate);
    if (existing) {
      throw new Error(`UNIQUE Constraint Error: Truck license plate '${fields.license_plate}' already exists.`);
    }

    const now = this.nowIso();
    const newTruck = {
      ...fields,
      id: this.newId(),
      created_at: now,
      updated_at: now,
    } as Truck;
    this.trucks.unshift(newTruck);
    this.recordAudit('created truck', 'truck', newTruck.id, `Added truck ${newTruck.license_plate} (${newTruck.model}).`, newTruck);
    return newTruck;
  }

  public updateTruck(id: string, updates: Partial<Omit<Truck, 'id' | 'created_at'>>): Truck {
    const index = this.trucks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Truck ${id} not found.`);
    const previous = this.trucks[index];
    const fields = this.readTruckFields(updates, true);
    const hasOngoingTrip = this.trips.some((trip) => trip.truck_id === id && trip.status === 'Ongoing');

    if (fields.status !== undefined && fields.status !== previous.status) {
      if (fields.status === 'On Trip') {
        throw new Error('On Trip is set automatically when the truck is dispatched on a trip.');
      }
      if (hasOngoingTrip) {
        throw new Error(`Truck ${previous.license_plate} is on an ongoing trip. Complete the trip before changing its status.`);
      }
    }

    if (fields.license_plate) {
      const duplicate = this.trucks.find(
        (t) => t.id !== id && t.license_plate.toUpperCase().trim() === fields.license_plate
      );
      if (duplicate) {
        throw new Error(`UNIQUE Constraint Error: License plate '${fields.license_plate}' already exists.`);
      }
    }

    const updated: Truck = { ...previous, ...fields };
    const changed = changedFields(previous, updated);
    if (changed.length === 0) return previous;
    updated.updated_at = this.nowIso();
    this.trucks[index] = updated;
    this.recordAudit(
      'updated truck',
      'truck',
      id,
      `Updated truck ${updated.license_plate}; changed ${changed.join(', ')}.`,
      {
        before: Object.fromEntries(changed.map((key) => [key, previous[key]])),
        after: Object.fromEntries(changed.map((key) => [key, updated[key]])),
      },
    );
    return updated;
  }

  public deleteTruck(id: string) {
    const truck = this.trucks.find((t) => t.id === id);
    if (!truck) throw new Error(`Truck ${id} not found.`);
    // Foreign Key Constraint Check: ON DELETE RESTRICT
    const linkedTrip = this.trips.find((trip) => trip.truck_id === id);
    if (linkedTrip) {
      throw new Error(
        `Foreign Key Constraint Violation (ON DELETE RESTRICT): Cannot delete truck ${truck.license_plate} because it is referenced by trip ${linkedTrip.origin} to ${linkedTrip.destination}.`
      );
    }
    const linkedServiceRecord = this.truckServiceRecords.find((record) => record.truck_id === id);
    if (linkedServiceRecord) {
      throw new Error(
        `Foreign Key Constraint Violation: Cannot delete truck ${truck.license_plate} because it has service history.`
      );
    }

    this.trucks = this.trucks.filter((t) => t.id !== id);
    this.recordAudit('deleted truck', 'truck', id, `Deleted truck ${truck.license_plate} (${truck.model}).`, truck);
  }


  // --- DRIVERS (CRUD & FK integrity) ---
  public getDrivers(): Driver[] {
    return [...this.drivers];
  }

  public getDriver(id: string): Driver | undefined {
    return this.drivers.find((d) => d.id === id);
  }

  private readDriverFields(data: Partial<Omit<Driver, 'id' | 'created_at' | 'updated_at'>>, partial: boolean): Partial<Driver> {
    const fields: Partial<Driver> = {};
    if (!partial || data.full_name !== undefined) fields.full_name = requireText(data.full_name, 'Driver name', 120);
    if (!partial || data.license_number !== undefined) {
      fields.license_number = requireText(data.license_number, 'License number', 40).toUpperCase();
    }
    if (!partial || data.phone !== undefined) fields.phone = requireText(data.phone, 'Phone number', 40);
    if (!partial || data.status !== undefined) {
      const status = data.status ?? 'Available';
      if (!DRIVER_STATUSES.includes(status)) throw new Error('Select a valid driver status.');
      fields.status = status;
    }
    if (!partial || data.experience_years !== undefined) {
      fields.experience_years = optionalInteger(data.experience_years, 'Experience', 0, 80) ?? 0;
    }
    return fields;
  }

  public createDriver(driverData: Omit<Driver, 'id' | 'created_at' | 'updated_at'>): Driver {
    const fields = this.readDriverFields(driverData, false);
    if (fields.status === 'On Trip') {
      throw new Error('A new driver cannot start as On Trip. Assign them to a trip instead.');
    }
    const existing = this.drivers.find((d) => d.license_number.toUpperCase().trim() === fields.license_number);
    if (existing) {
      throw new Error(`UNIQUE Constraint Error: Driver license number '${fields.license_number}' already exists.`);
    }

    const now = this.nowIso();
    const newDriver = {
      ...fields,
      id: this.newId(),
      created_at: now,
      updated_at: now,
    } as Driver;
    this.drivers.unshift(newDriver);
    this.recordAudit('created driver', 'driver', newDriver.id, `Added driver ${newDriver.full_name} (${newDriver.license_number}).`, newDriver);
    return newDriver;
  }

  public updateDriver(id: string, updates: Partial<Omit<Driver, 'id' | 'created_at'>>): Driver {
    const index = this.drivers.findIndex((d) => d.id === id);
    if (index === -1) throw new Error(`Driver ${id} not found.`);
    const previous = this.drivers[index];
    const fields = this.readDriverFields(updates, true);
    const hasOngoingTrip = this.trips.some((trip) => trip.driver_id === id && trip.status === 'Ongoing');

    if (fields.status !== undefined && fields.status !== previous.status) {
      if (fields.status === 'On Trip') {
        throw new Error('On Trip is set automatically when the driver is assigned to a trip.');
      }
      if (hasOngoingTrip) {
        throw new Error(`${previous.full_name} is on an ongoing trip. Complete the trip before changing their status.`);
      }
    }

    if (fields.license_number) {
      const duplicate = this.drivers.find(
        (d) => d.id !== id && d.license_number.toUpperCase().trim() === fields.license_number
      );
      if (duplicate) {
        throw new Error(`UNIQUE Constraint Error: License number '${fields.license_number}' already exists.`);
      }
    }

    const updated: Driver = { ...previous, ...fields };
    const changed = changedFields(previous, updated);
    if (changed.length === 0) return previous;
    updated.updated_at = this.nowIso();
    this.drivers[index] = updated;
    this.recordAudit(
      'updated driver',
      'driver',
      id,
      `Updated driver ${updated.full_name}; changed ${changed.join(', ')}.`,
      {
        before: Object.fromEntries(changed.map((key) => [key, previous[key]])),
        after: Object.fromEntries(changed.map((key) => [key, updated[key]])),
      },
    );
    return updated;
  }

  public deleteDriver(id: string) {
    const driver = this.drivers.find((d) => d.id === id);
    if (!driver) throw new Error(`Driver ${id} not found.`);
    // Foreign Key Constraint Check: ON DELETE RESTRICT
    const linkedTrip = this.trips.find((trip) => trip.driver_id === id);
    if (linkedTrip) {
      throw new Error(
        `Foreign Key Constraint Violation (ON DELETE RESTRICT): Cannot delete driver ${driver.full_name} because they are referenced by trip ${linkedTrip.origin} to ${linkedTrip.destination}.`
      );
    }

    this.drivers = this.drivers.filter((d) => d.id !== id);
    this.recordAudit('deleted driver', 'driver', id, `Deleted driver ${driver.full_name} (${driver.license_number}).`, driver);
  }


  // --- TRIPS (Associations, Status, Dynamic Logs, Budget) ---
  public getTrips(): Trip[] {
    return [...this.trips];
  }

  public getEnrichedTrips(): EnrichedTrip[] {
    return this.trips.map((trip) => {
      const truck = this.trucks.find((t) => t.id === trip.truck_id);
      const driver = this.drivers.find((d) => d.id === trip.driver_id);
      const expenses = this.expenses.filter((e) => e.trip_id === trip.id);
      const spare_parts = this.spareParts.filter((sp) => sp.trip_id === trip.id);

      const total_expenses =
        trip.status === 'Completed' && trip.total_expenses_cost !== undefined
          ? Number(trip.total_expenses_cost)
          : expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      const total_spare_parts =
        trip.status === 'Completed' && trip.total_spare_parts_cost !== undefined
          ? Number(trip.total_spare_parts_cost)
          : spare_parts.reduce((sum, sp) => sum + Number(sp.price), 0);

      const driver_pay = Number(trip.driver_pay) || 0;
      const total_spent = total_expenses + total_spare_parts + driver_pay;
      const budget = Number(trip.budget_allocated) || 0;
      const remaining_budget = budget - total_spent;
      const budget_utilization_pct = budget > 0 ? (total_spent / budget) * 100 : 0;
      const is_over_budget = total_spent > budget;

      // Legacy finalized calculation: budget estimate minus driver pay and recorded trip costs.
      const profit_loss =
        trip.final_profit_loss !== undefined
          ? Number(trip.final_profit_loss)
          : budget - (driver_pay + total_expenses + total_spare_parts);

      const financial_flag: 'Profitable' | 'Loss' =
        trip.financial_flag ?? (profit_loss >= 0 ? 'Profitable' : 'Loss');

      return {
        ...trip,
        truck,
        driver,
        expenses,
        spare_parts,
        driver_pay,
        total_expenses,
        total_spare_parts,
        total_spent,
        remaining_budget,
        budget_utilization_pct,
        is_over_budget,
        profit_loss,
        financial_flag,
      };
    });
  }

  public getEnrichedTrip(id: string): EnrichedTrip | undefined {
    return this.getEnrichedTrips().find((t) => t.id === id);
  }

  public createTrip(payload: CreateTripPayload): Trip {
    // 1. Validate required fields
    if (!payload.origin?.trim()) {
      throw new Error('Trip Origin is required.');
    }
    if (!payload.destination?.trim()) {
      throw new Error('Trip Destination is required.');
    }
    if (!payload.scheduled_start) {
      throw new Error('Scheduled Start departure date is required.');
    }
    if (!payload.scheduled_end) {
      throw new Error('Scheduled End arrival date is required.');
    }

    const startDate = new Date(payload.scheduled_start).getTime();
    const endDate = new Date(payload.scheduled_end).getTime();
    if (isNaN(startDate) || isNaN(endDate)) {
      throw new Error('Invalid scheduled start or end date format.');
    }
    if (endDate < startDate) {
      throw new Error('Scheduled End Date cannot be earlier than Scheduled Start Date.');
    }

    // 2. Validate monetary amounts
    const budgetNum = requireWholeAmount(payload.budget_allocated, 'Budget Allocated');

    const driverPayNum = requireWholeAmount(payload.driver_pay, 'Driver Pay', { allowZero: true });

    // 3. Double-Booking Prevention & Referential Integrity
    const truck = this.trucks.find((t) => t.id === payload.truck_id);
    if (!truck) {
      throw new Error(`Referential Error: Selected Truck ID '${payload.truck_id}' does not exist.`);
    }
    if (truck.status !== 'Available') {
      throw new Error(
        `Double-Booking Prevention: Truck '${truck.license_plate}' (${truck.model}) is currently '${truck.status}' and cannot be dispatched.`
      );
    }

    const driver = this.drivers.find((d) => d.id === payload.driver_id);
    if (!driver) {
      throw new Error(`Referential Error: Selected Driver ID '${payload.driver_id}' does not exist.`);
    }
    if (driver.status !== 'Available') {
      throw new Error(
        `Double-Booking Prevention: Driver '${driver.full_name}' is currently '${driver.status}' and cannot be dispatched.`
      );
    }

    // 4. Validate initial expenses if provided
    if (payload.initial_expenses && payload.initial_expenses.length > 0) {
      for (let i = 0; i < payload.initial_expenses.length; i++) {
        const exp = payload.initial_expenses[i];
        if (!EXPENSE_TYPES.includes(exp.expense_type)) {
          throw new Error(`Initial expense #${i + 1} must have a valid Expense Type.`);
        }
        const expAmount = Number(exp.amount);
        if (!Number.isInteger(expAmount) || expAmount <= 0) {
          throw new Error(`Initial expense #${i + 1} (${exp.expense_type}): Amount must be a whole amount greater than Tsh 0.`);
        }
      }
    }

    // 5. Validate initial spare parts if provided
    if (payload.initial_spare_parts && payload.initial_spare_parts.length > 0) {
      for (let i = 0; i < payload.initial_spare_parts.length; i++) {
        const sp = payload.initial_spare_parts[i];
        if (!sp.part_name?.trim()) {
          throw new Error(`Initial spare part #${i + 1} must have a Part / Service Name.`);
        }
        const spPrice = Number(sp.price);
        if (!Number.isInteger(spPrice) || spPrice < 0) {
          throw new Error(`Initial spare part #${i + 1} ('${sp.part_name}'): Price must be a whole amount of Tsh 0 or greater.`);
        }
      }
    }

    // 6. Instantiate the trip as planned; dispatch is a separate status transition.
    const now = this.nowIso();
    const tripId = this.newId();

    const newTrip: Trip = {
      id: tripId,
      truck_id: truck.id,
      driver_id: driver.id,
      status: 'Planned',
      origin: payload.origin.trim(),
      destination: payload.destination.trim(),
      scheduled_start: new Date(payload.scheduled_start).toISOString(),
      scheduled_end: new Date(payload.scheduled_end).toISOString(),
      budget_allocated: budgetNum,
      driver_pay: driverPayNum,
      cargo_type: payload.cargo_type?.trim() || 'General Cargo',
      notes: payload.notes?.trim() || '',
      delay_logs: [],
      created_at: now,
      updated_at: now,
    };

    this.trips.unshift(newTrip);

    // 7. Insert initial expenses (if any)
    if (payload.initial_expenses && payload.initial_expenses.length > 0) {
      for (const exp of payload.initial_expenses) {
        this.expenses.push({
          id: this.newId(),
          trip_id: tripId,
          expense_type: exp.expense_type,
          amount: Number(exp.amount),
          description: exp.description?.trim() || `Launch expense (${exp.expense_type})`,
          timestamp: now,
          created_at: now,
        });
      }
    }

    // 8. Insert initial spare parts (if any)
    if (payload.initial_spare_parts && payload.initial_spare_parts.length > 0) {
      for (const sp of payload.initial_spare_parts) {
        this.spareParts.push({
          id: this.newId(),
          trip_id: tripId,
          part_name: sp.part_name.trim(),
          price: Number(sp.price),
          description: sp.description?.trim() || 'Launch maintenance item',
          replaced_by: 'KAM Fleets Launch Inspection Depot',
          timestamp: now,
          created_at: now,
        });
      }
    }

    this.recordAudit(
      'created trip',
      'trip',
      tripId,
      `Created trip ${newTrip.origin} to ${newTrip.destination} with ${payload.initial_expenses?.length || 0} initial expenses and ${payload.initial_spare_parts?.length || 0} initial parts.`,
      {
        trip: newTrip,
        initial_expenses: payload.initial_expenses || [],
        initial_spare_parts: payload.initial_spare_parts || [],
      },
    );
    return newTrip;
  }

  public completeTrip(id: string): Trip {
    return this.updateTrip(id, { status: 'Completed' });
  }

  public updateTrip(id: string, updates: Partial<Omit<Trip, 'id' | 'created_at'>>): Trip {
    const index = this.trips.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Trip ${id} not found.`);

    const oldTrip = this.trips[index];

    // Prevent any further modifications or mid-trip updates to the trip once its status is marked as 'Completed'
    if (oldTrip.status === 'Completed') {
      throw new Error(
        `Forbidden: Trip ${id} is marked as Completed and finalized. No further modifications, mid-trip updates, or status changes are permitted.`
      );
    }
    updates = this.normalizeTripUpdates(oldTrip, updates);

    // Referential checks
    if (updates.truck_id && updates.truck_id !== oldTrip.truck_id) {
      const truck = this.trucks.find((t) => t.id === updates.truck_id);
      if (!truck) throw new Error(`Foreign Key Violation: Truck ID ${updates.truck_id} does not exist.`);
    }
    if (updates.driver_id && updates.driver_id !== oldTrip.driver_id) {
      const driver = this.drivers.find((d) => d.id === updates.driver_id);
      if (!driver) throw new Error(`Foreign Key Violation: Driver ID ${updates.driver_id} does not exist.`);
    }

    const newStatus = updates.status || oldTrip.status;
    const effectiveTruckId = updates.truck_id || oldTrip.truck_id;
    const effectiveDriverId = updates.driver_id || oldTrip.driver_id;

    let completionCalculations: Partial<Trip> = {};

    // Handle status transitions
    if (updates.status && updates.status !== oldTrip.status) {
      if (newStatus === 'Ongoing') {
        const truck = this.trucks.find((item) => item.id === effectiveTruckId);
        const driver = this.drivers.find((item) => item.id === effectiveDriverId);
        if (!truck || truck.status !== 'Available') {
          throw new Error('The assigned truck must be Available before the trip can start.');
        }
        if (!driver || driver.status !== 'Available') {
          throw new Error('The assigned driver must be Available before the trip can start.');
        }
        this.updateTruckStatusInternal(effectiveTruckId, 'On Trip');
        this.updateDriverStatusInternal(effectiveDriverId, 'On Trip');
      } else if (newStatus === 'Completed') {
        // 1. Revert the assigned Truck and Driver statuses back to 'Available'
        this.updateTruckStatusInternal(effectiveTruckId, 'Available');
        this.updateDriverStatusInternal(effectiveDriverId, 'Available');

        // 2. Finalize the budget variance using the budget estimate and actual trip costs.
        const tripExpenses = this.expenses.filter((e) => e.trip_id === id);
        const tripSpareParts = this.spareParts.filter((sp) => sp.trip_id === id);
        const totalExpensesCost = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const totalSparePartsCost = tripSpareParts.reduce((sum, sp) => sum + Number(sp.price), 0);
        const budgetAllocated = Number(updates.budget_allocated ?? oldTrip.budget_allocated) || 0;
        const driverPay = Number(updates.driver_pay ?? oldTrip.driver_pay) || 0;

        const profitLoss = budgetAllocated - (driverPay + totalExpensesCost + totalSparePartsCost);

        // Keep legacy enum values for compatibility; UI describes these as within/over budget.
        const financialFlag: 'Profitable' | 'Loss' = profitLoss >= 0 ? 'Profitable' : 'Loss';

        // 3. Save the final financial result, Total Expenses, and Total Spare Parts Cost to the Trip record
        completionCalculations = {
          final_profit_loss: profitLoss,
          total_expenses_cost: totalExpensesCost,
          total_spare_parts_cost: totalSparePartsCost,
          financial_flag: financialFlag,
          completed_at: oldTrip.completed_at || this.nowIso(),
        };
      } else if (newStatus === 'Planned' && oldTrip.status === 'Ongoing') {
        this.updateTruckStatusInternal(effectiveTruckId, 'Available');
        this.updateDriverStatusInternal(effectiveDriverId, 'Available');
      }
    }

    if (oldTrip.status === 'Ongoing' && newStatus === 'Ongoing') {
      if (effectiveTruckId !== oldTrip.truck_id) {
        this.updateTruckStatusInternal(oldTrip.truck_id, 'Available');
        this.updateTruckStatusInternal(effectiveTruckId, 'On Trip');
      }
      if (effectiveDriverId !== oldTrip.driver_id) {
        this.updateDriverStatusInternal(oldTrip.driver_id, 'Available');
        this.updateDriverStatusInternal(effectiveDriverId, 'On Trip');
      }
    }

    this.trips[index] = {
      ...oldTrip,
      ...updates,
      ...completionCalculations,
      updated_at: this.nowIso(),
    };

    const auditUpdates: Partial<Trip> = { ...updates, ...completionCalculations };
    const changedTripFields = Object.keys(auditUpdates).filter(
      (key) => JSON.stringify(oldTrip[key as keyof Trip]) !== JSON.stringify(auditUpdates[key as keyof Trip]),
    );
    if (changedTripFields.length > 0) {
      this.recordAudit(
        updates.status === 'Completed' ? 'completed trip' : 'updated trip',
        'trip',
        id,
        `${updates.status === 'Completed' ? 'Completed' : 'Updated'} trip ${oldTrip.origin} to ${oldTrip.destination}; changed ${changedTripFields.join(', ')}.`,
        { before: Object.fromEntries(changedTripFields.map((key) => [key, oldTrip[key as keyof Trip]])), after: Object.fromEntries(changedTripFields.map((key) => [key, this.trips[index][key as keyof Trip]])) },
      );
    }
    return this.trips[index];
  }

  public deleteTrip(id: string) {
    const trip = this.trips.find((t) => t.id === id);
    if (!trip) return;
    if (this.invoices.some((invoice) => invoice.trip_id === id)) {
      throw new Error(`Cannot delete trip ${id} because it has invoice history. Delete is restricted to preserve accounting records.`);
    }
    const deletedExpenses = this.expenses.filter((expense) => expense.trip_id === id);
    const deletedSpareParts = this.spareParts.filter((part) => part.trip_id === id);

    // Reset truck and driver status if ongoing
    if (trip.status === 'Ongoing') {
      this.updateTruckStatusInternal(trip.truck_id, 'Available');
      this.updateDriverStatusInternal(trip.driver_id, 'Available');
    }

    // ON DELETE CASCADE: Delete associated expenses & spare parts
    this.expenses = this.expenses.filter((e) => e.trip_id !== id);
    this.spareParts = this.spareParts.filter((sp) => sp.trip_id !== id);
    this.trips = this.trips.filter((t) => t.id !== id);

    this.recordAudit(
      'deleted trip',
      'trip',
      id,
      `Deleted trip ${trip.origin} to ${trip.destination}, ${deletedExpenses.length} expenses, and ${deletedSpareParts.length} parts.`,
      { trip, expenses: deletedExpenses, spare_parts: deletedSpareParts },
    );
  }

  // --- DYNAMIC DELAY LOGS (Dynamic logs with timestamps) ---
  public addDelayLog(tripId: string, logData: Omit<DelayLog, 'id' | 'trip_id' | 'timestamp'> & { timestamp?: string }): DelayLog {
    const tripIndex = this.trips.findIndex((t) => t.id === tripId);
    if (tripIndex === -1) throw new Error(`Trip ${tripId} not found.`);

    if (this.trips[tripIndex].status === 'Completed') {
      throw new Error(`Forbidden: Trip ${tripId} is marked as Completed. No further delays can be documented.`);
    }

    const newLog: DelayLog = {
      id: this.newId(),
      trip_id: tripId,
      reason: requireText(logData.reason, 'Delay reason', 500),
      severity: requireSeverity(logData.severity),
      location: optionalText(logData.location, 'Delay location', 200) || undefined,
      duration_minutes: requireMinutes(logData.duration_minutes),
      timestamp: logData.timestamp ? requireDate(logData.timestamp, 'Delay time') : this.nowIso(),
    };

    this.trips[tripIndex].delay_logs = [
      newLog,
      ...(this.trips[tripIndex].delay_logs || []),
    ];
    this.trips[tripIndex].updated_at = this.nowIso();

    this.recordAudit('added trip delay', 'trip', tripId, `Added a ${newLog.severity.toLowerCase()} delay: ${newLog.reason}.`, newLog);
    return newLog;
  }

  public removeDelayLog(tripId: string, logId: string) {
    const tripIndex = this.trips.findIndex((t) => t.id === tripId);
    if (tripIndex === -1) return;

    if (this.trips[tripIndex].status === 'Completed') {
      throw new Error(`Forbidden: Trip ${tripId} is marked as Completed. Delay records are locked.`);
    }

    const removedLog = this.trips[tripIndex].delay_logs.find((log) => log.id === logId);
    this.trips[tripIndex].delay_logs = (this.trips[tripIndex].delay_logs || []).filter((l) => l.id !== logId);
    this.trips[tripIndex].updated_at = this.nowIso();
    if (removedLog) this.recordAudit('removed trip delay', 'trip', tripId, `Removed delay record: ${removedLog.reason}.`, removedLog);
  }

  // --- EXPENSES (Trip ID, Type, Amount, Description, Timestamp) ---
  public getExpenses(tripId?: string): Expense[] {
    if (tripId) {
      return this.expenses.filter((e) => e.trip_id === tripId);
    }
    return [...this.expenses];
  }

  public createExpense(data: Omit<Expense, 'id' | 'created_at' | 'timestamp'> & { timestamp?: string }): Expense {
    // Foreign key check
    const trip = this.trips.find((t) => t.id === data.trip_id);
    if (!trip) throw new Error(`Foreign Key Violation: Trip ID ${data.trip_id} does not exist.`);

    if (trip.status === 'Completed') {
      throw new Error(`Forbidden: Cannot add mid-trip expenses to completed trip ${data.trip_id}. Trip records are finalized and locked.`);
    }

    requireWholeAmount(data.amount, 'Expense amount');
    requireExpenseType(data.expense_type);
    if (data.timestamp && !Number.isFinite(new Date(data.timestamp).getTime())) {
      throw new Error('Validation Error: Expense date and time must be valid.');
    }

    const now = this.nowIso();
    const newExpense: Expense = {
      trip_id: trip.id,
      expense_type: data.expense_type,
      description: optionalText(data.description, 'Expense description', 500) ?? '',
      id: this.newId(),
      amount: Number(data.amount),
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : now,
      created_at: now,
    };

    this.expenses.unshift(newExpense);
    this.recordAudit('created expense', 'expense', newExpense.id, `Recorded ${newExpense.expense_type} expense of Tsh ${newExpense.amount} for trip ${trip.id}.`, newExpense, trip.id);
    return newExpense;
  }

  public deleteExpense(id: string) {
    const exp = this.expenses.find((e) => e.id === id);
    if (exp) {
      const trip = this.trips.find((t) => t.id === exp.trip_id);
      if (trip && trip.status === 'Completed') {
        throw new Error(`Forbidden: Cannot delete expenses from completed trip ${trip.id}. Trip records are locked.`);
      }
    }

    if (exp) {
      this.recordAudit('deleted expense', 'expense', id, `Deleted ${exp.expense_type} expense of Tsh ${exp.amount} from trip ${exp.trip_id}.`, exp, exp.trip_id);
    }
    this.expenses = this.expenses.filter((e) => e.id !== id);
  }

  // --- SPARE PARTS (Trip ID, Part Name, Price, Description, Timestamp) ---
  public getSpareParts(tripId?: string): SparePart[] {
    if (tripId) {
      return this.spareParts.filter((sp) => sp.trip_id === tripId);
    }
    return [...this.spareParts];
  }

  public createSparePart(data: Omit<SparePart, 'id' | 'created_at' | 'timestamp'> & { timestamp?: string }): SparePart {
    // Foreign key check
    const trip = this.trips.find((t) => t.id === data.trip_id);
    if (!trip) throw new Error(`Foreign Key Violation: Trip ID ${data.trip_id} does not exist.`);

    if (trip.status === 'Completed') {
      throw new Error(`Forbidden: Cannot add roadside spare parts to completed trip ${data.trip_id}. Trip records are finalized and locked.`);
    }

    requireWholeAmount(data.price, 'Spare part price', { allowZero: true });
    requireText(data.part_name, 'Part / service name', 200);
    if (data.timestamp && !Number.isFinite(new Date(data.timestamp).getTime())) {
      throw new Error('Validation Error: Spare part date and time must be valid.');
    }

    const now = this.nowIso();
    const newPart: SparePart = {
      trip_id: trip.id,
      part_name: data.part_name.trim(),
      description: optionalText(data.description, 'Spare part description', 500) ?? '',
      replaced_by: optionalText(data.replaced_by, 'Replaced by', 200) || undefined,
      id: this.newId(),
      price: Number(data.price),
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : now,
      created_at: now,
    };

    this.spareParts.unshift(newPart);
    this.recordAudit('created spare part', 'spare part', newPart.id, `Recorded ${newPart.part_name} costing Tsh ${newPart.price} for trip ${trip.id}.`, newPart, trip.id);
    return newPart;
  }

  public deleteSparePart(id: string) {
    const sp = this.spareParts.find((p) => p.id === id);
    if (sp) {
      const trip = this.trips.find((t) => t.id === sp.trip_id);
      if (trip && trip.status === 'Completed') {
        throw new Error(`Forbidden: Cannot delete spare parts from completed trip ${trip.id}. Trip records are locked.`);
      }
    }

    if (sp) {
      this.recordAudit('deleted spare part', 'spare part', id, `Deleted ${sp.part_name} costing Tsh ${sp.price} from trip ${sp.trip_id}.`, sp, sp.trip_id);
    }
    this.spareParts = this.spareParts.filter((sp) => sp.id !== id);
  }

  // --- CORRECTIONS (expenses, parts, invoices, payments) ---
  private requireOpenTrip(tripId: string, recordLabel: string) {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error(`Foreign Key Violation: Trip ID ${tripId} does not exist.`);
    if (trip.status === 'Completed') {
      throw new Error(`Forbidden: Trip ${trip.origin} to ${trip.destination} is completed; its ${recordLabel} are locked.`);
    }
    return trip;
  }

  public updateExpense(
    id: string,
    updates: Pick<Expense, 'expense_type' | 'amount' | 'description'> & { timestamp?: string },
  ): Expense {
    const index = this.expenses.findIndex((expense) => expense.id === id);
    if (index === -1) throw new Error(`Expense ${id} not found.`);
    const previous = this.expenses[index];
    this.requireOpenTrip(previous.trip_id, 'expenses');
    const updated: Expense = {
      ...previous,
      expense_type: requireExpenseType(updates.expense_type),
      amount: requireWholeAmount(updates.amount, 'Expense amount'),
      description: optionalText(updates.description, 'Expense description', 500) ?? '',
      timestamp: updates.timestamp ? requireDate(updates.timestamp, 'Expense date') : previous.timestamp,
    };
    const changed = changedFields(previous, updated);
    if (changed.length === 0) return previous;
    this.expenses[index] = updated;
    this.recordAudit(
      'updated expense',
      'expense',
      id,
      `Updated ${updated.expense_type} expense on trip ${updated.trip_id}; changed ${changed.join(', ')}.`,
      { before: previous, after: updated },
      updated.trip_id,
    );
    return updated;
  }

  public updateSparePart(
    id: string,
    updates: Pick<SparePart, 'part_name' | 'price' | 'description'> & { replaced_by?: string; timestamp?: string },
  ): SparePart {
    const index = this.spareParts.findIndex((part) => part.id === id);
    if (index === -1) throw new Error(`Spare part ${id} not found.`);
    const previous = this.spareParts[index];
    this.requireOpenTrip(previous.trip_id, 'spare parts');
    const updated: SparePart = {
      ...previous,
      part_name: requireText(updates.part_name, 'Part / service name', 200),
      price: requireWholeAmount(updates.price, 'Spare part price', { allowZero: true }),
      description: optionalText(updates.description, 'Spare part description', 500) ?? '',
      replaced_by: optionalText(updates.replaced_by, 'Replaced by', 200) || undefined,
      timestamp: updates.timestamp ? requireDate(updates.timestamp, 'Spare part date') : previous.timestamp,
    };
    const changed = changedFields(previous, updated);
    if (changed.length === 0) return previous;
    this.spareParts[index] = updated;
    this.recordAudit(
      'updated spare part',
      'spare part',
      id,
      `Updated ${updated.part_name} on trip ${updated.trip_id}; changed ${changed.join(', ')}.`,
      { before: previous, after: updated },
      updated.trip_id,
    );
    return updated;
  }

  public voidInvoice(id: string, reason: string): Invoice {
    const index = this.invoices.findIndex((invoice) => invoice.id === id);
    if (index === -1) throw new Error(`Invoice ${id} not found.`);
    const invoice = this.invoices[index];
    if (invoice.voided_at) throw new Error(`Invoice ${invoice.invoice_number} is already void.`);
    const voidReason = requireText(reason, 'Void reason', 500);
    const activePayments = this.payments.filter((payment) => payment.invoice_id === id && !payment.reversed_at);
    if (activePayments.length > 0) {
      throw new Error(
        `Reverse the ${activePayments.length} recorded payment${activePayments.length === 1 ? '' : 's'} on ${invoice.invoice_number} before voiding it.`,
      );
    }
    const updated: Invoice = { ...invoice, voided_at: this.nowIso(), void_reason: voidReason };
    this.invoices[index] = updated;
    this.recordAudit(
      'voided invoice',
      'invoice',
      id,
      `Voided invoice ${invoice.invoice_number} (Tsh ${invoice.amount}): ${voidReason}`,
      { invoice: updated },
      invoice.trip_id,
    );
    return updated;
  }

  public reversePayment(id: string, reason: string): Payment {
    const index = this.payments.findIndex((payment) => payment.id === id);
    if (index === -1) throw new Error(`Payment ${id} not found.`);
    const payment = this.payments[index];
    if (payment.reversed_at) throw new Error('This payment has already been reversed.');
    const reversalReason = requireText(reason, 'Reversal reason', 500);
    const invoice = this.invoices.find((item) => item.id === payment.invoice_id);
    const updated: Payment = { ...payment, reversed_at: this.nowIso(), reversal_reason: reversalReason };
    this.payments[index] = updated;
    this.recordAudit(
      'reversed payment',
      'payment',
      id,
      `Reversed Tsh ${payment.amount} recorded against invoice ${invoice?.invoice_number || payment.invoice_id}: ${reversalReason}`,
      { payment: updated },
      invoice?.trip_id,
    );
    return updated;
  }

  private normalizeTripUpdates(oldTrip: Trip, updates: Partial<Omit<Trip, 'id' | 'created_at'>>): Partial<Trip> {
    const allowedKeys = [
      'truck_id',
      'driver_id',
      'status',
      'origin',
      'destination',
      'scheduled_start',
      'scheduled_end',
      'budget_allocated',
      'driver_pay',
      'cargo_type',
      'notes',
    ] as const;
    const next: Partial<Trip> = {};
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) (next as Record<string, unknown>)[key] = updates[key];
    }
    if (next.status !== undefined && !TRIP_STATUSES.includes(next.status)) throw new Error('Select a valid trip status.');
    if (next.origin !== undefined) next.origin = requireText(next.origin, 'Trip Origin', 200);
    if (next.destination !== undefined) next.destination = requireText(next.destination, 'Trip Destination', 200);
    if (next.cargo_type !== undefined) next.cargo_type = optionalText(next.cargo_type, 'Cargo type', 120) || 'General Cargo';
    if (next.notes !== undefined) next.notes = optionalText(next.notes, 'Trip notes', 2000) ?? '';
    if (next.scheduled_start !== undefined) next.scheduled_start = requireDate(next.scheduled_start, 'Scheduled start');
    if (next.scheduled_end !== undefined) next.scheduled_end = requireDate(next.scheduled_end, 'Scheduled end');
    const start = new Date(next.scheduled_start ?? oldTrip.scheduled_start).getTime();
    const end = new Date(next.scheduled_end ?? oldTrip.scheduled_end).getTime();
    if (end < start) throw new Error('Scheduled End Date cannot be earlier than Scheduled Start Date.');
    if (next.budget_allocated !== undefined) next.budget_allocated = requireWholeAmount(next.budget_allocated, 'Budget Allocated');
    if (next.driver_pay !== undefined) next.driver_pay = requireWholeAmount(next.driver_pay, 'Driver Pay', { allowZero: true });

    const truckChanged = next.truck_id !== undefined && next.truck_id !== oldTrip.truck_id;
    const driverChanged = next.driver_id !== undefined && next.driver_id !== oldTrip.driver_id;
    const statusChanged = next.status !== undefined && next.status !== oldTrip.status;
    if ((truckChanged || driverChanged) && oldTrip.status !== 'Planned') {
      throw new Error('The truck and driver can only be changed before the trip starts.');
    }
    if ((truckChanged || driverChanged) && statusChanged) {
      throw new Error('Change the trip status separately from reassigning its truck or driver.');
    }
    const targetStatus = next.status ?? oldTrip.status;
    const truck = this.trucks.find((t) => t.id === (next.truck_id ?? oldTrip.truck_id));
    const driver = this.drivers.find((d) => d.id === (next.driver_id ?? oldTrip.driver_id));
    if (truckChanged && !truck) throw new Error(`Foreign Key Violation: Truck ID ${next.truck_id} does not exist.`);
    if (driverChanged && !driver) throw new Error(`Foreign Key Violation: Driver ID ${next.driver_id} does not exist.`);
    const needsAvailableTruck = targetStatus === 'Ongoing' && (truckChanged || statusChanged);
    const needsAvailableDriver = targetStatus === 'Ongoing' && (driverChanged || statusChanged);
    if (needsAvailableTruck && truck && truck.status !== 'Available') {
      throw new Error(`Double-Booking Prevention: Truck '${truck.license_plate}' is currently '${truck.status}' and cannot be dispatched.`);
    }
    if (needsAvailableDriver && driver && driver.status !== 'Available') {
      throw new Error(`Double-Booking Prevention: Driver '${driver.full_name}' is currently '${driver.status}' and cannot be dispatched.`);
    }
    return next;
  }


  // --- STATS & KPIS ---
  public getStats(): DatabaseStats {
    const totalTrucks = this.trucks.length;
    const availableTrucks = this.trucks.filter((t) => t.status === 'Available').length;
    const onTripTrucks = this.trucks.filter((t) => t.status === 'On Trip').length;
    const maintenanceTrucks = this.trucks.filter((t) => t.status === 'Maintenance').length;

    const totalDrivers = this.drivers.length;
    const availableDrivers = this.drivers.filter((d) => d.status === 'Available').length;

    const totalTrips = this.trips.length;
    const ongoingTrips = this.trips.filter((t) => t.status === 'Ongoing').length;
    const completedTrips = this.trips.filter((t) => t.status === 'Completed').length;
    const plannedTrips = this.trips.filter((t) => t.status === 'Planned').length;

    const totalBudgetAllocated = this.trips.reduce((sum, t) => sum + (Number(t.budget_allocated) || 0), 0);
    const totalActualExpenses = this.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalSparePartsCost = this.spareParts.reduce((sum, sp) => sum + (Number(sp.price) || 0), 0);
    const budgetLessExpensesAndParts = totalBudgetAllocated - (totalActualExpenses + totalSparePartsCost);

    const completedTripsList = this.trips.filter((t) => t.status === 'Completed');
    const totalFinalizedBudgetVariance = completedTripsList.reduce(
      (sum, t) => sum + (Number(t.final_profit_loss) || 0),
      0
    );
    const withinBudgetTripsCount = completedTripsList.filter(
      (t) => t.financial_flag === 'Profitable' || (t.final_profit_loss !== undefined && Number(t.final_profit_loss) >= 0)
    ).length;
    const overBudgetTripsCount = completedTripsList.filter(
      (t) => t.financial_flag === 'Loss' || (t.final_profit_loss !== undefined && Number(t.final_profit_loss) < 0)
    ).length;

    return {
      totalTrucks,
      availableTrucks,
      onTripTrucks,
      maintenanceTrucks,
      totalDrivers,
      availableDrivers,
      totalTrips,
      ongoingTrips,
      completedTrips,
      plannedTrips,
      totalBudgetAllocated,
      totalActualExpenses,
      totalSparePartsCost,
      budgetLessExpensesAndParts,
      totalFinalizedBudgetVariance,
      withinBudgetTripsCount,
      overBudgetTripsCount,
    };
  }

  // Internal helpers
  protected updateTruckStatusInternal(truckId: string, status: TruckStatus) {
    const idx = this.trucks.findIndex((t) => t.id === truckId);
    if (idx !== -1) {
      this.trucks[idx] = {
        ...this.trucks[idx],
        status,
        updated_at: this.nowIso(),
      };
    }
  }

  protected updateDriverStatusInternal(driverId: string, status: DriverStatus) {
    const idx = this.drivers.findIndex((d) => d.id === driverId);
    if (idx !== -1) {
      this.drivers[idx] = {
        ...this.drivers[idx],
        status,
        updated_at: this.nowIso(),
      };
    }
  }
}