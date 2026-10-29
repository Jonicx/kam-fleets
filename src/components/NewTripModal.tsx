import React, { useState } from 'react';
import {
  X,
  Navigation2,
  Calendar,
  AlertCircle,
  Truck as TruckIcon,
  User,
  Wallet,
  Receipt,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  Truck,
  Driver,
  ExpenseType,
  CreateTripPayload,
  InitialExpenseInput,
  InitialSparePartInput,
} from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';

interface NewTripModalProps {
  trucks: Truck[];
  drivers: Driver[];
  onClose: () => void;
  onCreateTrip: (payload: CreateTripPayload) => void;
}

export const NewTripModal: React.FC<NewTripModalProps> = ({
  trucks,
  drivers,
  onClose,
  onCreateTrip,
}) => {
  // Available assets (filtering to prevent double-booking)
  const availableTrucks = trucks.filter((t) => t.status === 'Available');
  const availableDrivers = drivers.filter((d) => d.status === 'Available');

  // Form states
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  // Schedule dates (Default: departing tomorrow at 06:00, arriving 5 days later)
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() + 1);
  defaultStart.setHours(6, 0, 0, 0);

  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 5);
  defaultEnd.setHours(18, 0, 0, 0);

  const formatDateForInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [scheduledStart, setScheduledStart] = useState(formatDateForInput(defaultStart));
  const [scheduledEnd, setScheduledEnd] = useState(formatDateForInput(defaultEnd));

  // Financial allocations
  const [budgetAllocated, setBudgetAllocated] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [notes, setNotes] = useState('');

  // Initial Expenses list at launch
  const [initialExpenses, setInitialExpenses] = useState<InitialExpenseInput[]>([]);

  // Initial Spare Parts list needed at launch
  const [initialSpareParts, setInitialSpareParts] = useState<InitialSparePartInput[]>([]);

  // Validation / Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick route presets
  const applyPreset = (orig: string, dest: string, defaultCargo: string, defaultBudget: string, defaultPay: string) => {
    setOrigin(orig);
    setDestination(dest);
    setCargoType(defaultCargo);
    setBudgetAllocated(defaultBudget);
    setDriverPay(defaultPay);
  };

  // Expense helpers
  const handleAddExpenseRow = () => {
    setInitialExpenses((prev) => [
      ...prev,
      {
        expense_type: 'Tolls',
        amount: 50,
        description: '',
      },
    ]);
  };

  const handleUpdateExpense = (index: number, field: keyof InitialExpenseInput, value: any) => {
    setInitialExpenses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveExpense = (index: number) => {
    setInitialExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  // Spare Parts helpers
  const handleAddSparePartRow = () => {
    setInitialSpareParts((prev) => [
      ...prev,
      {
        part_name: '',
        price: 80,
        description: 'Pre-departure replacement',
      },
    ]);
  };

  const handleUpdateSparePart = (index: number, field: keyof InitialSparePartInput, value: any) => {
    setInitialSpareParts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveSparePart = (index: number) => {
    setInitialSpareParts((prev) => prev.filter((_, i) => i !== index));
  };

  // Live Financial Summaries
  const budgetNum = parseFloat(budgetAllocated) || 0;
  const driverPayNum = parseFloat(driverPay) || 0;
  const expensesSubtotal = initialExpenses.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);
  const sparePartsSubtotal = initialSpareParts.reduce((sum, sp) => sum + (parseFloat(String(sp.price)) || 0), 0);
  const totalLaunchCommitment = driverPayNum + expensesSubtotal + sparePartsSubtotal;
  const projectedNetMargin = budgetNum - totalLaunchCommitment;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Double-booking & Availability validations
    if (!truckId) {
      setErrorMsg('Please select an Available truck from the fleet dropdown.');
      return;
    }
    const selectedTruck = trucks.find((t) => t.id === truckId);
    if (!selectedTruck || selectedTruck.status !== 'Available') {
      setErrorMsg('Double-Booking Conflict: The selected truck is no longer available. Please choose another.');
      return;
    }

    if (!driverId) {
      setErrorMsg('Please select an Available driver from the directory dropdown.');
      return;
    }
    const selectedDriver = drivers.find((d) => d.id === driverId);
    if (!selectedDriver || selectedDriver.status !== 'Available') {
      setErrorMsg('Double-Booking Conflict: The selected driver is no longer available. Please choose another.');
      return;
    }

    // 2. Route & Date validations
    if (!origin.trim()) {
      setErrorMsg('Origin facility/depot is required.');
      return;
    }
    if (!destination.trim()) {
      setErrorMsg('Destination delivery terminal is required.');
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      setErrorMsg('Both Scheduled Start and Scheduled End dates are required.');
      return;
    }
    if (new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
      setErrorMsg('Validation Error: Scheduled End date must be after Scheduled Start departure.');
      return;
    }

    // 3. Monetary validations
    if (budgetNum <= 0) {
      setErrorMsg('Validation Error: Budget Allocated must be a positive number greater than Tsh 0.');
      return;
    }
    if (driverPayNum < 0) {
      setErrorMsg('Validation Error: Driver Pay must be Tsh 0 or greater.');
      return;
    }

    // 4. Validate initial expenses
    for (let i = 0; i < initialExpenses.length; i++) {
      const exp = initialExpenses[i];
      const amount = parseFloat(String(exp.amount));
      if (isNaN(amount) || amount <= 0) {
        setErrorMsg(`Initial expense row #${i + 1} (${exp.expense_type}): Amount must be greater than Tsh 0.`);
        return;
      }
    }

    // 5. Validate initial spare parts
    for (let i = 0; i < initialSpareParts.length; i++) {
      const sp = initialSpareParts[i];
      if (!sp.part_name.trim()) {
        setErrorMsg(`Initial spare part row #${i + 1}: Part / Service Name cannot be blank.`);
        return;
      }
      const price = parseFloat(String(sp.price));
      if (isNaN(price) || price < 0) {
        setErrorMsg(`Initial spare part row #${i + 1} ('${sp.part_name}'): Price cannot be negative.`);
        return;
      }
    }

    try {
      onCreateTrip({
        truck_id: truckId,
        driver_id: driverId,
        origin: origin.trim(),
        destination: destination.trim(),
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        budget_allocated: budgetNum,
        driver_pay: driverPayNum,
        cargo_type: cargoType.trim(),
        notes: notes.trim(),
        initial_expenses: initialExpenses.map((e) => ({
          expense_type: e.expense_type,
          amount: parseFloat(String(e.amount)),
          description: e.description.trim(),
        })),
        initial_spare_parts: initialSpareParts.map((sp) => ({
          part_name: sp.part_name.trim(),
          price: parseFloat(String(sp.price)),
          description: sp.description?.trim(),
        })),
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch trip.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="modal-readable bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between border-b border-slate-800">
          <div>

            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center space-x-2">
              <Navigation2 className="h-5 w-5 text-amber-500 fill-current" />
              <span>Create &amp; Dispatch Trip</span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Launch trip route with assigned truck, driver pay, initial transit expenses, and launch maintenance parts.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-red-400 hover:text-white hover:bg-red-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6 max-sm:[&_label]:text-xs max-sm:[&_label_span]:text-xs max-sm:[&_input]:text-sm max-sm:[&_input]:py-2 max-sm:[&_select]:text-sm max-sm:[&_select]:py-2 max-sm:[&_textarea]:text-sm max-sm:[&_p]:text-xs max-sm:[&_h3]:text-sm"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* SECTION 1: ASSET SELECTION & DOUBLE-BOOKING PROTECTION */}
          <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3.5">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <TruckIcon className="h-4 w-4 text-blue-600 hidden sm:flex" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Select Available Truck &amp; Driver
                </h3>
              </div>
              <span className="text-xs sm:text-[11px] text-slate-500 font-medium">
                {availableTrucks.length} trucks, {availableDrivers.length} drivers available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Truck Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>Assigned Heavy Truck *</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                    Must be Available
                  </span>
                </label>
                {availableTrucks.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <p className="font-bold flex items-center space-x-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>No Trucks Currently Available</span>
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      All trucks are On Trip or in Maintenance. Free a vehicle or register a truck first.
                    </p>
                  </div>
                ) : (
                  <select
                    value={truckId}
                    onChange={(e) => setTruckId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select an available truck...
                    </option>
                    {availableTrucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.license_plate} - {t.model} ({t.capacity_tons || 30}T Capacity)
                      </option>
                    ))}
                  </select>
                )}
                {truckId && (
                  <div className="mt-1.5 text-xs sm:text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                    {(() => {
                      const t = trucks.find((trk) => trk.id === truckId);
                      return t ? (
                        <>
                          <span className="font-mono text-slate-700 font-bold">{t.license_plate}</span>
                          <span>•</span>
                          <span>{t.model}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-semibold">{t.status}</span>
                        </>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Driver Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>Assigned Driver *</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                    Must be Available
                  </span>
                </label>
                {availableDrivers.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <p className="font-bold flex items-center space-x-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>No Drivers Currently Available</span>
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      All drivers are on active trips or off duty. Mark a driver Available first.
                    </p>
                  </div>
                ) : (
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select an available commercial driver...
                    </option>
                    {availableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.license_number}) - {d.phone}
                      </option>
                    ))}
                  </select>
                )}
                {driverId && (
                  <div className="mt-1.5 text-xs sm:text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                    {(() => {
                      const d = drivers.find((drv) => drv.id === driverId);
                      return d ? (
                        <>
                          <span className="text-slate-800 font-bold">{d.full_name}</span>
                          <span>•</span>
                          <span className="font-mono">{d.license_number}</span>
                          <span>•</span>
                          <span>{d.experience_years} yrs exp</span>
                        </>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: ROUTING & SCHEDULE */}
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <Navigation2 className="h-3.5 w-3.5 hidden sm:flex text-slate-600" />
                <span>2. Trip Routing &amp; Schedule</span>
              </h3>

              {/* Quick Route Preset Buttons */}
              <div className="hidden items-center space-x-1 text-[11px] lg:flex">
                <span className="text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Kigali Central Depot, Rwanda',
                      'Mombasa Port Gateway, Kenya',
                      '32 Tons Heavy Rebar Steel & Clamps',
                      '3500',
                      '480'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Kigali → Mombasa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Dar es Salaam Port Terminal, Tanzania',
                      'Kigali Bumbogo Logistics Hub',
                      '25 Tons Bulk Agricultural Fertilizer',
                      '2900',
                      '400'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Dar → Kigali
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Kigali Prime Special Economic Zone',
                      'Rubavu Cross-Border Terminal',
                      '28 Tons Bagged Grain Provisions',
                      '1250',
                      '180'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Local Kigali → Rubavu
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Origin Depot / Staging Facility *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kigali Central Supply Depot"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Destination Delivery Hub *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mombasa Port Gateway"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Scheduled Departure (Start Date &amp; Time) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Scheduled Arrival (End Date &amp; Time) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Cargo Description &amp; Specifications
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30 Tons Heavy Cement &amp; Steel Clamps"
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Trip Operational Instructions / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weighbridge compliance; check seals at Malaba"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: BUDGET ALLOCATION & DRIVER PAY */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Wallet className="h-4 w-4 hidden sm:flex text-emerald-600" />
              <span>3. Financial Allocation &amp; Driver Compensation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Budget Allocated (Tsh) *
                  <span className="text-slate-400 font-normal block text-[10px]">
                    Total revenue / operational capital allocated for this route
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Tsh</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 3200.00"
                    value={budgetAllocated}
                    onChange={(e) => setBudgetAllocated(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Driver Pay specifically for this trip instance (Tsh) *
                  <span className="text-slate-400 font-normal block text-[10px]">
                    Contract compensation payable to the driver upon route completion
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Tsh</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="e.g. 450.00"
                    value={driverPay}
                    onChange={(e) => setDriverPay(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Financial Rollup Projection Box */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:flex-nowrap sm:gap-x-4 sm:gap-y-0">
                <div>
                  <span className="text-xs sm:text-[10px] text-slate-400 uppercase block">Budget Allocated</span>
                  <span className="font-extrabold text-slate-900 font-mono">{formatTsh(budgetNum)}</span>
                </div>
                <span className="hidden text-slate-300 sm:inline">-</span>
                <div>
                  <span className="text-xs sm:text-[10px] text-slate-400 uppercase block">Driver Pay</span>
                  <span className="font-bold text-slate-700 font-mono">{formatTsh(driverPayNum)}</span>
                </div>
                <span className="hidden text-slate-300 sm:inline">-</span>
                <div>
                  <span className="text-xs sm:text-[10px] text-slate-400 uppercase block">Launch Expenses</span>
                  <span className="font-bold text-slate-700 font-mono">{formatTsh(expensesSubtotal)}</span>
                </div>
                <span className="hidden text-slate-300 sm:inline">-</span>
                <div>
                  <span className="text-xs sm:text-[10px] text-slate-400 uppercase block">Launch Spares</span>
                  <span className="font-bold text-slate-700 font-mono">{formatTsh(sparePartsSubtotal)}</span>
                </div>
              </div>

              <div className="w-full border-t border-slate-200 pt-3 text-left sm:w-auto sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right">
                <span className="text-xs sm:text-[10px] text-slate-400 uppercase block">Projected Net Margin</span>
                <span
                  className={`font-mono font-extrabold text-sm ${
                    projectedNetMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatTsh(projectedNetMargin)}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: INITIAL TRIP EXPENSES */}
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Receipt className="h-4 w-4 hidden sm:flex text-blue-600" />
                  <span>4. Initial Launch Expenses (Optional)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pre-departure disbursements: Fuel, Tolls advance, Police/Checkpoints, Food, Other
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddExpenseRow}
                className="flex w-full items-center justify-center space-x-1 px-2.5 py-2 sm:w-auto sm:py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-semibold transition border border-blue-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Expense Line</span>
              </button>
            </div>

            {initialExpenses.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                No initial launch expenses recorded. You can add expenses later during the trip.
              </div>
            ) : (
              <div className="space-y-2">
                {initialExpenses.map((exp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Type *</label>
                      <select
                        value={exp.expense_type}
                        onChange={(e) => handleUpdateExpense(idx, 'expense_type', e.target.value as ExpenseType)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 bg-white"
                      >
                        <option value="Fuel">Fuel (Diesel)</option>
                        <option value="Tolls">Tolls / Highway</option>
                        <option value="Police/Bribes">Police/Bribes</option>
                        <option value="Food">Food / Allowance</option>
                        <option value="Other">Other Fees</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Amount (Tsh) *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={exp.amount}
                        onChange={(e) => handleUpdateExpense(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Description</label>
                      <input
                        type="text"
                        value={exp.description}
                        onChange={(e) => handleUpdateExpense(idx, 'description', e.target.value)}
                        placeholder="e.g. 400L Diesel tank refill"
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end items-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Remove expense line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: INITIAL SPARE PARTS AT LAUNCH */}
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Wrench className="h-4 w-4 hidden sm:flex text-orange-600" />
                  <span>5. Initial Spare Parts Needed at Launch (Optional)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pre-departure vehicle maintenance replacements (e.g. drive axle tire, fan belt, oil filter)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSparePartRow}
                className="flex w-full items-center justify-center space-x-1 px-2.5 py-2 sm:w-auto sm:py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition border border-orange-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Launch Spare Part</span>
              </button>
            </div>

            {initialSpareParts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                No initial spare parts required for launch. Vehicle passed pre-departure inspection checklist.
              </div>
            ) : (
              <div className="space-y-2">
                {initialSpareParts.map((sp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Part / Service Name *</label>
                      <input
                        type="text"
                        required
                        value={sp.part_name}
                        onChange={(e) => handleUpdateSparePart(idx, 'part_name', e.target.value)}
                        placeholder="e.g. Drive Axle Tire 315/80R22.5"
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Price (Tsh) *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={sp.price}
                        onChange={(e) => handleUpdateSparePart(idx, 'price', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Description</label>
                      <input
                        type="text"
                        value={sp.description || ''}
                        onChange={(e) => handleUpdateSparePart(idx, 'description', e.target.value)}
                        placeholder="e.g. Replaced worn front tire"
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end items-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveSparePart(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Remove spare part line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Status Commitment Notice 
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start space-x-2.5">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-bold">Automated Status Transition &amp; Lock</p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Upon submitting, this trip status will automatically become{' '}
                <span className="font-extrabold uppercase px-1 py-0.2 rounded bg-blue-200 text-blue-900">
                  Ongoing
                </span>
                . The selected Truck and Driver statuses will immediately transition to{' '}
                <span className="font-extrabold uppercase px-1 py-0.2 rounded bg-blue-200 text-blue-900">
                  On Trip
                </span>
                , preventing any double-booking in other operations.
              </p>
            </div>
          </div>*/}

          {/* Modal Footer Actions */}
          <div className="flex flex-col items-stretch gap-3 pt-3 border-t border-slate-200 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:space-x-2 lg:flex-1">
              <button
                type="submit"
                disabled={availableTrucks.length === 0 || availableDrivers.length === 0}
                className={`w-full justify-center px-5 py-2.5 sm:w-auto lg:w-full lg:flex-1 rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5 ${
                  availableTrucks.length === 0 || availableDrivers.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20'
                }`}
              >
                <Navigation2 className="h-4 w-4 fill-current" />
                <span>Submit &amp; Launch Trip</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
