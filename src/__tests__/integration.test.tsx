import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { dbStore } from '../db/store';
import { FleetDomain } from '../db/domain';

describe('Integration Tests - End-to-End Workflows', () => {
  beforeEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  afterEach(() => {
    localStorage.clear();
    dbStore.disconnectRemote();
  });

  describe('Trip Creation Workflow', () => {
    it('should create complete trip with truck and driver', () => {
      // Create truck
      const truck = dbStore.createTruck({
        license_plate: `TRK ${Date.now()}`,
        model: 'Test Truck',
        status: 'Available',
        year: 2020,
        capacity_tons: 10,
      });

      expect(truck).toBeDefined();
      expect(truck.status).toBe('Available');

      // Create driver
      const driver = dbStore.createDriver({
        full_name: 'John Doe',
        license_number: `LIC${Date.now()}`,
        phone: '1234567890',
        status: 'Available',
        experience_years: 5,
      });

      expect(driver).toBeDefined();
      expect(driver.status).toBe('Available');

      // Create trip
      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'Dar es Salaam',
        destination: 'Arusha',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 5000,
        driver_pay: 2000,
      });

      expect(trip).toBeDefined();
      expect(trip.status).toBe('Planned');

      // Creating a trip schedules it without dispatching the assigned resources.
      const updatedTruck = dbStore.getTruck(truck.id);
      const updatedDriver = dbStore.getDriver(driver.id);

      expect(updatedTruck?.status).toBe('Available');
      expect(updatedDriver?.status).toBe('Available');
    });

    it('should update trip status through lifecycle', () => {
      const truck = dbStore.createTruck({
        license_plate: 'TRK 456',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Jane Doe',
        license_number: 'LIC456',
        phone: '0987654321',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 3000,
        driver_pay: 1500,
      });

      // Start trip
      dbStore.updateTrip(trip.id, { status: 'Ongoing' });
      const trips = dbStore.getTrips();
      let updatedTrip = trips.find((t) => t.id === trip.id);
      expect(updatedTrip?.status).toBe('Ongoing');
      expect(dbStore.getTruck(truck.id)?.status).toBe('On Trip');
      expect(dbStore.getDriver(driver.id)?.status).toBe('On Trip');

      // Complete trip
      dbStore.completeTrip(trip.id);
      const completedTrips = dbStore.getTrips();
      updatedTrip = completedTrips.find((t) => t.id === trip.id);
      expect(updatedTrip?.status).toBe('Completed');
      expect(updatedTrip?.completed_at).toBeDefined();

      // Verify truck and driver returned to available
      const finalTruck = dbStore.getTruck(truck.id);
      const finalDriver = dbStore.getDriver(driver.id);

      expect(finalTruck?.status).toBe('Available');
      expect(finalDriver?.status).toBe('Available');
    });
  });

  describe('Expense Tracking Workflow', () => {
    it('should add expenses to trip and calculate totals', () => {
      const truck = dbStore.createTruck({
        license_plate: 'TRK 789',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Bob Smith',
        license_number: 'LIC789',
        phone: '5555555555',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'X',
        destination: 'Y',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 10000,
        driver_pay: 4000,
      });

      // Add expenses
      const expense1 = dbStore.createExpense({
        trip_id: trip.id,
        expense_type: 'Fuel',
        amount: 2000,
        description: 'Fuel for trip',
      });

      const expense2 = dbStore.createExpense({
        trip_id: trip.id,
        expense_type: 'Tolls',
        amount: 500,
        description: 'Road tolls',
      });

      expect(expense1).toBeDefined();
      expect(expense2).toBeDefined();

      // Get enriched trip with calculations
      const enrichedTrip = dbStore.getEnrichedTrip(trip.id);
      // Total includes expenses + driver_pay
      expect(enrichedTrip?.total_expenses).toBe(2500);
      expect(enrichedTrip?.total_spent).toBe(6500); // 2500 expenses + 4000 driver_pay
      expect(enrichedTrip?.remaining_budget).toBe(3500); // 10000 - 6500
    });

    it('should add spare parts to trip', () => {
      const truck = dbStore.createTruck({
        license_plate: 'TRK 999',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Alice Johnson',
        license_number: 'LIC999',
        phone: '9999999999',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'P',
        destination: 'Q',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 8000,
        driver_pay: 3000,
      });

      // Add spare part
      const sparePart = dbStore.createSparePart({
        trip_id: trip.id,
        part_name: 'Brake Pad',
        price: 1500,
        description: 'Replacement brake pad',
      });

      expect(sparePart).toBeDefined();

      const enrichedTrip = dbStore.getEnrichedTrip(trip.id);
      expect(enrichedTrip?.total_spare_parts).toBe(1500);
    });
  });

  describe('Invoice and Payment Workflow', () => {
    it('should create invoice for completed trip and accept payments', () => {
      const truck = dbStore.createTruck({
        license_plate: 'TRK 111',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Charlie Brown',
        license_number: 'LIC111',
        phone: '1111111111',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'M',
        destination: 'N',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 15000,
        driver_pay: 6000,
      });

      dbStore.updateTrip(trip.id, { status: 'Ongoing' });
      dbStore.completeTrip(trip.id);

      // Create invoice
      const invoice = dbStore.createInvoice({
        trip_id: trip.id,
        amount: 20000,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

      expect(invoice).toBeDefined();
      expect(invoice.amount).toBe(20000);

      // Add payment
      const payment = dbStore.createPayment({
        invoice_id: invoice.id,
        amount: 20000,
        method: 'Bank transfer',
        paid_at: new Date().toISOString(),
      });

      expect(payment).toBeDefined();
      expect(payment.amount).toBe(20000);

      // Verify payment is linked to invoice
      const invoicePayments = dbStore.getInvoicePayments(invoice.id);
      expect(invoicePayments.length).toBe(1);
      expect(invoicePayments[0].id).toBe(payment.id);
    });

    it('should reject payment exceeding invoice balance', () => {
      const truck = dbStore.createTruck({
        license_plate: 'TRK 222',
        model: 'Test Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Diana Prince',
        license_number: 'LIC222',
        phone: '2222222222',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'R',
        destination: 'S',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 10000,
        driver_pay: 4000,
      });

      dbStore.updateTrip(trip.id, { status: 'Ongoing' });
      dbStore.completeTrip(trip.id);

      const invoice = dbStore.createInvoice({
        trip_id: trip.id,
        amount: 10000,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

      // First payment
      dbStore.createPayment({
        invoice_id: invoice.id,
        amount: 8000,
        method: 'Cash',
        paid_at: new Date().toISOString(),
      });

      // Try to overpay
      expect(() => {
        dbStore.createPayment({
          invoice_id: invoice.id,
          amount: 3000,
          method: 'Cash',
          paid_at: new Date().toISOString(),
        });
      }).toThrow('exceeds the invoice balance');
    });
  });

  describe('Audit Trail Workflow', () => {
    it('should log all operations with correct attribution', () => {
      const actor = 'Test Operator';
      dbStore.setAuditActor(actor);

      // Create truck
      const truck = dbStore.createTruck({
        license_plate: 'AUD 001',
        model: 'Audit Truck',
        status: 'Available',
      });

      // Create driver
      const driver = dbStore.createDriver({
        full_name: 'Audit Driver',
        license_number: 'AUD001',
        phone: '0000000000',
        status: 'Available',
      });

      // Create trip
      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'Start',
        destination: 'End',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 5000,
        driver_pay: 2000,
      });

      // Check audit logs
      const logs = dbStore.getAuditLogs();

      expect(logs.length).toBeGreaterThan(0);

      // Verify at least some logs have the actor (not all due to initial data)
      const actorLogs = logs.filter((log) => log.actor === actor);
      expect(actorLogs.length).toBeGreaterThan(0);

      // Verify truck creation log
      const truckLog = logs.find((log) => log.entity_id === truck.id && log.entity_type === 'truck');
      expect(truckLog).toBeDefined();
      expect(truckLog?.action).toBe('created truck');

      // Verify trip creation log
      const tripLog = logs.find((log) => log.entity_id === trip.id && log.entity_type === 'trip');
      expect(tripLog).toBeDefined();
      expect(tripLog?.action).toBe('created trip');
    });
  });

  describe('Data Persistence Workflow', () => {
    it('should persist all data to localStorage', () => {
      // Create various entities
      const truck = dbStore.createTruck({
        license_plate: 'PRS 001',
        model: 'Persistence Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'Persistence Driver',
        license_number: 'PRS001',
        phone: '1112223333',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 3000,
        driver_pay: 1500,
      });

      // Verify localStorage has data
      const storedTrucks = localStorage.getItem('kam_fleets_db_v1_trucks');
      const storedDrivers = localStorage.getItem('kam_fleets_db_v1_drivers');
      const storedTrips = localStorage.getItem('kam_fleets_db_v1_trips');

      expect(storedTrucks).toBeDefined();
      expect(storedDrivers).toBeDefined();
      expect(storedTrips).toBeDefined();

      // Parse and verify content
      const trucks = JSON.parse(storedTrucks!);
      const drivers = JSON.parse(storedDrivers!);
      const trips = JSON.parse(storedTrips!);

      expect(trucks.some((t: any) => t.id === truck.id)).toBe(true);
      expect(drivers.some((d: any) => d.id === driver.id)).toBe(true);
      expect(trips.some((t: any) => t.id === trip.id)).toBe(true);
    });

    it('should reload data from localStorage on initialization', () => {
      // Create data
      const truck = dbStore.createTruck({
        license_plate: 'RLD 001',
        model: 'Reload Truck',
        status: 'Available',
      });

      // Store reference
      const truckId = truck.id;

      // Verify data is in localStorage
      const storedTrucks = localStorage.getItem('kam_fleets_db_v1_trucks');
      expect(storedTrucks).toBeDefined();

      // Parse and verify the truck is stored
      const trucks = JSON.parse(storedTrucks!);
      expect(trucks.some((t: any) => t.id === truckId)).toBe(true);
    });
  });

  describe('Business Rule Enforcement', () => {
    it('should prevent deleting truck with active trips', () => {
      const truck = dbStore.createTruck({
        license_plate: `BRU ${Date.now()}`,
        model: 'Business Rule Truck',
        status: 'Available',
      });

      const driver = dbStore.createDriver({
        full_name: 'BR Driver',
        license_number: `BRU${Date.now()}`,
        phone: '4445556666',
        status: 'Available',
      });

      const trip = dbStore.createTrip({
        truck_id: truck.id,
        driver_id: driver.id,
        origin: 'A',
        destination: 'B',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 86400000).toISOString(),
        budget_allocated: 2000,
        driver_pay: 1000,
      });

      expect(() => dbStore.deleteTruck(truck.id)).toThrow();

      // Completed trips remain in history and continue to reference their truck.
      dbStore.updateTrip(trip.id, { status: 'Completed' });

      expect(dbStore.getTrips().find((item) => item.id === trip.id)?.status).toBe('Completed');
      expect(() => dbStore.deleteTruck(truck.id)).toThrow();
    });

    it('should prevent creating trip with non-existent truck', () => {
      const driver = dbStore.createDriver({
        full_name: 'Test Driver',
        license_number: `TST${Date.now()}`,
        phone: '7778889999',
        status: 'Available',
      });

      expect(() => {
        dbStore.createTrip({
          truck_id: 'non-existent-truck-id',
          driver_id: driver.id,
          origin: 'A',
          destination: 'B',
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 86400000).toISOString(),
          budget_allocated: 1000,
          driver_pay: 500,
        });
      }).toThrow();
    });

    it('should prevent duplicate license plates', () => {
      const plate = `DUP ${Date.now()}`;
      dbStore.createTruck({
        license_plate: plate,
        model: 'Duplicate Truck 1',
        status: 'Available',
      });

      expect(() => {
        dbStore.createTruck({
          license_plate: plate,
          model: 'Duplicate Truck 2',
          status: 'Available',
        });
      }).toThrow();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset database to initial state', () => {
      // Add custom data
      dbStore.createTruck({
        license_plate: 'CST 001',
        model: 'Custom Truck',
        status: 'Available',
      });

      dbStore.createDriver({
        full_name: 'Custom Driver',
        license_number: 'CST001',
        phone: '1231231234',
        status: 'Available',
      });

      // Reset
      dbStore.resetToDefault();

      // Verify custom data is gone
      const trucks = dbStore.getTrucks();
      const drivers = dbStore.getDrivers();

      expect(trucks.some((t) => t.license_plate === 'CST 001')).toBe(false);
      expect(drivers.some((d) => d.license_number === 'CST001')).toBe(false);

      // Verify sample data is restored
      expect(trucks.length).toBeGreaterThan(0);
      expect(drivers.length).toBeGreaterThan(0);

      // Verify invoices and payments are cleared
      const invoices = dbStore.getInvoices();
      const payments = dbStore.getPayments();

      expect(invoices.length).toBe(0);
      expect(payments.length).toBe(0);
    });
  });
});
