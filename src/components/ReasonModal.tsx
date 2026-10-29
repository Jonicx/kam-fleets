import React, { FormEvent, useState } from 'react';
import { X } from 'lucide-react';

interface ReasonModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export const ReasonModal: React.FC<ReasonModalProps> = ({ title, description, confirmLabel, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      onConfirm(reason);
      onClose();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'This change could not be saved.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <form onSubmit={submit} className="modal-readable bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 id="reason-modal-title" className="text-base font-bold text-slate-900 pr-8">{title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Reason
          <textarea
            autoFocus
            required
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium normal-case tracking-normal text-slate-700"
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="flex justify-end space-x-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};