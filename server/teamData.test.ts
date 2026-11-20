import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { FleetDomain } from '../src/db/domain.ts';
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
