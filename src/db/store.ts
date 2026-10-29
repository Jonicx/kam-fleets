import { TruckServiceRecord } from '../types/database.ts';
import {
  INITIAL_TRUCKS,
  INITIAL_DRIVERS,
  INITIAL_TRIPS,
  INITIAL_EXPENSES,
  INITIAL_SPARE_PARTS,
  INITIAL_TRUCK_SERVICE_RECORDS,
} from './initialData.ts';
import {
  AppRole,
  CommandRecord,
  DatabaseSnapshot,
  DEFAULT_AUDIT_ACTOR,
  FleetDomain,
  MAX_AUDIT_LOGS,
} from './domain.ts';

export type { DatabaseSnapshot, AppRole, CommandRecord } from './domain.ts';

const STORAGE_KEY_PREFIX = 'kam_fleets_db_v1_';
const LEGACY_STORAGE_KEY_PREFIX = 'jcq_fleet_db_v1_';
const POLL_INTERVAL_MS = 15_000;
const MAX_RETRY_DELAY_MS = 60_000;

export interface RemoteState {
  version: number;
  snapshot: DatabaseSnapshot;
}

export interface RemoteBackend {
  /** Returns null when the server has nothing newer than `sinceVersion`. */
  loadState: (sinceVersion: number) => Promise<RemoteState | null>;
  sendCommand: (record: CommandRecord) => Promise<RemoteState>;
}

export interface RemoteSession {
  role: AppRole;
  actorName: string;
  onError: (message: string) => void;
}

/** Thrown by a backend when the server rejected a command (validation or permission), so retrying will not help. */
export class CommandRejectedError extends Error {}

export type SyncStatus = 'local' | 'synced' | 'syncing' | 'offline';

class DatabaseStore extends FleetDomain {
  private listeners: Set<() => void> = new Set();
  private storageKeySuffix = '';
  private remote?: RemoteBackend;
  private session?: RemoteSession;
  private pendingCommands: CommandRecord[] = [];
  private remoteVersion = 0;
  private syncStatus: SyncStatus = 'local';
  private flushing = false;
  private retryDelayMs = 2_000;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private readonly handleWake = () => {
    void this.refresh();
  };

  constructor() {
    super();
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (
          event.key?.startsWith(`${STORAGE_KEY_PREFIX}${this.storageKeySuffix}`) ||
          event.key?.startsWith(`${LEGACY_STORAGE_KEY_PREFIX}${this.storageKeySuffix}`)
        ) {
          this.loadFromStorage();
          this.notify();
        }
      });
    }
  }

  private storageKey(key: string) {
    return `${STORAGE_KEY_PREFIX}${this.storageKeySuffix}${key}`;
  }

  private readStorageValue(key: string) {
    return localStorage.getItem(this.storageKey(key)) ??
      localStorage.getItem(`${LEGACY_STORAGE_KEY_PREFIX}${this.storageKeySuffix}${key}`);
  }

  private readStored<T>(key: string, fallback: T): T {
    const stored = this.readStorageValue(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  }

  private loadFromStorage() {
    const sample = !this.storageKeySuffix;
    try {
      this.trucks = this.readStored('trucks', sample ? [...INITIAL_TRUCKS] : []);
      const savedServiceRecords = this.readStored<TruckServiceRecord[]>('truck_service_records', []);
      this.truckServiceRecords = savedServiceRecords.length > 0 || !sample
        ? savedServiceRecords
        : [...INITIAL_TRUCK_SERVICE_RECORDS];
      this.drivers = this.readStored('drivers', sample ? [...INITIAL_DRIVERS] : []);
      this.trips = this.readStored('trips', sample ? [...INITIAL_TRIPS] : []);
      this.expenses = this.readStored('expenses', sample ? [...INITIAL_EXPENSES] : []);
      this.spareParts = this.readStored('spare_parts', sample ? [...INITIAL_SPARE_PARTS] : []);
      this.invoices = this.readStored('invoices', []);
      this.payments = this.readStored('payments', []);
      this.auditLogs = this.readStored('audit_logs', []);
      this.pendingCommands = this.readStored('pending_commands', []);
      this.remoteVersion = this.readStored('remote_version', 0);
      if (!this.session) {
        this.auditActor = this.readStorageValue('audit_actor')?.trim() || DEFAULT_AUDIT_ACTOR;
      }
    } catch {
      this.trucks = sample ? [...INITIAL_TRUCKS] : [];
      this.truckServiceRecords = sample ? [...INITIAL_TRUCK_SERVICE_RECORDS] : [];
      this.drivers = sample ? [...INITIAL_DRIVERS] : [];
      this.trips = sample ? [...INITIAL_TRIPS] : [];
      this.expenses = sample ? [...INITIAL_EXPENSES] : [];
      this.spareParts = sample ? [...INITIAL_SPARE_PARTS] : [];
      this.invoices = [];
      this.payments = [];
      this.auditLogs = [];
      this.pendingCommands = [];
      this.remoteVersion = 0;
    }
  }

  private writeToLocalStorage() {
    try {
      localStorage.setItem(this.storageKey('trucks'), JSON.stringify(this.trucks));
      localStorage.setItem(this.storageKey('truck_service_records'), JSON.stringify(this.truckServiceRecords));
      localStorage.setItem(this.storageKey('drivers'), JSON.stringify(this.drivers));
      localStorage.setItem(this.storageKey('trips'), JSON.stringify(this.trips));
      localStorage.setItem(this.storageKey('expenses'), JSON.stringify(this.expenses));
      localStorage.setItem(this.storageKey('spare_parts'), JSON.stringify(this.spareParts));
      localStorage.setItem(this.storageKey('invoices'), JSON.stringify(this.invoices));
      localStorage.setItem(this.storageKey('payments'), JSON.stringify(this.payments));
      localStorage.setItem(this.storageKey('audit_logs'), JSON.stringify(this.auditLogs));
      localStorage.setItem(this.storageKey('pending_commands'), JSON.stringify(this.pendingCommands));
      localStorage.setItem(this.storageKey('remote_version'), JSON.stringify(this.remoteVersion));
      if (!this.session) localStorage.setItem(this.storageKey('audit_actor'), this.auditActor);
    } catch (e) {
      console.error('Failed to persist to localStorage', e);
    }
  }

  protected afterCommand(record: CommandRecord) {
    if (this.remote) {
      this.pendingCommands.push(record);
      this.setSyncStatus('syncing');
    }
    this.writeToLocalStorage();
    this.notify();
    if (this.remote) void this.flush();
  }

  private setSyncStatus(status: SyncStatus) {
    if (this.syncStatus === status) return;
    this.syncStatus = status;
    this.notify();
  }

  private applyRemoteState(state: RemoteState) {
    this.remoteVersion = state.version;
    this.applySnapshot({ ...state.snapshot, auditActor: this.auditActor });
    this.writeToLocalStorage();
    this.notify();
  }

  private scheduleRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.pendingCommands.length > 0) void this.flush();
      else void this.refresh();
    }, this.retryDelayMs);
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
  }

  private async flush() {
    if (this.flushing || !this.remote) return;
    this.flushing = true;
    try {
      while (this.remote && this.pendingCommands.length > 0) {
        const record = this.pendingCommands[0];
        this.setSyncStatus('syncing');
        try {
          const state = await this.remote.sendCommand(record);
          this.pendingCommands.shift();
          this.retryDelayMs = 2_000;
          if (this.pendingCommands.length === 0) this.applyRemoteState(state);
          else this.writeToLocalStorage();
        } catch (error) {
          if (error instanceof CommandRejectedError) {
            this.pendingCommands.shift();
            this.session?.onError(`A change was not saved: ${error.message}`);
            if (this.pendingCommands.length === 0) {
              const state = await this.remote.loadState(0).catch(() => null);
              if (state) this.applyRemoteState(state);
            }
            continue;
          }
          console.error('Failed to sync with Neon', error);
          this.setSyncStatus('offline');
          this.scheduleRetry();
          return;
        }
      }
      if (this.remote) this.setSyncStatus('synced');
    } finally {
      this.flushing = false;
    }
  }

  /** Pulls the latest shared team data (no-op while local changes are still being sent). */
  public async refresh() {
    if (!this.remote) return;
    if (this.pendingCommands.length > 0) {
      await this.flush();
      return;
    }
    try {
      const state = await this.remote.loadState(this.remoteVersion);
      if (state && this.pendingCommands.length === 0) this.applyRemoteState(state);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      this.retryDelayMs = 2_000;
      this.setSyncStatus('synced');
    } catch (error) {
      console.error('Failed to refresh from Neon', error);
      this.setSyncStatus('offline');
      this.scheduleRetry();
    }
  }

  public async connectRemote(userId: string, backend: RemoteBackend, session: RemoteSession) {
    this.disconnectRemote();
    this.session = session;
    this.auditActor = session.actorName;
    this.storageKeySuffix = `team_${encodeURIComponent(userId)}_`;
    this.loadFromStorage();
    this.remote = backend;
    if (typeof window !== 'undefined') {
      this.pollTimer = setInterval(this.handleWake, POLL_INTERVAL_MS);
      window.addEventListener('focus', this.handleWake);
      window.addEventListener('online', this.handleWake);
    }
    if (this.pendingCommands.length > 0) await this.flush();
    if (this.pendingCommands.length === 0) {
      try {
        const state = await backend.loadState(0);
        if (state) this.applyRemoteState(state);
        this.setSyncStatus('synced');
      } catch (error) {
        console.error('Failed to connect to Neon; continuing with saved local data', error);
        this.setSyncStatus('offline');
        this.scheduleRetry();
      }
    }
    this.notify();
  }

  public disconnectRemote() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pollTimer = undefined;
    this.retryTimer = undefined;
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWake);
      window.removeEventListener('online', this.handleWake);
    }
    this.remote = undefined;
    this.session = undefined;
    this.syncStatus = 'local';
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getRole(): AppRole {
    return this.session?.role ?? 'Admin';
  }

  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  public getPendingChangeCount(): number {
    return this.pendingCommands.length;
  }

  public isAuditActorVerified(): boolean {
    return Boolean(this.session);
  }

  public setAuditActor(actor: string): string {
    if (this.session) throw new Error('Audit attribution uses your signed-in account and cannot be changed here.');
    const normalizedActor = actor.trim();
    if (!normalizedActor) throw new Error('Operator name is required for audit attribution.');
    if (normalizedActor.length > 100) throw new Error('Operator name must be 100 characters or fewer.');
    const previousActor = this.auditActor;
    if (previousActor === normalizedActor) return this.auditActor;
    this.recordAudit(
      'updated operator attribution',
      'audit settings',
      'operator name',
      `Changed the locally recorded operator name from "${previousActor}" to "${normalizedActor}".`,
    );
    this.auditLogs = this.auditLogs.slice(0, MAX_AUDIT_LOGS);
    this.auditActor = normalizedActor;
    this.writeToLocalStorage();
    this.notify();
    return this.auditActor;
  }

  // --- INTERACTIVE SQL QUERY RUNNER FOR SCHEMA STUDIO ---
  public executeMockSql(query: string): { columns: string[]; rows: any[]; rowCount: number; executionTimeMs: number } {
    const startTime = performance.now();
    const clean = query.trim().replace(/;$/, '');
    const lower = clean.toLowerCase();

    let columns: string[] = [];
    let rows: any[] = [];

    if (lower.startsWith('select') && lower.includes('from trucks')) {
      columns = ['id', 'license_plate', 'model', 'status', 'year', 'capacity_tons', 'current_mileage'];
      rows = this.trucks.map((t) => ({
        id: t.id.slice(0, 8) + '...',
        license_plate: t.license_plate,
        model: t.model,
        status: t.status,
        year: t.year || 'N/A',
        capacity_tons: `${t.capacity_tons} T`,
        current_mileage: `${t.current_mileage?.toLocaleString()} km`,
      }));
    } else if (lower.startsWith('select') && lower.includes('from drivers')) {
      columns = ['id', 'full_name', 'license_number', 'phone', 'status', 'experience_years'];
      rows = this.drivers.map((d) => ({
        id: d.id.slice(0, 8) + '...',
        full_name: d.full_name,
        license_number: d.license_number,
        phone: d.phone,
        status: d.status,
        experience_years: `${d.experience_years} yrs`,
      }));
    } else if (lower.startsWith('select') && lower.includes('from trips') && lower.includes('join')) {
      // Joined trip report
      columns = ['trip_id', 'origin', 'destination', 'truck_plate', 'driver_name', 'status', 'budget_allocated', 'total_spent'];
      rows = this.getEnrichedTrips().map((t) => ({
        trip_id: t.id.slice(0, 8) + '...',
        origin: t.origin,
        destination: t.destination,
        truck_plate: t.truck?.license_plate || 'Unassigned',
        driver_name: t.driver?.full_name || 'Unassigned',
        status: t.status,
        budget_allocated: `$${t.budget_allocated.toLocaleString()}`,
        total_spent: `$${t.total_spent.toLocaleString()}`,
      }));
    } else if (lower.startsWith('select') && lower.includes('from trips')) {
      columns = ['id', 'truck_id', 'driver_id', 'origin', 'destination', 'status', 'budget_allocated'];
      rows = this.trips.map((t) => ({
        id: t.id.slice(0, 8) + '...',
        truck_id: t.truck_id.slice(0, 8) + '...',
        driver_id: t.driver_id.slice(0, 8) + '...',
        origin: t.origin,
        destination: t.destination,
        status: t.status,
        budget_allocated: `$${t.budget_allocated.toLocaleString()}`,
      }));
    } else if (lower.startsWith('select') && lower.includes('from expenses') && lower.includes('group by expense_type')) {
      columns = ['expense_type', 'transaction_count', 'total_amount'];
      const map: Record<string, { count: number; total: number }> = {};
      this.expenses.forEach((e) => {
        if (!map[e.expense_type]) map[e.expense_type] = { count: 0, total: 0 };
        map[e.expense_type].count += 1;
        map[e.expense_type].total += Number(e.amount);
      });
      rows = Object.entries(map).map(([type, data]) => ({
        expense_type: type,
        transaction_count: data.count,
        total_amount: `$${data.total.toFixed(2)}`,
      }));
    } else if (lower.startsWith('select') && lower.includes('from expenses')) {
      columns = ['id', 'trip_id', 'expense_type', 'amount', 'description', 'timestamp'];
      rows = this.expenses.map((e) => ({
        id: e.id.slice(0, 8) + '...',
        trip_id: e.trip_id.slice(0, 8) + '...',
        expense_type: e.expense_type,
        amount: `$${Number(e.amount).toFixed(2)}`,
        description: e.description || '-',
        timestamp: new Date(e.timestamp).toLocaleDateString(),
      }));
    } else if (lower.startsWith('select') && lower.includes('from spare_parts')) {
      columns = ['id', 'trip_id', 'part_name', 'price', 'replaced_by', 'timestamp'];
      rows = this.spareParts.map((sp) => ({
        id: sp.id.slice(0, 8) + '...',
        trip_id: sp.trip_id.slice(0, 8) + '...',
        part_name: sp.part_name,
        price: `$${Number(sp.price).toFixed(2)}`,
        replaced_by: sp.replaced_by || 'Field Workshop',
        timestamp: new Date(sp.timestamp).toLocaleDateString(),
      }));
    } else if (lower.startsWith('select') && lower.includes('from trip_delay_logs')) {
      columns = ['id', 'trip_id', 'reason', 'severity', 'duration_min', 'timestamp'];
      const allLogs = this.trips.flatMap((t) => t.delay_logs || []);
      rows = allLogs.map((l) => ({
        id: l.id.slice(0, 8) + '...',
        trip_id: l.trip_id.slice(0, 8) + '...',
        reason: l.reason,
        severity: l.severity,
        duration_min: `${l.duration_minutes || 0}m`,
        timestamp: new Date(l.timestamp).toLocaleString(),
      }));
    } else {
      // Default summary view
      columns = ['table_name', 'record_count', 'primary_key', 'foreign_keys', 'indexes'];
      rows = [
        {
          table_name: 'trucks',
          record_count: this.trucks.length,
          primary_key: 'id (UUID)',
          foreign_keys: 'None',
          indexes: 'PRIMARY, license_plate (UNIQUE)',
        },
        {
          table_name: 'drivers',
          record_count: this.drivers.length,
          primary_key: 'id (UUID)',
          foreign_keys: 'None',
          indexes: 'PRIMARY, license_number (UNIQUE)',
        },
        {
          table_name: 'trips',
          record_count: this.trips.length,
          primary_key: 'id (UUID)',
          foreign_keys: 'truck_id, driver_id',
          indexes: 'idx_trips_truck_id, idx_trips_driver_id, idx_trips_status',
        },
        {
          table_name: 'trip_delay_logs',
          record_count: this.trips.flatMap((t) => t.delay_logs || []).length,
          primary_key: 'id (UUID)',
          foreign_keys: 'trip_id (CASCADE)',
          indexes: 'idx_trip_delay_logs_trip_id, idx_trip_delay_logs_timestamp',
        },
        {
          table_name: 'expenses',
          record_count: this.expenses.length,
          primary_key: 'id (UUID)',
          foreign_keys: 'trip_id (CASCADE)',
          indexes: 'idx_expenses_trip_id, idx_expenses_type, idx_expenses_timestamp',
        },
        {
          table_name: 'spare_parts',
          record_count: this.spareParts.length,
          primary_key: 'id (UUID)',
          foreign_keys: 'trip_id (CASCADE)',
          indexes: 'idx_spare_parts_trip_id, idx_spare_parts_timestamp',
        },
      ];
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
    };
  }
}
export const dbStore = new DatabaseStore();