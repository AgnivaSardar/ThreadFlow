import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';

export interface WorkTask {
  id: string;
  time: string;
  title: string;
  description: string;
  unit: string;
  buyerOrPo: string;
  completed: boolean;
  role: string[];
}

interface WorkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
}

export const WorkScheduleModal: React.FC<WorkScheduleModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
}) => {
  const { user } = useAuthStore();
  const [currentDate, setCurrentDate] = useState<Date>(selectedDate);

  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Esc key listener to exit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Unique date key: YYYY-MM-DD
  const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const currentRole = user?.role || 'MERCHANDISER';
  const storageKey = `threadflow_tasks_${currentRole}_${dateKey}`;

  // Role-specific task generator for given date
  const getTasksForRoleAndDate = (role: string, date: Date): WorkTask[] => {
    const day = date.getDate();
    const isPast = date < new Date(2026, 10, 4);

    if (role === 'SUPERVISOR') {
      return [
        {
          id: `sup-1-${dateKey}`,
          time: '06:00 AM - 07:30 AM',
          title: 'Shift Handover & Needle Count Verification',
          description: `Line 1 needle log and operator count sign-off for ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
          unit: 'Unit 1 (Cotton Hub - Own)',
          buyerOrPo: 'PO: B-PO-88213 (Company B UK)',
          completed: isPast,
          role: ['SUPERVISOR'],
        },
        {
          id: `sup-2-${dateKey}`,
          time: '08:30 AM - 11:30 AM',
          title: 'Active Stage Production Log & Quality Audit',
          description: 'Log hourly piece count in Finishing & Packing stage. Target: 500 pcs good output.',
          unit: 'Unit 1 (Cotton Hub - Own)',
          buyerOrPo: 'PO: B-PO-88213',
          completed: isPast,
          role: ['SUPERVISOR'],
        },
        {
          id: `sup-3-${dateKey}`,
          time: '12:00 PM - 01:30 PM',
          title: 'Subcontract Gate Pass Dispatch to PrintTex',
          description: 'Verify 3,000 cut pieces loaded for chest screen printing. Sign dispatch receipt.',
          unit: 'Subcontract - PrintTex',
          buyerOrPo: 'PO: C-PO-0492 (Company C Germany)',
          completed: false,
          role: ['SUPERVISOR'],
        },
        {
          id: `sup-4-${dateKey}`,
          time: '02:00 PM - 02:45 PM',
          title: 'Shift End Clean-down & Voice Note Summary',
          description: 'Ensure floor line is clear, record voice note in Tamil with scrap weigh-off.',
          unit: 'Unit 1 & Unit 2',
          buyerOrPo: 'All Active Line Orders',
          completed: false,
          role: ['SUPERVISOR'],
        },
      ];
    }

    if (role === 'BUYER') {
      return [
        {
          id: `buy-1-${dateKey}`,
          time: '09:00 AM GMT',
          title: 'Review Daily Shift Output & Defect Visuals',
          description: 'Inspect photo proofs logged by floor supervisor for active consignment.',
          unit: 'Unit 3 (Specialty - Own)',
          buyerOrPo: 'PO: B-PO-88272',
          completed: isPast,
          role: ['BUYER'],
        },
        {
          id: `buy-2-${dateKey}`,
          time: '11:30 AM GMT',
          title: 'Acknowledge Ex-Factory Schedule Buffer',
          description: 'Confirm 2-day recovery mitigation proposed by factory merchandising team.',
          unit: 'Tiruppur Hub',
          buyerOrPo: 'PO: B-PO-88213',
          completed: false,
          role: ['BUYER'],
        },
        {
          id: `buy-3-${dateKey}`,
          time: '03:00 PM GMT',
          title: 'Weekly Executive Quality & Sedex Audit Review',
          description: 'Sign off digital shipment clearance certificate for CW 45 air consignments.',
          unit: 'Export Freight Gate',
          buyerOrPo: 'Orders B-PO-88255 / B-PO-88272',
          completed: false,
          role: ['BUYER'],
        },
      ];
    }

    if (role === 'ADMIN') {
      return [
        {
          id: `adm-1-${dateKey}`,
          time: '07:30 AM - 08:30 AM',
          title: 'Factory-wide Output & Run-Rate Briefing',
          description: 'Review real-time throughput across Unit 1, Unit 2, Unit 3, and PrintTex lines.',
          unit: 'Executive HQ Tiruppur',
          buyerOrPo: 'All 9 Active Orders',
          completed: true,
          role: ['ADMIN'],
        },
        {
          id: `adm-2-${dateKey}`,
          time: '10:00 AM - 11:30 AM',
          title: 'Cryptographic Audit Trail Verification',
          description: 'Verify 100% SHA-256 chain seal continuity and inspect zero-tamper integrity log.',
          unit: 'Compliance Registry',
          buyerOrPo: '124 Sealed Events',
          completed: false,
          role: ['ADMIN'],
        },
        {
          id: `adm-3-${dateKey}`,
          time: '02:00 PM - 03:30 PM',
          title: 'Subcontract Partner Capacity Audit',
          description: 'Inspect WashTex hydro-extraction capacity to eliminate bottleneck risk on organic rib tanks.',
          unit: 'Subcontract - WashTex',
          buyerOrPo: 'PO: C-PO-0492',
          completed: false,
          role: ['ADMIN'],
        },
      ];
    }

    // Default: MERCHANDISER
    return [
      {
        id: `mer-1-${dateKey}`,
        time: '09:00 AM - 10:15 AM',
        title: 'Operational Issue Review & Triage Gate',
        description: 'Review machine breakdown alert flagged on Line 1. Decide: Inform Buyer or keep internal buffer.',
        unit: 'Unit 1 (Cotton Hub - Own)',
        buyerOrPo: 'PO: B-PO-88213 (Company B UK)',
        completed: isPast,
        role: ['MERCHANDISER'],
      },
      {
        id: `mer-2-${dateKey}`,
        time: '11:00 AM - 12:30 PM',
        title: 'Ex-Factory Buffer & Run-Rate Alignment',
        description: 'Simulate recovery plan in finishing stage to protect 24-Dec-2026 air shipment window.',
        unit: 'Unit 1 & Finishing Hub',
        buyerOrPo: 'PO: T-PO-862316',
        completed: false,
        role: ['MERCHANDISER'],
      },
      {
        id: `mer-3-${dateKey}`,
        time: '02:00 PM - 03:15 PM',
        title: 'Subcontract Strike-off Approval (PrintTex)',
        description: 'Verify pigment printing colour fastness and wash-test report before bulk run.',
        unit: 'Subcontract - PrintTex',
        buyerOrPo: 'PO: C-PO-0492 (Company C Germany)',
        completed: false,
        role: ['MERCHANDISER'],
      },
      {
        id: `mer-4-${dateKey}`,
        time: '04:30 PM - 05:30 PM',
        title: 'Weekly Executive Report Generation & Buyer Memo',
        description: 'Generate CW 45 comprehensive delivery schedule health analysis with AI forecast.',
        unit: 'Merchandising Office',
        buyerOrPo: 'All Active European Accounts',
        completed: false,
        role: ['MERCHANDISER'],
      },
    ];
  };

  const [tasks, setTasks] = useState<WorkTask[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return getTasksForRoleAndDate(currentRole, currentDate);
  });

  // Reload when date or role changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setTasks(JSON.parse(saved));
        return;
      }
    } catch {
      // ignore
    }
    setTasks(getTasksForRoleAndDate(currentRole, currentDate));
  }, [dateKey, currentRole, storageKey]);

  // Persist task updates
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  if (!isOpen) return null;

  const formattedDateString = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isToday =
    currentDate.getFullYear() === 2026 &&
    currentDate.getMonth() === 10 &&
    currentDate.getDate() === 4;

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0C2D48] text-white p-5 flex items-center justify-between border-b border-[#143D60]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Daily Work & Operations Checklist
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {user?.role}
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-0.5">
                Tasks, line supervisions, and milestone commitments for this date
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-sky-200/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Press Esc to close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector Navigation Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 shadow-2xs flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-sky-700" />
              <span>{formattedDateString}</span>
              {isToday && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">
                  TODAY
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            {tasks.length} Planned Events
          </span>
        </div>

        {/* Progress Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Completion:</span>
            <span className="text-xs font-black font-mono text-[#0C2D48]">
              {completedCount} / {tasks.length} tasks ({progressPercent}%)
            </span>
          </div>

          <div className="flex-1 max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="p-5 overflow-y-auto space-y-3 divide-y divide-slate-100 smooth-scroll flex-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleToggleTask(task.id)}
              className={`pt-3 first:pt-0 flex items-start gap-3.5 p-3 rounded-2xl transition-all cursor-pointer ${
                task.completed
                  ? 'bg-emerald-50/40 border border-emerald-100'
                  : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
              }`}
            >
              {/* Checkbox button */}
              <button
                type="button"
                className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                  task.completed
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'border-2 border-slate-300 text-transparent hover:border-sky-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 fill-current stroke-white stroke-[2.5]" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h4
                    className={`text-sm font-bold tracking-tight ${
                      task.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                    <Clock className="w-3 h-3 text-sky-600" />
                    {task.time}
                  </span>
                </div>

                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    task.completed ? 'text-slate-400 line-through' : 'text-slate-600'
                  }`}
                >
                  {task.description}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    {task.unit}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                    <Building2 className="w-3 h-3 text-sky-600" />
                    {task.buyerOrPo}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Click tasks to complete • Press Esc to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0C2D48] hover:bg-[#164368] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
