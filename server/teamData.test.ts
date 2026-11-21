import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { FleetDomain } from '../src/db/domain.ts';
import type { Expense, Invoice, SparePart } from '../src/types/database.ts';
import { saveChanges, ServerDomain } from './teamData.ts';

describe('driver persistence', () => {
  it('inserts a new driver with a zero total distance', async () => {
    const before = new FleetDomain().getSnapshot();
    const driverId = '00000000-0000-4000-8000-000000000001';
    const auditId = '00000000-0000-4000-8000-000000000002';
    const domain = new ServerDomain(before, 'Test User', [driverId, auditId]);
    domain.executeCommand('createDriver', [{
      full_name: 'New Driver',
      license_number: 'NEW-123',
      phone: '1234567890',
      status: 'Available',
      experience_years: 5,
    }]);

    const calls: { statement: string; values: unknown[] }[] = [];
    const query = vi.fn(async (...args: unknown[]) => {
      calls.push({
        statement: String(args[0]),
        values: Array.isArray(args[1]) ? args[1] : [],
      });
      return { rows: [{ data_version: 1 }] };
    });
    await saveChanges(
      { query } as unknown as PoolClient,
      before,
      domain.getSnapshot(),
      '00000000-0000-4000-8000-000000000003',
      'Test User',
    );

    const driverInsert = calls.find(({ statement }) => statement.startsWith('INSERT INTO drivers'));
    expect(driverInsert?.values[6]).toBe(0);
  });
});

describe('invoice persistence', () => {
  it('records who voided an invoice in the same upsert', async () => {
    const invoiceId = '00000000-0000-4000-8000-000000000011';
    const actorUserId = '00000000-0000-4000-8000-000000000012';
    const invoice: Invoice = {
      id: invoiceId,
      invoice_number: 'KAM-TEST-VOID',
      amount: 1500,
      issued_at: '2026-11-20T09:00:00.000Z',
      due_at: '2026-11-21T09:00:00.000Z',
      created_at: '2026-11-20T09:00:00.000Z',
    };
    const before = { ...new FleetDomain().getSnapshot(), invoices: [invoice] };
    const after = {
      ...before,
      invoices: [{ ...invoice, voided_at: '2026-11-21T06:00:00.000Z', void_reason: 'Cancelled' }],
    };

    const calls: { statement: string; values: unknown[] }[] = [];
    const query = vi.fn(async (...args: unknown[]) => {
      calls.push({
        statement: String(args[0]),
        values: Array.isArray(args[1]) ? args[1] : [],
      });
      return { rows: [{ data_version: 1 }] };
    });

    await saveChanges(
      { query } as unknown as PoolClient,
      before,
      after,
      actorUserId,
      'Test User',
    );

    const invoiceUpsert = calls.find(({ statement }) => statement.startsWith('INSERT INTO invoices'));
    expect(invoiceUpsert?.statement).toContain('voided_by');
    expect(invoiceUpsert?.values).toContain(actorUserId);
    expect(calls.some(({ statement }) => statement.startsWith('UPDATE invoices SET voided_by'))).toBe(false);
  });
});

describe('standalone cost persistence', () => {
  it('inserts standalone expenses and spare parts with a null trip id', async () => {
    const before = new FleetDomain().getSnapshot();
    const expense: Expense = {
      id: '00000000-0000-4000-8000-000000000021',
      expense_type: 'Fuel',
      amount: 1250,
      description: 'Standalone expense',
      timestamp: '2026-11-21T06:00:00.000Z',
      created_at: '2026-11-21T06:00:00.000Z',
    };
    const part: SparePart = {
      id: '00000000-0000-4000-8000-000000000022',
      part_name: 'Standalone part',
      price: 2500,
      description: 'Standalone spare part',
      timestamp: '2026-11-21T06:00:00.000Z',
      created_at: '2026-11-21T06:00:00.000Z',
    };
    const after = {
      ...before,
      expenses: [expense, ...before.expenses],
      spareParts: [part, ...before.spareParts],
    };

    const calls: { statement: string; values: unknown[] }[] = [];
    const query = vi.fn(async (...args: unknown[]) => {
      calls.push({
        statement: String(args[0]),
        values: Array.isArray(args[1]) ? args[1] : [],
      });
      return { rows: [{ data_version: 1 }] };
    });

    await saveChanges(
      { query } as unknown as PoolClient,
      before,
      after,
      '00000000-0000-4000-8000-000000000023',
      'Test User',
    );

    const expenseInsert = calls.find(({ statement }) => statement.startsWith('INSERT INTO expenses'));
    const partInsert = calls.find(({ statement }) => statement.startsWith('INSERT INTO spare_parts'));
    expect(expenseInsert?.values[1]).toBeNull();
    expect(partInsert?.values[1]).toBeNull();
  });
});
