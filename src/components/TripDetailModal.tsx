import React, { useState } from 'react';
import {
  X,
  Navigation2,
  Calendar,
  Wallet,
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
  CheckCircle,
  Check,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import {
  EnrichedTrip,
  ExpenseType,
  TripStatus,
  DelayLog,
} from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { getDelaySeverityClasses } from '../utils/delaySeverity.ts';

interface TripDetailModalProps {
  trip: EnrichedTrip;
  onClose: () => void;
  onOpenUpdateModal?: (tripId: string) => void;
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

export const TripDetailModal: React.FC<TripDetailModalProps> = ({
  trip,
  onClose,
  onOpenUpdateModal,
  onUpdateStatus,
  onAddDelayLog,
  onRemoveDelayLog,
  onAddExpense,
  onDeleteExpense,
  onAddSparePart,
  onDeleteSparePart,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'delays' | 'expenses' | 'spares' | 'overview'>('stats');

  // Form states
  const [showAddDelay, setShowAddDelay] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [delaySeverity, setDelaySeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [delayLocation, setDelayLocation] = useState('');
  const [delayDuration, setDelayDuration] = useState('60');

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseType>('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  const [showAddSpare, setShowAddSpare] = useState(false);
  const [partName, setPartName] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [partReplacedBy, setPartReplacedBy] = useState('');

  const [modalError, setModalError] = useState<string | null>(null);
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);

  const isCompleted = trip.status === 'Completed';
  const isOngoing = trip.status === 'Ongoing';

  const budget = Number(trip.budget_allocated) || 0;
  const driverPay = Number(trip.driver_pay) || 0;
  const totalExp = trip.status === 'Completed' && trip.total_expenses_cost !== undefined
    ? Number(trip.total_expenses_cost)
    : trip.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalSpares = trip.status === 'Completed' && trip.total_spare_parts_cost !== undefined
    ? Number(trip.total_spare_parts_cost)
    : trip.spare_parts.reduce((s, sp) => s + Number(sp.price), 0);

  // Finalized budget variance is not actual billed revenue or accounting profit.
  const calculatedProfitLoss = budget - (driverPay + totalExp + totalSpares);
  const profitLoss = isCompleted && trip.final_profit_loss !== undefined
    ? Number(trip.final_profit_loss)
    : calculatedProfitLoss;

  const isWithinBudget = profitLoss >= 0;

  const handleCreateDelay = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!delayReason.trim()) {
      setModalError('Delay reason is required.');
      return;
    }
    onAddDelayLog(trip.id, {
      reason: delayReason.trim(),
      severity: delaySeverity,
      location: delayLocation.trim() || undefined,
      duration_minutes: parseInt(delayDuration) || 0,
      timestamp: new Date().toISOString(),
    });
    setDelayReason('');
    setDelayLocation('');
    setShowAddDelay(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError('Please enter a valid expense amount greater than Tsh 0.');
      return;
    }
    onAddExpense(trip.id, {
      expense_type: expenseType,
      amount: amountNum,
      description: expenseDesc.trim(),
      timestamp: new Date().toISOString(),
    });
    setExpenseAmount('');
    setExpenseDesc('');
    setShowAddExpense(false);
  };

  const handleCreateSpare = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const priceNum = parseFloat(partPrice);
    if (!partName.trim() || isNaN(priceNum) || priceNum < 0) {
      setModalError('Please provide a valid part / service name and non-negative price (Tsh 0 or greater).');
      return;
    }
    onAddSparePart(trip.id, {
      part_name: partName.trim(),
      price: priceNum,
      description: partDesc.trim(),
      replaced_by: partReplacedBy.trim() || undefined,
      timestamp: new Date().toISOString(),
    });
    setPartName('');
    setPartPrice('');
    setPartDesc('');
    setPartReplacedBy('');
    setShowAddSpare(false);
  };

  const budgetPct = Math.round(trip.budget_utilization_pct);
  const isOver = trip.is_over_budget;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="modal-readable bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] min-w-0">
        {/* Header */}
        <div className="bg-slate-900 text-white p-3 sm:p-5 border-b border-slate-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center flex-wrap gap-2">
                {isCompleted ? (
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded tracking-wider flex items-center gap-1 ${
                      isWithinBudget
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    <CheckCircle className="h-3 w-3 inline" />
                    <span>Completed</span>
                    <span className="opacity-60"> </span>
                    <span>{isWithinBudget ? 'Within budget' : 'Over budget'}</span>
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                      trip.status === 'Ongoing'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {trip.status} Trip
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight flex flex-wrap items-center gap-1 min-w-0 break-words">
                <span>{trip.origin}</span>
                <span className="text-slate-400">→</span>
                <span>{trip.destination}</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300">
                Cargo: <strong className="text-white">{trip.cargo_type || 'General Freight'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {modalError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-5 py-2 text-xs font-semibold flex items-center justify-between">
            <span>{modalError}</span>
            <button onClick={() => setModalError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Completed Journey Financial Outcome & Lock Status */}
        {isCompleted && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${isWithinBudget ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                    {isWithinBudget ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Completed at: {trip.completed_at ? new Date(trip.completed_at).toLocaleString() : new Date(trip.updated_at).toLocaleString()} ·
                  </div>
                </div>
              </div>

              <div className="text-left  sm:text-right sm:border-l sm:border-slate-800 sm:pl-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Budget Variance</span>
                <span className={`text-xl font-black font-mono tabular-nums ${isWithinBudget ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {`${profitLoss >= 0 ? '+' : '-'}${formatTsh(Math.abs(profitLoss), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>

            {/* Formula calculation card */}
            <div className="bg-slate-950/70 p-2 rounded-xl  border-slate-800 font-mono text-xs space-y-1.5">
              <div className="text-[11px] text-slate-400 font-sans font-semibold pb-1  border-slate-800/80 flex items-center justify-between">
                <span>Budget variance = budget estimate − driver pay − trip expenses − in-trip parts. This is not billed revenue or cash received.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto overflow-y-hidden  border-b border-slate-200 bg-white px-2 py-2 sm:px-5 sm:py-3 shadow-md drop-shadow-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2 py-2 sm:gap-4">
            <button
              onClick={() => setActiveTab('stats')}
              className={`whitespace-nowrap px-2 py-2 text-[10px] font-bold transition sm:px-3 mb-3 sm:text-xs ${
                activeTab === 'stats'
                  ? ' text-emerald-600'
                  : ' text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                <span>Stats</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('delays')}
              className={`whitespace-nowrap px-2 py-2 text-[10px] font-bold transition sm:px-3 mb-3 sm:text-xs ${
                activeTab === 'delays'
                  ? ' text-amber-500'
                  : ' text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Delay Logs ({trip.delay_logs?.length || 0})</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`whitespace-nowrap px-2 py-2 text-[10px] font-bold transition sm:px-3 mb-3 sm:text-xs ${
                activeTab === 'expenses'
                  ? ' text-red-600'
                  : ' text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                <span>Expenses ({trip.expenses?.length || 0})</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('spares')}
              className={`whitespace-nowrap px-2 py-2 text-[10px] font-bold transition mb-3 sm:px-3 sm:text-xs ${
                activeTab === 'spares'
                  ? ' text-amber-700'
                  : ' text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                <span>Spare Parts ({trip.spare_parts?.length || 0})</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap px-2 py-2 text-[10px] font-bold transition mb-3 sm:px-3 sm:text-xs ${
                activeTab === 'overview'
                  ? ' text-blue-600'
                  : ' text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <TruckIcon className="h-3.5 w-3.5" />
                <span>Vehicle &amp; Driver</span>
              </span>
            </button>
          </div>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {/* TAB 1: STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Trip Financial Summary</h3>
                <p className="text-[11px] text-slate-500 sm:text-xs">
                  Budget estimate, recorded costs, and current budget position.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Budget Estimate</div>
                    <div className="mt-2 text-2xl font-black font-mono tracking-tight sm:text-3xl">
                      {formatTsh(trip.budget_allocated)}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                      {isCompleted ? 'Final budget variance' : 'Budget remaining after current costs'}
                    </div>
                    <div className={`mt-2 text-xl font-black font-mono sm:text-2xl ${isOver ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {formatTsh(trip.remaining_budget)}
                    </div>
                  </div>
                </div>
                <details className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-bold text-slate-200">What does budget variance mean?</summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                    For a completed trip, it is the budget estimate minus finalized trip costs. A positive result means costs were below budget; a negative result means they were above budget. It is not invoiced revenue or profit.
                  </p>
                </details>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                    <span>Budget Utilization</span>
                    <span>{budgetPct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full ${isOver ? 'bg-rose-400' : budgetPct > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Driver Pay</div>
                  <div className="mt-2 text-xl font-extrabold text-slate-900 font-mono">
                    {formatTsh(trip.driver_pay || 0)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {isCompleted ? 'Recorded trip costs' : 'Costs + assigned driver pay'}
                  </div>
                  <div className={`mt-2 text-xl font-extrabold font-mono ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatTsh(trip.total_spent)}
                  </div>
                  {!isCompleted && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Driver pay is allocated but not treated as incurred until trip completion.</p>}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC DELAY LOGS */}
          {activeTab === 'delays' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">Dynamic Delay Reasons &amp; Logs</h3>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    Live dynamic logging with timestamps for route delays (e.g. customs checkpoints, mechanical stops, weather)
                  </p>
                </div>
                <button
                  onClick={() => setShowAddDelay(!showAddDelay)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-amber-400 sm:w-auto sm:text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Delay</span>
                </button>
              </div>

              {/* Add Delay Form */}
              {showAddDelay && (
                <form onSubmit={handleCreateDelay} className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                  <div className="font-bold text-xs text-amber-900 flex items-center space-x-1">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Record New Delay Event</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Reason for Delay *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Malaba border customs clearance backlog"
                        value={delayReason}
                        onChange={(e) => setDelayReason(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Severity Level
                      </label>
                      <select
                        value={delaySeverity}
                        onChange={(e) => setDelaySeverity(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Location / Checkpoint
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Malaba OSBP / Eldoret km 50"
                        value={delayLocation}
                        onChange={(e) => setDelayLocation(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Estimated Impact (Minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={delayDuration}
                        onChange={(e) => setDelayDuration(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddDelay(false)}
                      className="w-full rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 sm:w-auto sm:text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-amber-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-amber-500 sm:w-auto sm:text-xs"
                    >
                      Save Delay Log
                    </button>
                  </div>
                </form>
              )}

              {/* Delay Logs Timeline */}
              {(!trip.delay_logs || trip.delay_logs.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-1 opacity-80" />
                  <p className="font-semibold text-slate-700">No transit delays recorded for this trip.</p>
                  <p className="text-[11px] text-slate-400">Truck is operating on projected schedule.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trip.delay_logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-extrabold ${getDelaySeverityClasses(log.severity)}`}
                          >
                            {log.severity} Severity
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </span>
                          {log.duration_minutes ? (
                            <span className="text-[11px] font-bold text-slate-700">
                              +{log.duration_minutes} min delay
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-bold text-slate-900">{log.reason}</p>
                        {log.location && (
                          <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>{log.location}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => onRemoveDelayLog(trip.id, log.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Remove delay log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">Trip Expenses Ledger</h3>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    Disbursements incurred: Fuel, Tolls, Police/Bribes, Food, and Other transit fees
                  </p>
                </div>
                <button
                  onClick={() => setShowAddExpense(!showAddExpense)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-red-600 sm:w-auto sm:text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Expense</span>
                </button>
              </div>

              {/* Add Expense Form */}
              {showAddExpense && (
                <form onSubmit={handleCreateExpense} className="bg-red-50/60 p-4 rounded-xl border border-red-200 space-y-3">
                  <div className="font-bold text-xs text-red-900">Record New Trip Expense</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Expense Type *
                      </label>
                      <select
                        value={expenseType}
                        onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="Fuel">Fuel (Diesel refill)</option>
                        <option value="Tolls">Tolls (Highway / Weighbridge)</option>
                        <option value="Police/Bribes">Police/Bribes (Checkpoint clearance)</option>
                        <option value="Food">Food (Driver subsistence)</option>
                        <option value="Other">Other (Parking / Yard fees)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Amount (Tsh) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        placeholder="e.g. 150.00"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Description / Context
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 200L Diesel refill in Eldoret"
                        value={expenseDesc}
                        onChange={(e) => setExpenseDesc(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddExpense(false)}
                      className="w-full rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 sm:w-auto sm:text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-blue-500 sm:w-auto sm:text-xs"
                    >
                      Record Expense
                    </button>
                  </div>
                </form>
              )}

              {/* Expenses Table */}
              {trip.expenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <Receipt className="h-7 w-7 text-slate-400 mx-auto mb-1 opacity-80" />
                  <p className="font-semibold text-slate-700">No expenses recorded for this trip yet.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto [scrollbar-width:thin] shadow-2xs">
                  <table className="w-full min-w-[960px] text-left text-[13px] md:min-w-0 md:text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-bold md:text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trip.expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold md:text-[10px] ${
                                exp.expense_type === 'Fuel'
                                  ? 'bg-amber-100 text-amber-800'
                                  : exp.expense_type === 'Tolls'
                                  ? 'bg-blue-100 text-blue-800'
                                  : exp.expense_type === 'Police/Bribes'
                                  ? 'bg-rose-100 text-rose-800'
                                  : exp.expense_type === 'Food'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {exp.expense_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                            {formatTsh(Number(exp.amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{exp.description || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-xs md:text-[11px]">
                            {new Date(exp.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => onDeleteExpense(exp.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
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
          )}

          {/* TAB 3: SPARE PARTS (Maintenance required during a trip) */}
          {activeTab === 'spares' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">Roadside Spare Parts &amp; Maintenance</h3>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    Emergency mechanical repairs and spare parts procured while on the road
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSpare(!showAddSpare)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-orange-500 sm:w-auto sm:text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Spare Part</span>
                </button>
              </div>

              {/* Add Spare Part Form */}
              {showAddSpare && (
                <form onSubmit={handleCreateSpare} className="bg-orange-50/60 p-4 rounded-xl border border-orange-200 space-y-3">
                  <div className="font-bold text-xs text-orange-950 flex items-center space-x-1">
                    <Wrench className="h-4 w-4" />
                    <span>Log Mechanical Spare Part Installation</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Part / Service Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Drive Axle Tire 315/80R22.5"
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Price (Tsh) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        placeholder="e.g. 380.00"
                        value={partPrice}
                        onChange={(e) => setPartPrice(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Replaced By / Workshop
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Nakuru Roadside Spares &amp; Garage"
                        value={partReplacedBy}
                        onChange={(e) => setPartReplacedBy(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Description / Problem Encountered
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Emergency tire blowout after sharp iron scrap on road"
                        value={partDesc}
                        onChange={(e) => setPartDesc(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddSpare(false)}
                      className="w-full rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 sm:w-auto sm:text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-orange-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-orange-500 sm:w-auto sm:text-xs"
                    >
                      Save Spare Part Record
                    </button>
                  </div>
                </form>
              )}

              {/* Spare Parts List */}
              {trip.spare_parts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <Wrench className="h-7 w-7 text-slate-400 mx-auto mb-1 opacity-80" />
                  <p className="font-semibold text-slate-700">No spare parts purchased or replaced on this trip.</p>
                  <p className="text-[11px] text-slate-400">Truck mechanical systems operating normally.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto [scrollbar-width:thin] shadow-2xs">
                  <table className="w-full min-w-[1120px] text-left text-[13px] md:min-w-0 md:text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-bold md:text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Part / Service Name</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Mechanic / Shop</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trip.spare_parts.map((sp) => (
                        <tr key={sp.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{sp.part_name}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                            {formatTsh(Number(sp.price), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{sp.replaced_by || 'Field Workshop'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{sp.description || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-xs md:text-[11px]">
                            {new Date(sp.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => onDeleteSparePart(sp.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
                              title="Delete spare part record"
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
          )}

          {/* TAB 4: TRUCK & DRIVER OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Truck Association Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <TruckIcon className="h-4 w-4 text-amber-600" />
                    <span>Allocated Vehicle (truck_id)</span>
                  </div>
                  {trip.truck ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">License Plate:</span>
                        <span className="font-extrabold text-slate-900">{trip.truck.license_plate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Model:</span>
                        <span className="font-medium text-slate-800">{trip.truck.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="font-semibold text-blue-700">{trip.truck.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Haul Capacity:</span>
                        <span className="font-medium text-slate-800">{trip.truck.capacity_tons} Tons</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Odometer:</span>
                        <span className="font-mono text-slate-800">{trip.truck.current_mileage?.toLocaleString()} km</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No truck associated with this trip ID.</p>
                  )}
                </div>

                {/* Driver Association Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Assigned Driver (driver_id)</span>
                  </div>
                  {trip.driver ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Full Name:</span>
                        <span className="font-extrabold text-slate-900">{trip.driver.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">License No:</span>
                        <span className="font-mono font-medium text-slate-800">{trip.driver.license_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-medium text-slate-800">{trip.driver.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="font-semibold text-blue-700">{trip.driver.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Commercial Experience:</span>
                        <span className="font-medium text-slate-800">{trip.driver.experience_years} Years</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No driver associated with this trip ID.</p>
                  )}
                </div>
              </div>

              {/* Trip Metadata Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">Schedule &amp; Trip Notes</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Scheduled Departure</span>
                    <span className="font-medium text-slate-800">{new Date(trip.scheduled_start).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Scheduled Arrival</span>
                    <span className="font-medium text-slate-800">{new Date(trip.scheduled_end).toLocaleString()}</span>
                  </div>
                </div>
                {trip.notes && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase">Route Notes</span>
                    <p className="text-slate-700 mt-0.5">{trip.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {trip.status === 'Ongoing' && onOpenUpdateModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUpdateModal(trip.id);
                }}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white transition shadow-xs hover:bg-amber-400 sm:w-auto sm:text-xs"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Update Trip</span>
              </button>
            )}

            {/* Status change actions */}
            {trip.status === 'Planned' && (
              <button
                onClick={() => onUpdateStatus(trip.id, 'Ongoing')}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-blue-500 sm:w-auto sm:text-xs"
              >
                Start Trip
              </button>
            )}
            {trip.status === 'Ongoing' && (
              <button
                onClick={() => setShowCompleteConfirmModal(true)}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-500 sm:w-auto sm:text-xs"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Complete Trip</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-[11px] font-bold text-white transition hover:bg-slate-800 sm:w-auto sm:text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
