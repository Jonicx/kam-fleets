import { describe, it, expect } from 'vitest';
import { formatTsh } from '../utils/currency';
import { toLocalDateTimeInput } from '../utils/dateInput';
import { getDelaySeverityClasses } from '../utils/delaySeverity';
import { canEditTruckServiceRecord } from '../utils/truckService';

describe('Currency Utils', () => {
  describe('formatTsh', () => {
    it('should format zero correctly', () => {
      expect(formatTsh(0)).toBe('Tsh 0.00');
    });

    it('should format positive numbers', () => {
      expect(formatTsh(1000)).toBe('Tsh 1,000.00');
      expect(formatTsh(1000000)).toBe('Tsh 1,000,000.00');
      expect(formatTsh(1500000)).toBe('Tsh 1,500,000.00');
    });

    it('should format negative numbers', () => {
      expect(formatTsh(-1000)).toBe('Tsh -1,000.00');
      expect(formatTsh(-500)).toBe('Tsh -500.00');
    });

    it('should handle decimal values', () => {
      expect(formatTsh(1000.5)).toBe('Tsh 1,000.50');
      expect(formatTsh(1000.49)).toBe('Tsh 1,000.49');
    });

    it('should handle very large numbers', () => {
      expect(formatTsh(9999999999)).toBe('Tsh 9,999,999,999.00');
    });

    it('should format without decimals when maximumFractionDigits is 0', () => {
      expect(formatTsh(1000, { maximumFractionDigits: 0 })).toBe('Tsh 1,000');
    });
  });
});

describe('Date Input Utils', () => {
  describe('toLocalDateTimeInput', () => {
    it('should format ISO date string to input format', () => {
      const isoDate = '2026-10-28T10:30:00Z';
      const result = toLocalDateTimeInput(isoDate);
      expect(result).toContain('2026-10-28');
      expect(result).toContain('T');
    });

    it('should handle different date formats', () => {
      const isoDate = '2026-12-31T23:59:59Z';
      const result = toLocalDateTimeInput(isoDate);
      // The function converts to local timezone, so we just check it has a date
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle empty string', () => {
      const result = toLocalDateTimeInput('');
      expect(result).toBe('');
    });

    it('should handle invalid date', () => {
      const result = toLocalDateTimeInput('invalid-date');
      expect(result).toBe('');
    });
  });
});

describe('Delay Severity Utils', () => {
  describe('getDelaySeverityClasses', () => {
    it('should return classes for Low severity', () => {
      const classes = getDelaySeverityClasses('Low');
      expect(classes).toContain('bg-slate-50');
      expect(classes).toContain('text-slate-700');
    });

    it('should return classes for Medium severity', () => {
      const classes = getDelaySeverityClasses('Medium');
      expect(classes).toContain('bg-orange-50');
      expect(classes).toContain('text-orange-800');
    });

    it('should return classes for High severity', () => {
      const classes = getDelaySeverityClasses('High');
      expect(classes).toContain('bg-rose-50');
      expect(classes).toContain('text-rose-800');
    });

    it('should return classes for Critical severity', () => {
      const classes = getDelaySeverityClasses('Critical');
      expect(classes).toContain('bg-rose-50');
      expect(classes).toContain('text-rose-800');
    });
  });
});

describe('Truck Service Utils', () => {
  describe('canEditTruckServiceRecord', () => {
    it('should allow editing within 7 days', () => {
      const recentRecord = {
        id: '1',
        truck_id: 'truck1',
        record_type: 'Service' as const,
        item_name: 'Oil Change',
        price: 500,
        mechanic_name: 'John',
        service_location: 'Garage',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(canEditTruckServiceRecord(recentRecord)).toBe(true);
    });

    it('should allow editing on exactly 7th day', () => {
      const sevenDayRecord = {
        id: '1',
        truck_id: 'truck1',
        record_type: 'Service' as const,
        item_name: 'Oil Change',
        price: 500,
        mechanic_name: 'John',
        service_location: 'Garage',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(canEditTruckServiceRecord(sevenDayRecord)).toBe(true);
    });

    it('should not allow editing after 7 days', () => {
      const oldRecord = {
        id: '1',
        truck_id: 'truck1',
        record_type: 'Service' as const,
        item_name: 'Oil Change',
        price: 500,
        mechanic_name: 'John',
        service_location: 'Garage',
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(canEditTruckServiceRecord(oldRecord)).toBe(false);
    });

    it('should not allow editing very old records', () => {
      const veryOldRecord = {
        id: '1',
        truck_id: 'truck1',
        record_type: 'Service' as const,
        item_name: 'Oil Change',
        price: 500,
        mechanic_name: 'John',
        service_location: 'Garage',
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(canEditTruckServiceRecord(veryOldRecord)).toBe(false);
    });

    it('should allow editing of very recent records', () => {
      const recentRecord = {
        id: '1',
        truck_id: 'truck1',
        record_type: 'Service' as const,
        item_name: 'Oil Change',
        price: 500,
        mechanic_name: 'John',
        service_location: 'Garage',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      };

      expect(canEditTruckServiceRecord(recentRecord)).toBe(true);
    });
  });
});
