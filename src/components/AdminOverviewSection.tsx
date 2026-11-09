import React from 'react';
import { BarChart3, TrendingUp, Truck, Wallet } from 'lucide-react';
import { formatTsh } from '../utils/currency.ts';
import { MetricCard } from './AdminDashboardPrimitives.tsx';
import { AdminSummaryDropdown } from './AdminSummaryDropdown.tsx';

interface FinancialMonth {
  key: string;
  label: string;
  budget: number;
  invoiced: number;
  collected: number;
  costs: number;
}

interface CostCategory {
  label: string;
  amount: number;
  color: string;
}

interface AdminOverviewSectionProps {
  completedTripBudget: number;
  finalizedBudgetVariance: number;
  fleetServiceCosts: number;
  completedTripCount: number;
  profitableTrips: number;
  lossTrips: number;
  totalRecordedCosts: number;
  months: FinancialMonth[];
  costCategories: CostCategory[];
  serviceRecordCount: number;
  showBudgetInChart: boolean;
  onShowBudgetInChart: (show: boolean) => void;
  maxMonthlyValue: number;
  maxCostCategory: number;
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  completedTripBudget,
  finalizedBudgetVariance,
  fleetServiceCosts,
  completedTripCount,
  profitableTrips,
  lossTrips,
  totalRecordedCosts,
  months,
  costCategories,
  serviceRecordCount,
  showBudgetInChart,
  onShowBudgetInChart,
  maxMonthlyValue,
  maxCostCategory,
}) => (

        <>
          <AdminSummaryDropdown
            id="admin-trip-performance-summary-cards"
            label="Trip Performance Summary"
            showToggleOnLargeScreens
          >
            <section aria-label="Trip performance metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Completed trip budget"
                value={formatTsh(completedTripBudget)}
                detail={`${completedTripCount} completed ${completedTripCount === 1 ? 'trip' : 'trips'}`}
                icon={<Wallet className="h-4 w-4" />}
                accent="text-emerald-600 bg-emerald-50"
                explanation="The budget amounts assigned to trips that have been completed."
              />
              <MetricCard
                label="Finalized budget variance"
                value={formatTsh(finalizedBudgetVariance)}
                detail="Budget estimate less final costs"
                icon={<TrendingUp className="h-4 w-4" />}
                accent="text-blue-600 bg-blue-50"
                explanation="Completed trip budgets minus their final costs. It is not invoice revenue or profit."
              />
              <MetricCard
                label="Fleet service costs"
                value={formatTsh(fleetServiceCosts)}
                detail={`${serviceRecordCount} service records`}
                icon={<Truck className="h-4 w-4" />}
                accent="text-violet-600 bg-violet-50"
                explanation="The total cost of fleet service records included in this report."
              />
              <MetricCard
                label="Within budget trips"
                value={`${profitableTrips} / ${completedTripCount}`}
                detail={`${lossTrips} completed over budget`}
                icon={<BarChart3 className="h-4 w-4" />}
                accent="text-amber-600 bg-amber-50"
                explanation="Completed trips whose final costs did not exceed their budgets."
              />
            </section>
          </AdminSummaryDropdown>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Monthly financial trend</h2>
              <p className="mt-1 text-xs text-slate-500">Invoiced, cash collected, and recorded costs · last 6 months</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 sm:mt-0">
              {showBudgetInChart && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Budget estimate</span>}
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Invoiced</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Cash collected</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Recorded costs</span>
            </div>
          </div>
          <div className="mt-4">
            <div
              role="img"
              aria-label="Bar chart comparing invoiced amounts, cash collected and recorded costs for the last six months"
              className="relative"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between">
                {[0, 1, 2, 3].map((line) => (
                  <span key={line} className="border-t border-dashed border-slate-200" />
                ))}
              </div>
              <div className="relative grid h-44 grid-cols-6 gap-1">
                {months.map((month) => (
                  <div key={month.key} className="flex items-end justify-center gap-0.5 sm:gap-1">
                    {([
                      ['invoiced', 'bg-blue-500', 'invoiced'],
                      ['collected', 'bg-emerald-500', 'cash collected'],
                      ['costs', 'bg-amber-500', 'recorded costs'],
                    ] as const).map(([key, color, label]) => (
                      <div
                        key={key}
                        title={`${month.label}: ${label} ${formatTsh(month[key])}`}
                        className={`w-2 rounded-t sm:w-4 ${color}`}
                        style={{
                          height: `${(month[key] / maxMonthlyValue) * 100}%`,
                          minHeight: month[key] > 0 ? '2px' : 0,
                        }}
                      />
                    ))}
                    {showBudgetInChart && (
                      <div
                        title={`${month.label}: budget estimate ${formatTsh(month.budget)}`}
                        className="w-2 rounded-t bg-slate-400 sm:w-4"
                        style={{
                          height: `${(month.budget / maxMonthlyValue) * 100}%`,
                          minHeight: month.budget > 0 ? '2px' : 0,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1 pt-2 text-center text-[10px] text-slate-500 sm:text-xs">
              {months.map((month) => <span key={month.key}>{month.label}</span>)}
            </div>
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showBudgetInChart}
              onChange={(event) => onShowBudgetInChart(event.target.checked)}
              className="rounded border-slate-300 text-slate-700 focus:ring-amber-400"
            />
            Include trip budget estimates
          </label>
          <details className="mt-3 rounded-lg border border-slate-100">
            <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-slate-700">View monthly figures</summary>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full min-w-[420px] text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    {showBudgetInChart && <th className="px-3 py-2 text-right">Budget estimate</th>}
                    <th className="px-3 py-2 text-right">Invoiced</th>
                    <th className="px-3 py-2 text-right">Cash collected</th>
                    <th className="px-3 py-2 text-right">Recorded costs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {months.map((month) => (
                    <tr key={month.key}>
                      <th scope="row" className="px-3 py-2 font-medium text-slate-700">{month.label}</th>
                      {showBudgetInChart && <td className="px-3 py-2 text-right">{formatTsh(month.budget)}</td>}
                      <td className="px-3 py-2 text-right">{formatTsh(month.invoiced)}</td>
                      <td className="px-3 py-2 text-right">{formatTsh(month.collected)}</td>
                      <td className="px-3 py-2 text-right">{formatTsh(month.costs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Invoices use issue date; cash uses payment date; completed-trip costs use completion date; open-trip and fleet-service costs use transaction dates.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">Recorded costs</h2>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{formatTsh(totalRecordedCosts)}</p>
          <p className="mt-1 text-xs text-slate-500">Total included in this report</p>
          <details className="mt-3 rounded-lg border border-slate-100">
            <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-slate-700">Show cost categories</summary>
            <div className="space-y-4 border-t border-slate-100 p-3">
              {costCategories.map((category) => (
                <div key={category.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700">{category.label}</span>
                    <span className="shrink-0 font-bold text-slate-900">{formatTsh(category.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${category.color}`}
                      style={{ width: `${Math.max(category.amount > 0 ? 2 : 0, (category.amount / maxCostCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                Completed trip expenses and parts use saved completion snapshots; open trip costs use transactions in the selected period. Driver pay is included only on completed trips. Fleet service stays separate and is never allocated to trips.
              </p>
            </div>
          </details>
        </div>
          </section>
        </>
      
);
