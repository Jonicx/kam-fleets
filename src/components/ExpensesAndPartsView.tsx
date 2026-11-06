import React, { useState } from 'react';
import {
  Receipt,
  Wrench,
  Search,
  Filter,
  Calendar,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  Eye,
  Pencil,
  X,
} from 'lucide-react';
import { Expense, SparePart, EnrichedTrip, ExpenseType, Truck, TruckServiceRecord, TruckServiceType } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { canEditTruckServiceRecord } from '../utils/truckService.ts';
import { LedgerEntry, LedgerEntryModal, LedgerEntryValues } from './LedgerEntryModal.tsx';

interface ExpensesAndPartsViewProps {
  expenses: Expense[];
  spareParts: SparePart[];
  trucks: Truck[];
  truckServiceRecords: TruckServiceRecord[];
  trips: EnrichedTrip[];
  onDeleteExpense: (id: string) => void;
  onDeleteSparePart: (id: string) => void;
  onSaveEntry: (kind: LedgerEntry['kind'], values: LedgerEntryValues, id?: string) => void;
  onUpdateTruckServiceRecord: (
    id: string,
    updates: Pick<TruckServiceRecord, 'record_type' | 'item_name' | 'price' | 'mechanic_name' | 'service_location' | 'timestamp'>
  ) => void;
  onSelectTrip: (tripId: string) => void;
}

export const ExpensesAndPartsView: React.FC<ExpensesAndPartsViewProps> = ({
  expenses,
  spareParts,
  trucks,
  truckServiceRecords,
  trips,
  onDeleteExpense,
  onDeleteSparePart,
  onSaveEntry,
  onUpdateTruckServiceRecord,
  onSelectTrip,
}) => {
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [activeLedger, setActiveLedger] = useState<'all' | 'expenses' | 'spares' | 'services'>('all');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [dateValue, setDateValue] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isEditingService, setIsEditingService] = useState(false);
  const [serviceEditError, setServiceEditError] = useState<string | null>(null);
  const [serviceEditType, setServiceEditType] = useState<TruckServiceType>('Service');
  const [serviceEditItem, setServiceEditItem] = useState('');
  const [serviceEditPrice, setServiceEditPrice] = useState('');
  const [serviceEditMechanic, setServiceEditMechanic] = useState('');
  const [serviceEditLocation, setServiceEditLocation] = useState('');
  const [serviceEditTimestamp, setServiceEditTimestamp] = useState('');

  const selectedService = truckServiceRecords.find((record) => record.id === selectedServiceId);
  const selectedServiceTruck = selectedService
    ? trucks.find((truck) => truck.id === selectedService.truck_id)
    : undefined;

  const openServiceDetails = (record: TruckServiceRecord) => {
    const timestamp = new Date(record.timestamp);
    const localTimestamp = new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setSelectedServiceId(record.id);
    setIsEditingService(false);
    setServiceEditError(null);
    setServiceEditType(record.record_type);
    setServiceEditItem(record.item_name);
    setServiceEditPrice(String(record.price));
    setServiceEditMechanic(record.mechanic_name);
    setServiceEditLocation(record.service_location);
    setServiceEditTimestamp(localTimestamp);
  };

  const handleSaveServiceEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedService) return;
    setServiceEditError(null);
    try {
      onUpdateTruckServiceRecord(selectedService.id, {
        record_type: serviceEditType,
        item_name: serviceEditItem.trim(),
        price: Number(serviceEditPrice),
        mechanic_name: serviceEditMechanic.trim(),
        service_location: serviceEditLocation.trim(),
        timestamp: new Date(serviceEditTimestamp).toISOString(),
      });
      setIsEditingService(false);
    } catch (error) {
      setServiceEditError(error instanceof Error ? error.message : 'Failed to update truck service record.');
    }
  };

  const cityOptions = Array.from(
    new Set(
      [
        ...trips.flatMap((trip) => [trip.origin, trip.destination]),
        ...truckServiceRecords.map((record) => record.service_location),
      ].filter((city): city is string => Boolean(city))
    )
  ).sort();

  // Total metrics
  const totalExpenseSum = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalDriverPayments = trips.reduce((sum, trip) => sum + Math.max(0, Number(trip.driver_pay) || 0), 0);
  const totalSparePartsSum = spareParts.reduce((sum, sp) => sum + Number(sp.price), 0);
  const totalTruckServiceSum = truckServiceRecords.reduce((sum, record) => sum + Number(record.price), 0);
  const totalCombined = totalExpenseSum + totalDriverPayments + totalSparePartsSum + totalTruckServiceSum;

  const dateRangeStartValue = dateRangeStart || dateRangeEnd;
  const dateRangeEndValue = dateRangeEnd || dateRangeStart;

  const summaryToneClasses = {
    amber: 'border-amber-200 bg-white text-amber-600',
    blue: 'border-blue-200 bg-white text-blue-600',
    rose: 'border-rose-200 bg-white text-rose-600',
    emerald: 'border-emerald-200 bg-white text-emerald-600',
    purple: 'border-purple-200 bg-white text-purple-600',
    orange: 'border-orange-200 bg-orange-50/30 text-orange-700',
  } as const;

  const activeFilterChips = [
    searchTerm.trim() ? `Search: ${searchTerm.trim()}` : null,
    cityFilter !== 'All' ? `City: ${cityFilter}` : null,
    activeLedger !== 'all'
      ? `Ledger: ${
          activeLedger === 'expenses' ? 'Trip Expenses & Payments' : activeLedger === 'spares' ? 'Spare Parts' : 'Truck Services'
        }`
      : null,
    selectedType !== 'All' ? `Type: ${selectedType}` : null,
    dateMode === 'single' && dateValue ? `Date: ${new Date(`${dateValue}T00:00:00`).toLocaleDateString()}` : null,
    dateMode === 'range' && (dateRangeStartValue || dateRangeEndValue)
      ? `Range: ${
          dateRangeStartValue && dateRangeEndValue && dateRangeStartValue > dateRangeEndValue
            ? `${new Date(`${dateRangeEndValue}T00:00:00`).toLocaleDateString()} → ${new Date(`${dateRangeStartValue}T00:00:00`).toLocaleDateString()}`
            : `${dateRangeStartValue ? new Date(`${dateRangeStartValue}T00:00:00`).toLocaleDateString() : '—'} → ${dateRangeEndValue ? new Date(`${dateRangeEndValue}T00:00:00`).toLocaleDateString() : '—'}`
        }`
      : null,
  ].filter(Boolean) as string[];

  const hasActiveFilters = activeFilterChips.length > 0;

  const dateRangeSummary = (() => {
    if (dateMode !== 'range' || (!dateRangeStart && !dateRangeEnd)) return null;

    const safeStart = dateRangeStart && dateRangeEnd && dateRangeStart > dateRangeEnd ? dateRangeEnd : dateRangeStart;
    const safeEnd = dateRangeEnd && dateRangeStart && dateRangeStart > dateRangeEnd ? dateRangeStart : dateRangeEnd;
    if (!safeStart && !safeEnd) return null;

    const startDate = safeStart ? new Date(`${safeStart}T00:00:00`) : null;
    const endDate = safeEnd ? new Date(`${safeEnd}T23:59:59`) : null;

    if (!startDate && endDate) {
      return `Until ${endDate.toLocaleDateString()}`;
    }
    if (startDate && !endDate) {
      return `From ${startDate.toLocaleDateString()}`;
    }
    if (!startDate || !endDate) return null;

    const diffDays = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
    return `${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()} (${diffDays + 1} days)`;
  })();

  // Breakdown by Expense Type
  const fuelTotal = expenses
    .filter((e) => e.expense_type === 'Fuel')
    .reduce((s, e) => s + Number(e.amount), 0);
  const tollsTotal = expenses
    .filter((e) => e.expense_type === 'Tolls')
    .reduce((s, e) => s + Number(e.amount), 0);
  const policeBribesTotal = expenses
    .filter((e) => e.expense_type === 'Police/Bribes')
    .reduce((s, e) => s + Number(e.amount), 0);
  const foodTotal = expenses
    .filter((e) => e.expense_type === 'Food')
    .reduce((s, e) => s + Number(e.amount), 0);
  const otherTotal = expenses
    .filter((e) => e.expense_type === 'Other')
    .reduce((s, e) => s + Number(e.amount), 0);

  const summaryCards = [
    {
      key: 'fuel',
      label: 'Fuel (Diesel)',
      value: formatTsh(fuelTotal, { maximumFractionDigits: 0 }),
      subtitle: `${expenses.filter((e) => e.expense_type === 'Fuel').length} fills`,
      tone: 'amber',
    },
    {
      key: 'tolls',
      label: 'Highway Tolls',
      value: formatTsh(tollsTotal, { maximumFractionDigits: 0 }),
      subtitle: `${expenses.filter((e) => e.expense_type === 'Tolls').length} gates`,
      tone: 'blue',
    },
    {
      key: 'police',
      label: 'Police / Bribes',
      value: formatTsh(policeBribesTotal, { maximumFractionDigits: 0 }),
      subtitle: `${expenses.filter((e) => e.expense_type === 'Police/Bribes').length} checks`,
      tone: 'rose',
    },
    {
      key: 'food',
      label: 'Driver Food',
      value: formatTsh(foodTotal, { maximumFractionDigits: 0 }),
      subtitle: `${expenses.filter((e) => e.expense_type === 'Food').length} per-diems`,
      tone: 'emerald',
    },
    {
      key: 'other',
      label: 'Other Fees',
      value: formatTsh(otherTotal, { maximumFractionDigits: 0 }),
      subtitle: 'Parking & yard',
      tone: 'purple',
    },
    {
      key: 'driver-payments',
      label: 'Driver Payments',
      value: formatTsh(totalDriverPayments, { maximumFractionDigits: 0 }),
      subtitle: `${trips.filter((trip) => Number(trip.driver_pay) > 0).length} trip payments`,
      tone: 'blue',
    },
    {
      key: 'spares',
      label: 'Spare Parts',
      value: formatTsh(totalSparePartsSum, { maximumFractionDigits: 0 }),
      subtitle: `${spareParts.length} maintenance`,
      tone: 'orange',
    },
    {
      key: 'truck-services',
      label: 'Truck Services',
      value: formatTsh(totalTruckServiceSum, { maximumFractionDigits: 0 }),
      subtitle: `${truckServiceRecords.length} records`,
      tone: 'purple',
    },
  ];

  const truckPlateById = new Map(trucks.map((truck) => [truck.id, truck.license_plate]));

  // Combine items for unified ledger
  const unifiedItems = [
    ...expenses.map((e) => ({
      id: e.id,
      kind: 'expense' as const,
      trip_id: e.trip_id,
      truck_id: null,
      reference: '',
      service_location: null,
      category: e.expense_type,
      title: `${e.expense_type} Disbursement`,
      description: e.description,
      amount: Number(e.amount),
      timestamp: e.timestamp,
    })),
    ...trips
      .filter((trip) => Number(trip.driver_pay) > 0)
      .map((trip) => ({
        id: `driver-payment-${trip.id}`,
        kind: 'driver_payment' as const,
        trip_id: trip.id,
        truck_id: null,
        reference: '',
        service_location: null,
        category: 'Driver Payment',
        title: `Driver Payment · ${trip.driver?.full_name || 'Assigned driver'}`,
        description: `${trip.origin} → ${trip.destination}`,
        amount: Number(trip.driver_pay),
        timestamp: trip.completed_at ?? trip.scheduled_start,
      })),
    ...spareParts.map((sp) => ({
      id: sp.id,
      kind: 'spare_part' as const,
      trip_id: sp.trip_id,
      truck_id: null,
      reference: '',
      service_location: null,
      category: 'Spare Part',
      title: sp.part_name,
      description: `${sp.description || ''} ${sp.replaced_by ? `(Mechanic: ${sp.replaced_by})` : ''}`,
      amount: Number(sp.price),
      timestamp: sp.timestamp,
    })),
    ...truckServiceRecords.map((record) => ({
      id: record.id,
      kind: 'truck_service' as const,
      trip_id: null,
      truck_id: record.truck_id,
      reference: truckPlateById.get(record.truck_id) || 'Unknown truck',
      service_location: record.service_location,
      category: record.record_type,
      title: record.item_name,
      description: `Mechanic: ${record.mechanic_name} · Serviced at: ${record.service_location}`,
      amount: Number(record.price),
      timestamp: record.timestamp,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredItems = unifiedItems.filter((item) => {
    if (activeLedger === 'expenses' && item.kind !== 'expense' && item.kind !== 'driver_payment') return false;
    if (activeLedger === 'spares' && item.kind !== 'spare_part') return false;
    if (activeLedger === 'services' && item.kind !== 'truck_service') return false;
    if (selectedType !== 'All' && item.category !== selectedType) return false;

    const trip = trips.find((t) => t.id === item.trip_id);
    const routeCities =
      item.kind === 'truck_service'
        ? [item.service_location || '']
        : trip
        ? [trip.origin, trip.destination]
        : [];
    if (cityFilter !== 'All' && !routeCities.some((city) => city.toLowerCase().includes(cityFilter.toLowerCase()))) {
      return false;
    }

    const itemDate = new Date(item.timestamp);
    const rangeStart =
      dateMode === 'range' && dateRangeStart && dateRangeEnd && dateRangeStart > dateRangeEnd ? dateRangeEnd : dateRangeStart;
    const rangeEnd =
      dateMode === 'range' && dateRangeStart && dateRangeEnd && dateRangeStart > dateRangeEnd ? dateRangeStart : dateRangeEnd;
    const dateStart = dateMode === 'range' ? (rangeStart || rangeEnd || dateValue) : dateValue;
    const dateEnd = dateMode === 'range' ? (rangeEnd || rangeStart || dateValue) : dateValue;

    if (dateStart && itemDate < new Date(`${dateStart}T00:00:00`)) return false;
    if (dateEnd && itemDate > new Date(`${dateEnd}T23:59:59`)) return false;

    const searchLower = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(searchLower) ||
      (item.description && item.description.toLowerCase().includes(searchLower)) ||
      item.category.toLowerCase().includes(searchLower) ||
      item.reference.toLowerCase().includes(searchLower) ||
      Boolean(trip?.client?.name.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <span>Transit Expenses &amp; Maintenance Ledger</span>
          <span className="text-xs hidden font-semibold px-2 py-0.5 rounded-full sm:flex bg-slate-200 text-slate-700">
            {formatTsh(totalCombined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Audited breakdown of trip costs, including driver payments, fuel, tolls, food, roadside parts, and truck services
        </p>
      </div>
        <div className="flex shrink-0 gap-2 self-start">
          <button
            type="button"
            onClick={() => setLedgerEntry({ kind: 'expense' })}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition shadow-sm"
          >
            <Receipt className="h-4 w-4" />
            <span>Add Expense</span>
          </button>
          <button
            type="button"
            onClick={() => setLedgerEntry({ kind: 'spare_part' })}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
          >
            <Wrench className="h-4 w-4" />
            <span>Add Spare Part</span>
          </button>
        </div>
      </div>
      {entryError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{entryError}</div>
      )}
      {ledgerEntry && (
        <LedgerEntryModal entry={ledgerEntry} trips={trips} onSave={onSaveEntry} onClose={() => setLedgerEntry(null)} />
      )}

      {/* Spend Breakdown Cards */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => {
          const toneClasses = summaryToneClasses[card.tone as keyof typeof summaryToneClasses];

          return (
            <div key={card.key} className={`bg-white p-3.5 rounded-xl border shadow-2xs ${toneClasses}`}>
              <span className="text-[10px] font-bold uppercase block">{card.label}</span>
              <span className="text-lg font-extrabold text-slate-900 font-mono mt-1 block">{card.value}</span>
              <span className="text-[10px] text-slate-400">{card.subtitle}</span>
            </div>
          );
        })}
      </div>

      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={isSummaryOpen}
          aria-controls="expense-summary-cards"
          onClick={() => setIsSummaryOpen((open) => !open)}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left animate-pulse ${
            isSummaryOpen
              ? 'border-green-700 bg-green-500/80 text-white shadow-[0_0_14px_2px_rgba(21,128,61,0.8)]'
              : 'border-green-500 bg-green-300/40 text-green-950 shadow-[0_0_14px_2px_rgba(34,197,94,0.7)]'
          }`}
        >
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${isSummaryOpen ? 'text-green-50' : 'text-green-900'}`}>Expense Summary</div>
            <div className={`text-sm font-bold ${isSummaryOpen ? 'text-white' : 'text-green-950'}`}>{formatTsh(totalCombined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
            isSummaryOpen
              ? 'border-green-300/80 bg-green-800/60 text-white'
              : 'border-green-600/70 bg-green-100/70 text-green-900'
          }`}>
            {isSummaryOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {isSummaryOpen && (
          <div id="expense-summary-cards" className="mt-3 grid grid-cols-1 gap-3">
            {summaryCards.map((card) => {
              const toneClasses = summaryToneClasses[card.tone as keyof typeof summaryToneClasses];

              return (
                <div key={`${card.key}-mobile`} className={`bg-white p-3.5 rounded-xl border shadow-2xs ${toneClasses}`}>
                  <span className="text-[10px] font-bold uppercase block">{card.label}</span>
                  <span className="text-lg font-extrabold text-slate-900 font-mono mt-1 block">{card.value}</span>
                  <span className="text-[10px] text-slate-400">{card.subtitle}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Tab Bar */}
      <div
        className={`bg-white p-3 rounded-xl border shadow-xs sm:p-4 ${
          hasActiveFilters ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.3fr_1fr_1fr]">
            <div className={`relative rounded-lg border ${searchTerm.trim() ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'}`}>
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search disbursements, driver payments, parts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-transparent text-xs text-slate-700 focus:outline-none"
              />
            </div>

            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
              cityFilter !== 'All' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}>
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="All">All cities</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
              selectedType !== 'All' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}>
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                aria-label="Filter by category"
                className="w-full bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
              >
                {['All', 'Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other', 'Driver Payment', 'Spare Part', 'Service'].map((type) => (
                  <option key={type} value={type}>{type === 'All' ? 'All categories' : type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${
            dateMode === 'range' && (dateRangeStart || dateRangeEnd)
              ? 'border-amber-300 bg-amber-50/60'
              : dateValue
              ? 'border-amber-300 bg-amber-50/60'
              : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Date filter</span>
              </div>

              <div className="inline-flex rounded-full bg-slate-200 p-0.5">
                {(['single', 'range'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDateMode(mode)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                      dateMode === mode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {mode === 'single' ? 'Day' : 'Range'}
                  </button>
                ))}
              </div>
            </div>

            {dateMode === 'single' ? (
              <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-700 focus:outline-none"
                />
              </label>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-700 focus:outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-700 focus:outline-none"
                  />
                </label>
              </div>
            )}

            {dateRangeSummary && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 to-white px-2.5 py-2 text-[10px] font-bold text-amber-800">
                Range selected: {dateRangeSummary}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['all', 'expenses', 'spares', 'services'] as const).map((ledger) => (
                <button
                  key={ledger}
                  onClick={() => {
                    setActiveLedger(ledger);
                    setSelectedType('All');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition whitespace-nowrap ${
                    activeLedger === ledger
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ledger === 'all'
                    ? 'All Disbursements'
                    : ledger === 'expenses'
                    ? 'Trip Expenses & Payments'
                    : ledger === 'spares'
                    ? 'Spare Parts'
                    : 'Truck Services'}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Entity Type</th>
                <th className="py-3.5 px-4">Item / Description</th>
                <th className="py-3.5 px-4">Trip / Truck Ref</th>
                <th className="py-3.5 px-4">Disbursed Amount</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const linkedTrip = item.trip_id ? trips.find((t) => t.id === item.trip_id) : undefined;

                return (
                  <tr key={`${item.kind}-${item.id}`} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold ${
                          item.category === 'Fuel'
                            ? 'bg-amber-100 text-amber-800'
                            : item.category === 'Tolls'
                            ? 'bg-blue-100 text-blue-800'
                            : item.category === 'Police/Bribes'
                            ? 'bg-rose-100 text-rose-800'
                            : item.category === 'Food'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.category === 'Spare Part'
                            ? 'bg-orange-100 text-orange-900 border border-orange-200'
                            : item.category === 'Driver Payment'
                            ? 'bg-blue-100 text-blue-800'
                            : item.kind === 'truck_service'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        {item.description || '-'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {linkedTrip ? (
                        <button
                          onClick={() => onSelectTrip(linkedTrip.id)}
                          className="text-blue-600 hover:underline flex items-center space-x-1 font-semibold text-left"
                        >
                          <span className="truncate max-w-[160px]">
                            {linkedTrip.origin.split(',')[0]} → {linkedTrip.destination.split(',')[0]}
                          </span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </button>
                      ) : item.kind === 'truck_service' ? (
                        <span className="font-mono text-[11px] font-bold text-slate-700">{item.reference}</span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">{item.trip_id?.slice(0, 8) || '-'}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                      {formatTsh(item.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {item.kind === 'driver_payment' ? (
                        <span className="text-[10px] font-semibold text-slate-400">Trip cost</span>
                      ) : item.kind === 'truck_service' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const record = truckServiceRecords.find((service) => service.id === item.id);
                            if (record) openServiceDetails(record);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                          aria-label={`View service record for ${item.reference}`}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                        {linkedTrip?.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEntryError(null);
                              if (item.kind === 'expense') {
                                setLedgerEntry({ kind: 'expense', record: expenses.find((expense) => expense.id === item.id) });
                              } else {
                                setLedgerEntry({ kind: 'spare_part', record: spareParts.find((part) => part.id === item.id) });
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                            title="Edit record"
                            aria-label={`Edit ${item.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        <button
                        onClick={() => {
                          setEntryError(null);
                          try {
                            if (item.kind === 'expense') {
                              onDeleteExpense(item.id);
                            } else if (item.kind === 'spare_part') {
                              onDeleteSparePart(item.id);
                            }
                          } catch (deleteError) {
                            setEntryError(deleteError instanceof Error ? deleteError.message : 'The record could not be deleted.');
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete record"
                      >
                        <Trash2 className="h-4 w-4" />
                        </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedService && selectedServiceTruck && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedServiceId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="truck-service-details-title"
            className="modal-readable bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between border-b border-slate-800">
              <div className="min-w-0">
                <h2 id="truck-service-details-title" className="text-base sm:text-lg font-extrabold tracking-tight flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{isEditingService ? 'Edit Service Record' : 'Service Record Details'}</span>
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  {selectedServiceTruck.license_plate} · {selectedServiceTruck.model}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Edits are allowed within 7 days of record creation.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceId(null)}
                aria-label="Close service record details"
                className="p-1.5 rounded-lg text-red-400 hover:text-white hover:bg-red-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {isEditingService ? (
                <form onSubmit={handleSaveServiceEdit} className="space-y-4">
                  {serviceEditError && (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      {serviceEditError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Work Type *
                      <select
                        required
                        value={serviceEditType}
                        onChange={(event) => setServiceEditType(event.target.value as TruckServiceType)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Service">Service</option>
                        <option value="Spare Part">Spare Part Replacement</option>
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-700">
                      {serviceEditType === 'Service' ? 'Service Performed *' : 'Spare Part Replaced *'}
                      <input
                        required
                        maxLength={160}
                        value={serviceEditItem}
                        onChange={(event) => setServiceEditItem(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Price (Tsh) *
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={serviceEditPrice}
                        onChange={(event) => setServiceEditPrice(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Mechanic Name *
                      <input
                        required
                        maxLength={120}
                        value={serviceEditMechanic}
                        onChange={(event) => setServiceEditMechanic(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-700 sm:col-span-2">
                      Service Location *
                      <input
                        required
                        maxLength={160}
                        value={serviceEditLocation}
                        onChange={(event) => setServiceEditLocation(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-700 sm:col-span-2">
                      Date and Time *
                      <input
                        required
                        type="datetime-local"
                        value={serviceEditTimestamp}
                        onChange={(event) => setServiceEditTimestamp(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingService(false);
                        setServiceEditError(null);
                      }}
                      className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Work Type</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">{selectedService.record_type}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Service / Part</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">{selectedService.item_name}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Price</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">
                        {formatTsh(Number(selectedService.price), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mechanic</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">{selectedService.mechanic_name}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Service Location</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">{selectedService.service_location}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date and Time</dt>
                      <dd className="mt-1 text-xs font-semibold text-slate-900">{new Date(selectedService.timestamp).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedServiceId(null)}
                      className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Close
                    </button>
                    {canEditTruckServiceRecord(selectedService) ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingService(true)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Service
                      </button>
                    ) : (
                      <p className="self-center text-[11px] text-slate-500">
                        Edit window expired (7 days after recording).
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
