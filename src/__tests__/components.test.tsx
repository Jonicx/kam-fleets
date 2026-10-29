import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardView } from '../components/DashboardView';
import { TripsView } from '../components/TripsView';
import { TrucksView } from '../components/TrucksView';
import { DriversView } from '../components/DriversView';
import { ExpensesAndPartsView } from '../components/ExpensesAndPartsView';
import { dbStore } from '../db/store';
import type { EnrichedTrip, DatabaseStats, Truck, Driver, Expense, SparePart, TruckServiceRecord } from '../types/database';

// Mock dbStore
vi.mock('../db/store', () => ({
  dbStore: {
    getTrucks: vi.fn(),
    getDrivers: vi.fn(),
    getTrips: vi.fn(),
    getEnrichedTrips: vi.fn(),
    getExpenses: vi.fn(),
    getSpareParts: vi.fn(),
    getTruckServiceRecords: vi.fn(),
    getStats: vi.fn(),
    createTrip: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
    createTruck: vi.fn(),
    updateTruck: vi.fn(),
    deleteTruck: vi.fn(),
    createDriver: vi.fn(),
    updateDriver: vi.fn(),
    deleteDriver: vi.fn(),
    createExpense: vi.fn(),
    deleteExpense: vi.fn(),
    createSparePart: vi.fn(),
    deleteSparePart: vi.fn(),
    updateTruckServiceRecord: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

describe('DashboardView Component', () => {
  const mockStats: DatabaseStats = {
    totalTrucks: 5,
    availableTrucks: 2,
    onTripTrucks: 2,
    maintenanceTrucks: 1,
    totalDrivers: 4,
    availableDrivers: 2,
    totalTrips: 10,
    ongoingTrips: 2,
    completedTrips: 6,
    plannedTrips: 2,
    totalBudgetAllocated: 50000,
    totalActualExpenses: 35000,
    totalSparePartsCost: 5000,
    budgetLessExpensesAndParts: 10000,
    totalFinalizedBudgetVariance: 5000,
    withinBudgetTripsCount: 7,
    overBudgetTripsCount: 3,
  };

  const mockEnrichedTrips: EnrichedTrip[] = [
    {
      id: '1',
      truck_id: 'truck1',
      driver_id: 'driver1',
      status: 'Ongoing',
      origin: 'Dar es Salaam',
      destination: 'Arusha',
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 86400000).toISOString(),
      budget_allocated: 5000,
      driver_pay: 2000,
      expenses: [],
      spare_parts: [],
      delay_logs: [],
      total_expenses: 1000,
      total_spare_parts: 500,
      total_spent: 1500,
      remaining_budget: 3500,
      budget_utilization_pct: 30,
      is_over_budget: false,
      profit_loss: 3500,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard with stats', () => {
    render(
      <DashboardView
        stats={mockStats}
        enrichedTrips={mockEnrichedTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTrip={vi.fn()}
        onNavigateToSchema={vi.fn()}
      />
    );

    // Just verify it renders without crashing
    expect(screen.getByText('Fleet & Trip Operational Command', { exact: true })).toBeInTheDocument();
  });

  it('should display ongoing trips', () => {
    render(
      <DashboardView
        stats={mockStats}
        enrichedTrips={mockEnrichedTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTrip={vi.fn()}
        onNavigateToSchema={vi.fn()}
      />
    );

    // Just verify it renders
    expect(screen.getByText('Live Ongoing Trips', { exact: true })).toBeInTheDocument();
  });

  it('should call onOpenNewTrip when button clicked', () => {
    const onOpenNewTrip = vi.fn();
    render(
      <DashboardView
        stats={mockStats}
        enrichedTrips={mockEnrichedTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTrip={onOpenNewTrip}
        onNavigateToSchema={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Plan New Trip', { exact: true }));

    expect(onOpenNewTrip).toHaveBeenCalled();
  });
});

describe('TripsView Component', () => {
  const mockTrips: EnrichedTrip[] = [
    {
      id: '1',
      truck_id: 'truck1',
      driver_id: 'driver1',
      status: 'Planned',
      origin: 'Dar es Salaam',
      destination: 'Arusha',
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 86400000).toISOString(),
      budget_allocated: 5000,
      driver_pay: 2000,
      expenses: [],
      spare_parts: [],
      delay_logs: [],
      total_expenses: 0,
      total_spare_parts: 0,
      total_spent: 0,
      remaining_budget: 5000,
      budget_utilization_pct: 0,
      is_over_budget: false,
      profit_loss: 5000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render trips list', () => {
    render(
      <TripsView
        trips={mockTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTripModal={vi.fn()}
        onUpdateTripStatus={vi.fn()}
        onDeleteTrip={vi.fn()}
      />
    );

    // Just verify it renders
    expect(screen.getByText('Trip Operations & Dispatch', { exact: true })).toBeInTheDocument();
  });

  it('should display trip origin and destination', () => {
    render(
      <TripsView
        trips={mockTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTripModal={vi.fn()}
        onUpdateTripStatus={vi.fn()}
        onDeleteTrip={vi.fn()}
      />
    );

    expect(screen.getByText('Dar es Salaam', { exact: true })).toBeInTheDocument();
  });

  it('should call onOpenNewTripModal when new trip button clicked', () => {
    const onOpenNewTripModal = vi.fn();
    render(
      <TripsView
        trips={mockTrips}
        onSelectTrip={vi.fn()}
        onOpenNewTripModal={onOpenNewTripModal}
        onUpdateTripStatus={vi.fn()}
        onDeleteTrip={vi.fn()}
      />
    );

    const newTripButton = screen.getByRole('button', { name: /new trip/i });
    fireEvent.click(newTripButton);

    expect(onOpenNewTripModal).toHaveBeenCalled();
  });
});

describe('TrucksView Component', () => {
  const mockTrucks: Truck[] = [
    {
      id: '1',
      license_plate: 'ABC 123',
      model: 'Scania R500',
      status: 'Available',
      year: 2020,
      capacity_tons: 32,
      current_mileage: 100000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockServiceRecords: TruckServiceRecord[] = [];

  const mockEnrichedTrips: EnrichedTrip[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render trucks list', () => {
    render(
      <TrucksView
        trucks={mockTrucks}
        serviceRecords={mockServiceRecords}
        trips={mockEnrichedTrips}
        onCreateTruck={vi.fn()}
        onCreateServiceRecord={vi.fn()}
        onUpdateServiceRecord={vi.fn()}
        onUpdateTruckStatus={vi.fn()}
        onDeleteTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
      />
    );

    expect(screen.getByText('Fleet Trucks Management', { exact: true })).toBeInTheDocument();
  });

  it('should display truck license plate', () => {
    render(
      <TrucksView
        trucks={mockTrucks}
        serviceRecords={mockServiceRecords}
        trips={mockEnrichedTrips}
        onCreateTruck={vi.fn()}
        onCreateServiceRecord={vi.fn()}
        onUpdateServiceRecord={vi.fn()}
        onUpdateTruckStatus={vi.fn()}
        onDeleteTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
      />
    );

    expect(screen.getAllByText('ABC 123', { exact: true }).length).toBeGreaterThan(0);
  });
});

describe('DriversView Component', () => {
  const mockDrivers: Driver[] = [
    {
      id: '1',
      full_name: 'John Doe',
      license_number: 'LIC123',
      phone: '1234567890',
      status: 'Available',
      experience_years: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drivers list', () => {
    render(
      <DriversView
        drivers={mockDrivers}
        onCreateDriver={vi.fn()}
        onUpdateDriverStatus={vi.fn()}
        onDeleteDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
      />
    );

    expect(screen.getByText('Drivers Directory', { exact: true })).toBeInTheDocument();
  });

  it('should display driver name', () => {
    render(
      <DriversView
        drivers={mockDrivers}
        onCreateDriver={vi.fn()}
        onUpdateDriverStatus={vi.fn()}
        onDeleteDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
      />
    );

    expect(screen.getAllByText('John Doe', { exact: true }).length).toBeGreaterThan(0);
  });
});

describe('ExpensesAndPartsView Component', () => {
  const mockExpenses: Expense[] = [
    {
      id: '1',
      trip_id: 'trip1',
      expense_type: 'Fuel',
      amount: 500,
      description: 'Fuel purchase',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  const mockSpareParts: SparePart[] = [];

  const mockTrucks: Truck[] = [];

  const mockServiceRecords: TruckServiceRecord[] = [];

  const mockTrips: EnrichedTrip[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render expenses and parts view', () => {
    render(
      <ExpensesAndPartsView
        expenses={mockExpenses}
        spareParts={mockSpareParts}
        trucks={mockTrucks}
        truckServiceRecords={mockServiceRecords}
        trips={mockTrips}
        onDeleteExpense={vi.fn()}
        onDeleteSparePart={vi.fn()}
        onSaveEntry={vi.fn()}
        onUpdateTruckServiceRecord={vi.fn()}
        onSelectTrip={vi.fn()}
      />
    );

    expect(screen.getByText('Transit Expenses & Maintenance Ledger', { exact: true })).toBeInTheDocument();
  });

  it('should display expense type', () => {
    render(
      <ExpensesAndPartsView
        expenses={mockExpenses}
        spareParts={mockSpareParts}
        trucks={mockTrucks}
        truckServiceRecords={mockServiceRecords}
        trips={mockTrips}
        onDeleteExpense={vi.fn()}
        onDeleteSparePart={vi.fn()}
        onSaveEntry={vi.fn()}
        onUpdateTruckServiceRecord={vi.fn()}
        onSelectTrip={vi.fn()}
      />
    );

    expect(screen.getAllByText('Fuel', { exact: true }).length).toBeGreaterThan(0);
  });
});
