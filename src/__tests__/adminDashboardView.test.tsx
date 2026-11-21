import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardView } from '../components/AdminDashboardView.tsx';
import type { EnrichedTrip } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';

describe('AdminDashboardView monthly financial trend', () => {
  it('groups completed-trip costs by the scheduled start date, not the completion date', () => {
    const now = new Date();
    const scheduledStartDate = new Date(now.getFullYear(), now.getMonth() - 4, 15, 12);
    const scheduledStart = scheduledStartDate.toISOString();
    const scheduledEnd = new Date(scheduledStartDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const trip: EnrichedTrip = {
      id: 'trip-with-delayed-completion',
      truck_id: 'truck-1',
      driver_id: 'driver-1',
      status: 'Completed',
      origin: 'Dar es Salaam',
      destination: 'Arusha',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      completed_at: now.toISOString(),
      budget_allocated: 1_000,
      driver_pay: 50,
      delay_logs: [],
      created_at: scheduledStart,
      updated_at: now.toISOString(),
      expenses: [],
      spare_parts: [],
      total_expenses: 400,
      total_spare_parts: 100,
      total_spent: 550,
      remaining_budget: 450,
      budget_utilization_pct: 55,
      is_over_budget: false,
      profit_loss: 450,
    };

    render(
      <AdminDashboardView
        trips={[trip]}
        trucks={[]}
        drivers={[]}
        clients={[]}
        truckServiceRecords={[]}
        invoices={[]}
        payments={[]}
        auditLogs={[]}
        onSelectTrip={vi.fn()}
        onCreateInvoice={() => { throw new Error('Unexpected invoice creation'); }}
        onCreatePayment={() => { throw new Error('Unexpected payment creation'); }}
        onVoidInvoice={vi.fn()}
        onReversePayment={vi.fn()}
        onLoadOlderAuditLogs={async () => ({ logs: [], total: 0, hasMore: false })}
      />,
    );

    fireEvent.change(screen.getByLabelText('Filter report by date period'), { target: { value: 'all' } });

    const chart = screen.getByRole('img', {
      name: 'Bar chart comparing invoiced amounts, cash collected and recorded costs for the last six months',
    });
    const costTooltips = within(chart).getAllByTitle(/recorded costs/);
    const tripMonth = scheduledStartDate.toLocaleDateString(undefined, { month: 'short' });
    const completionMonth = now.toLocaleDateString(undefined, { month: 'short' });
    const tripMonthCost = costTooltips.find((bar) => bar.getAttribute('title')?.startsWith(`${tripMonth}:`));
    const completionMonthCost = costTooltips.find((bar) => bar.getAttribute('title')?.startsWith(`${completionMonth}:`));

    expect(tripMonthCost).toHaveAttribute('title', `${tripMonth}: recorded costs ${formatTsh(550)}`);
    expect(completionMonthCost).toHaveAttribute('title', `${completionMonth}: recorded costs ${formatTsh(0)}`);
  });
});
