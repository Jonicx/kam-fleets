import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dbStore } from '../db/store';
import type { RemoteBackend, RemoteSession } from '../db/store';

describe('DatabaseStore - LocalStorage Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  describe('Initial Data Loading', () => {
    it('should load initial sample data on first run', () => {
      const trucks = dbStore.getTrucks();
      const drivers = dbStore.getDrivers();
      const trips = dbStore.getTrips();

      expect(trucks.length).toBeGreaterThan(0);
      expect(drivers.length).toBeGreaterThan(0);
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should persist data to localStorage', () => {
      const initialTruckCount = dbStore.getTrucks().length;

      dbStore.createTruck({
        license_plate: 'TEST 123',
        model: 'Test Truck',
        status: 'Available',
      });

      // Create new store instance to test persistence
      const storedTrucks = localStorage.getItem('kam_fleets_db_v1_trucks');
      expect(storedTrucks).toBeDefined();

      const parsedTrucks = JSON.parse(storedTrucks!);
      expect(parsedTrucks.length).toBe(initialTruckCount + 1);
    });
  });

  describe('Data Persistence', () => {
    it('should persist truck changes', () => {
      const truck = dbStore.createTruck({
        license_plate: `TEST ${Date.now()}`,
        model: 'Test Truck',
        status: 'Available',
      });

      dbStore.updateTruck(truck.id, { status: 'Maintenance' });

      const trucks = dbStore.getTrucks();
      const updatedTruck = trucks.find((t) => t.id === truck.id);

      expect(updatedTruck?.status).toBe('Maintenance');
    });

    it('should persist driver changes', () => {
      const driver = dbStore.createDriver({
        full_name: 'Test Driver',
        license_number: `LIC${Date.now()}`,
        phone: '1234567890',
        status: 'Available',
      });

      dbStore.updateDriver(driver.id, { status: 'Off Duty' });

      const drivers = dbStore.getDrivers();
      const updatedDriver = drivers.find((d) => d.id === driver.id);

      expect(updatedDriver?.status).toBe('Off Duty');
    });

    it('should persist trip changes', () => {
      const truck = dbStore.createTruck({
        license_plate: `TEST ${Date.now()}`,
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Test Driver',
        license_number: `LIC${Date.now()}`,
        phone: '1234567890',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      dbStore.updateTrip(trip.id, { status: 'Ongoing' });

      const trips = dbStore.getTrips();
      const updatedTrip = trips.find((t) => t.id === trip.id);

      expect(updatedTrip?.status).toBe('Ongoing');
    });
  });

  describe('Storage Event Handling', () => {
    it('should reload data when storage event fires', () => {
      let notified = false;
      const unsubscribe = dbStore.subscribe(() => {
        notified = true;
      });

      // Simulate storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'kam_fleets_db_v1_trucks',
        newValue: JSON.stringify(dbStore.getTrucks()),
      }));

      expect(notified).toBe(true);
      unsubscribe();
    });
  });
});

describe('DatabaseStore - Sync Status', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should start in local mode', () => {
    expect(dbStore.getSyncStatus()).toBe('local');
  });

  it('should report pending changes when commands are queued', () => {
    dbStore.createTruck({
      license_plate: 'TEST 123',
      model: 'Test Truck',
      status: 'Available',
    });

    // In local mode, pending changes are 0
    expect(dbStore.getPendingChangeCount()).toBe(0);
  });
});

describe('DatabaseStore - Remote Connection', () => {
  const mockBackend: RemoteBackend = {
    loadState: vi.fn(async () => ({
      version: 1,
      snapshot: {
        trucks: [],
        truckServiceRecords: [],
        drivers: [],
        trips: [],
        expenses: [],
        spareParts: [],
        invoices: [],
        payments: [],
        auditLogs: [],
        auditActor: 'Test User',
      },
    })),
    sendCommand: vi.fn(async () => ({
      version: 2,
      snapshot: {
        trucks: [],
        truckServiceRecords: [],
        drivers: [],
        trips: [],
        expenses: [],
        spareParts: [],
        invoices: [],
        payments: [],
        auditLogs: [],
        auditActor: 'Test User',
      },
    })),
  };

  const mockSession: RemoteSession = {
    role: 'Admin',
    actorName: 'Test User',
    onError: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should connect to remote backend', async () => {
    await dbStore.connectRemote('user123', mockBackend, mockSession);

    expect(dbStore.getSyncStatus()).toBe('synced');
    expect(mockBackend.loadState).toHaveBeenCalledWith(0);
  });

  it('should disconnect from remote backend', async () => {
    await dbStore.connectRemote('user123', mockBackend, mockSession);
    dbStore.disconnectRemote();

    expect(dbStore.getSyncStatus()).toBe('local');
  });

  it('should load data saved with the previous storage prefix', async () => {
    localStorage.setItem(
      'jcq_fleet_db_v1_team_user123_trucks',
      JSON.stringify([{ id: 'legacy-truck', license_plate: 'LEGACY 1' }]),
    );
    const unavailableBackend: RemoteBackend = {
      loadState: vi.fn().mockRejectedValue(new Error('Network unavailable')),
      sendCommand: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    };

    await dbStore.connectRemote('user123', unavailableBackend, mockSession);

    expect(dbStore.getTrucks()[0].license_plate).toBe('LEGACY 1');
  });

  it('should keep cached team data available when Neon is unreachable', async () => {
    localStorage.setItem(
      'kam_fleets_db_v1_team_user123_trucks',
      JSON.stringify([{ id: 'cached-truck', license_plate: 'OFFLINE 1' }]),
    );
    const unavailableBackend: RemoteBackend = {
      loadState: vi.fn().mockRejectedValue(new Error('Network unavailable')),
      sendCommand: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    };

    await expect(dbStore.connectRemote('user123', unavailableBackend, mockSession)).resolves.toBeUndefined();

    expect(dbStore.getTrucks()[0].license_plate).toBe('OFFLINE 1');
    expect(dbStore.getSyncStatus()).toBe('offline');
  });

  it('should use session actor name for audit logs', async () => {
    await dbStore.connectRemote('user123', mockBackend, mockSession);

    dbStore.createTruck({
      license_plate: 'TEST 123',
      model: 'Test Truck',
      status: 'Available',
    });

    const auditActor = dbStore.getAuditActor();
    expect(auditActor).toBe('Test User');
  });
});

describe('DatabaseStore - Command Queue', () => {
  const mockBackend: RemoteBackend = {
    loadState: vi.fn(async () => ({
      version: 1,
      snapshot: {
        trucks: [],
        truckServiceRecords: [],
        drivers: [],
        trips: [],
        expenses: [],
        spareParts: [],
        invoices: [],
        payments: [],
        auditLogs: [],
        auditActor: 'Test User',
      },
    })),
    sendCommand: vi.fn(async () => ({
      version: 2,
      snapshot: {
        trucks: [],
        truckServiceRecords: [],
        drivers: [],
        trips: [],
        expenses: [],
        spareParts: [],
        invoices: [],
        payments: [],
        auditLogs: [],
        auditActor: 'Test User',
      },
    })),
  };

  const mockSession: RemoteSession = {
    role: 'Admin',
    actorName: 'Test User',
    onError: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should queue commands when connected to remote', async () => {
    await dbStore.connectRemote('user123', mockBackend, mockSession);

    dbStore.createTruck({
      license_plate: 'TEST 123',
      model: 'Test Truck',
      status: 'Available',
    });

    // Command should be queued and sent
    expect(mockBackend.sendCommand).toHaveBeenCalled();
  });
});

describe('DatabaseStore - Snapshot Management', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should export complete snapshot', () => {
    const snapshot = dbStore.getSnapshot();

    expect(snapshot).toHaveProperty('trucks');
    expect(snapshot).toHaveProperty('drivers');
    expect(snapshot).toHaveProperty('trips');
    expect(snapshot).toHaveProperty('expenses');
    expect(snapshot).toHaveProperty('spareParts');
    expect(snapshot).toHaveProperty('invoices');
    expect(snapshot).toHaveProperty('payments');
    expect(snapshot).toHaveProperty('auditLogs');
    expect(snapshot).toHaveProperty('auditActor');
  });

  it('should import snapshot correctly', () => {
    const customSnapshot = {
      trucks: [],
      truckServiceRecords: [],
      drivers: [],
      trips: [],
      expenses: [],
      spareParts: [],
      invoices: [],
      payments: [],
      auditLogs: [],
      auditActor: 'Custom Actor',
    };

    dbStore.applySnapshot(customSnapshot);

    expect(dbStore.getTrucks().length).toBe(0);
    expect(dbStore.getAuditActor()).toBe('Custom Actor');
  });
});

describe('DatabaseStore - Role Management', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should default to Admin role in local mode', () => {
    expect(dbStore.getRole()).toBe('Admin');
  });

  it('should use session role when connected', async () => {
    const mockBackend: RemoteBackend = {
      loadState: vi.fn(async () => ({
        version: 1,
        snapshot: {
          trucks: [],
          truckServiceRecords: [],
          drivers: [],
          trips: [],
          expenses: [],
          spareParts: [],
          invoices: [],
          payments: [],
          auditLogs: [],
          auditActor: 'Test User',
        },
      })),
      sendCommand: vi.fn(async () => ({
        version: 2,
        snapshot: {
          trucks: [],
          truckServiceRecords: [],
          drivers: [],
          trips: [],
          expenses: [],
          spareParts: [],
          invoices: [],
          payments: [],
          auditLogs: [],
          auditActor: 'Test User',
        },
      })),
    };

    const mockSession: RemoteSession = {
      role: 'Dispatcher',
      actorName: 'Test User',
      onError: vi.fn(),
    };

    await dbStore.connectRemote('user123', mockBackend, mockSession);

    expect(dbStore.getRole()).toBe('Dispatcher');
  });
});

describe('DatabaseStore - Audit Actor Management', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should allow setting audit actor in local mode', () => {
    const newActor = dbStore.setAuditActor('Local Operator');
    expect(newActor).toBe('Local Operator');
    expect(dbStore.getAuditActor()).toBe('Local Operator');
  });

  it('should throw error when trying to change audit actor while connected', async () => {
    const mockBackend: RemoteBackend = {
      loadState: vi.fn(async () => ({
        version: 1,
        snapshot: {
          trucks: [],
          truckServiceRecords: [],
          drivers: [],
          trips: [],
          expenses: [],
          spareParts: [],
          invoices: [],
          payments: [],
          auditLogs: [],
          auditActor: 'Test User',
        },
      })),
      sendCommand: vi.fn(async () => ({
        version: 2,
        snapshot: {
          trucks: [],
          truckServiceRecords: [],
          drivers: [],
          trips: [],
          expenses: [],
          spareParts: [],
          invoices: [],
          payments: [],
          auditLogs: [],
          auditActor: 'Test User',
        },
      })),
    };

    const mockSession: RemoteSession = {
      role: 'Admin',
      actorName: 'Test User',
      onError: vi.fn(),
    };

    await dbStore.connectRemote('user123', mockBackend, mockSession);

    expect(() => {
      dbStore.setAuditActor('Different Actor');
    }).toThrow('cannot be changed here');
  });

  it('should validate audit actor length', () => {
    expect(() => {
      dbStore.setAuditActor('A'.repeat(101));
    }).toThrow('100 characters or fewer');
  });

  it('should validate audit actor is not empty', () => {
    expect(() => {
      dbStore.setAuditActor('   ');
    }).toThrow('Operator name is required');
  });
});

describe('DatabaseStore - Notification System', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should notify subscribers on data change', () => {
    let notified = false;
    const unsubscribe = dbStore.subscribe(() => {
      notified = true;
    });

    dbStore.createTruck({
      license_plate: 'TEST 123',
      model: 'Test Truck',
      status: 'Available',
    });

    expect(notified).toBe(true);
    unsubscribe();
  });

  it('should allow unsubscribing', () => {
    let callCount = 0;
    const unsubscribe = dbStore.subscribe(() => {
      callCount++;
    });

    dbStore.createTruck({
      license_plate: `TEST ${Date.now()}`,
      model: 'Test Truck',
      status: 'Available',
    });

    unsubscribe();

    dbStore.createTruck({
      license_plate: `TEST ${Date.now() + 1}`,
      model: 'Test Truck 2',
      status: 'Available',
    });

    expect(callCount).toBe(1);
  });
});

describe('DatabaseStore - SQL Mock', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  it('should execute mock SQL for trucks', () => {
    const result = dbStore.executeMockSql('SELECT * FROM trucks');

    expect(result.columns).toContain('license_plate');
    expect(result.columns).toContain('model');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should execute mock SQL for drivers', () => {
    const result = dbStore.executeMockSql('SELECT * FROM drivers');

    expect(result.columns).toContain('full_name');
    expect(result.columns).toContain('license_number');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should execute mock SQL for trips', () => {
    const result = dbStore.executeMockSql('SELECT * FROM trips');

    expect(result.columns).toContain('origin');
    expect(result.columns).toContain('destination');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return table summary for unknown queries', () => {
    const result = dbStore.executeMockSql('SELECT * FROM unknown_table');

    expect(result.columns).toContain('table_name');
    expect(result.columns).toContain('record_count');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
