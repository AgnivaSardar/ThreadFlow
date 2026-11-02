import React from 'react';
import { RiskLevel, ApprovalStatus } from '../types';

interface StatusBadgeProps {
  status?: RiskLevel | ApprovalStatus | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const norm = String(status || '').toUpperCase();

  let bg = 'bg-slate-100';
  let text = 'text-slate-700';
  let border = 'border-slate-200';
  let dot = 'bg-slate-400';
  let displayLabel = label || norm;

  if (norm === 'GREEN' || norm === 'CONFIRMED' || norm === 'ACTIVE' || norm === 'ON_TRACK') {
    bg = 'bg-emerald-50';
    text = 'text-emerald-700';
    border = 'border-emerald-200';
    dot = 'bg-emerald-500';
  } else if (norm === 'AMBER' || norm === 'PENDING_REVIEW' || norm === 'DELAYED' || norm === 'LOW_STOCK') {
    bg = 'bg-amber-50';
    text = 'text-amber-800';
    border = 'border-amber-200';
    dot = 'bg-amber-500';
  } else if (norm === 'RED' || norm === 'OVERDUE' || norm === 'CRITICAL' || norm === 'OUT_OF_STOCK') {
    bg = 'bg-rose-50';
    text = 'text-rose-700';
    border = 'border-rose-200';
    dot = 'bg-rose-500';
  } else if (norm === 'OVERRIDDEN' || norm === 'IN_PROGRESS' || norm === 'IN_STOCK') {
    bg = 'bg-sky-50';
    text = 'text-sky-700';
    border = 'border-sky-200';
    dot = 'bg-sky-500';
  }

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${bg} ${text} ${border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
      <span>{displayLabel}</span>
    </span>
  );
};
