import React, { useEffect, useRef, useState } from 'react';
import { formatTsh } from '../utils/currency.ts';

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent: string;
  explanation: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  detail,
  icon,
  accent,
  explanation,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const resetWhenClickingOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target)) {
        setIsFlipped(false);
      }
    };

    document.addEventListener('pointerdown', resetWhenClickingOutside);
    return () => document.removeEventListener('pointerdown', resetWhenClickingOutside);
  }, []);

  return (
    <button
      ref={cardRef}
      type="button"
      aria-label={isFlipped ? `Show value for ${label}` : `Show explanation for ${label}`}
      aria-pressed={isFlipped}
      onClick={() => setIsFlipped((flipped) => !flipped)}
      className="h-[112px] w-full min-w-0 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 sm:h-[144px]"
    >
      <span
        className="relative block h-full w-full rounded-xl [perspective:800px]"
        aria-hidden="true"
      >
        <span
          className="absolute inset-0 block rounded-xl transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <span className="absolute inset-0 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm [backface-visibility:hidden] max-sm:justify-start max-sm:gap-1.5 sm:p-4">
            <span className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
                {label}
              </span>
              <span className={`shrink-0 rounded-lg p-1.5 ${accent}`}>{icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block break-words text-base font-extrabold leading-tight text-slate-900 sm:text-lg">
                {value}
              </span>
              <span className="mt-1 block text-[10px] leading-relaxed text-slate-500 sm:text-xs">
                {detail}
              </span>
            </span>
          </span>
          <span
            className="absolute inset-0 flex flex-col justify-center rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm [backface-visibility:hidden] sm:p-4"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              {label}
            </span>
            <span className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-700">
              {explanation}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
};

export const AccountingMetric: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="min-w-0 rounded-lg bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-extrabold text-slate-900">{value}</p>
  </div>
);

export const DetailAmount: React.FC<{
  label: string;
  amount: number;
  emphasize?: boolean;
}> = ({ label, amount, emphasize }) => (
  <div className={`flex items-center justify-between gap-2 text-[11px] ${emphasize ? 'border-t border-slate-200 pt-2 font-bold text-slate-900' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span className={`whitespace-nowrap ${amount < 0 ? 'text-rose-700' : ''}`}>{formatTsh(amount)}</span>
  </div>
);
