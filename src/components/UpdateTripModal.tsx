import React, { useState } from 'react';
import {
  X,
  Calendar,
  AlertTriangle,
  Receipt,
  Wrench,
  Clock,
  Plus,
  Trash2,
  Truck as TruckIcon,
  User,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  History,
  Check,
  Fuel,
  ArrowRight,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  EnrichedTrip,
  ExpenseType,
  TripStatus,
  DelayLog,
  Expense,
  SparePart,
} from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { getDelaySeverityClasses } from '../utils/delaySeverity.ts';

interface UpdateTripModalProps {
  trip: EnrichedTrip;
  onClose: () => void;
  onUpdateStatus: (tripId: string, status: TripStatus) => void;
  onAddDelayLog: (
    tripId: string,
    log: {
      reason: string;
      severity: 'Low' | 'Medium' | 'High' | 'Critical';
      location?: string;
      duration_minutes?: number;
      timestamp?: string;
    }
  ) => void;
  onRemoveDelayLog: (tripId: string, logId: string) => void;
  onAddExpense: (
    tripId: string,
    expense: {
      expense_type: ExpenseType;
      amount: number;
      description: string;
      timestamp?: string;
    }
  ) => void;
  onDeleteExpense: (expenseId: string) => void;
  onAddSparePart: (
    tripId: string,
    part: {
      part_name: string;
      price: number;
      description: string;
      replaced_by?: string;
      timestamp?: string;
    }
  ) => void;
  onDeleteSparePart: (partId: string) => void;
}

export const UpdateTripModal: React.FC<UpdateTripModalProps> = ({
  trip,
  onClose,
  onUpdateStatus,
  onAddDelayLog,
  onRemoveDelayLog,
  onAddExpense,
  onDeleteExpense,
  onAddSparePart,
  onDeleteSparePart,
}) => {
  const [activeConsoleTab, setActiveConsoleTab] = useState<'expenses' | 'spares' | 'delays' | 'history'>('expenses');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'expense' | 'spare_part' | 'delay'>('all');

  // Flash messages & errors
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setFormError(null);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Helper for current ISO datetime string formatted for datetime-local input
  const getNowFormatted = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 1. MID-TRIP EXPENSES STATE
  const [expenseType, setExpenseType] = useState<ExpenseType>('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseTimestamp, setExpenseTimestamp] = useState(getNowFormatted());

  // 2. MID-TRIP SPARE PARTS STATE
  const [partName, setPartName] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [partReplacedBy, setPartReplacedBy] = useState('');
  const [partTimestamp, setPartTimestamp] = useState(getNowFormatted());

  // 3. DOCUMENT DELAYS STATE
  const [delayReason, setDelayReason] = useState('');
  const [delaySeverity, setDelaySeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [delayLocation, setDelayLocation] = useState('');
  const [delayDuration, setDelayDuration] = useState('60');
  const [delayTimestamp, setDelayTimestamp] = useState(getNowFormatted());

  // Expense submission handler
  const handleAppendExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Expense amount must be a positive number greater than Tsh 0.');
      return;
    }

    try {
      onAddExpense(trip.id, {
        expense_type: expenseType,
        amount: amt,
        description: expenseDesc.trim() || `Mid-trip ${expenseType} disbursement`,
        timestamp: new Date(expenseTimestamp).toISOString(),
      });

      setExpenseAmount('');
      setExpenseDesc('');
      setExpenseTimestamp(getNowFormatted());
      showToast(`Logged Tsh ${amt.toFixed(2)} ${expenseType} expense in real-time.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to append expense.');
    }
  };

  // Spare part submission handler
  const handleAppendSparePart = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!partName.trim()) {
      setFormError('Part / Service name is required for spare part maintenance log.');
      return;
    }
    const priceNum = parseFloat(partPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Part / Service price must be Tsh 0 or greater.');
      return;
    }

    try {
      onAddSparePart(trip.id, {
        part_name: partName.trim(),
        price: priceNum,
        description: partDesc.trim() || 'Roadside maintenance replacement',
        replaced_by: partReplacedBy.trim() || 'Roadside Field Workshop',
        timestamp: new Date(partTimestamp).toISOString(),
      });

      setPartName('');
      setPartPrice('');
      setPartDesc('');
      setPartReplacedBy('');
      setPartTimestamp(getNowFormatted());
      showToast(`Logged spare part '${partName.trim()}' (Tsh ${priceNum.toFixed(2)}) in real-time.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to append spare part.');
    }
  };

  // Delay submission handler
  const handleAppendDelay = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!delayReason.trim()) {
      setFormError('Delay reason description is required.');
      return;
    }

    try {
      onAddDelayLog(trip.id, {
        reason: delayReason.trim(),
        severity: delaySeverity,
        location: delayLocation.trim() || undefined,
        duration_minutes: parseInt(delayDuration) || 0,
        timestamp: new Date(delayTimestamp).toISOString(),
      });

      setDelayReason('');
      setDelayLocation('');
      setDelayDuration('60');
      setDelayTimestamp(getNowFormatted());
      showToast('Documented delay incident with timestamp.');
    } catch (err: any) {
      setFormError(err.message || 'Failed to document delay.');
    }
  };

  // Preset button helpers
  const applyDelayPreset = (reason: string, defaultSeverity: 'Low' | 'Medium' | 'High' | 'Critical', mins: string) => {
    setDelayReason(reason);
    setDelaySeverity(defaultSeverity);
    setDelayDuration(mins);
    setFormError(null);
  };

  const applySparePreset = (name: string, defaultPrice: string, desc: string) => {
    setPartName(name);
    setPartPrice(defaultPrice);
    setPartDesc(desc);
    setFormError(null);
  };

  // Real-time calculations
  const budget = Number(trip.budget_allocated) || 0;
  const driverPay = Number(trip.driver_pay) || 0;
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalSpareParts = trip.spare_parts.reduce((sum, sp) => sum + Number(sp.price), 0);
  const totalSpent = totalExpenses + totalSpareParts + driverPay;
  const remainingMargin = budget - totalSpent;
  const budgetBurnPct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const isOver = totalSpent > budget;

  // Build unified historical timeline sorted chronologically from earliest to latest
  type TimelineItem = {
    id: string;
    type: 'departure' | 'expense' | 'spare_part' | 'delay';
    timestamp: string;
    title: string;
    subtitle?: string;
    badge: string;
    badgeStyle: string;
    amount?: number;
    runningSpend?: number;
    rawItem?: any;
  };

  // Chronologically ascending items to calculate running spend
  const chronologicalEvents: Omit<TimelineItem, 'runningSpend'>[] = [
    {
      id: 'event-departure',
      type: 'departure' as const,
      timestamp: trip.scheduled_start,
      title: `Journey Dispatched: ${trip.origin} → ${trip.destination}`,
      subtitle: `Truck ${trip.truck?.license_plate || 'Assigned'} dispatched with Driver ${trip.driver?.full_name || 'Assigned'} · Cargo: ${trip.cargo_type || 'General Freight'}`,
      badge: 'Departure',
      badgeStyle: 'text-blue-700 bg-blue-50 border-blue-200',
      amount: driverPay,
    },
    ...trip.expenses.map((e) => ({
      id: `exp-${e.id}`,
      type: 'expense' as const,
      timestamp: e.timestamp,
      title: `${e.expense_type} Disbursement: Tsh ${Number(e.amount).toFixed(2)}`,
      subtitle: e.description || 'No description provided',
      badge: e.expense_type,
      badgeStyle:
        e.expense_type === 'Fuel'
          ? 'text-amber-800 bg-amber-50 border-amber-200'
          : e.expense_type === 'Tolls'
          ? 'text-blue-800 bg-blue-50 border-blue-200'
          : e.expense_type === 'Police/Bribes'
          ? 'text-rose-800 bg-rose-50 border-rose-200'
          : 'text-emerald-800 bg-emerald-50 border-emerald-200',
      amount: Number(e.amount),
      rawItem: e,
    })),
    ...trip.spare_parts.map((sp) => ({
      id: `sp-${sp.id}`,
      type: 'spare_part' as const,
      timestamp: sp.timestamp,
      title: `Roadside Maintenance: ${sp.part_name} (Tsh ${Number(sp.price).toFixed(2)})`,
      subtitle: `${sp.description || 'Maintenance replacement'}${sp.replaced_by ? ` · Replaced by ${sp.replaced_by}` : ''}`,
      badge: 'Spare Part',
      badgeStyle: 'text-orange-900 bg-orange-50 border-orange-200',
      amount: Number(sp.price),
      rawItem: sp,
    })),
    ...(trip.delay_logs || []).map((l) => ({
      id: `delay-${l.id}`,
      type: 'delay' as const,
      timestamp: l.timestamp,
      title: `Delay Documented: ${l.reason}`,
      subtitle: `${l.location ? `Checkpoint: ${l.location} · ` : ''}${l.duration_minutes ? `Impact: +${l.duration_minutes} min` : ''}`,
      badge: `${l.severity} Delay`,
      badgeStyle: getDelaySeverityClasses(l.severity),
      amount: undefined,
      rawItem: l,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Attach running cumulative expenditure
  let cumulativeSpend = 0;
  const chronologicalWithSpend: TimelineItem[] = chronologicalEvents.map((ev) => {
    if (ev.amount) {
      cumulativeSpend += ev.amount;
    }
    return {
      ...ev,
      runningSpend: cumulativeSpend,
    };
  });

  // Display timeline items in reverse chronological order (newest first for operator convenience)
  const displayTimelineItems = [...chronologicalWithSpend]
    .reverse()
    .filter((item) => (historyFilter === 'all' ? true : item.type === historyFilter));

  const totalDelayMinutes = (trip.delay_logs || []).reduce(
    (sum, d) => sum + (Number(d.duration_minutes) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="modal-readable bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div>

            <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight mb-2.5 flex items-center space-x-2 text-white">
              <span>{trip.origin}</span>
              <span className="text-gray-400 font-bold">→</span>
              <span>{trip.destination}</span>
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <TruckIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <strong className="text-white">{trip.truck?.license_plate || 'Unassigned'}</strong>
                <span className="text-slate-400">({trip.truck?.model || 'Truck'})</span>
              </span>

              <span aria-hidden="true" className="text-slate-600">·</span>

              <span className="flex items-center space-x-1.5 text-slate-300">
                <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <strong className="text-white">{trip.driver?.full_name || 'Unassigned'}</strong>
                <span className="text-slate-400">({trip.driver?.phone || 'No phone'})</span>
              </span>

              <span aria-hidden="true" className="text-slate-600">·</span>

              <span className="text-slate-400">
                Cargo: <strong className="text-slate-200">{trip.cargo_type || 'General Cargo'}</strong>
              </span>
            </div>
          </div>

        </div>

        

        {/* Real-Time Flash Toast */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold flex items-center justify-between shadow-inner">
            <span className="flex items-center space-x-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{toastMsg}</span>
            </span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-200 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Form Validation Error Banner */}
        {formError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-5 py-2.5 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </span>
            <button onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Complete Confirmation Modal Inline Dialog */}
        {showCompleteConfirm && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-xs">
            <div className="flex items-start space-x-3 max-w-2xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-slate-900">
                  Confirm Journey Completion?
                </p>
                <p className="text-slate-600">
                  This will transition the trip status to <strong>Completed</strong> and automatically update Truck{' '}
                  <strong>{trip.truck?.license_plate}</strong> and Driver <strong>{trip.driver?.full_name}</strong> back to{' '}
                  <span className="text-emerald-700 font-semibold">Available</span> in the database.
                </p>
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    onClick={() => {
                      onUpdateStatus(trip.id, 'Completed');
                      setShowCompleteConfirm(false);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                  >
                    Confirm &amp; Complete Journey
                  </button>
                  <button
                    onClick={() => setShowCompleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Segmented Tab Navigation for Mid-Trip Operations */}
        <div className="flex border-b border-slate-200 px-2 py-2 shadow-md rounded-b-lg drop-shadow-x bg-white space-x-1 overflow-x-auto scrollbar-none pt-2 sm:px-5 sm:py-3">
          <button
            onClick={() => {
              setActiveConsoleTab('expenses');
              setFormError(null);
            }}
            className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg border-b-2 py-1.5 px-2 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-xs ${
              activeConsoleTab === 'expenses'
                ? 'border-blue-600 bg-blue-500/20 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate">Expenses</span>
            <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-500 sm:px-1.5 sm:text-[10px]">
              {trip.expenses.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveConsoleTab('spares');
              setFormError(null);
            }}
            className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg border-b-2 py-1.5 px-2 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-xs ${
              activeConsoleTab === 'spares'
                ? 'border-orange-600 bg-orange-500/20 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate">Spare Parts</span>
            <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-500 sm:px-1.5 sm:text-[10px]">
              {trip.spare_parts.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveConsoleTab('delays');
              setFormError(null);
            }}
            className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg border-b-2 py-1.5 px-2 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-xs ${
              activeConsoleTab === 'delays'
                ? 'border-amber-600 bg-amber-500/20 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate">Delays</span>
            <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-500 sm:px-1.5 sm:text-[10px]">
              {trip.delay_logs?.length || 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveConsoleTab('history');
              setFormError(null);
            }}
            className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg border-b-2 py-1.5 px-2 text-[10px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-xs ${
              activeConsoleTab === 'history'
                ? 'border-purple-600 bg-purple-500/20 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate">History</span>
            <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-500 sm:px-1.5 sm:text-[10px]">
              {chronologicalEvents.length}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {/* TAB 1: LOG MID-TRIP EXPENSES */}
          {activeConsoleTab === 'expenses' && (
            <div className="min-h-[360px] space-y-4 sm:min-h-[420px] sm:space-y-6">
              {/* Append Expense Form Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 sm:p-5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Append Mid-Trip Expense
                      </h3>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAppendExpense} className="space-y-3 sm:space-y-3.5">
                  {/* Category Buttons Selector */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Expense Category *
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {(['Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other'] as ExpenseType[]).map((cat) => (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => setExpenseType(cat)}
                          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 border ${
                            expenseType === cat
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          <span>{cat}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount with Quick Presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Amount (Tsh) *</label>
                        <div className="items-center space-x-1 text-[11px] hidden sm:inline-flex">
                          <span className="text-slate-400 ">Quick:</span>
                          {[25000, 50000, 100000, 200000, 350000].map((amt) => (
                            <button
                              type="button"
                              key={amt}
                              onClick={() => setExpenseAmount(String(amt))}
                              className="px-1.5 py-0.5 rounded bg-white hover:bg-blue-50 text-slate-700 border border-slate-200 font-mono tabular-nums transition"
                            >
                              +Tsh {amt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          required
                          placeholder="0.00"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          className="w-full pl-7 pr-3  py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Disbursement Timestamp *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={expenseTimestamp}
                        onChange={(e) => setExpenseTimestamp(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Description / Receipt Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 200L Diesel refill at TotalEnergies Eldoret Depot / Highway Toll clearance"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm flex items-center space-x-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Running Expense Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {trip.expenses.length} Records · {formatTsh(totalExpenses, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total
                  </h4>
                  <span className="text-xs hidden sm:flex text-slate-400">Live Synchronized</span>
                </div>

                {trip.expenses.length === 0 ? (
                  <div className="p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500 bg-slate-50">
                    No mid-trip expenses logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
                    <table className="min-w-[960px] w-full text-left text-[13px] md:min-w-0 md:text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider md:text-[10px]">
                        <tr>
                          <th className="py-2.5 px-2 sm:px-3">Category</th>
                          <th className="py-2.5 px-2 sm:px-3">Amount</th>
                          <th className="py-2.5 px-2 sm:px-3">Description</th>
                          <th className="py-2.5 px-2 sm:px-3">Timestamp</th>
                          <th className="py-2.5 px-2 text-right sm:px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trip.expenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50 align-top">
                            <td className="py-2.5 px-2 whitespace-nowrap sm:px-3">
                              <span className="text-[13px] font-semibold text-slate-800 md:text-xs">
                                {exp.expense_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-mono tabular-nums font-bold text-slate-900 sm:px-3">
                              {formatTsh(Number(exp.amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 sm:px-3">{exp.description || '—'}</td>
                            <td className="py-2.5 px-2 text-slate-400 font-mono tabular-nums whitespace-nowrap sm:px-3">
                              {new Date(exp.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right sm:px-3">
                              <button
                                onClick={() => onDeleteExpense(exp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                                title="Delete expense"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LOG ROADSIDE SPARE PARTS */}
          {activeConsoleTab === 'spares' && (
            <div className="min-h-[360px] space-y-4 sm:min-h-[420px] sm:space-y-6">
              {/* Append Spare Part Form Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 sm:p-5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-orange-600 hidden text-white sm:flex items-center justify-center">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Log Roadside Spare Part &amp; Repair
                      </h3>
                      <p className="text-xs hidden sm:flex text-slate-500">
                        Record emergency parts and repairs needed during trip without modifying previous logs
                      </p>
                    </div>
                  </div>
                </div>

                {/* Common Emergency Presets */}
                <div className="sm:flex flex-wrap items-center hidden gap-1.5 text-xs">
                  <span className="text-xs font-semibold text-slate-700 mr-1">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() =>
                      applySparePreset(
                        'Heavy Duty Drive Axle Tire (315/80R22.5)',
                        '380',
                        'Highway tire puncture roadside replacement'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Drive Axle Tire (Tsh 380)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applySparePreset('Air Brake Coupling Valve', '45', 'Replaced leaking air brake hose line')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Air Brake Valve (Tsh 45)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applySparePreset(
                        'Alternator Fan Belt & Tensioner',
                        '110',
                        'Belt snapped during steep mountain climb'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Fan Belt (Tsh 110)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applySparePreset('Fuel Water Separator Filter', '65', 'Fuel flow blockage replacement')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Fuel Filter (Tsh 65)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applySparePreset('Hydraulic Lift Cylinder Seal Kit', '140', 'Hydraulic fluid leak repair')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-orange-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Hydraulic Seal (Tsh 140)
                  </button>
                </div>

                <form onSubmit={handleAppendSparePart} className="space-y-3 sm:space-y-3.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Part / Service Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Drive Axle Tire 315/80R22.5"
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Part / Service Price (Tsh) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-xs">Tsh</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          required
                          placeholder="0.00"
                          value={partPrice}
                          onChange={(e) => setPartPrice(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Garage / Roadside Mechanic
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Nakuru Roadside Heavy Spares & Workshop"
                        value={partReplacedBy}
                        onChange={(e) => setPartReplacedBy(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Installation Timestamp *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={partTimestamp}
                        onChange={(e) => setPartTimestamp(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Description / Maintenance Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Road debris caused blowout; replaced on shoulder"
                      value={partDesc}
                      onChange={(e) => setPartDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition shadow-sm flex items-center space-x-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Running Spare Parts Audit Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {trip.spare_parts.length} Parts · {formatTsh(totalSpareParts, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total
                  </h4>
                  <span className="text-xs hidden sm:flex text-slate-400">Live Synchronized</span>
                </div>

                {trip.spare_parts.length === 0 ? (
                  <div className="p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500 bg-slate-50">
                    No roadside spare parts needed so far. Vehicle running reliably.
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
                    <table className="min-w-[1120px] w-full text-left text-[13px] md:min-w-0 md:text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider md:text-[10px]">
                        <tr>
                          <th className="py-2.5 px-2 sm:px-3">Part / Service Name</th>
                          <th className="py-2.5 px-2 sm:px-3">Price</th>
                          <th className="py-2.5 px-2 sm:px-3">Mechanic / Workshop</th>
                          <th className="py-2.5 px-2 sm:px-3">Description</th>
                          <th className="py-2.5 px-2 sm:px-3">Timestamp</th>
                          <th className="py-2.5 px-2 text-right sm:px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trip.spare_parts.map((sp) => (
                          <tr key={sp.id} className="hover:bg-slate-50 align-top">
                            <td className="py-2.5 px-2 font-semibold text-slate-900 sm:px-3">{sp.part_name}</td>
                            <td className="py-2.5 px-2 font-mono tabular-nums font-bold text-slate-900 sm:px-3">
                              {formatTsh(Number(sp.price), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 sm:px-3">{sp.replaced_by || 'Field Workshop'}</td>
                            <td className="py-2.5 px-2 text-slate-500 sm:px-3">{sp.description || '—'}</td>
                            <td className="py-2.5 px-2 text-slate-400 font-mono tabular-nums whitespace-nowrap sm:px-3">
                              {new Date(sp.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right sm:px-3">
                              <button
                                onClick={() => onDeleteSparePart(sp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                                title="Delete spare part"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENT DELAYS */}
          {activeConsoleTab === 'delays' && (
            <div className="min-h-[360px] space-y-4 sm:min-h-[420px] sm:space-y-6">
              {/* Document Delay Incident Form Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 sm:p-5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg hidden sm:flex bg-amber-600 text-white items-center justify-center">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Document Mid-Trip Delay Incident
                      </h3>
                      <p className="text-xs text-slate-500">
                        Record delays (customs hold-up, mechanical breakdown, traffic, weather)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Common Delay Presets */}
                <div className="flex flex-wrap items-center gap-1 text-xs sm:gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 mr-1">Frequent Delays:</span>
                  <button
                    type="button"
                    onClick={() =>
                      applyDelayPreset('Customs Hold-Up at Border Clearance Post', 'High', '240')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Customs Hold-Up (4h)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDelayPreset('Mechanical Breakdown & Roadside Repair Wait', 'High', '120')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Mechanical Breakdown (2h)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDelayPreset('Traffic Gridlock & Highway Obstruction', 'Medium', '75')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Traffic Gridlock (1h15m)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDelayPreset('Severe Rainstorm & Muddy Mountain Road Slowdown', 'Medium', '90')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Weather / Rain (1.5h)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDelayPreset('Weighbridge Calibration & Axle Queue', 'Low', '45')
                    }
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 text-xs border border-slate-200 transition"
                  >
                    Weighbridge Queue (45m)
                  </button>
                </div>

                <form onSubmit={handleAppendDelay} className="space-y-3 sm:space-y-3.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Delay Reason / Incident Description *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Customs system offline at Malaba border clearance checkpoint"
                        value={delayReason}
                        onChange={(e) => setDelayReason(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Severity Level
                      </label>
                      <select
                        value={delaySeverity}
                        onChange={(e) => setDelaySeverity(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="Low">Low (&lt; 1 hour)</option>
                        <option value="Medium">Medium (1 - 3 hours)</option>
                        <option value="High">High (3 - 6 hours)</option>
                        <option value="Critical">Critical (&gt; 6 hours / Overnight)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Location / Highway Checkpoint
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Malaba OSBP Gate #3"
                        value={delayLocation}
                        onChange={(e) => setDelayLocation(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Estimated Impact (Minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="60"
                        value={delayDuration}
                        onChange={(e) => setDelayDuration(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Incident Timestamp *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={delayTimestamp}
                        onChange={(e) => setDelayTimestamp(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm flex items-center space-x-1.5"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      <span>Document Delay Incident</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Real-Time Delay Sub-Log List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {trip.delay_logs?.length || 0} Incidents · {totalDelayMinutes}m Total Impact
                  </h4>
                  <span className="text-xs hidden sm:flex text-slate-400">Chronological Audit</span>
                </div>

                {(!trip.delay_logs || trip.delay_logs.length === 0) ? (
                  <div className="p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500 bg-slate-50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1 opacity-80" />
                    <p className="font-semibold text-slate-700">No delays currently documented for this route.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Journey is operating on schedule.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trip.delay_logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <span className="font-bold text-slate-800">
                              {log.severity} Severity
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center space-x-1 font-mono tabular-nums">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                            </span>
                            {log.duration_minutes ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-amber-800 font-mono tabular-nums">
                                  +{log.duration_minutes} min delay
                                </span>
                              </>
                            ) : null}
                          </div>

                          <p className="text-xs font-bold text-slate-900">{log.reason}</p>

                          {log.location && (
                            <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>Checkpoint: {log.location}</span>
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => onRemoveDelayLog(trip.id, log.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                          title="Remove delay log"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HISTORICAL PATH OF THE TRIP */}
          {activeConsoleTab === 'history' && (
            <div className="min-h-[360px] space-y-3 sm:min-h-[420px] sm:space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <History className="h-4 w-4 hidden sm:flex text-purple-700" />
                    <span>Preserved Historical Path of the Journey</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unified audit of all departure dispatches, mid-trip disbursements, roadside maintenance parts,
                    and delay incidents with immutable timestamps.
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1 self-start rounded-lg border border-slate-200 bg-white p-1 text-[10px] sm:self-center sm:text-xs">
                  <button
                    onClick={() => setHistoryFilter('all')}
                    className={`rounded px-2 py-1 font-semibold transition sm:px-2.5 ${
                      historyFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({chronologicalEvents.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('expense')}
                    className={`rounded px-2 py-1 font-semibold transition sm:px-2.5 ${
                      historyFilter === 'expense'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Expenses ({trip.expenses.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('spare_part')}
                    className={`rounded px-2 py-1 font-semibold transition sm:px-2.5 ${
                      historyFilter === 'spare_part'
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Repairs ({trip.spare_parts.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('delay')}
                    className={`rounded px-2 py-1 font-semibold transition sm:px-2.5 ${
                      historyFilter === 'delay'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Delays ({trip.delay_logs?.length || 0})
                  </button>
                </div>
              </div>

              {/* Vertical Historical Path Timeline */}
              <div className="relative pl-5 space-y-3 before:absolute before:left-2.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200 sm:pl-6 sm:space-y-4">
                {displayTimelineItems.map((item) => (
                  <div key={item.id} className="relative group">
                    <div
                      className={`absolute -left-5 top-2 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] shadow-xs sm:-left-6 sm:top-1.5 sm:h-5 sm:w-5 sm:text-[10px] ${
                        item.type === 'departure'
                          ? 'bg-blue-600 text-white'
                          : item.type === 'expense'
                          ? 'bg-emerald-600 text-white'
                          : item.type === 'spare_part'
                          ? 'bg-orange-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {item.type === 'departure' && '▶'}
                      {item.type === 'expense' && 'Tsh'}
                      {item.type === 'spare_part' && '⚙'}
                      {item.type === 'delay' && '⏱'}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300 sm:rounded-xl sm:p-3.5">
                      <div className="flex flex-col gap-1 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border sm:px-2 sm:py-0.5 sm:text-[10px] ${item.badgeStyle}`}>
                            {item.badge}
                          </span>
                          <span className="font-mono tabular-nums text-slate-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {item.runningSpend !== undefined && (
                          <div className="font-mono tabular-nums text-slate-500 sm:text-[11px]">
                            Spend: <strong className="text-slate-800">{formatTsh(item.runningSpend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                      </div>

                      <div className="pt-1 text-[11px] font-bold leading-snug text-slate-900 sm:text-xs">{item.title}</div>
                      {item.subtitle && <p className="pt-1 text-[10px] leading-relaxed text-slate-500 sm:text-xs">{item.subtitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <strong className="text-green-700 animate-pulse uppercase">{trip.status}</strong>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCompleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
            >
              Complete Trip
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
