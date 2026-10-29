import React, { useState } from 'react';
import {
  Truck as TruckIcon,
  Navigation2,
  AlertTriangle,
  Receipt,
  Wrench,
  Wallet,
  ArrowUpRight,
  Clock,
  MapPin,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { EnrichedTrip, DatabaseStats } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { getDelaySeverityClasses } from '../utils/delaySeverity.ts';

interface DashboardViewProps {
  stats: DatabaseStats;
  enrichedTrips: EnrichedTrip[];
  onSelectTrip: (tripId: string) => void;
  onOpenUpdateModal?: (tripId: string) => void;
  onOpenNewTrip: () => void;
  onNavigateToSchema: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  enrichedTrips,
  onSelectTrip,
  onOpenUpdateModal,
  onOpenNewTrip,
  onNavigateToSchema,
}) => {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const ongoingTrips = enrichedTrips.filter((t) => t.status === 'Ongoing');
  const currentTime = Date.now();
  const plannedTrips = enrichedTrips.filter(
    (trip) =>
      trip.status === 'Planned' &&
      new Date(trip.scheduled_start).getTime() >= currentTime,
  );
  const operationalTrips = [...ongoingTrips, ...plannedTrips];
  const openTripBudget = operationalTrips.reduce(
    (total, trip) => total + Number(trip.budget_allocated || 0),
    0,
  );
  const ongoingTripCosts = ongoingTrips.reduce((total, trip) => total + trip.total_spent, 0);
  const ongoingExpenses = ongoingTrips.reduce((total, trip) => total + trip.total_expenses, 0);
  const ongoingParts = ongoingTrips.reduce((total, trip) => total + trip.total_spare_parts, 0);

  // Calculate fleet utilization
  const totalFleet = stats.totalTrucks || 1;
  const utilizationRate = Math.round((stats.onTripTrucks / totalFleet) * 100);

  // Group all delays across ongoing trips
  const activeDelays = ongoingTrips.flatMap((t) =>
    (t.delay_logs || []).map((l) => ({ ...l, trip: t }))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Schema Announcement */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-[0_18px_30px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="absolute -left-10 top-0 h-28 w-28 rotate-45 rounded-br-2xl bg-slate-950/70 shadow-[10px_10px_18px_rgba(15,23,42,0.35)]" />
        <div className="absolute -right-10 bottom-0 h-28 w-28 rotate-45 rounded-tl-2xl bg-slate-950/20 shadow-[-10px_-10px_18px_rgba(15,23,42,0.35)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.16),_transparent_28%)]" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-1 flex items-center space-x-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
              <span>Logistics Engine</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Fleet &amp; Trip Operational Command
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-200/90">
              Realtime haulage management tracking trucks, drivers, ongoing trips, dynamic delay logs,
              transit expenses, and roadside spare parts & maintenance.
            </p>
            <button
              type="button"
              onClick={onOpenNewTrip}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              <span>Plan New Trip</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={isSummaryOpen}
        aria-controls="operations-summary-cards"
        onClick={() => setIsSummaryOpen((open) => !open)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-bold animate-pulse lg:hidden ${
          isSummaryOpen
            ? 'border-green-700 bg-green-700/80 text-white shadow-[0_0_14px_2px_rgba(21,128,61,0.8)]'
            : 'border-green-500 bg-green-500/40 text-green-950 shadow-[0_0_14px_2px_rgba(34,197,94,0.7)]'
        }`}
      >
        <span>Operations Summary</span>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
          isSummaryOpen
            ? 'border-green-300/80 bg-green-800/60 text-white'
            : 'border-green-600/70 bg-green-100/70 text-green-900'
        }`}>
          {isSummaryOpen ? 'Hide' : 'Show'}
        </span>
      </button>

      {/* KPI Cards Grid */}
      <div
        id="operations-summary-cards"
        className={`${isSummaryOpen ? 'grid' : 'hidden'} grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4 lg:gap-4`}
      >
        {/* Active Trips Card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs lg:p-5 lg:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider lg:text-xs lg:font-semibold">
              Ongoing Trips
            </span>
            <div className="hidden h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 items-center justify-center lg:flex">
              <Navigation2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 lg:mt-3 lg:flex-nowrap lg:gap-x-0 lg:space-x-2">
            <span className="text-lg font-extrabold text-slate-900 font-mono lg:font-sans lg:text-3xl">{stats.ongoingTrips}</span>
            <span className="text-[10px] text-slate-400 lg:text-xs lg:text-slate-500">currently on the road</span>
          </div>
          <div className="mt-1 flex items-center text-[10px] text-slate-400 lg:mt-2 lg:text-xs lg:text-slate-600">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1.5 animate-pulse"></span>
            <span>{plannedTrips.length} upcoming departures</span>
          </div>
        </div>

        {/* Fleet Deployment Card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs lg:p-5 lg:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider lg:text-xs lg:font-semibold">
              Fleet On Road
            </span>
            <div className="hidden h-8 w-8 rounded-lg bg-amber-50 text-amber-600 items-center justify-center lg:flex">
              <TruckIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 lg:mt-3 lg:flex-nowrap lg:gap-x-0 lg:space-x-2">
            <span className="text-lg font-extrabold text-slate-900 font-mono lg:font-sans lg:text-3xl">{stats.onTripTrucks}</span>
            <span className="text-[10px] text-slate-400 lg:text-xs lg:text-slate-500">/ {stats.totalTrucks} trucks</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between lg:mt-2 lg:text-xs lg:text-slate-600">
            <span>Utilization: <strong>{utilizationRate}%</strong></span>
            {stats.maintenanceTrucks > 0 && (
              <span className="text-amber-700 font-medium">
                {stats.maintenanceTrucks} in repair
              </span>
            )}
          </div>
        </div>

        {/* Budget Allocated Card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs lg:p-5 lg:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider lg:text-xs lg:font-semibold">
              Open Trip Budgets
            </span>
            <div className="hidden h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 items-center justify-center lg:flex">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline lg:mt-3">
            <span className="text-lg font-extrabold text-slate-900 font-mono lg:font-sans lg:text-2xl">
              {formatTsh(openTripBudget)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 lg:mt-2 lg:text-xs lg:text-slate-600">
            Ongoing and upcoming trips only
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs lg:p-5 lg:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider lg:text-xs lg:font-semibold">
              Ongoing Trip Costs
            </span>
            <div className="hidden h-8 w-8 rounded-lg bg-purple-50 text-purple-600 items-center justify-center lg:flex">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 lg:mt-3 lg:flex-nowrap lg:gap-x-0 lg:space-x-2">
            <span className="text-lg font-extrabold text-slate-900 font-mono lg:font-sans lg:text-2xl">
              {formatTsh(ongoingTripCosts)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between lg:mt-2 lg:text-xs lg:text-slate-500">
            <span>Expenses: {formatTsh(ongoingExpenses)}</span>
            <span>Spares: {formatTsh(ongoingParts)}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Trips & Delays Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Ongoing Trips Monitor (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Navigation2 className="h-4 w-4 text-emerald-600" />
                <span>Live Ongoing Trips</span>
              </h2>
              <p className="text-xs text-slate-500">
                Track haulage routes, driver assignments, and real-time budget burn
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
              active
            </span>
          </div>

          {ongoingTrips.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <TruckIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No active trips currently on the road.</p>
              <p className="text-xs text-slate-500 mt-1">Start a planned trip or dispatch a new one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ongoingTrips.map((trip) => {
                const budgetPct = Math.min(100, Math.round(trip.budget_utilization_pct));
                const isOver = trip.is_over_budget;

                return (
                  <div
                    key={trip.id}
                    onClick={() => onSelectTrip(trip.id)}
                    className="bg-white rounded-xl p-5 border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 animate-pulse text-emerald-800">
                          Ongoing
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {trip.cargo_type || 'General Cargo'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Eta: {new Date(trip.scheduled_end).toLocaleDateString()}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition" />
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="my-3 flex items-start space-x-3">
                      <div className="flex flex-col items-center mt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div>
                        <div className="w-0.5 h-6 bg-slate-200"></div>
                        <div className="w-2.5 h-2.5 rounded-full  bg-gray-600"></div>
                      </div>
                      <div className="flex-1 space-y-5 text-xs">
                        <div className="flex items-baseline justify-between">
                          <span className="font-semibold text-slate-800">{trip.origin}</span>
                          <span className="text-[11px] text-slate-400">Origin</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-semibold text-slate-800">{trip.destination}</span>
                          <span className="text-[11px] text-slate-400">Destination</span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Vehicle & Driver */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Truck</span>
                        <span className="font-bold text-slate-800">
                          {trip.truck?.license_plate || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Driver</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {trip.driver?.full_name || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Driver Pay</span>
                        <span className="font-black text-slate-800 truncate block">
                          {formatTsh(trip.driver_pay || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Budget</span>
                        <span className="font-black text-slate-800">
                          {formatTsh(trip.budget_allocated)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Total Spent</span>
                        <span className={`font-black ${isOver ? 'text-rose-600' : 'text-slate-800'}`}>
                          {formatTsh(trip.total_spent)}
                        </span>
                      </div>
                    </div>

                    {/* Budget Utilization Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-800 font-medium">Budget Burn</span>
                        <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-slate-700'}`}>
                          {budgetPct}% {isOver && '(OVER BUDGET)'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden ring-1 ring-slate-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: '100%',
                            background: 'linear-gradient(90deg, #16a34a 0%, #4ade80 18%, #facc15 48%, #f59e0b 70%, #f97316 85%, #ef4444 100%)',
                            backgroundSize: `${budgetPct}% 100%`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'left center',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Delay Reasons tags */}
                    {trip.delay_logs && trip.delay_logs.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-amber-700 flex items-center space-x-1 mr-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Active Delays:</span>
                        </span>
                        {trip.delay_logs.map((log) => (
                          <span
                            key={log.id}
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {log.reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Operational Update Action CTA */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Disbursements: <strong>{formatTsh(trip.total_expenses)}</strong> exp • <strong>{formatTsh(trip.total_spare_parts)}</strong> spares
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenUpdateModal) {
                            onOpenUpdateModal(trip.id);
                          } else {
                            onSelectTrip(trip.id);
                          }
                        }}
                        className="flex w-full items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-red-800  text-white transition shadow-xs sm:w-auto"
                      >
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Planned Trips Queue */}
          {plannedTrips.length > 0 ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Planned Departure Queue ({plannedTrips.length})
                </h3>
              </div>
              <div className="space-y-3">
                {plannedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => onSelectTrip(trip.id)}
                    className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          Planned
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold flex-col text-slate-800">
                            {trip.origin} → {trip.destination}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                            {trip.truck?.model || 'Truck Assigned'}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-center gap-2 mt-2.5 sm:mt-0 text-xs sm:w-auto sm:justify-end">
                        <span className="font-black text-slate-700">
                          {formatTsh(trip.budget_allocated)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
              <Calendar className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No upcoming departures scheduled.</p>
              <p className="mt-1 text-xs text-slate-500">Planned trips with a future start date will appear here.</p>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Delays Timeline & Quick Schema Status */}
        <div className="space-y-4">
          {/* Dynamic Delay Logs Box */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col gap-2 pb-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Dynamic Delay Logs</h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {activeDelays.length} active
              </span>
            </div>

            {activeDelays.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-medium text-slate-700">All trips currently on schedule.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No transit delays recorded.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {activeDelays.map((delay) => (
                  <div
                    key={delay.id}
                    onClick={() => onSelectTrip(delay.trip_id)}
                    className="p-3 rounded-xl bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-sm transition cursor-pointer"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span
                        className={`inline-flex w-fit rounded border px-1.5 py-0.5 text-[10px] font-extrabold ${getDelaySeverityClasses(delay.severity)}`}
                      >
                        {delay.severity} Severity
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(delay.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 mt-1.5">
                      {delay.reason}
                    </p>

                    {delay.location && (
                      <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{delay.location}</span>
                      </p>
                    )}

                    <div className="mt-2 text-[10px] text-slate-500 flex flex-col gap-1 pt-1 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate">Trip: {delay.trip.origin.split(',')[0]} → {delay.trip.destination.split(',')[0]}</span>
                      {delay.duration_minutes ? (
                        <span className="font-bold text-amber-900">+{delay.duration_minutes}m delay</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Database Relations Architecture Card 
          <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-xs">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
              <Wrench className="h-3.5 w-3.5" />
              <span>Relational Integrity Rules</span>
            </div>
            <h4 className="text-sm font-bold text-white mb-2">
              KAM Fleets Database Model Structure
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 mb-4">
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>trips.truck_id</strong> &amp; <strong>driver_id</strong>: ON DELETE RESTRICT</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>expenses.trip_id</strong>: ON DELETE CASCADE with 5 expense types</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>spare_parts.trip_id</strong>: ON DELETE CASCADE for in-route maintenance</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>Foreign key index coverage on all child identifiers</span>
              </li>
            </ul>

            <button
              onClick={onNavigateToSchema}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center justify-center space-x-1.5"
            >
              <span>Inspect Schema &amp; Run SQL Queries</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>*/}
        </div>
      </div>
    </div>
  );
};
