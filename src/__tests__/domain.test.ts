import { describe, it, expect, beforeEach } from 'vitest';
import { FleetDomain } from '../db/domain';
import type { Truck, Driver, Trip, Expense, SparePart, Invoice, Payment } from '../types/database';

describe('FleetDomain - Truck Management', () => {
  let domain: FleetDomain;

  beforeEach(() => {
    domain = new FleetDomain();
  });

  describe('createTruck', () => {
    it('should create a truck with valid data', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
        year: 2020,
        capacity_tons: 10,
        current_mileage: 5000,
      });

      expect(truck).toBeDefined();
      expect(truck.license_plate).toBe('ABC 123');
      expect(truck.model).toBe('Test Truck');
      expect(truck.status).toBe('Available');
      expect(truck.id).toBeDefined();
    });

    it('should throw error for invalid status', () => {
      expect(() => {
        domain.createTruck({
          license_plate: 'ABC 123',
          model: 'Test Truck',
          status: 'Invalid' as any,
        });
      }).toThrow('Select a valid truck status');
    });

    it('should throw error for missing required fields', () => {
      expect(() => {
        domain.createTruck({
          license_plate: '',
          model: 'Test Truck',
          status: 'Available',
        });
      }).toThrow('License plate is required');
    });

    it('should throw error for duplicate license plate', () => {
      domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      expect(() => {
        domain.createTruck({
          license_plate: 'ABC 123',
          model: 'Another Truck',
          status: 'Available',
        });
      }).toThrow();
    });
  });

  describe('updateTruck', () => {
    it('should update existing truck', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const updated = domain.updateTruck(truck.id, {
        status: 'Maintenance',
        current_mileage: 10000,
      });

      expect(updated.status).toBe('Maintenance');
      expect(updated.current_mileage).toBe(10000);
    });

    it('should throw error for non-existent truck', () => {
      expect(() => {
        domain.updateTruck('non-existent-id', { status: 'Maintenance' });
      }).toThrow('not found');
    });
  });

  describe('deleteTruck', () => {
    it('should delete truck that is not in use', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      domain.deleteTruck(truck.id);
      const trucks = domain.getTrucks();

      expect(trucks.find((t) => t.id === truck.id)).toBeUndefined();
    });

    it('should throw error when deleting truck with active trips', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      expect(() => domain.deleteTruck(truck.id)).toThrow();
    });
  });
});

describe('FleetDomain - Driver Management', () => {
  let domain: FleetDomain;

  beforeEach(() => {
    domain = new FleetDomain();
  });

  describe('createDriver', () => {
    it('should create a driver with valid data', () => {
      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
        experience_years: 5,
      });

      expect(driver).toBeDefined();
      expect(driver.full_name).toBe('John Doe');
      expect(driver.license_number).toBe('LIC123');
      expect(driver.status).toBe('Available');
      expect(driver.id).toBeDefined();
    });

    it('should throw error for duplicate license number', () => {
      domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      expect(() => {
        domain.createDriver({
          full_name: 'Jane Doe',
          license_number: 'LIC123',
          phone: '0987654321',
          status: 'Available',
        });
      }).toThrow();
    });
  });

  describe('deleteDriver', () => {
    it('should delete driver without active trips', () => {
      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      domain.deleteDriver(driver.id);
      const drivers = domain.getDrivers();

      expect(drivers.find((d) => d.id === driver.id)).toBeUndefined();
    });

    it('should throw error when deleting driver with active trips', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      expect(() => domain.deleteDriver(driver.id)).toThrow();
    });
  });
});

describe('FleetDomain - Trip Management', () => {
  let domain: FleetDomain;

  beforeEach(() => {
    domain = new FleetDomain();
  });

  describe('createTrip', () => {
    it('should create a trip with valid data', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      const trip = domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'Dar es Salaam',
        destination: 'Arusha',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      expect(trip).toBeDefined();
      expect(trip.origin).toBe('Dar es Salaam');
      expect(trip.destination).toBe('Arusha');
      expect(trip.status).toBe('Planned');
      expect(domain.getTruck(truck.id)?.status).toBe('Available');
      expect(domain.getDriver(driver.id)?.status).toBe('Available');
    });

    it('should throw error for non-existent truck', () => {
      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      expect(() => {
        domain.createTrip({
          truck_id: 'non-existent',
          driver_id: driver.id,
          origin: 'A',
          destination: 'B',
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 86400000).toISOString(),
          budget_allocated: 1000,
          driver_pay: 500,
        });
      }).toThrow('does not exist');
    });

    it('should throw error for non-existent driver', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      expect(() => {
        domain.createTrip({
          truck_id: truck.id,
          driver_id: 'non-existent',
          origin: 'A',
          destination: 'B',
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 86400000).toISOString(),
          budget_allocated: 1000,
          driver_pay: 500,
        });
      }).toThrow('does not exist');
    });

    it('should throw error for invalid budget', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      expect(() => {
        domain.createTrip({
          truck_id: truck.id,
          driver_id: driver.id,
          origin: 'A',
          destination: 'B',
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 86400000).toISOString(),
          budget_allocated: -100,
          driver_pay: 500,
        });
      }).toThrow('must be greater than Tsh 0');
    });
  });

  describe('updateTrip', () => {
    it('should update trip status', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      const trip = domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      const updated = domain.updateTrip(trip.id, { status: 'Ongoing' });
      expect(updated.status).toBe('Ongoing');
    });
  });

  describe('completeTrip', () => {
    it('should complete a trip and update truck/driver status', () => {
      const truck = domain.createTruck({
        license_plate: 'ABC 123',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'John Doe',
        license_number: 'LIC123',
        phone: '1234567890',
        status: 'Available',
      });

      const trip = domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      domain.updateTrip(trip.id, { status: 'Ongoing' });
      expect(domain.getTruck(truck.id)?.status).toBe('On Trip');
      expect(domain.getDriver(driver.id)?.status).toBe('On Trip');

      domain.completeTrip(trip.id);

      const updatedTrip = domain.getTrips().find((item) => item.id === trip.id);
      expect(updatedTrip?.status).toBe('Completed');
      expect(updatedTrip?.completed_at).toBeDefined();

      const updatedTruck = domain.getTruck(truck.id);
      expect(updatedTruck?.status).toBe('Available');

      const updatedDriver = domain.getDriver(driver.id);
      expect(updatedDriver?.status).toBe('Available');
    });
  });
});

describe('FleetDomain - Expense Management', () => {
  let domain: FleetDomain;
  let tripId: string;

  beforeEach(() => {
    domain = new FleetDomain();
    const truck = domain.createTruck({
      license_plate: 'ABC 123',
      model: 'Test Truck',
      status: 'Available',
    });

    const driver = domain.createDriver({
      full_name: 'John Doe',
      license_number: 'LIC123',
      phone: '1234567890',
      status: 'Available',
    });

    const trip = domain.createTrip({
      truck_id: truck.id,
      driver_id: driver.id,
      origin: 'A',
      destination: 'B',
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 86400000).toISOString(),
      budget_allocated: 1000,
      driver_pay: 500,
    });

    tripId = trip.id;
  });

  describe('createExpense', () => {
    it('should create an expense', () => {
      const expense = domain.createExpense({
        trip_id: tripId,
        expense_type: 'Fuel',
        amount: 500,
        description: 'Fuel purchase',
      });

      expect(expense).toBeDefined();
      expect(expense.expense_type).toBe('Fuel');
      expect(expense.amount).toBe(500);
    });

    it('should throw error for invalid expense type', () => {
      expect(() => {
        domain.createExpense({
          trip_id: tripId,
          expense_type: 'Invalid' as any,
          amount: 500,
          description: 'Test',
        });
      }).toThrow('Select a valid expense type');
    });
  });

  describe('deleteExpense', () => {
    it('should delete an expense', () => {
      const expense = domain.createExpense({
        trip_id: tripId,
        expense_type: 'Fuel',
        amount: 500,
        description: 'Fuel purchase',
      });

      domain.deleteExpense(expense.id);
      const expenses = domain.getExpenses();

      expect(expenses.find((e) => e.id === expense.id)).toBeUndefined();
    });
  });
});

describe('FleetDomain - Invoice and Payment Management', () => {
  let domain: FleetDomain;
  let tripId: string;

  beforeEach(() => {
    domain = new FleetDomain();
    const truck = domain.createTruck({
      license_plate: 'ABC 123',
      model: 'Test Truck',
      status: 'Available',
    });

    const driver = domain.createDriver({
      full_name: 'John Doe',
      license_number: 'LIC123',
      phone: '1234567890',
      status: 'Available',
    });

    const trip = domain.createTrip({
      truck_id: truck.id,
      driver_id: driver.id,
      origin: 'A',
      destination: 'B',
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 86400000).toISOString(),
      budget_allocated: 1000,
      driver_pay: 500,
    });

    domain.updateTrip(trip.id, { status: 'Ongoing' });
    domain.completeTrip(trip.id);
    tripId = trip.id;
  });

  describe('createInvoice', () => {
    it('should create an invoice for completed trip', () => {
      const invoice = domain.createInvoice({
        trip_id: tripId,
        amount: 1500,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

      expect(invoice).toBeDefined();
      expect(invoice.amount).toBe(1500);
      expect(invoice.invoice_number).toBeDefined();
    });

    it('should throw error for non-completed trip', () => {
      const truck = domain.createTruck({
        license_plate: 'XYZ 789',
        model: 'Test Truck 2',
        status: 'Available',
      });

      const driver = domain.createDriver({
        full_name: 'Jane Doe',
        license_number: 'LIC456',
        phone: '0987654321',
        status: 'Available',
      });

      const newTrip = domain.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'C',
        destination: 'D',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 1000,
        driver_pay: 500,
      });

      expect(() => {
        domain.createInvoice({
          trip_id: newTrip.id,
          amount: 1500,
          issued_at: new Date().toISOString(),
          due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        });
      }).toThrow('Invoices can only be issued for completed trips');
    });

    it('should throw error for invalid dates', () => {
      expect(() => {
        domain.createInvoice({
          trip_id: tripId,
          amount: 1500,
          issued_at: 'invalid-date',
          due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        });
      }).toThrow('must be valid dates');
    });
  });

  describe('createPayment', () => {
    it('should create a payment for invoice', () => {
      const invoice = domain.createInvoice({
        trip_id: tripId,
        amount: 1500,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

      const payment = domain.createPayment({
        invoice_id: invoice.id,
        amount: 1500,
        method: 'Cash',
        paid_at: new Date().toISOString(),
      });

      expect(payment).toBeDefined();
      expect(payment.amount).toBe(1500);
      expect(payment.method).toBe('Cash');
    });

    it('should throw error for payment exceeding invoice balance', () => {
      const invoice = domain.createInvoice({
        trip_id: tripId,
        amount: 1500,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

      domain.createPayment({
        invoice_id: invoice.id,
        amount: 1000,
        method: 'Cash',
        paid_at: new Date().toISOString(),
      });

      expect(() => {
        domain.createPayment({
          invoice_id: invoice.id,
          amount: 1000,
          method: 'Cash',
          paid_at: new Date().toISOString(),
        });
      }).toThrow('exceeds the invoice balance');
    });
  });
});

describe('FleetDomain - Audit Logging', () => {
  let domain: FleetDomain;

  beforeEach(() => {
    domain = new FleetDomain();
  });

  it('should log audit entry for truck creation', () => {
    domain.createTruck({
      license_plate: 'ABC 123',
      model: 'Test Truck',
      status: 'Available',
    });

    const logs = domain.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('created truck');
    expect(logs[0].entity_type).toBe('truck');
  });

  it('should limit audit logs to MAX_AUDIT_LOGS', () => {
    // Create a smaller number of trucks to generate audit logs
    for (let i = 0; i < 100; i++) {
      domain.createTruck({
        license_plate: `TRK ${i}`,
        model: 'Test Truck',
        status: 'Available',
      });
    }

    const logs = domain.getAuditLogs();
    expect(logs.length).toBeLessThanOrEqual(2000);
  }, 10000);
});

describe('FleetDomain - Reset', () => {
  let domain: FleetDomain;

  beforeEach(() => {
    domain = new FleetDomain();
  });

  it('should reset to default data', () => {
    domain.createTruck({
      license_plate: 'CUSTOM 1',
      model: 'Custom Truck',
      status: 'Available',
    });

    domain.resetToDefault();

    const trucks = domain.getTrucks();
    const invoices = domain.getInvoices();
    const payments = domain.getPayments();

    expect(trucks.length).toBeGreaterThan(0);
    expect(invoices.length).toBe(0);
    expect(payments.length).toBe(0);
  });
});
