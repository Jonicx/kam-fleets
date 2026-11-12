import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface DashboardQualityIssue {
  id: string;
  title: string;
  detail: string;
  tripId?: string;
}

interface AdminDataQualityPanelProps {
  issues: DashboardQualityIssue[];
  showAllWarnings: boolean;
  onToggleWarnings: () => void;
  onSelectTrip: (tripId: string) => void;
}

export const AdminDataQualityPanel: React.FC<AdminDataQualityPanelProps> = ({
  issues,
  showAllWarnings,
  onToggleWarnings,
  onSelectTrip,
}) => (
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Data quality checks</h2>
              <p className="mt-1 text-xs text-slate-500">Review missing or inconsistent records in this report.</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${issues.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
              {issues.length} {issues.length === 1 ? 'item needs' : 'items need'} review
            </span>
          </div>
          {issues.length ? (
            <>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {issues.slice(0, showAllWarnings ? undefined : 3).map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => issue.tripId && onSelectTrip(issue.tripId)}
                  className="flex w-full items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-left transition hover:bg-amber-50"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    <span className="block text-xs font-bold text-slate-800">{issue.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">{issue.detail}</span>
                  </span>
                </button>
              ))}
              </div>
              {issues.length > 3 && (
                <button
                  type="button"
                  onClick={() => onToggleWarnings()}
                  className="mt-3 text-xs font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  {showAllWarnings ? 'Show top 3' : `View all ${issues.length} items`}
                </button>
              )}
            </>
          ) : (
            <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
              No missing assignments, missing invoices or final calculations, overdue/overpaid invoices, or finalized-cost mismatches found in this report.
            </div>
          )}
          <p className="mobile-explanation mt-3 text-[10px] leading-relaxed text-slate-500">
            These are review prompts, not automatic accounting corrections. Invoices are considered overdue against their due date and remaining balance.
          </p>
        </div>
);

interface AdminPriorityWarningsProps {
        issues: DashboardQualityIssue[];
        onShowAll: () => void;
        onSelectTrip: (tripId: string) => void;
}

export const AdminPriorityWarnings: React.FC<AdminPriorityWarningsProps> = ({
        issues,
        onShowAll,
        onSelectTrip,
}) => {
        if (issues.length === 0) return null;

        return (
          <section aria-label="Priority items needing review" className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h2 className="text-xs font-bold text-amber-950">
                  {issues.length} {issues.length === 1 ? 'item' : 'items'} need review
                </h2>
              </div>
              <button
                type="button"
                onClick={onShowAll}
                className="rounded-md px-2 py-1 text-xs font-bold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:bg-amber-100"
              >
                View all
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {issues.slice(0, 3).map((issue) => (
                <li key={issue.id} className="text-[11px] text-amber-950">
                  <button
                    type="button"
                    onClick={() => issue.tripId && onSelectTrip(issue.tripId)}
                    className="text-left underline decoration-amber-300 underline-offset-2 hover:text-amber-700"
                  >
                    {issue.title}: {issue.detail}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
};
