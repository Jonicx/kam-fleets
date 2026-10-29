import React from 'react';
import { X, Calendar, User, FileText, Activity } from 'lucide-react';

interface AuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: {
    id: string;
    summary: string;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    timestamp: string;
    details?: string;
  } | null;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  isOpen,
  onClose,
  auditLog,
}) => {
  if (!isOpen || !auditLog) return null;

  const parseDetails = (details: string) => {
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  };

  const parsedDetails = auditLog.details ? parseDetails(auditLog.details) : null;

  const renderDetailValue = (value: any): React.ReactNode => {
    if (value === null) return <span className="text-slate-400 italic">null</span>;
    if (value === undefined) return <span className="text-slate-400 italic">undefined</span>;
    if (typeof value === 'boolean') return <span className={value ? 'text-emerald-600' : 'text-rose-600'}>{value.toString()}</span>;
    if (typeof value === 'object') return <pre className="bg-slate-50 p-2 rounded text-xs text-slate-600 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
    return <span className="text-slate-700">{value.toString()}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Audit Log Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-1">Summary</h3>
            <p className="text-sm text-blue-800">{auditLog.summary}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Actor</span>
              </div>
              <p className="text-sm text-slate-900 font-medium">{auditLog.actor}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Action</span>
              </div>
              <p className="text-sm text-slate-900 font-medium">{auditLog.action}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600">Entity Type</span>
              </div>
              <p className="text-sm text-slate-900 font-medium capitalize">{auditLog.entity_type}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600">Entity ID</span>
              </div>
              <p className="text-sm text-slate-900 font-mono">{auditLog.entity_id}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Timestamp</span>
            </div>
            <p className="text-sm text-slate-900 font-medium">{new Date(auditLog.timestamp).toLocaleString()}</p>
          </div>

          {/* Details */}
          {parsedDetails && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <h3 className="text-sm font-bold text-slate-900 bg-slate-50 px-4 py-2 border-b border-slate-200">
                Details
              </h3>
              <div className="p-4 space-y-2">
                {Object.entries(parsedDetails).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-2 text-sm">
                    <span className="font-semibold text-slate-600 sm:w-40 shrink-0">{key}:</span>
                    <span className="flex-1 text-slate-900">{renderDetailValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
