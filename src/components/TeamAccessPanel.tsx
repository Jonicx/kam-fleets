import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserRound } from 'lucide-react';
import { listTeamMembers, updateTeamMember, type TeamMember } from '../neon.ts';
import type { AppRole } from '../db/domain.ts';

export const TeamAccessPanel: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setMembers(await listTeamMembers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Team members could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (member: TeamMember, changes: Partial<TeamMember>) => {
    setBusyId(member.id);
    setError('');
    try {
      const updated = await updateTeamMember(member.id, changes);
      setMembers((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'The team member could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = members.filter((member) => member.pending).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">Team access</h2>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{pendingCount} pending</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh team members"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="mobile-explanation mt-2 text-xs leading-relaxed text-slate-500">
        Everyone shares the same fleet data. Approve new sign-ups and choose who can manage billing and deletions.
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
      <ul className="mt-4 divide-y divide-slate-100">
        {isLoading ? (
        <li role="status" className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading team members...
        </li>
        ) : members.map((member) => (
        <li key={member.id} className="flex flex-col gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800">{member.name || member.email}</p>
              <p className="truncate text-[10px] text-slate-500">{member.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={member.role}
                disabled={busyId === member.id}
                onChange={(event) => void change(member, { role: event.target.value as AppRole })}
                aria-label={`Role for ${member.email}`}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="Dispatcher">Dispatcher</option>
                <option value="Admin">Admin</option>
              </select>
              <button
                type="button"
                disabled={busyId === member.id}
                onClick={() => void change(member, { active: !member.active })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                  member.active
                    ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {member.active ? 'Revoke' : 'Approve'}
              </button>
            </div>
          </li>
        ))}
        {!isLoading && members.length === 0 && <li className="py-6 text-center text-xs text-slate-500">No team members yet.</li>}
      </ul>
      <div className="mobile-explanation mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        Invoices and payments are never deleted: corrections are recorded as voids and reversals. Trip deletion is blocked when invoices exist.
      </div>
    </div>
  );
};