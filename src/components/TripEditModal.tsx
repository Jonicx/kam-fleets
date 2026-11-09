import React, { useEffect, useState } from 'react';
import { AlertCircle, Navigation2, X } from 'lucide-react';
import { Client, Driver, EnrichedTrip, Trip, Truck } from '../types/database.ts';
import { toLocalDateTimeInput } from '../utils/dateInput.ts';

type TripDetailUpdates = Partial<Pick<Trip,
  'truck_id' | 'driver_id' | 'client_id' | 'origin' | 'destination' | 'scheduled_start' | 'scheduled_end' | 'budget_allocated' | 'driver_pay' | 'cargo_type' | 'notes'>>;

interface TripEditModalProps {
  trip: EnrichedTrip;
  trucks: Truck[];
  drivers: Driver[];
  clients: Client[];
  onSave: (tripId: string, updates: TripDetailUpdates) => void;
  onClose: () => void;
}

const inputClass =
  'w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'text-[11px] font-semibold text-slate-700 block mb-1';

export const TripEditModal: React.FC<TripEditModalProps> = ({ trip, trucks, drivers, clients, onSave, onClose }) => {
  const canReassign = trip.status === 'Planned';
  const [truckId, setTruckId] = useState(trip.truck_id);
  const [driverId, setDriverId] = useState(trip.driver_id);
  const [clientId, setClientId] = useState(trip.client_id || '');
  const [origin, setOrigin] = useState(trip.origin);
  const [destination, setDestination] = useState(trip.destination);
  const [scheduledStart, setScheduledStart] = useState(toLocalDateTimeInput(trip.scheduled_start));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalDateTimeInput(trip.scheduled_end));
  const [budget, setBudget] = useState(String(trip.budget_allocated));
  const [driverPay, setDriverPay] = useState(String(trip.driver_pay || 0));
  const [cargoType, setCargoType] = useState(trip.cargo_type || '');
  const [notes, setNotes] = useState(trip.notes || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const truckOptions = trucks.filter((truck) => truck.id === trip.truck_id || truck.status !== 'On Trip');
  const driverOptions = drivers.filter((driver) => driver.id === trip.driver_id || driver.status !== 'On Trip');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      onSave(trip.id, {
        ...(canReassign ? { truck_id: truckId, driver_id: driverId } : {}),
        client_id: clientId || null,
        origin: origin.trim(),
        destination: destination.trim(),
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: new Date(scheduledEnd).toISOString(),
        budget_allocated: Number(budget),
        driver_pay: Number(driverPay),
        cargo_type: cargoType.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The trip could not be updated.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-3 sm:items-start sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Edit trip details" className="modal-readable bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation2 className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold">Edit Trip Details</h3>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="trip-origin" className={labelClass}>Origin *</label>
              <input id="trip-origin" required maxLength={200} value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="trip-destination" className={labelClass}>Destination *</label>
              <input id="trip-destination" required maxLength={200} value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="trip-truck" className={labelClass}>Truck</label>
              <select id="trip-truck" disabled={!canReassign} value={truckId} onChange={(e) => setTruckId(e.target.value)} className={inputClass}>
                {truckOptions.map((truck) => (
                  <option key={truck.id} value={truck.id}>{truck.license_plate} · {truck.model} ({truck.status})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="trip-driver" className={labelClass}>Driver</label>
              <select id="trip-driver" disabled={!canReassign} value={driverId} onChange={(e) => setDriverId(e.target.value)} className={inputClass}>
                {driverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.full_name} ({driver.status})</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="trip-client" className={labelClass}>Client (optional)</label>
              <select id="trip-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">No client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            {!canReassign && (
              <p className="text-[11px] text-slate-500 sm:col-span-2">The truck and driver can only be changed before the trip starts.</p>
            )}
            <div>
              <label htmlFor="trip-start" className={labelClass}>Scheduled start *</label>
              <input id="trip-start" type="datetime-local" required value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="trip-end" className={labelClass}>Scheduled end *</label>
              <input id="trip-end" type="datetime-local" required min={scheduledStart} value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="trip-budget" className={labelClass}>Budget estimate (TSh) *</label>
              <input id="trip-budget" type="number" required min={1} step="1" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label htmlFor="trip-pay" className={labelClass}>Driver pay (TSh)</label>
              <input id="trip-pay" type="number" required min={0} step="1" inputMode="numeric" value={driverPay} onChange={(e) => setDriverPay(e.target.value)} className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="trip-cargo" className={labelClass}>Cargo</label>
            <input id="trip-cargo" maxLength={120} value={cargoType} onChange={(e) => setCargoType(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="trip-notes" className={labelClass}>Notes</label>
            <textarea id="trip-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};
