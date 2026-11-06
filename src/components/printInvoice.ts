import type { EnrichedTrip, Invoice, Payment, Driver, Client } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { formatDate } from './adminDashboardUtils.ts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

const printableInvoiceNumber = (invoiceNumber: string) =>
  invoiceNumber.replace(/^JCQ(?=-)/i, 'KAM');

const brandLogoUrl = new URL(`${import.meta.env.BASE_URL}print-logo.png`, window.location.origin).href;

function openPrintDocument(title: string, documentNumber: string, content: string) {
  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (!popup) throw new Error(`Allow pop-ups to print or save the ${title.toLowerCase()} as PDF.`);

  popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} ${escapeHtml(documentNumber)}</title>
    <style>
      :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #172033; background: #fff; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 36px; background: #eef2f7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { width: 100%; max-width: 820px; min-height: 900px; margin: 0 auto; padding: 44px 48px; background: #fff; box-shadow: 0 12px 38px rgba(15, 23, 42, .12); }
      .topline { height: 6px; margin: -44px -48px 34px; background: #f5b925; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 1px solid #e2e8f0; }
      .logo { display: block; width: 190px; max-height: 76px; object-fit: contain; }
      .doc-heading { text-align: right; }
      h1 { margin: 0 0 7px; color: #111827; font-size: 30px; letter-spacing: -.04em; }
      .doc-number { color: #475569; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
      .status { display: inline-block; margin-top: 12px; padding: 6px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .status.void { background: #fff1f2; color: #be123c; }
      .section-title { margin: 28px 0 12px; color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .meta-card { min-height: 68px; padding: 13px 15px; border: 1px solid #e2e8f0; border-radius: 9px; background: #f8fafc; }
      .meta-label { display: block; margin-bottom: 7px; color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      .meta-value { color: #172033; font-size: 12px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
      table { width: 100%; margin-top: 26px; border-collapse: collapse; }
      th { padding: 11px 13px; background: #111827; color: #fff; font-size: 9px; letter-spacing: .12em; text-align: left; text-transform: uppercase; }
      th:last-child, td:last-child { text-align: right; }
      td { padding: 14px 13px; border-bottom: 1px solid #e2e8f0; font-size: 12px; line-height: 1.5; vertical-align: top; }
      .item-title { color: #172033; font-weight: 700; }
      .item-detail { margin-top: 4px; color: #64748b; font-size: 10px; }
      .amount { white-space: nowrap; font-weight: 700; }
      .totals { width: min(100%, 340px); margin: 24px 0 0 auto; }
      .total-row { display: flex; justify-content: space-between; gap: 18px; padding: 9px 0; color: #475569; font-size: 11px; }
      .total-row strong { color: #172033; text-align: right; white-space: nowrap; }
      .grand-total { margin-top: 7px; padding: 15px 16px; border-radius: 9px; background: #111827; color: #fff; }
      .grand-total span, .grand-total strong { color: #fff; font-size: 13px; font-weight: 800; }
      .grand-total strong { color: #ffd166; }
      .balance { padding-top: 13px; border-top: 1px solid #e2e8f0; font-size: 12px; font-weight: 800; }
      .notice { margin-top: 22px; padding: 12px 14px; border-left: 3px solid #f5b925; background: #fffbeb; color: #713f12; font-size: 10px; line-height: 1.6; }
      .footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 9px; line-height: 1.6; text-align: center; }
      .footer strong { color: #172033; }
      @page { size: A4; margin: 12mm; }
      @media print {
        body { padding: 0; background: #fff; }
        .sheet { max-width: none; min-height: 0; margin: 0; padding: 22px 24px; box-shadow: none; }
        .topline { margin: -22px -24px 25px; }
        .footer { margin-top: 42px; }
      }
      @media screen and (max-width: 600px) {
        body { padding: 12px; }
        .sheet { min-height: 0; padding: 24px 20px; }
        .topline { margin: -24px -20px 24px; }
        .header { flex-direction: column; }
        .doc-heading { text-align: left; }
        h1 { font-size: 25px; }
        .meta-grid { grid-template-columns: 1fr; }
        .totals { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="topline"></div>
      <header class="header">
        <img class="logo" src="${escapeHtml(brandLogoUrl)}" alt="KAM Fleets">
        <div class="doc-heading">
          <h1>${escapeHtml(title)}</h1>
          <div class="doc-number">${escapeHtml(documentNumber)}</div>
        </div>
      </header>
      ${content}
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));</script>
    </main>
  </body>
</html>`);
  popup.document.close();
}

function metadataCard(label: string, value: string) {
  return `<div class="meta-card"><span class="meta-label">${escapeHtml(label)}</span><div class="meta-value">${escapeHtml(value)}</div></div>`;
}

function documentFooter() {
  return `<footer class="footer"><strong>Thank you for choosing KAM Fleets.</strong><br>Please keep this document for your records.</footer>`;
}

export function printInvoice(
  invoice: Invoice,
  trip: EnrichedTrip | undefined,
  driver: Driver | undefined,
  paid: number,
  client?: Client,
) {
  const isDriverInvoice = invoice.driver_id !== undefined;
  const invoiceNumber = printableInvoiceNumber(invoice.invoice_number);
  const balance = Math.max(0, invoice.amount - paid);
  const route = trip ? `${trip.origin} → ${trip.destination}` : 'Trip unavailable';
  const billTo = client?.name ?? (isDriverInvoice ? driver?.full_name : undefined) ?? 'Customer';
  const details = isDriverInvoice
    ? [
        ['Invoice type', 'Driver invoice'],
        ['Driver', driver?.full_name ?? 'Unavailable'],
        ['Phone', driver?.phone ?? '—'],
        ...(trip ? [['Related trip', route]] : []),
        ...(invoice.reason ? [['Description', invoice.reason]] : []),
      ]
    : [
        ['Invoice type', 'Trip invoice'],
        ['Route', route],
        ['Truck', trip?.truck?.license_plate ?? '—'],
        ['Driver', trip?.driver?.full_name ?? '—'],
        ['Cargo', trip?.cargo_type ?? '—'],
      ];
  const status = invoice.voided_at ? 'void' : balance === 0 ? 'paid' : paid > 0 ? 'partially paid' : 'payment due';
  const voidStatus = invoice.voided_at
    ? `<span class="status void">Void · ${escapeHtml(invoice.void_reason ?? 'Voided')}</span>`
    : `<span class="status">${escapeHtml(status)}</span>`;
  const content = `
      ${voidStatus}
      <section>
        <h2 class="section-title">Invoice details</h2>
        <div class="meta-grid">
          ${metadataCard('Bill to', billTo)}
          ${metadataCard('Invoice date', formatDate(invoice.issued_at))}
          ${metadataCard('Invoice number', invoiceNumber)}
          ${metadataCard('Payment due', formatDate(invoice.due_at))}
          ${details.map(([label, value]) => metadataCard(label, value)).join('')}
        </div>
      </section>
      <table>
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          <tr>
            <td><div class="item-title">${escapeHtml(isDriverInvoice ? invoice.reason || 'Driver service' : 'Trip transportation service')}</div><div class="item-detail">${escapeHtml(isDriverInvoice ? `Invoice for ${driver?.full_name ?? 'driver services'}` : route)}</div></td>
            <td class="amount">${escapeHtml(formatTsh(invoice.amount))}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Invoice total</span><strong>${escapeHtml(formatTsh(invoice.amount))}</strong></div>
        <div class="total-row"><span>Payments received</span><strong>${escapeHtml(formatTsh(paid))}</strong></div>
        <div class="total-row balance"><span>Balance due</span><strong>${escapeHtml(formatTsh(balance))}</strong></div>
      </div>
      ${invoice.voided_at ? `<div class="notice"><strong>Invoice voided:</strong> ${escapeHtml(invoice.void_reason ?? 'No reason provided.')}</div>` : ''}
      ${documentFooter()}`;
  openPrintDocument('Invoice', invoiceNumber, content);
}

export function printReceipt(
  payment: Payment,
  invoice: Invoice,
  trip: EnrichedTrip | undefined,
  client: Client | undefined,
  driver: Driver | undefined,
  paidBefore: number,
) {
  const invoiceNumber = printableInvoiceNumber(invoice.invoice_number);
  const receiptNumber = `KAM-RCP-${new Date(payment.paid_at).getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`;
  const remainingBalance = Math.max(0, invoice.amount - paidBefore - payment.amount);
  const content = `
      ${payment.reversed_at ? '<span class="status void">Reversed payment</span>' : '<span class="status">Payment received</span>'}
      <section>
        <h2 class="section-title">Receipt details</h2>
        <div class="meta-grid">
          ${metadataCard('Receipt number', receiptNumber)}
          ${metadataCard('Date received', formatDate(payment.paid_at))}
          ${metadataCard('Received from', client?.name ?? driver?.full_name ?? 'Customer')}
          ${metadataCard('Related invoice', invoiceNumber)}
          ${metadataCard('Payment method', payment.method)}
          ${metadataCard('Payment reference', payment.reference || '—')}
          ${trip ? metadataCard('Trip route', `${trip.origin} → ${trip.destination}`) : ''}
        </div>
      </section>
      <table>
        <thead><tr><th>Payment description</th><th>Amount</th></tr></thead>
        <tbody>
          <tr>
            <td><div class="item-title">Payment against invoice ${escapeHtml(invoiceNumber)}</div><div class="item-detail">${escapeHtml(payment.notes || 'Payment received by KAM Fleets')}</div></td>
            <td class="amount">${escapeHtml(formatTsh(payment.amount))}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Invoice total</span><strong>${escapeHtml(formatTsh(invoice.amount))}</strong></div>
        <div class="total-row"><span>This payment</span><strong>${escapeHtml(formatTsh(payment.amount))}</strong></div>
        <div class="total-row balance"><span>${payment.reversed_at ? 'Balance due' : 'Balance after payment'}</span><strong>${escapeHtml(formatTsh(payment.reversed_at ? Math.max(0, invoice.amount - paidBefore) : remainingBalance))}</strong></div>
      </div>
      ${payment.reversed_at ? `<div class="notice"><strong>Payment reversed:</strong> ${escapeHtml(payment.reversal_reason ?? 'This receipt is for a reversed payment.')}</div>` : ''}
      ${documentFooter()}`;
  openPrintDocument('Payment receipt', receiptNumber, content);
}
