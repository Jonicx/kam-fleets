import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, Payment } from '../types/database.ts';
import { printInvoice, printReceipt } from '../components/printInvoice.ts';

describe('print documents', () => {
  let writtenDocument = '';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockPrintWindow = () => {
    writtenDocument = '';
    const popup = {
      document: {
        write: vi.fn((html: string) => {
          writtenDocument = html;
        }),
        close: vi.fn(),
      },
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
  };

  const invoice: Invoice = {
    id: 'invoice-1',
    invoice_number: 'JCQ-2026-1A260B5A',
    amount: 3500000,
    issued_at: '2026-10-07T12:00:00.000Z',
    due_at: '2026-11-11T23:59:59.000Z',
    created_at: '2026-10-07T12:00:00.000Z',
  };

  it('prints a professionally styled invoice with KAM branding and legacy KAM numbering', () => {
    mockPrintWindow();

    printInvoice(invoice, undefined, undefined, 0);

    expect(writtenDocument).toContain('Invoice KAM-2026-1A260B5A');
    expect(writtenDocument).toContain('print-logo.png');
    expect(writtenDocument).not.toContain('Fleet &amp; transport services');
    expect(writtenDocument).not.toContain('Official document');
    expect(writtenDocument).toContain('Bill to');
    expect(writtenDocument).toContain('Balance due');
    expect(writtenDocument).not.toContain('JCQ-2026');
  });

  it('prints a branded receipt for an individual invoice payment', () => {
    mockPrintWindow();
    const payment: Payment = {
      id: '12345678-abcd-1234-abcd-123456789abc',
      invoice_id: invoice.id,
      amount: 1000000,
      method: 'Bank transfer',
      paid_at: '2026-10-20T12:00:00.000Z',
      reference: 'BANK-REF-19',
      created_at: '2026-10-20T12:00:00.000Z',
    };

    printReceipt(payment, invoice, undefined, undefined, undefined, 0);

    expect(writtenDocument).toContain('Payment receipt KAM-RCP-2026-12345678');
    expect(writtenDocument).toContain('print-logo.png');
    expect(writtenDocument).toContain('Bank transfer');
    expect(writtenDocument).toContain('KAM-2026-1A260B5A');
    expect(writtenDocument).toContain('Balance after payment');
  });
});
