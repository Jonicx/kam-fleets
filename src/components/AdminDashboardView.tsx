import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  AlertTriangle,
  FileText,
  History,
  Receipt,
  UserRound,
  LayoutDashboard,
} from 'lucide-react';
import { AuditDetailModal } from './AuditDetailModal.tsx';
import {
  EnrichedTrip,
  Driver,
  Truck as TruckRecord,
  TruckServiceRecord,
  Invoice, 
  Payment,
  PaymentMethod,
  AuditLog,
} from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { MetricCard } from './AdminDashboardPrimitives.tsx';
import { AdminSummaryDropdown } from './AdminSummaryDropdown.tsx';
import { AdminBillingSection } from './AdminBillingSection.tsx';
import { AdminDataQualityPanel, AdminPriorityWarnings } from './AdminDataQualityPanel.tsx';
import { AdminOverviewSection } from './AdminOverviewSection.tsx';
import { AdminTripLedger } from './AdminTripLedger.tsx';
import { TeamAccessPanel } from './TeamAccessPanel.tsx';
import { DateRange, formatDate, getInvoiceStatus, getTripCostBreakdown, isWithinRange } from './adminDashboardUtils.ts';

interface AdminDashboardViewProps {
  trips: EnrichedTrip[];
  trucks: TruckRecord[];
  drivers: Driver[];
  truckServiceRecords: TruckServiceRecord[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  onSelectTrip: (tripId: string) => void;
  onCreateInvoice: (data: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'> & { invoice_number?: string }) => Invoice;
  onCreatePayment: (data: Omit<Payment, 'id' | 'created_at'>) => Payment;
  onVoidInvoice: (invoiceId: string, reason: string) => void;
  onReversePayment: (paymentId: string, reason: string) => void;
}

type LedgerFilter = 'All' | EnrichedTrip['status'];
type DatePreset = 'today' | 'all' | '30d' | '90d' | 'ytd' | 'custom';
type DashboardSection = 'overview' | 'billing' | 'trip-costs' | 'review';

const monthKey = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const dateInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const getRecordedTripCosts = (trip: EnrichedTrip) =>
  trip.total_expenses +
  trip.total_spare_parts +
  Number(trip.driver_pay || 0);

const escapeCsvValue = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  trips,
  trucks,
  drivers,
  truckServiceRecords,
  invoices: allInvoices,
  payments: allPayments,
  auditLogs,
  onSelectTrip,
  onCreateInvoice,
  onCreatePayment,
  onVoidInvoice,
  onReversePayment,
}) => {
  const invoices = useMemo(() => allInvoices.filter((invoice) => !invoice.voided_at), [allInvoices]);
  const payments = useMemo(() => allPayments.filter((payment) => !payment.reversed_at), [allPayments]);
  const [filter, setFilter] = useState<LedgerFilter>('All');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [today, setToday] = useState(() => new Date());
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [showBudgetInChart, setShowBudgetInChart] = useState(false);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [invoiceTripId, setInvoiceTripId] = useState('');
  const [invoiceDriverId, setInvoiceDriverId] = useState('');
  const [invoiceLinkedTripId, setInvoiceLinkedTripId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'trip' | 'driver'>('trip');
  const [invoiceReason, setInvoiceReason] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState(() => dateInputValue(new Date()));
  const [invoiceDueAt, setInvoiceDueAt] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return dateInputValue(due);
  });
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentPaidAt, setPaymentPaidAt] = useState(() => dateInputValue(new Date()));
  const [accountingError, setAccountingError] = useState('');
  const [accountingSuccess, setAccountingSuccess] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeout = window.setTimeout(() => setToday(new Date()), nextMidnight.getTime() - now.getTime() + 50);
    return () => window.clearTimeout(timeout);
  }, [today]);

  const reportRange = useMemo<DateRange>(() => {
    const now = new Date();
    if (datePreset === 'today') {
      return {
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() - 1,
      };
    }
    if (datePreset === '30d' || datePreset === '90d') {
      return { start: now.getTime() - (datePreset === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000, end: now.getTime() };
    }
    if (datePreset === 'ytd') {
      return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: now.getTime() };
    }
    if (datePreset === 'custom') {
      const start = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null;
      const endDate = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : null;
      return { start: start !== null && Number.isFinite(start) ? start : null, end: endDate !== null && Number.isFinite(endDate) ? endDate : null };
    }
    return { start: null, end: null };
  }, [customFrom, customTo, datePreset, today]);

  const reportTrips = useMemo(
    () => trips.filter((trip) =>
      (filter === 'All' || trip.status === filter) &&
      (
        isWithinRange(trip.status === 'Completed' ? trip.completed_at || trip.scheduled_end : trip.scheduled_start, reportRange) ||
        (trip.status !== 'Completed' && (
          trip.expenses.some((expense) => isWithinRange(expense.timestamp, reportRange)) ||
          trip.spare_parts.some((part) => isWithinRange(part.timestamp, reportRange))
        )) ||
        invoices
          .filter((invoice) => invoice.trip_id === trip.id)
          .some((invoice) =>
            isWithinRange(invoice.issued_at, reportRange) ||
            payments.some((payment) =>
              payment.invoice_id === invoice.id && isWithinRange(payment.paid_at, reportRange),
            ),
          )
      ),
    ),
    [filter, invoices, payments, reportRange, trips],
  );
  const statusTripIds = useMemo(
    () => new Set(trips.filter((trip) => filter === 'All' || trip.status === filter).map((trip) => trip.id)),
    [filter, trips],
  );

  const analytics = useMemo(() => {
    const completedTrips = reportTrips.filter((trip) =>
      trip.status === 'Completed' &&
      isWithinRange(trip.completed_at || trip.scheduled_end, reportRange),
    );
    const completedTripBudget = completedTrips.reduce(
      (total, trip) => total + Number(trip.budget_allocated || 0),
      0,
    );
    const finalizedBudgetVariance = completedTrips.reduce(
      (total, trip) => total + trip.profit_loss,
      0,
    );
    const recordedExpenses = completedTrips.reduce((total, trip) => total + Number(trip.total_expenses || 0), 0) +
      reportTrips.filter((trip) => trip.status !== 'Completed').reduce(
        (total, trip) => total + trip.expenses
          .filter((expense) => isWithinRange(expense.timestamp, reportRange))
          .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        0,
      );
    const recordedParts = completedTrips.reduce((total, trip) => total + Number(trip.total_spare_parts || 0), 0) +
      reportTrips.filter((trip) => trip.status !== 'Completed').reduce(
        (total, trip) => total + trip.spare_parts
          .filter((part) => isWithinRange(part.timestamp, reportRange))
          .reduce((sum, part) => sum + Number(part.price || 0), 0),
        0,
      );
    const completedDriverPay = completedTrips.reduce((total, trip) => total + Number(trip.driver_pay || 0), 0);
    const fleetServiceCosts = truckServiceRecords
      .filter((record) => isWithinRange(record.timestamp, reportRange))
      .reduce((total, record) => total + Number(record.price || 0), 0);
    const tripOperatingCosts = recordedExpenses + recordedParts + completedDriverPay;
    const totalRecordedCosts = tripOperatingCosts + fleetServiceCosts;
    const profitableTrips = completedTrips.filter((trip) => trip.profit_loss >= 0).length;
    const lossTrips = completedTrips.length - profitableTrips;
    const reportInvoices = invoices.filter((invoice) =>
      (invoice.trip_id && statusTripIds.has(invoice.trip_id) || invoice.driver_id) && isWithinRange(invoice.issued_at, reportRange),
    );
    const invoicedAmount = reportInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0);
    const reportTripInvoices = invoices.filter((invoice) => invoice.trip_id && statusTripIds.has(invoice.trip_id));
    const reportDriverInvoices = invoices.filter((invoice) => invoice.driver_id && !invoice.trip_id);
    const invoiceIds = new Set([...reportTripInvoices, ...reportDriverInvoices].map((invoice) => invoice.id));
    const collectedCash = payments
      .filter((payment) => invoiceIds.has(payment.invoice_id) && isWithinRange(payment.paid_at, reportRange))
      .reduce((total, payment) => total + Number(payment.amount), 0);
    const outstandingBalance = reportInvoices.reduce((total, invoice) => {
      const paid = payments
        .filter((payment) => payment.invoice_id === invoice.id)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      return total + Math.max(0, Number(invoice.amount) - paid);
    }, 0);

    const chartEnd = reportRange.end === null ? new Date() : new Date(reportRange.end);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(chartEnd.getFullYear(), chartEnd.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        key,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        budget: 0,
        invoiced: 0,
        collected: 0,
        costs: 0,
      };
    });
    const monthByKey = new Map(months.map((month) => [month.key, month]));

    for (const trip of reportTrips) {
      if (trip.status === 'Completed') {
        const key = monthKey(trip.completed_at || trip.scheduled_end);
        const month = key ? monthByKey.get(key) : undefined;
        if (month && isWithinRange(trip.completed_at || trip.scheduled_end, reportRange)) {
          month.budget += Number(trip.budget_allocated || 0);
          month.costs += getRecordedTripCosts(trip);
        }
      } else {
        for (const expense of trip.expenses) {
          const key = monthKey(expense.timestamp);
          const month = key ? monthByKey.get(key) : undefined;
          if (month && isWithinRange(expense.timestamp, reportRange)) month.costs += Number(expense.amount || 0);
        }
        for (const part of trip.spare_parts) {
          const key = monthKey(part.timestamp);
          const month = key ? monthByKey.get(key) : undefined;
          if (month && isWithinRange(part.timestamp, reportRange)) month.costs += Number(part.price || 0);
        }
      }
    }

    for (const invoice of [...reportTripInvoices, ...reportDriverInvoices]) {
      const key = monthKey(invoice.issued_at);
      const month = key ? monthByKey.get(key) : undefined;
      if (month && isWithinRange(invoice.issued_at, reportRange)) {
        month.invoiced += Number(invoice.amount || 0);
      }
    }

    for (const payment of payments) {
      const invoice = [...reportTripInvoices, ...reportDriverInvoices].find((item) => item.id === payment.invoice_id);
      const key = monthKey(payment.paid_at);
      const month = key ? monthByKey.get(key) : undefined;
      if (invoice && month && isWithinRange(payment.paid_at, reportRange)) {
        month.collected += Number(payment.amount || 0);
      }
    }

    for (const record of truckServiceRecords.filter((item) => isWithinRange(item.timestamp, reportRange))) {
      const key = monthKey(record.timestamp);
      const month = key ? monthByKey.get(key) : undefined;
      if (month) month.costs += Number(record.price || 0);
    }

    const costCategories = [
      {
        label: 'Trip expenses',
        amount: recordedExpenses,
        color: 'bg-blue-500',
      },
      {
        label: 'In-trip parts',
        amount: recordedParts,
        color: 'bg-amber-500',
      },
      {
        label: 'Completed driver pay',
        amount: completedDriverPay,
        color: 'bg-emerald-500',
      },
      {
        label: 'Fleet servicing',
        amount: fleetServiceCosts,
        color: 'bg-violet-500',
      },
    ];

    return {
      completedTrips,
      completedTripBudget,
      finalizedBudgetVariance,
      totalRecordedCosts,
      fleetServiceCosts,
      invoicedAmount,
      collectedCash,
      outstandingBalance,
      reportInvoices,
      reportTripInvoices,
      statusTripIds,
      profitableTrips,
      lossTrips,
      months,
      costCategories,
    };
  }, [invoices, payments, reportRange, reportTrips, statusTripIds, truckServiceRecords]);

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...reportTrips]
      .filter((trip) => {
        if (!query) return true;
        return [
          trip.origin,
          trip.destination,
          trip.driver?.full_name,
          trip.truck?.license_plate,
          trip.cargo_type,
        ].some((value) => value?.toLocaleLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          new Date(b.completed_at || b.scheduled_start).getTime() -
          new Date(a.completed_at || a.scheduled_start).getTime(),
      );
  }, [reportTrips, search]);

  const completedTripsWithoutInvoices = reportTrips.filter(
    (trip) => trip.status === 'Completed' && !invoices.some((invoice) => invoice.trip_id === trip.id),
  );
  const overdueInvoices = analytics.reportInvoices.filter(
    (invoice) => getInvoiceStatus(invoice, payments) === 'Overdue',
  );
  const snapshotMismatches = reportTrips.filter((trip) => {
    if (trip.status !== 'Completed') return false;
    const expenseDifference =
      trip.total_expenses -
      trip.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const partsDifference =
      trip.total_spare_parts -
      trip.spare_parts.reduce((sum, part) => sum + Number(part.price || 0), 0);
    return Math.abs(expenseDifference) > 0.01 || Math.abs(partsDifference) > 0.01;
  });
  const missingFinalizedResults = reportTrips.filter(
    (trip) => trip.status === 'Completed' && trip.final_profit_loss === undefined,
  );
  const overpaidInvoices = analytics.reportInvoices.filter((invoice) =>
    payments.filter((payment) => payment.invoice_id === invoice.id).reduce((sum, payment) => sum + payment.amount, 0) > invoice.amount + 0.01,
  );
  const dataQualityIssues = [
    ...reportTrips
      .filter((trip) => !trip.truck || !trip.driver)
      .map((trip) => ({
        id: `assignment-${trip.id}`,
        title: 'Missing trip assignment',
        detail: `${trip.origin} → ${trip.destination} is missing ${!trip.truck && !trip.driver ? 'a truck and driver' : !trip.truck ? 'a truck' : 'a driver'}.`,
        tripId: trip.id,
      })),
      ...missingFinalizedResults.map((trip) => ({
        id: `finalized-${trip.id}`,
        title: 'Completed trip is missing its final calculation',
        detail: `${trip.origin} → ${trip.destination} is completed but has no saved final budget variance.`,
        tripId: trip.id,
      })),
    ...completedTripsWithoutInvoices.map((trip) => ({
      id: `invoice-${trip.id}`,
      title: 'Completed trip not invoiced',
      detail: `${trip.origin} → ${trip.destination} has no issued invoice.`,
      tripId: trip.id,
    })),
    ...snapshotMismatches.map((trip) => ({
      id: `snapshot-${trip.id}`,
      title: 'Finalized costs do not reconcile',
      detail: `${trip.origin} → ${trip.destination} snapshot totals differ from linked expense/parts records.`,
      tripId: trip.id,
    })),
    ...overdueInvoices.map((invoice) => ({
      id: `overdue-${invoice.id}`,
      title: 'Invoice is overdue',
      detail: `${invoice.invoice_number} has an unpaid balance of ${formatTsh(invoice.amount - payments.filter((payment) => payment.invoice_id === invoice.id).reduce((sum, payment) => sum + payment.amount, 0))}.`,
      tripId: invoice.trip_id,
    })),
    ...overpaidInvoices.map((invoice) => ({
      id: `overpaid-${invoice.id}`,
      title: 'Payments exceed invoice amount',
      detail: `${invoice.invoice_number} has more recorded payments than its billed total.`,
      tripId: invoice.trip_id,
    })),
  ].sort((left, right) => {
    const priority = (title: string) => {
      if (title.includes('exceed invoice')) return 0;
      if (title.includes('overdue')) return 1;
      if (title.includes('reconcile') || title.includes('missing its final')) return 2;
      if (title.includes('not invoiced')) return 3;
      return 4;
    };
    return priority(left.title) - priority(right.title);
  });
  const completedTripsForInvoice = trips.filter((trip) => trip.status === 'Completed' || trip.status === 'Ongoing');
  const selectedInvoiceTrip = completedTripsForInvoice.find((trip) => trip.id === invoiceTripId)
    || completedTripsForInvoice[0];
  const selectedInvoiceDriver = drivers.find((driver) => driver.id === invoiceDriverId);
  const selectedInvoiceLinkedTrip = trips.find((trip) => trip.id === invoiceLinkedTripId);
  const availablePaymentInvoices = invoices.filter((invoice) => {
    const paid = payments
      .filter((payment) => payment.invoice_id === invoice.id)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    return invoice.amount - paid > 0;
  });
  const rangeIsInvalid = reportRange.start !== null && reportRange.end !== null && reportRange.start > reportRange.end;
  const selectedPaymentInvoice = availablePaymentInvoices.find((item) => item.id === paymentInvoiceId)
    || availablePaymentInvoices[0];
  const selectedPaymentPaid = selectedPaymentInvoice
    ? payments.filter((payment) => payment.invoice_id === selectedPaymentInvoice.id)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    : 0;
  const selectedPaymentBalance = selectedPaymentInvoice
    ? Math.max(0, Number(selectedPaymentInvoice.amount) - selectedPaymentPaid)
    : 0;
  const reportPeriodLabel = datePreset === 'today'
    ? formatDate(today.toISOString())
    : datePreset === 'all'
      ? 'All available dates'
      : datePreset === 'custom'
        ? `${customFrom || 'Start'} – ${customTo || 'Today'}`
        : reportRange.start !== null && reportRange.end !== null
          ? `${formatDate(new Date(reportRange.start).toISOString())} – ${formatDate(new Date(reportRange.end).toISOString())}`
          : 'Select dates';
  const isReportPeriodFiltered = datePreset !== 'today';

  const handleCreateInvoice = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountingError('');
    setAccountingSuccess('');
    const amount = Number(invoiceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAccountingError('Enter the billed amount.');
      return;
    }
    try {
      if (invoiceType === 'trip') {
        if (!selectedInvoiceTrip) {
          setAccountingError('Please select a trip.');
          return;
        }
        onCreateInvoice({
          trip_id: selectedInvoiceTrip.id,
          invoice_number: invoiceNumber,
          amount,
          issued_at: new Date(`${invoiceIssuedAt}T12:00:00`).toISOString(),
          due_at: new Date(`${invoiceDueAt}T23:59:59`).toISOString(),
        });
        setAccountingSuccess(`Invoice recorded for ${formatTsh(amount)}.`);
      } else {
        if (!selectedInvoiceDriver) {
          setAccountingError('Please select a driver.');
          return;
        }
        if (!invoiceReason.trim()) {
          setAccountingError('Please provide a reason for the driver invoice.');
          return;
        }
        onCreateInvoice({
          driver_id: selectedInvoiceDriver.id,
          trip_id: invoiceLinkedTripId || undefined,
          invoice_number: invoiceNumber,
          amount,
          reason: invoiceReason,
          issued_at: new Date(`${invoiceIssuedAt}T12:00:00`).toISOString(),
          due_at: new Date(`${invoiceDueAt}T23:59:59`).toISOString(),
        });
        setAccountingSuccess(`Driver invoice recorded for ${formatTsh(amount)}.`);
      }
      setInvoiceAmount('');
      setInvoiceNumber('');
      setInvoiceReason('');
      setInvoiceLinkedTripId('');
      setInvoiceIssuedAt(dateInputValue(new Date()));
    } catch (error) {
      setAccountingError(error instanceof Error ? error.message : 'Invoice could not be created.');
    }
  };

  const handleRecordPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountingError('');
    setAccountingSuccess('');
    const invoice = selectedPaymentInvoice;
    if (!invoice) {
      setAccountingError('There are no unpaid invoices to apply a payment to.');
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > selectedPaymentBalance) {
      setAccountingError(`Enter a payment greater than zero and no more than the remaining balance of ${formatTsh(selectedPaymentBalance)}.`);
      return;
    }
    try {
      onCreatePayment({
        invoice_id: invoice.id,
        amount,
        method: paymentMethod,
        paid_at: new Date(`${paymentPaidAt}T12:00:00`).toISOString(),
        reference: paymentReference,
      });
      setAccountingSuccess(`Payment of ${formatTsh(amount)} recorded for ${invoice.invoice_number}.`);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentPaidAt(dateInputValue(new Date()));
    } catch (error) {
      setAccountingError(error instanceof Error ? error.message : 'Payment could not be recorded.');
    }
  };

  const exportLedger = () => {
    const rows = [
      ['Report period', reportPeriodLabel],
      ['Trip status', filter === 'All' ? 'All statuses' : filter],
      ['Search', search.trim() || 'None'],
      [],
      [
        'Trip ID',
        'Date',
        'Route',
        'Driver',
        'Truck',
        'Status',
        'Completed trip budget estimate (Tsh)',
        'Recorded trip costs (Tsh)',
        'Finalized budget variance (Tsh)',
        'Invoiced (Tsh)',
        'Collected (Tsh)',
        'Outstanding invoice balance (Tsh)',
      ],
      ...filteredTrips.map((trip) => {
        const tripInvoices = analytics.reportTripInvoices.filter((invoice) => invoice.trip_id === trip.id);
        const periodInvoices = tripInvoices.filter((invoice) => isWithinRange(invoice.issued_at, reportRange));
        const invoiced = periodInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
        const collected = payments
          .filter((payment) =>
            tripInvoices.some((invoice) => invoice.id === payment.invoice_id) &&
            isWithinRange(payment.paid_at, reportRange),
          )
          .reduce((sum, payment) => sum + payment.amount, 0);
        const outstanding = periodInvoices.reduce((sum, invoice) => {
          const paid = payments
            .filter((payment) => payment.invoice_id === invoice.id)
            .reduce((paymentTotal, payment) => paymentTotal + payment.amount, 0);
          return sum + Math.max(0, invoice.amount - paid);
        }, 0);
        return [
          trip.id,
          formatDate(trip.completed_at || trip.scheduled_start),
          `${trip.origin} - ${trip.destination}`,
          trip.driver?.full_name || 'Unassigned',
          trip.truck?.license_plate || 'Unassigned',
          trip.status,
          Number(trip.budget_allocated || 0),
          getTripCostBreakdown(trip, reportRange).total,
          trip.status === 'Completed' ? trip.profit_loss : '',
          invoiced,
          collected,
          outstanding,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kam-fleets-trip-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const maxMonthlyValue = Math.max(
    ...analytics.months.flatMap((month) => [
      ...(showBudgetInChart ? [month.budget] : []),
      month.invoiced,
      month.collected,
      month.costs,
    ]),
    1,
  );
  const maxCostCategory = Math.max(
    ...analytics.costCategories.map((category) => category.amount),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Schema Announcement */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white ">
        <div className="absolute -right-10 bottom-0 h-28 w-28 rotate-45 rounded-tl-2xl bg-slate-950/20 shadow-[-10px_-10px_18px_rgba(15,23,42,0.35)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.16),_transparent_28%)]" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-1 flex items-center space-x-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
              <BarChart3 className="h-4 w-4" />
              <span>Management overview</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Admin Dashboard</h1>
          </div>
          <div className="flex-col flex-wrap items-center gap-3">
            <p className="mt-1 mb-2 max-w-2xl text-sm leading-relaxed text-slate-200/90">
              Trace budgets, invoices, received payments, operational costs, and every recorded change back to its source.
            </p>
            <div className="flex items-center gap-2 rounded-xl border justify-between border-white/10 bg-white/5 px-2  py-2 text-xs text-slate-200">
              <div className="flex items-center gap-1">
                <Truck className="h-4 w-4 text-amber-300" />
                <span>{trucks.length} trucks</span>
              </div>
              <span className="text-slate-500">·</span>
              <div className="flex items-center gap-1">
                <Truck className="h-4 w-4 text-amber-300" />
                <span>{drivers.length} drivers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="sticky top-1 z-20 -mx-4 w-[calc(100%+2rem)] rounded-none border-x-0 border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/15 backdrop-blur-sm sm:mx-0 sm:w-auto sm:rounded-2xl sm:border-x sm:p-3 sm:shadow-sm">
          <div className="mb-2 flex items-center justify-between px-1 sm:mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Dashboard workspace</span>
            <span className="text-[10px] font-semibold text-slate-400">Select a section</span>
          </div>
          <nav className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0" aria-label="Dashboard sections">
            <div className="flex min-w-max gap-1 rounded-xl bg-slate-100/80 p-1 sm:gap-2 lg:min-w-0 lg:w-full">
            {([
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'billing', label: 'Billing', icon: Receipt },
              { id: 'trip-costs', label: 'Trip costs', icon: Truck },
              { id: 'review', label: 'Review', icon: AlertTriangle },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                aria-current={activeSection === id ? 'page' : undefined}
                className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition sm:min-w-32 sm:px-4 lg:min-w-0 lg:flex-1 ${
                  activeSection === id
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${activeSection === id ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{label}</span>
              </button>
            ))}
            </div>
          </nav>
        </div>

        <div className="min-w-0 space-y-4">
          <section aria-label="Financial key performance indicators and report period" className="grid grid-cols-1 gap-3">
            <AdminSummaryDropdown
              id="admin-financial-summary-cards"
              label="Financial Summary"
              openOnLargeScreens
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Cash collected"
                  value={formatTsh(analytics.collectedCash)}
                  detail="Payments received during these dates"
                  icon={<Wallet className="h-4 w-4" />}
                  accent="text-emerald-600 bg-emerald-50"
                  explanation="Money actually received during this date range for trips in the selected status filter."
                />
                <MetricCard
                  label="Outstanding balance"
                  value={formatTsh(analytics.outstandingBalance)}
                  detail="Current unpaid on invoices issued in period"
                  icon={<Receipt className="h-4 w-4" />}
                  accent="text-amber-600 bg-amber-50"
                  explanation="What is still owed today on invoices issued during this date range."
                />
                <MetricCard
                  label="Invoiced"
                  value={formatTsh(analytics.invoicedAmount)}
                  detail={`${analytics.reportInvoices.length} invoice${analytics.reportInvoices.length === 1 ? '' : 's'} issued in period`}
                  icon={<FileText className="h-4 w-4" />}
                  accent="text-blue-600 bg-blue-50"
                  explanation="The total value of invoices issued during this date range."
                />
                <MetricCard
                  label="Recorded costs"
                  value={formatTsh(analytics.totalRecordedCosts)}
                  detail="Costs dated in the selected period"
                  icon={<TrendingDown className="h-4 w-4" />}
                  accent="text-rose-600 bg-rose-50"
                  explanation="Trip and service expenses recorded in this date range. Completed trips use their saved final costs."
                />
              </div>
            </AdminSummaryDropdown>

            <div className={`rounded-xl border p-3 shadow-sm transition-colors ${
              isReportPeriodFiltered
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-slate-200 bg-white'
            }`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-slate-900">Report period</h2>
                    {isReportPeriodFiltered && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        Filter active
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 text-[10px] ${isReportPeriodFiltered ? 'text-amber-800' : 'text-slate-500'}`}>
                    {reportPeriodLabel}
                  </p>
                </div>
                <BarChart3 className={`h-4 w-4 shrink-0 ${isReportPeriodFiltered ? 'text-amber-700' : 'text-amber-500'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:col-span-1">
                  Period
                  <select
                    value={datePreset}
                    onChange={(event) => setDatePreset(event.target.value as DatePreset)}
                    aria-label="Filter report by date period"
                    className={`mt-1 block w-full rounded-lg border px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700 ${
                      isReportPeriodFiltered ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <option value="today">Today</option>
                    <option value="all">All time</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="ytd">This year</option>
                    <option value="custom">Custom range</option>
                  </select>
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Trip status
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as LedgerFilter)}
                    aria-label="Filter report by trip status"
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700"
                  >
                    <option value="All">All statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Planned">Planned</option>
                  </select>
                </label>
                {datePreset === 'custom' && (
                  <>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      From
                      <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Report start date" className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium normal-case tracking-normal text-slate-700" />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      To
                      <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} aria-label="Report end date" className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium normal-case tracking-normal text-slate-700" />
                    </label>
                  </>
                )}
              </div>
              {rangeIsInvalid && <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-700">Start date must be on or before end date.</p>}
            </div>
          </section>

          <AdminPriorityWarnings
            issues={dataQualityIssues}
            onShowAll={() => {
              setShowAllWarnings(true);
              setActiveSection('review');
            }}
            onSelectTrip={onSelectTrip}
          />

      {activeSection === 'overview' && (
        <AdminOverviewSection
          completedTripBudget={analytics.completedTripBudget}
          finalizedBudgetVariance={analytics.finalizedBudgetVariance}
          fleetServiceCosts={analytics.fleetServiceCosts}
          completedTripCount={analytics.completedTrips.length}
          profitableTrips={analytics.profitableTrips}
          lossTrips={analytics.lossTrips}
          totalRecordedCosts={analytics.totalRecordedCosts}
          months={analytics.months}
          costCategories={analytics.costCategories}
          serviceRecordCount={truckServiceRecords.filter((record) => isWithinRange(record.timestamp, reportRange)).length}
          showBudgetInChart={showBudgetInChart}
          onShowBudgetInChart={setShowBudgetInChart}
          maxMonthlyValue={maxMonthlyValue}
          maxCostCategory={maxCostCategory}
        />
      )}

      {activeSection === 'billing' && (
        <AdminBillingSection
          invoicedAmount={analytics.invoicedAmount}
          collectedCash={analytics.collectedCash}
          outstandingBalance={analytics.outstandingBalance}
          reportInvoices={analytics.reportInvoices}
          reportTripInvoices={analytics.reportTripInvoices}
          trips={trips}
          drivers={drivers}
          payments={payments}
          reportRange={reportRange}
          completedTripsForInvoice={completedTripsForInvoice}
          selectedInvoiceTrip={selectedInvoiceTrip}
          invoiceAmount={invoiceAmount}
          onInvoiceAmountChange={setInvoiceAmount}
          onInvoiceTripIdChange={setInvoiceTripId}
          onInvoiceDriverIdChange={setInvoiceDriverId}
          onInvoiceLinkedTripIdChange={setInvoiceLinkedTripId}
          invoiceReason={invoiceReason}
          onInvoiceReasonChange={setInvoiceReason}
          invoiceNumber={invoiceNumber}
          onInvoiceNumberChange={setInvoiceNumber}
          invoiceIssuedAt={invoiceIssuedAt}
          onInvoiceIssuedAtChange={setInvoiceIssuedAt}
          invoiceDueAt={invoiceDueAt}
          onInvoiceDueAtChange={setInvoiceDueAt}
          onCreateInvoice={handleCreateInvoice}
          availablePaymentInvoices={availablePaymentInvoices}
          selectedPaymentInvoice={selectedPaymentInvoice}
          onPaymentInvoiceIdChange={setPaymentInvoiceId}
          selectedPaymentBalance={selectedPaymentBalance}
          paymentAmount={paymentAmount}
          onPaymentAmountChange={setPaymentAmount}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          paymentPaidAt={paymentPaidAt}
          onPaymentPaidAtChange={setPaymentPaidAt}
          paymentReference={paymentReference}
          onPaymentReferenceChange={setPaymentReference}
          onRecordPayment={handleRecordPayment}
          accountingError={accountingError}
          accountingSuccess={accountingSuccess}
          allInvoices={allInvoices}
          allPayments={allPayments}
          onVoidInvoice={onVoidInvoice}
          onReversePayment={onReversePayment}
          invoiceType={invoiceType}
          onInvoiceTypeChange={setInvoiceType}
          selectedInvoiceDriver={selectedInvoiceDriver}
          selectedInvoiceLinkedTrip={selectedInvoiceLinkedTrip}
        />
      )}

      {(activeSection === 'trip-costs' || activeSection === 'review') && <section className="grid grid-cols-1 gap-4">
        {activeSection === 'trip-costs' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cost reconciliation</h2>
              <p className="mt-1 text-xs text-slate-500">Trace the filtered cost total to its source records.</p>
            </div>
            <span className="whitespace-nowrap text-sm font-extrabold text-slate-900">{formatTsh(analytics.totalRecordedCosts)}</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {analytics.costCategories.map((category) => (
              <div key={category.label} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="text-slate-700">{category.label}</span>
                <span className="whitespace-nowrap font-bold text-slate-900">{formatTsh(category.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="text-slate-700">Trip operating costs subtotal</span>
              <span className="whitespace-nowrap font-bold text-slate-900">{formatTsh(analytics.totalRecordedCosts - analytics.fleetServiceCosts)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="font-bold text-slate-900">Total recorded costs</span>
              <span className="whitespace-nowrap font-extrabold text-slate-900">{formatTsh(analytics.totalRecordedCosts)}</span>
            </div>
          </div>
          <details className="mt-3 rounded-lg border border-slate-100">
            <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-slate-700">Standalone fleet service transactions ({truckServiceRecords.filter((record) => isWithinRange(record.timestamp, reportRange)).length})</summary>
            <div className="max-h-56 overflow-y-auto border-t border-slate-100 px-3">
              {truckServiceRecords
                .filter((record) => isWithinRange(record.timestamp, reportRange))
                .map((record) => (
                  <div key={record.id} className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 text-[11px]">
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{record.item_name}</span>
                      <span className="text-slate-500">{trucks.find((truck) => truck.id === record.truck_id)?.license_plate || 'Truck unavailable'} · {formatDate(record.timestamp)}</span>
                    </div>
                    <span className="shrink-0 font-bold">{formatTsh(record.price)}</span>
                  </div>
                ))}
            </div>
          </details>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            A completed trip uses its saved final expense/parts snapshots; an open trip uses itemized records dated in this period. Driver pay counts only after completion. Fleet servicing remains unallocated.
          </p>
        </div>

        )}
        {activeSection === 'review' && (
          <AdminDataQualityPanel
            issues={dataQualityIssues}
            showAllWarnings={showAllWarnings}
            onToggleWarnings={() => setShowAllWarnings(!showAllWarnings)}
            onSelectTrip={onSelectTrip}
          />
        )}
      </section>}

      {activeSection === 'trip-costs' && (
        <AdminTripLedger
          filteredTrips={filteredTrips}
          reportTrips={reportTrips}
          reportRange={reportRange}
          search={search}
          onSearchChange={setSearch}
          onExport={exportLedger}
          invoices={invoices}
          payments={payments}
          expandedTripId={expandedTripId}
          onExpandedTripIdChange={setExpandedTripId}
          onSelectTrip={onSelectTrip}
        />
      )}

      {activeSection === 'review' && <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Audit history</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">Every change, attributed to the signed-in team member who made it.</p>
            </div>
            <span className="whitespace-nowrap text-[10px] font-semibold text-slate-500">{auditLogs.length} retained</span>
          </div>
          <div className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto">
            {auditLogs
              .filter((log) => isWithinRange(log.timestamp, reportRange))
              .filter((log) => {
                if (log.related_trip_id) return analytics.statusTripIds.has(log.related_trip_id);
                if (log.entity_type === 'trip') return analytics.statusTripIds.has(log.entity_id);
                if (log.entity_type === 'invoice') return analytics.reportInvoices.some((invoice) => invoice.id === log.entity_id);
                if (log.entity_type === 'payment') {
                  const payment = payments.find((item) => item.id === log.entity_id);
                  return payment ? analytics.reportInvoices.some((invoice) => invoice.id === payment.invoice_id) : false;
                }
                return true;
              })
              .slice(0, 30)
              .map((log) => (
                <div key={log.id} className="px-4 py-3 sm:px-5 border-b border-slate-100 last:border-0">
                  <button
                    onClick={() => setSelectedAuditLog(log)}
                    className="w-full text-left flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between hover:bg-slate-50 rounded px-2 py-1 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800">{log.summary}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        {log.actor} · {log.action} · {log.entity_type} · {log.entity_id.slice(0, 8)}
                      </span>
                    </span>
                    <time className="shrink-0 text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</time>
                  </button>
                </div>
              ))}
            {auditLogs.filter((log) => isWithinRange(log.timestamp, reportRange)).length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-500">No audit activity in this date range.</p>
            )}
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-[10px] leading-relaxed text-slate-500 sm:px-5">
            Audit events are written by the server from the verified Neon Auth account and cannot be edited or deleted. The latest 2,000 events are shown.
          </p>
        </div>

        <TeamAccessPanel />
      </section>}

      {/* Audit Detail Modal */}
      <AuditDetailModal
        isOpen={selectedAuditLog !== null}
        onClose={() => setSelectedAuditLog(null)}
        auditLog={selectedAuditLog}
      />
        </div>
      </div>
    </div>
  );
};
