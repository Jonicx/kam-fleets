import type { EnrichedTrip, Invoice, Driver } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { formatDate } from './adminDashboardUtils.ts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

export function printInvoice(invoice: Invoice, trip: EnrichedTrip | undefined, driver: Driver | undefined, paid: number) {
  const popup = window.open('', '_blank', 'width=800,height=900');
  if (!popup) throw new Error('Allow pop-ups to print or save the invoice as PDF.');
  const isDriverInvoice = invoice.driver_id !== undefined;
  const route = trip ? `${trip.origin} → ${trip.destination}` : 'Trip unavailable';
  const rows: [string, string][] = [
    ['Invoice number', invoice.invoice_number],
    ['Issued', formatDate(invoice.issued_at)],
    ['Due', formatDate(invoice.due_at)],
  ];
  if (isDriverInvoice) {
    rows.push(['Type', 'Driver Invoice']);
    rows.push(['Driver', driver?.full_name ?? '-']);
    rows.push(['Phone', driver?.phone ?? '-']);
  } else {
    rows.push(['Type', 'Trip Invoice']);
    rows.push(['Route', route]);
    rows.push(['Truck', trip?.truck?.license_plate ?? '-']);
    rows.push(['Driver', trip?.driver?.full_name ?? '-']);
    rows.push(['Cargo', trip?.cargo_type ?? '-']);
  }
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title>
<style>body{font-family:system-ui,sans-serif;color:#0f172a;margin:40px}h1{margin:0}small{color:#d97706;font-weight:700;letter-spacing:.15em}
table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:14px}td:last-child{text-align:right;font-weight:600}
.total td{font-size:16px;font-weight:800}.void{color:#be123c;font-weight:800;font-size:20px;margin-top:16px}</style></head><body>
<small>KAM FLEETS</small><h1>Invoice ${escapeHtml(invoice.invoice_number)}</h1>
${invoice.voided_at ? `<p class="void">VOID - ${escapeHtml(invoice.void_reason ?? '')}</p>` : ''}
<table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}
<tr class="total"><td>Amount</td><td>${escapeHtml(formatTsh(invoice.amount))}</td></tr>
<tr><td>Received</td><td>${escapeHtml(formatTsh(paid))}</td></tr>
<tr class="total"><td>Balance due</td><td>${escapeHtml(formatTsh(Math.max(0, invoice.amount - paid)))}</td></tr></table>
<script>window.onload=()=>{window.print()}</script></body></html>`);
  popup.document.close();
}