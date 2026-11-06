import React, { useState } from 'react';
import {
  Navigation2,
  Search,
  Filter,
  Plus,
  Calendar,
  AlertTriangle,
  Play,
  CheckCircle,
  Clock,
  MoreVertical,
  Trash2,
  Eye,
  MapPin,
  Wrench,
  Pencil,
} from 'lucide-react';
import { Client, EnrichedTrip, TripStatus } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';

interface TripsViewProps {
  trips: EnrichedTrip[];
  clients?: Client[];
  onSelectTrip: (tripId: string) => void;
  onOpenUpdateModal?: (tripId: string) => void;
  onOpenNewTripModal: () => void;
  onUpdateTripStatus: (tripId: string, status: TripStatus) => void;
  onDeleteTrip: (tripId: string) => void;
  onEditTrip?: (tripId: string) => void;
}

export const TripsView: React.FC<TripsViewProps> = ({
  trips,
  clients = [],
  onSelectTrip,
  onOpenUpdateModal,
  onOpenNewTripModal,
  onUpdateTripStatus,
  onDeleteTrip,
  onEditTrip,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TripStatus>('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [tripToDelete, setTripToDelete] = useState<EnrichedTrip | null>(null);
  const [tripToComplete, setTripToComplete] = useState<EnrichedTrip | null>(null);

  const filteredTrips = trips.filter((trip) => {
    const matchesStatus = statusFilter === 'All' || trip.status === statusFilter;
    const matchesClient = clientFilter === 'All'
      || (clientFilter === 'none' ? !trip.client_id : trip.client_id === clientFilter);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      trip.origin.toLowerCase().includes(searchLower) ||
      trip.destination.toLowerCase().includes(searchLower) ||
      (trip.cargo_type && trip.cargo_type.toLowerCase().includes(searchLower)) ||
      (trip.truck && trip.truck.license_plate.toLowerCase().includes(searchLower)) ||
      (trip.driver && trip.driver.full_name.toLowerCase().includes(searchLower)) ||
      (trip.client && trip.client.name.toLowerCase().includes(searchLower));
    return matchesStatus && matchesClient && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Trip Operations &amp; Dispatch</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {trips.length} Total
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage scheduled haulage journeys, real-time status transitions, dynamic delay reports, and expenditure
          </p>
        </div>

        <button
          onClick={onOpenNewTripModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Plan &amp; Schedule New Trip</span>
        </button>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <summary className="cursor-pointer text-xs font-bold text-slate-700">What do budget estimate and variance mean?</summary>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          The budget estimate is the planned amount for a trip. For completed trips, budget variance is the estimate minus finalized trip costs. It shows whether recorded costs were under or over budget; it is not customer revenue or profit.
        </p>
      </details>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by route, cargo, truck, driver, or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <label className="shrink-0">
            <span className="sr-only">Filter by client</span>
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <option value="All">All clients</option>
              <option value="none">No client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          {(['All', 'Ongoing', 'Planned', 'Completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
              {status !== 'All' && (
                <span className="ml-1.5 text-[10px] opacity-75">
                  ({trips.filter((t) => t.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Table / List */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Navigation2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No trips match current filters.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query or schedule a new trip.</p>
        </div>
      ) : (
        <div className="md:overflow-hidden md:rounded-xl md:border md:border-slate-200 md:bg-white md:shadow-xs">
          <ul className="space-y-3 md:hidden">
            {filteredTrips.map((trip) => (
              <li key={trip.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <button type="button" onClick={() => onSelectTrip(trip.id)} className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold leading-5 text-slate-900">
                        {trip.origin.split(',')[0]} <span className="text-slate-400">→</span> {trip.destination.split(',')[0]}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{trip.cargo_type || 'General Cargo'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      trip.status === 'Ongoing' ? 'bg-blue-50 text-blue-700' : trip.status === 'Planned' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>{trip.status}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Truck</dt>
                      <dd className="mt-0.5 truncate font-semibold text-slate-800">{trip.truck?.license_plate || 'Unassigned'}</dd>
                    </div>
                    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Driver</dt>
                      <dd className="mt-0.5 truncate font-semibold text-slate-800">{trip.driver?.full_name || 'Unassigned'}</dd>
                    </div>
                    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Client</dt>
                      <dd className="mt-0.5 truncate font-semibold text-slate-800">{trip.client?.name || '—'}</dd>
                    </div>
                    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Schedule</dt>
                      <dd className="mt-0.5 text-[11px] leading-4 text-slate-700">
                        <span className="block">{new Date(trip.scheduled_start).toLocaleDateString()}</span>
                        <span className="block text-slate-500">to {new Date(trip.scheduled_end).toLocaleDateString()}</span>
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{trip.status === 'Completed' ? 'Budget variance' : 'Spent / budget'}</span>
                    <span className={`font-mono text-xs font-bold tabular-nums ${trip.status === 'Completed' ? (trip.profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600') : trip.is_over_budget ? 'text-rose-600' : 'text-slate-900'}`}>
                        {trip.status === 'Completed'
                          ? `${trip.profit_loss >= 0 ? '+' : '-'}${formatTsh(Math.abs(trip.profit_loss))}`
                          : `${formatTsh(trip.total_spent)} / ${formatTsh(trip.budget_allocated)}`}
                    </span>
                  </div>
                  {trip.delay_logs.length > 0 && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />{trip.delay_logs.length} delay{trip.delay_logs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                  {trip.status === 'Planned' && (
                    <button type="button" onClick={() => onUpdateTripStatus(trip.id, 'Ongoing')} className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-blue-50 text-blue-700 hover:bg-blue-100">Start trip</button>
                  )}
                  {trip.status === 'Ongoing' && (
                    <button type="button" onClick={() => (onOpenUpdateModal ? onOpenUpdateModal(trip.id) : onSelectTrip(trip.id))} className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-blue-600 text-white hover:bg-blue-500">Update trip</button>
                  )}
                  {trip.status === 'Ongoing' && (
                    <button type="button" onClick={() => setTripToComplete(trip)} className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-emerald-600 text-white hover:bg-emerald-500">Complete</button>
                  )}
                  {trip.status !== 'Completed' && onEditTrip && (
                    <button type="button" onClick={() => onEditTrip(trip.id)} className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</button>
                  )}
                  <button type="button" onClick={() => setTripToDelete(trip)} aria-label="Delete trip" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] text-left text-[13px] text-slate-600 md:min-w-0 md:text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider md:text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Route &amp; Cargo</th>
                  <th className="py-3.5 px-4">Truck &amp; Driver</th>
                  <th className="py-3.5 px-4">Scheduled Dates</th>
                  <th className="py-3.5 px-4">Financials (Budget / Spent)</th>
                  <th className="py-3.5 px-4">Delays</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => {
                  const isOver = trip.is_over_budget;
                  const delayCount = trip.delay_logs ? trip.delay_logs.length : 0;

                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onSelectTrip(trip.id)}
                    >
                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="inline-flex items-center text-xs font-semibold text-slate-900">
                            <span
                              className={`w-2 h-2 rounded-full mr-2 ${
                                trip.status === 'Ongoing'
                                  ? 'bg-blue-600 animate-pulse'
                                  : trip.status === 'Planned'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            ></span>
                            {trip.status}
                          </span>

                          {trip.status === 'Completed' && (
                            <div>
                              {trip.profit_loss >= 0 ? (
                                <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 md:text-[10px]">
                                  <CheckCircle className="h-3 w-3 text-emerald-600 mr-1" />
                                  <span>Within budget</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 md:text-[10px]">
                                  <AlertTriangle className="h-3 w-3 text-rose-600 mr-1" />
                                  <span>Over budget</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Route & Cargo */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{trip.origin.split(',')[0]}</span>
                          <span className="text-slate-400">→</span>
                          <span>{trip.destination.split(',')[0]}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs md:text-[11px]">
                          {trip.cargo_type || 'General Cargo'}
                        </div>
                        <div className="text-[10px] text-slate-500">Client: {trip.client?.name || '—'}</div>
                      </td>

                      {/* Truck & Driver */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">
                          {trip.truck?.license_plate || 'Unassigned'}
                        </div>
                        <div className="text-xs text-slate-500 md:text-[11px]">
                          {trip.driver?.full_name || 'Unassigned'}
                        </div>
                      </td>

                      {/* Scheduled Dates */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-500 text-xs md:text-[11px]">
                        <div>Start: {new Date(trip.scheduled_start).toLocaleDateString()}</div>
                        <div>End: {new Date(trip.scheduled_end).toLocaleDateString()}</div>
                      </td>

                      {/* Financials */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {trip.status === 'Completed' ? (
                          <div>
                            <div className="flex items-baseline space-x-1.5 font-mono tabular-nums">
                              <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase md:text-[10px]">Variance:</span>
                              <span
                                className={`font-bold text-xs ${
                                  trip.profit_loss >= 0
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {trip.profit_loss >= 0 ? '+' : '-'}{formatTsh(Math.abs(trip.profit_loss))}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums md:text-[10px]">
                              <span>Budget estimate: {formatTsh(trip.budget_allocated)}</span>
                              <span className="mx-1 text-slate-300">·</span>
                              <span>Trip costs: {formatTsh(trip.total_spent)}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline space-x-1.5">
                              <span className={`font-bold font-mono tabular-nums ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatTsh(trip.total_spent)}
                              </span>
                              <span className="text-slate-400">/</span>
                              <span className="text-slate-600 font-mono tabular-nums">{formatTsh(trip.budget_allocated)}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5 font-mono tabular-nums md:text-[10px]">
                              <span className="text-blue-600 font-medium">Driver pay: {formatTsh(trip.driver_pay || 0)}</span>
                              <span>•</span>
                              {isOver ? (
                                <span className="text-rose-600 font-semibold">Over Budget!</span>
                              ) : (
                                <span>{formatTsh(trip.remaining_budget)} budget variance</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Delays */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {delayCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 md:text-[10px]">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{delayCount} delay{delayCount > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs md:text-[11px]">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          {trip.status === 'Planned' && (
                            <button
                              onClick={() => onUpdateTripStatus(trip.id, 'Ongoing')}
                              title="Start Trip (Dispatches Truck & Driver)"
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                            </button>
                          )}

                          {trip.status === 'Ongoing' && (
                            <button
                              onClick={() => {
                                if (onOpenUpdateModal) {
                                  onOpenUpdateModal(trip.id);
                                } else {
                                  onSelectTrip(trip.id);
                                }
                              }}
                              title="Update Journey (Log Expenses, Spare Parts, Delays)"
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs"
                            >
                              <Wrench className="h-3.5 w-3.5" />
                              <span>Update Trip</span>
                            </button>
                          )}

                          {trip.status === 'Ongoing' && (
                            <button
                              onClick={() => setTripToComplete(trip)}
                              title="Complete trip (revert fleet assets and calculate budget variance)"
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center space-x-1 shadow-xs"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Complete</span>
                            </button>
                          )}

                          {trip.status !== 'Completed' && onEditTrip && (
                            <button
                              type="button"
                              onClick={() => onEditTrip(trip.id)}
                              title="Edit trip details"
                              aria-label="Edit trip details"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onSelectTrip(trip.id)}
                            title={trip.status === 'Completed' ? 'View Finalized Ledger & Outcome' : 'View Trip Details & Logs'}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setTripToDelete(trip)}
                            title="Delete Trip (Cascades to child records)"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Trip Workflow & Financial Calculation Modal */}
      {tripToComplete && (() => {
        const totalExp = tripToComplete.expenses.reduce((s, e) => s + Number(e.amount), 0);
        const totalSpares = tripToComplete.spare_parts.reduce((s, sp) => s + Number(sp.price), 0);
        const driverPay = Number(tripToComplete.driver_pay) || 0;
        const budget = Number(tripToComplete.budget_allocated) || 0;
        const profitLoss = budget - (driverPay + totalExp + totalSpares);
        const isProfitable = profitLoss >= 0;

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="modal-readable bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-emerald-600">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Complete trip and finalize budget variance</h3>
                  <p className="text-xs text-slate-500">Finalize recorded trip costs and release the assigned fleet assets.</p>
                </div>
              </div>

              {/* Route Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900 flex items-center space-x-2">
                  <span>{tripToComplete.origin}</span>
                  <span className="text-slate-400">→</span>
                  <span>{tripToComplete.destination}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Truck: <strong>{tripToComplete.truck?.license_plate || 'Unassigned'}</strong> · Driver: <strong>{tripToComplete.driver?.full_name || 'Unassigned'}</strong>
                </div>
              </div>

              {/* Exact Formula Breakdown Box */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Budget variance calculation
                </div>
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-xs space-y-2 border border-slate-800">
                  <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                    Budget variance = budget estimate - (driver pay + trip expenses + in-trip parts)
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget estimate:</span>
                      <span className="font-bold text-white tabular-nums">{formatTsh(budget)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">(-) Driver pay:</span>
                      <span className="tabular-nums">-{formatTsh(driverPay)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">(-) Trip expenses ({tripToComplete.expenses.length}):</span>
                      <span className="tabular-nums">-{formatTsh(totalExp)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">(-) In-trip parts ({tripToComplete.spare_parts.length}):</span>
                      <span className="tabular-nums">-{formatTsh(totalSpares)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                      <span className="font-bold text-white uppercase text-[11px]">Final budget variance:</span>
                      <span className={`text-base font-extrabold tabular-nums ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? '+' : '-'}{formatTsh(Math.abs(profitLoss))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Outcome Visual Flag Badge */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isProfitable
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center space-x-2">
                  {isProfitable ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  )}
                  <div>
                    <span className="font-bold block">
                      Budget position: {isProfitable ? 'Within budget' : 'Over budget'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      {isProfitable
                        ? 'The budget estimate exceeds recorded trip costs. This is not billed revenue or cash profit.'
                        : 'Recorded trip costs exceed the budget estimate.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fleet Asset Notice */}
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                <p>
                  <strong>Asset Status Reversion:</strong> Truck <strong>{tripToComplete.truck?.license_plate}</strong> and Driver <strong>{tripToComplete.driver?.full_name}</strong> will automatically revert back to <strong>'Available'</strong> status.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>Lock Notice:</strong> Once completed, all further modifications, mid-trip expenses, spare parts, and delay edits will be permanently prevented.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTripToComplete(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTripStatus(tripToComplete.id, 'Completed');
                    setTripToComplete(null);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                >
                  Confirm &amp; Finalize Trip
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-readable bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Trip Record?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the trip from <strong>{tripToDelete.origin}</strong> to{' '}
              <strong>{tripToDelete.destination}</strong>?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <strong>Cascade Effect:</strong> Foreign key constraints will automatically remove all{' '}
              {tripToDelete.expenses?.length || 0} associated expense disbursements and{' '}
              {tripToDelete.spare_parts?.length || 0} roadside spare parts records.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setTripToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTrip(tripToDelete.id);
                  setTripToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
              >
                Delete Trip &amp; Cascade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
