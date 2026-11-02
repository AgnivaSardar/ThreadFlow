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
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-slate-950 selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* ======================================================== */}
      {/* LEFT COLUMN: Dedicated Dark Navy Auth Portal (~42% Width) */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[42%] h-full bg-[#0C2D48] flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative z-10 border-r border-[#143D60]">
        {/* Subtle background ambient radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-sky-500/10 via-transparent to-transparent pointer-events-none" />

        {/* Top Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#0C2D48] shadow-md shadow-black/20">
            <Factory className="w-5 h-5 text-[#0C2D48]" />
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
              Access Company A's factory floor & shipment command center.
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
                    alert('Contact factory administration to reset internal credentials.');
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
          </form>

          {/* Quick Info */}
          <div className="mt-5 text-[11px] text-sky-100/50 text-center">
            Demo password:{' '}
            <code className="text-amber-400 font-mono font-semibold">ThreadFlow@2026</code>
          </div>
        </div>

        {/* Left Bottom Security Disclaimer */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-sky-200/50 pt-2 border-t border-[#143D60]/60">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Enterprise 256-Bit SSL • Role-Based Tenant Isolation</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Light Theme Value & Live Showcase (~58% Width) */}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-[58%] h-full bg-[#F4F7FB] flex-col justify-between p-10 xl:p-14 overflow-hidden relative">
        {/* Top Header Text */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-[#0369A1] text-xs font-semibold mb-4 border border-sky-200">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Industrial Run-Rate Intelligence</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Eliminate export shipment delays 14 days in advance.
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Deterministic daily run-rate math, Sunday-excluded forecasting, resilient Tamil floor voice logging, and immutable compliance auditing for Tiruppur knitwear exporters.
          </p>

          {/* 3 Key Numerical Impact Stats */}
          <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t border-slate-200/80">
            <div>
              <div className="text-2xl xl:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                ₹1.08 Cr
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Annual Leakage Prevented
              </div>
            </div>
            <div className="border-l border-slate-200/80 pl-6">
              <div className="text-2xl xl:text-3xl font-extrabold text-amber-600 font-mono tracking-tight">
                14 Days
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Early Warning Lead Time
              </div>
            </div>
            <div className="border-l border-slate-200/80 pl-6">
              <div className="text-2xl xl:text-3xl font-extrabold text-emerald-600 font-mono tracking-tight">
                500+ POs
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Monitored in Real Time
              </div>
            </div>
          </div>
        </div>

        {/* Live Sentinel Activity Card */}
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Floor Sentinel Activity
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE ENGINE
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Activity Item 1 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold font-mono">
                  B213
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Stitching Line 2 — Unit 1
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Rolling Rate: 420 pcs/day (Required: 400 pcs/day)
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                +20 Buffer (Green)
              </span>
            </div>

            {/* Activity Item 2 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold font-mono">
                  B240
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Finishing — Unit 1 Bottleneck
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Deficit: -111 pcs/day • Risk: ₹3.5L Air Freight
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 rounded-full border border-rose-200">
                5 Days Late (Red)
              </span>
            </div>

            {/* Activity Item 3 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold font-mono">
                  C488
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Printing Subcontract — PrintTex
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Downstream Buffer: 11 Days • Overdue Gate Pass Check
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                2-Wk Warning (Amber)
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Sunday Exclusion: Active</span>
            <span>3-Day WMA Weights: 0.50 / 0.30 / 0.20</span>
          </div>
        </div>

        {/* Right Bottom Footer Note */}
        <div className="text-xs text-slate-400">
          Company A — Tiruppur Knitwear Operations • 3 Owned Units & Dedicated Subcontractors
        </div>
      </div>
    </div>
  );
};
