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
  Star,
  ShieldCheck,
  Sparkles,
  Layers,
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-[#081B2C] selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* ======================================================== */}
      {/* LEFT COLUMN: Expanded Blue Login Space (~52% Width)      */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[50%] xl:w-[52%] h-full bg-[#0C2D48] flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 relative z-10 border-r border-[#164368]/70 shadow-2xl">
        {/* Ambient background glow behind form */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center text-[#0C2D48] shadow-lg shadow-black/20 overflow-hidden ring-1 ring-white/20">
            <img src="/logo.png" alt="ThreadFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white font-mono leading-none">
              Thread<span className="text-amber-400">Flow</span>
            </span>
            <div className="text-[10px] uppercase tracking-widest text-sky-200/60 font-bold mt-1">
              Production Intelligence & Critical Path OS
            </div>
          </div>
        </div>

        {/* Center Auth Form Container */}
        <div className="my-auto w-full max-w-[420px] mx-auto relative z-10 py-6">
          <div className="mb-7">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome back</h1>
            <p className="text-xs sm:text-sm text-sky-100/75 mt-1.5 leading-relaxed">
              Sign in to access your production intelligence workspace, milestone schedules, and live floor telemetry.
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-200 animate-fadeIn shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {loginSuccessMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-200 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{loginSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div>
              <label className="block text-xs font-bold text-sky-100/90 mb-1.5 uppercase tracking-wider text-[11px]">
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
                  placeholder="name@threadflow.com"
                  className="block w-full pl-10 pr-3.5 py-3 text-sm bg-[#092238] border border-[#164368] rounded-xl text-white placeholder-sky-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-sky-100/90 uppercase tracking-wider text-[11px]">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact your system administrator to reset credentials.');
                  }}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
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
                  className="block w-full pl-10 pr-11 py-3 text-sm bg-[#092238] border border-[#164368] rounded-xl text-white placeholder-sky-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-sky-200/40 hover:text-sky-100 transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#164368] bg-[#092238] text-amber-400 focus:ring-amber-400 focus:ring-offset-[#0C2D48] cursor-pointer"
                />
                <span className="text-xs font-medium text-sky-100/75">Remember this device</span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C2D48] focus:ring-amber-400 disabled:opacity-50 transition-all cursor-pointer shadow-amber-400/10"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <>
                    Sign In to Workspace
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Left Bottom Footer */}
        <div className="text-[11px] text-sky-200/40 text-center pt-3 border-t border-[#164368]/60 relative z-10 flex items-center justify-between">
          <span>© 2026 ThreadFlow Intelligence</span>
          <span className="text-[10px] text-sky-200/30">Enterprise Critical Path Architecture</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Showcase Hero Card with Industry Quotes   */}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[48%] h-full p-6 lg:p-8 xl:p-10 bg-[#081B2C] relative flex-col justify-center items-center">
        {/* Full-Height Showcase Card with Soft Gradient & Inset Shadow */}
        <div className="w-full h-full rounded-3xl relative overflow-hidden flex flex-col justify-between p-8 xl:p-12 border border-sky-800/30 bg-gradient-to-br from-[#0E3554] via-[#0A263D] to-[#061827] shadow-2xl">
          {/* Ambient Lighting Orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Pill Bar (Inspired by season delivery metrics in reference) */}
          <div className="flex items-center justify-between relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-sky-100 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Manufacturing Intelligence</span>
            </div>

            <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-sky-100 shadow-sm">
              <span className="text-amber-400 font-mono font-bold mr-1">4.8M+</span>
              <span>garments monitored on-time</span>
            </div>
          </div>

          {/* Center Brand Statements & Value Pillars */}
          <div className="relative z-10 my-auto py-8">
            <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
              Predictable Deliveries. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-sky-100 to-amber-300">
                Verified Floor Telemetry.
              </span>
            </h2>

            <p className="mt-4 text-sm xl:text-base text-sky-100/75 leading-relaxed max-w-lg">
              Synchronizing multi-unit knitting, processing, and finishing lines with international sourcing critical paths — eliminating unexpected ship date slips before they compound.
            </p>

            {/* Enterprise Feature Pills */}
            <div className="mt-7 flex flex-wrap gap-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-sky-100/90 backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                <span>Real-Time TNA Milestones</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-sky-100/90 backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                <span>Bilingual Floor Voice Capture</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-sky-100/90 backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                <span>Immutable Compliance Trail</span>
              </div>
            </div>
          </div>

          {/* Bottom Testimonial Card (Inspired directly by the quote card in reference image) */}
          <div className="relative z-10 pt-6 border-t border-white/10">
            {/* 5 Golden Stars */}
            <div className="flex items-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>

            {/* Inspiring Quotation */}
            <blockquote className="text-sm xl:text-base font-medium text-white leading-relaxed italic">
              “ThreadFlow gives us absolute confidence in our delivery commitments. Production bottlenecks and schedule shifts surface in real time — eliminating guesswork and surprise delays at ex-factory.”
            </blockquote>

            {/* Author Profile */}
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-200 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                SJ
              </div>
              <div>
                <div className="font-bold text-sm text-white">Sarah Jenkins</div>
                <div className="text-xs text-sky-200/60 font-medium">
                  Head of Global Apparel Sourcing & Merchandising
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
