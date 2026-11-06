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
} from 'lucide-react';
import { useAuthStore } from '../auth/authStore';
import { useLanguage } from '../../hooks/useLanguage';

export const OverviewPage: React.FC = () => {
  const { hasRole } = useAuthStore();
  const { t } = useLanguage();

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t.overview.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.subtitle}
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
            <h3 className="text-sm font-bold text-slate-900">{t.overview.orderBoardTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.overview.orderBoardDesc}
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
          <h3 className="text-sm font-bold text-slate-900">{t.overview.riskTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.riskDesc}
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
          <h3 className="text-sm font-bold text-slate-900">{t.overview.buyerPortalTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.buyerPortalDesc}
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
          <h3 className="text-sm font-bold text-slate-900">{t.overview.auditTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.auditDesc}
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
          <h3 className="text-sm font-bold text-slate-900">{t.overview.reportsTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.reportsDesc}
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
          <h3 className="text-sm font-bold text-slate-900">{t.overview.supervisorTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.overview.supervisorDesc}
          </p>
        </Link>
      </div>
    </div>
  );
};
