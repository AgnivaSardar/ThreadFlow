import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Factory,
  Building2,
  Check,
} from 'lucide-react';
import { useAuthStore } from './authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password) return;

    try {
      const user = await login(email, password);
      setLoginSuccessMessage(`Welcome back, ${user.name}`);
      setTimeout(() => redirectByRole(user.role), 300);
    } catch {
      // Error is tracked in authStore
    }
  };

  const redirectByRole = (role: string) => {
    switch (role) {
      case 'SUPERVISOR':
        navigate('/supervisor/my-work');
        break;
      case 'BUYER':
        navigate('/buyer-portal');
        break;
      case 'MERCHANDISER':
      case 'ADMIN':
      default:
        navigate('/orders');
        break;
    }
  };

  const companyCapabilities = [
    '3 Owned Manufacturing Units in Tiruppur',
    'Integrated Subcontract Printing & Washing',
    'Real-time TNA Milestone Tracking',
    'Offline-First Floor Supervisor Updates',
    'Multi-Tenant Scoped Buyer Portals',
    'Immutable Compliance Audit Trail',
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-[#0C2D48] selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* ======================================================== */}
      {/* LEFT COLUMN: Clean, Minimal Sign-In Form (~42% Width)    */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[42%] h-full bg-[#0C2D48] flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative z-10 border-r border-[#143D60]">
        {/* Top Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center text-[#0C2D48] shadow-md shadow-black/20 overflow-hidden">
            <img src="/logo.png" alt="ThreadFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white font-mono leading-none">
              Thread<span className="text-amber-400">Flow</span>
            </span>
            <div className="text-[10px] uppercase tracking-widest text-sky-200/60 font-semibold mt-0.5">
              Production Intelligence
            </div>
          </div>
        </div>

        {/* Center Auth Form Container */}
        <div className="my-auto w-full max-w-sm mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">Sign in</h1>
            <p className="text-xs text-sky-100/70 mt-1">
              Enter your credentials to access the workspace.
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-300 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loginSuccessMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-300 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{loginSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-sky-100/90 mb-1.5">
                Work Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-300/50">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company-a.com"
                  className="block w-full pl-10 pr-3 py-2.5 text-sm bg-[#092238] border border-[#164368] rounded-xl text-white placeholder-sky-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-sky-100/90">Password</label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact your administrator to reset credentials.');
                  }}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-300/50">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm bg-[#092238] border border-[#164368] rounded-xl text-white placeholder-sky-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-sky-200/40 hover:text-sky-100 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#164368] bg-[#092238] text-amber-400 focus:ring-amber-400 focus:ring-offset-[#0C2D48]"
                />
                <span className="text-xs text-sky-100/70">Remember this device</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C2D48] focus:ring-amber-400 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <>
                    Sign In to Workspace
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Demo Role Logins */}
            <div className="pt-3 border-t border-[#143D60]/60 space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-wider text-sky-200/60 text-center">
                Quick Role Fill (Default Password: ThreadFlow@2026)
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('merchandiser@company-a.com');
                    setPassword('ThreadFlow@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0E3352] hover:bg-[#164368] text-sky-100 font-semibold border border-sky-400/20 text-left transition-all cursor-pointer active:scale-95"
                >
                  <div className="font-bold text-amber-300 text-[11px]">Merchandiser</div>
                  <div className="text-[10px] text-sky-200/60 truncate">Ramesh (Orders/TNA)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('supervisor.muthu@company-a.com');
                    setPassword('ThreadFlow@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0E3352] hover:bg-[#164368] text-sky-100 font-semibold border border-sky-400/20 text-left transition-all cursor-pointer active:scale-95"
                >
                  <div className="font-bold text-emerald-300 text-[11px]">Supervisor (Unit 1)</div>
                  <div className="text-[10px] text-sky-200/60 truncate">Muthu (Floor Work)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('supervisor.selvam@company-a.com');
                    setPassword('ThreadFlow@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0E3352] hover:bg-[#164368] text-sky-100 font-semibold border border-sky-400/20 text-left transition-all cursor-pointer active:scale-95"
                >
                  <div className="font-bold text-emerald-300 text-[11px]">Supervisor (Unit 2)</div>
                  <div className="text-[10px] text-sky-200/60 truncate">Selvam (Floor Work)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('buyer@company-b.co.uk');
                    setPassword('ThreadFlow@2026');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0E3352] hover:bg-[#164368] text-sky-100 font-semibold border border-sky-400/20 text-left transition-all cursor-pointer active:scale-95"
                >
                  <div className="font-bold text-sky-300 text-[11px]">Buyer (Company B)</div>
                  <div className="text-[10px] text-sky-200/60 truncate">Sarah (UK Portal)</div>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Left Bottom Copyright */}
        <div className="text-[11px] text-sky-200/40 text-center pt-3 border-t border-[#143D60]/60">
          © 2026 Company A. All rights reserved.
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Minimal Company Overview & Tags (~58% Width)*/}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-[58%] h-full bg-[#F4F7FB] flex-col justify-between p-10 xl:p-14 overflow-hidden relative">
        {/* Top Company Overview */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold mb-4 border border-slate-300/60">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Company A — Tiruppur Knitwear Operations</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Production Intelligence & Order Operations
          </h2>

          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Unified manufacturing intelligence platform connecting factory floor operations, merchandising teams, and global export apparel partners.
          </p>

          {/* Clean Core Capabilities Grid */}
          <div className="mt-8 pt-6 border-t border-slate-200/80">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Core Capabilities
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {companyCapabilities.map((capability) => (
                <div
                  key={capability}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200/70 text-xs font-medium text-slate-700 shadow-sm"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                  <span>{capability}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Manufacturing Facilities Card */}
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="text-xs font-bold text-slate-900 tracking-wide uppercase mb-3">
            Manufacturing Infrastructure
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900">Unit 1</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Avinashi Road</div>
              <div className="text-[10px] text-sky-700 font-semibold mt-1">Knitting & Finishing</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900">Unit 2 & 3</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Palladam Road</div>
              <div className="text-[10px] text-sky-700 font-semibold mt-1">Stitching Lines</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900">Subcontractors</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Printing & Washing</div>
              <div className="text-[10px] text-sky-700 font-semibold mt-1">Dedicated Partners</div>
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="text-xs text-slate-400">
          Tiruppur, Tamil Nadu • Exporting to UK & European Retail Partners
        </div>
      </div>
    </div>
  );
};
