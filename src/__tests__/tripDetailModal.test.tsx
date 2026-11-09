import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TripDetailModal } from '../components/TripDetailModal.tsx';
import type { EnrichedTrip } from '../types/database.ts';

const trip: EnrichedTrip = {
  id: 'trip-1',
  truck_id: 'truck-1',
  driver_id: 'driver-1',
  status: 'Ongoing',
  origin: 'Dar es Salaam',
  destination: 'Arusha',
  scheduled_start: '2026-11-06T08:00:00.000Z',
  scheduled_end: '2026-11-07T08:00:00.000Z',
  budget_allocated: 100_000,
  driver_pay: 20_000,
  delay_logs: [],
  created_at: '2026-11-06T08:00:00.000Z',
  updated_at: '2026-11-06T08:00:00.000Z',
  expenses: [],
  spare_parts: [],
  total_expenses: 10_000,
  total_spare_parts: 5_000,
  total_spent: 35_000,
  remaining_budget: 65_000,
  budget_utilization_pct: 35,
  is_over_budget: false,
  profit_loss: 65_000,
};

describe('TripDetailModal trip completion', () => {
  it('confirms completion and reports the finalized status change', () => {
    const onClose = vi.fn();
    const onUpdateStatus = vi.fn();

    render(
      <TripDetailModal
        trip={trip}
        onClose={onClose}
        onUpdateStatus={onUpdateStatus}
        onAddDelayLog={vi.fn()}
        onRemoveDelayLog={vi.fn()}
        onAddExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
        onAddSparePart={vi.fn()}
        onDeleteSparePart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Complete Trip' }));
    expect(screen.getByRole('dialog', { name: 'Complete and finalize this trip?' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Final odometer reading in kilometers' }), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Finalize Trip' }));

    expect(onUpdateStatus).toHaveBeenCalledWith(trip.id, 'Completed', 0);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not complete a trip when the final odometer is below its start reading', () => {
    const onUpdateStatus = vi.fn();
    const tripWithTruck = {
      ...trip,
      truck: {
        id: 'truck-1',
        license_plate: 'ABC 123',
        model: 'Truck',
        status: 'On Trip' as const,
        current_mileage: 100_000,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    };

    render(
      <TripDetailModal
        trip={tripWithTruck}
        onClose={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onAddDelayLog={vi.fn()}
        onRemoveDelayLog={vi.fn()}
        onAddExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
        onAddSparePart={vi.fn()}
        onDeleteSparePart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Complete Trip' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Final odometer reading in kilometers' }), {
      target: { value: '99999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Finalize Trip' }));

    expect(onUpdateStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('at least 100,000 km');
  });
});
