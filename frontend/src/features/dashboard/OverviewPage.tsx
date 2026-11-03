import React from 'react';
import { ShiftCutoffBanner } from './ShiftCutoffBanner';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  AlertTriangle,
  Globe,
  ShieldCheck,
  FileText,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../auth/authStore';

export const OverviewPage: React.FC = () => {
  const { user, hasRole } = useAuthStore();

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Factory Operational Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tiruppur Manufacturing Command Center & Shift Synchronization
          </p>
        </div>
      </div>

      {/* Feature 13: Compact Shift Cut-Off Missing Update Detector */}
      <ShiftCutoffBanner />

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
        {hasRole('MERCHANDISER', 'ADMIN') && (
          <Link
            to="/orders"
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Export Order Board</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage purchase orders, 7-stage TNA pipelines, and schedule revisions.
            </p>
          </Link>
        )}

        <Link
          to="/risk"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Risk & Delay Engine</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time rolling run-rate pace, bottleneck warnings & recovery simulator.
          </p>
        </Link>

        <Link
          to="/buyer-portal"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Buyer Portal</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct production transparency, visual proof gallery & daily sign-offs.
          </p>
        </Link>

        <Link
          to="/audit"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Audit History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable SHA-256 cryptographic compliance log & financial penalty trail.
          </p>
        </Link>

        <Link
          to="/reports"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Weekly Buyer Reports</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            One-click executive status exports (RFC 4180 CSV & branded printable PDF).
          </p>
        </Link>

        <Link
          to="/supervisor/my-work"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Factory className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 transition" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Supervisor Work & Logs</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Floor quantity entry, bilingual Tamil voice notes, and inspection photos.
          </p>
        </Link>
      </div>
    </div>
  );
};
