import React, { useState, useEffect } from 'react';
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
  Check,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuthStore } from './authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, forgotPassword } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Load saved credentials/device preference on mount
  useEffect(() => {
    const savedRemember = localStorage.getItem('tf_remember_me');
    const savedEmail = localStorage.getItem('tf_saved_email');
    if (savedRemember === 'true') {
      setRememberMe(true);
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password) return;

    try {
      const user = await login(email, password);

      // Handle "Remember this device" persistence
      if (rememberMe) {
        localStorage.setItem('tf_remember_me', 'true');
        localStorage.setItem('tf_saved_email', email.trim());
      } else {
        localStorage.removeItem('tf_remember_me');
        localStorage.removeItem('tf_saved_email');
      }

      setLoginSuccessMessage(`Welcome back, ${user.name}`);
      setTimeout(() => redirectByRole(user.role), 300);
    } catch {
      // Error is tracked in authStore
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      setForgotError('Please enter your work email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(targetEmail);
      setForgotSuccess(res.message || `Password reset instructions have been dispatched to ${targetEmail}`);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to dispatch reset request. Please check your network.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotError(null);
    setForgotSuccess(null);
    setShowForgotModal(true);
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
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome back</h1>
            <p className="text-xs sm:text-sm text-sky-100/75 mt-2 leading-relaxed">
              Sign in to access your production intelligence workspace, milestone schedules, and live floor telemetry.
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-200 animate-fadeIn shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {loginSuccessMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-200 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{loginSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Work Email Field */}
            <div>
              <label className="block text-xs font-bold text-sky-100/90 mb-2 uppercase tracking-wider text-[11px]">
                Work Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-sky-400 z-10">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@threadflow.com"
                  className="block w-full pl-12 pr-4 py-3.5 text-sm bg-[#081F33] border border-[#1E4E79] rounded-xl text-white placeholder-sky-200/40 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-inner [&:-webkit-autofill]:bg-[#081F33] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#081F33_inset]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-sky-100/90 uppercase tracking-wider text-[11px]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-sky-400 z-10">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-12 pr-12 py-3.5 text-sm bg-[#081F33] border border-[#1E4E79] rounded-xl text-white placeholder-sky-200/40 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-inner [&:-webkit-autofill]:bg-[#081F33] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#081F33_inset]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-sky-400 hover:text-white transition-colors cursor-pointer z-10"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Custom Tactile Checkbox: Remember this device */}
            <div className="flex items-center justify-between pt-1">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-3 cursor-pointer select-none group"
              >
                <div
                  role="checkbox"
                  aria-checked={rememberMe}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 ${
                    rememberMe
                      ? 'bg-amber-400 border border-amber-400 text-slate-950 shadow-xs'
                      : 'bg-[#081F33] border-2 border-sky-400/60 group-hover:border-amber-400 text-transparent'
                  }`}
                >
                  {rememberMe && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="text-xs font-semibold text-sky-100/85 group-hover:text-white transition-colors">
                  Remember this device
                </span>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C2D48] focus:ring-amber-400 disabled:opacity-50 transition-all cursor-pointer shadow-amber-400/10"
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
      {/* RIGHT COLUMN: Crisp White Theme with Custom Given BG    */}
      {/* ======================================================== */}
      <div
        className="hidden lg:flex lg:w-[50%] xl:w-[48%] h-full flex-col justify-between p-8 sm:p-12 lg:p-12 xl:p-16 relative overflow-hidden bg-white"
        style={{
          backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)), url('/images/threadflow-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Top Pill Bar */}
        <div className="flex items-center justify-between relative z-10 w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Manufacturing Intelligence</span>
          </div>

          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs">
            <span className="text-amber-600 font-mono font-bold mr-1.5">4.8M+</span>
            <span>garments monitored on-time</span>
          </div>
        </div>

        {/* Center Brand Statements & Value Pillars */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          <h2 className="text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Predictable Deliveries. <br />
            <span className="text-sky-700">Verified Floor Telemetry.</span>
          </h2>

          <p className="mt-4 text-sm xl:text-base text-slate-600 leading-relaxed max-w-lg">
            Synchronizing multi-unit knitting, processing, and finishing lines with international sourcing critical paths — eliminating unexpected ship date slips before they compound.
          </p>

          {/* Feature Pills */}
          <div className="mt-7 flex flex-wrap gap-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span>Real-Time TNA Milestones</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span>Bilingual Floor Voice Capture</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span>Immutable Compliance Trail</span>
            </div>
          </div>
        </div>

        {/* Bottom Testimonial Card */}
        <div className="relative z-10 max-w-xl w-full">
          <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-md p-6 xl:p-8 backdrop-blur-sm">
            {/* 5 Golden Stars */}
            <div className="flex items-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4.5 h-4.5 fill-amber-400 text-amber-400" />
              ))}
            </div>

            {/* Inspiring Quotation */}
            <blockquote className="text-sm xl:text-base font-medium text-slate-800 leading-relaxed italic">
              “ThreadFlow gives us absolute confidence in our delivery commitments. Production bottlenecks and schedule shifts surface in real time — eliminating guesswork and surprise delays at ex-factory.”
            </blockquote>

            {/* Author Profile */}
            <div className="mt-5 flex items-center gap-3.5 pt-4 border-t border-slate-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-200 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                SJ
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900">Sarah Jenkins</div>
                <div className="text-xs text-slate-500 font-medium">
                  Head of Global Apparel Sourcing & Merchandising
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FORGOT PASSWORD MODAL                                    */}
      {/* ======================================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Reset your password</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
              Enter your registered work email and we will send you secure recovery instructions to regain access to your workspace.
            </p>

            {forgotError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-fadeIn">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Instructions Dispatched</div>
                  <div className="mt-0.5">{forgotSuccess}</div>
                </div>
              </div>
            )}

            {!forgotSuccess ? (
              <form onSubmit={handleForgotPasswordSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                    Registered Work Email
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@threadflow.com"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0C2D48] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      'Send Recovery Link'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
