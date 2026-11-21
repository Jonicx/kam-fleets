import React from 'react';
import { Trash2 } from 'lucide-react';
import { useModalAccessibility } from '../hooks/useModalAccessibility.ts';

export interface ConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

interface ConfirmActionModalProps extends ConfirmationRequest {
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useModalAccessibility(onClose);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      tabIndex={-1}
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-3 sm:items-start sm:p-4"
    >
      <div className="modal-readable bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
        <div className="flex items-center space-x-3 text-rose-600">
          <div className="p-2 bg-rose-50 rounded-xl">
            <Trash2 className="h-6 w-6" />
          </div>
          <h3 id="confirm-action-title" className="text-base font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
