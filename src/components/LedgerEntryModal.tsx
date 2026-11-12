import React, { useState } from 'react';
import { AlertCircle, Receipt, X } from 'lucide-react';
import { EnrichedTrip, Expense, ExpenseType, SparePart } from '../types/database.ts';
import { toLocalDateTimeInput } from '../utils/dateInput.ts';
import { useModalAccessibility } from '../hooks/useModalAccessibility.ts';

export type LedgerEntry =
  | { kind: 'expense'; record?: Expense }
  | { kind: 'spare_part'; record?: SparePart };

export interface LedgerEntryValues {
  trip_id: string;
  category: ExpenseType;
  name: string;
  amount: number;
  description: string;
  replaced_by?: string;
  timestamp: string;
}

interface LedgerEntryModalProps {
  entry: LedgerEntry;
  trips: EnrichedTrip[];
  onSave: (kind: LedgerEntry['kind'], values: LedgerEntryValues, id?: string) => void;
  onClose: () => void;
}

const EXPENSE_TYPES: ExpenseType[] = ['Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other'];
const inputClass =
  'w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100';
const labelClass = 'text-[11px] font-semibold text-slate-700 block mb-1';

export const LedgerEntryModal: React.FC<LedgerEntryModalProps> = ({ entry, trips, onSave, onClose }) => {
  const isExpense = entry.kind === 'expense';
  const expense = entry.kind === 'expense' ? entry.record : undefined;
  const part = entry.kind === 'spare_part' ? entry.record : undefined;
  const existing = expense || part;
  const openTrips = trips.filter((trip) => trip.status !== 'Completed');

  const [tripId, setTripId] = useState(existing?.trip_id || openTrips[0]?.id || '');
  const [category, setCategory] = useState<ExpenseType>(expense?.expense_type || 'Fuel');
  const [name, setName] = useState(part?.part_name || '');
  const [amount, setAmount] = useState(existing ? String(expense ? expense.amount : part?.price ?? '') : '');
  const [description, setDescription] = useState(existing?.description || '');
  const [replacedBy, setReplacedBy] = useState(part?.replaced_by || '');
  const [timestamp, setTimestamp] = useState(toLocalDateTimeInput(existing?.timestamp || new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility(onClose);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (!tripId) throw new Error('Select an open trip for this entry.');
      onSave(
        entry.kind,
        {
          trip_id: tripId,
          category,
          name: name.trim(),
          amount: Number(amount),
          description: description.trim(),
          replaced_by: replacedBy.trim() || undefined,
          timestamp: new Date(timestamp).toISOString(),
        },
        existing?.id,
      );
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The entry could not be saved.');
    }
  };

  const title = `${existing ? 'Edit' : 'Add'} ${isExpense ? 'Trip Expense' : 'Spare Part / Repair'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-3 sm:items-start sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ledger-entry-title" tabIndex={-1} className="modal-readable bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="h-4 w-4 text-amber-500" />
            <h3 id="ledger-entry-title" className="text-sm font-bold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label htmlFor="ledger-trip" className={labelClass}>Trip *</label>
            <select id="ledger-trip" required disabled={Boolean(existing)} value={tripId} onChange={(e) => setTripId(e.target.value)} className={inputClass}>
              {existing && !openTrips.some((trip) => trip.id === existing.trip_id) && <option value={existing.trip_id}>Completed trip</option>}
              {openTrips.length === 0 && !existing && <option value="">No open trips</option>}
              {openTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.origin.split(',')[0]} → {trip.destination.split(',')[0]} · {trip.truck?.license_plate || 'No truck'} · {trip.status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isExpense ? (
              <div>
                <label htmlFor="ledger-category" className={labelClass}>Expense type *</label>
                <select id="ledger-category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseType)} className={inputClass}>
                  {EXPENSE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="ledger-name" className={labelClass}>Part / repair name *</label>
                <input id="ledger-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
            )}
            <div>
              <label htmlFor="ledger-amount" className={labelClass}>Amount (TSh) *</label>
              <input id="ledger-amount" type="number" required min={isExpense ? 1 : 0} step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="ledger-time" className={labelClass}>Date &amp; time *</label>
            <input id="ledger-time" type="datetime-local" required value={timestamp} onChange={(e) => setTimestamp(e.target.value)} className={inputClass} />
          </div>
          {!isExpense && (
            <div>
              <label htmlFor="ledger-replaced" className={labelClass}>Replaced / fitted by</label>
              <input id="ledger-replaced" maxLength={200} value={replacedBy} onChange={(e) => setReplacedBy(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label htmlFor="ledger-description" className={labelClass}>Description</label>
            <textarea id="ledger-description" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition">
              {existing ? 'Save Changes' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
