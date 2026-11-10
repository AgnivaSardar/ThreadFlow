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
  ShieldCheck,
  RotateCcw,
  Clock,
  Building2,
  Globe,
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from './authStore';

type ResetStep = 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, registerBuyer, isLoading, error, clearError, forgotPassword, verifyOtp, resetPassword } = useAuthStore();

  const [isBuyerRegister, setIsBuyerRegister] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState(false);

  // Check URL params for session reasons
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'inactivity') {
      setInactivityNotice(true);
    }
  }, []);

  // Forgot Password / OTP Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('EMAIL');
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalNotice, setModalNotice] = useState<string | null>(null);

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password || !companyName || !contactName) return;

    try {
      const user = await registerBuyer({
        companyName: companyName.trim(),
        name: contactName.trim(),
        country: country.trim() || 'International',
        email: email.trim(),
        password,
      });

      setLoginSuccessMessage(`Buyer account created! Welcome, ${user.name}`);
      setTimeout(() => redirectByRole(user.role), 300);
    } catch {
      // Error is tracked in authStore
    }
  };

  const openForgotModal = () => {
    setResetEmail(email.trim());
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetStep('EMAIL');
    setModalError(null);
    setModalNotice(null);
    setShowForgotModal(true);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalNotice(null);

    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      setModalError('Please enter your work email address.');
      return;
    }

    setModalLoading(true);
    try {
      const res = await forgotPassword(targetEmail);
      setModalNotice(res.message || `Verification OTP code dispatched to ${targetEmail}`);
      setResetStep('OTP');
    } catch (err: any) {
      setModalError(err.message || 'Failed to dispatch verification code. Please check your network.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalNotice(null);

    const code = otpCode.trim();
    if (!code || code.length < 6) {
      setModalError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setModalLoading(true);
    try {
      await verifyOtp(resetEmail.trim(), code);
      setModalNotice('Code verified successfully. Enter your new password below.');
      setResetStep('PASSWORD');
    } catch (err: any) {
      setModalError(err.message || 'Invalid or expired OTP code. Please check and try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalNotice(null);

    if (!newPassword || newPassword.length < 8) {
      setModalError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setModalError('Passwords do not match. Please re-enter.');
      return;
    }

    setModalLoading(true);
    try {
      await resetPassword(resetEmail.trim(), otpCode.trim(), newPassword);
      setResetStep('SUCCESS');
    } catch (err: any) {
      setModalError(err.message || 'Failed to reset password. Please request a new OTP.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleFinishReset = () => {
    setShowForgotModal(false);
    setEmail(resetEmail);
    setPassword('');
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
      <div className="w-full lg:w-[50%] xl:w-[52%] h-full bg-[#0C2D48] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 relative z-10 border-r border-[#164368]/70 shadow-2xl overflow-hidden">
        {/* Ambient background glow behind form */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Header */}
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center text-[#0C2D48] shadow-lg shadow-black/20 overflow-hidden ring-1 ring-white/20">
            <img src="/logo.png" alt="ThreadFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono leading-none">
              Thread<span className="text-amber-400">Flow</span>
            </span>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-sky-200/60 font-bold mt-0.5 sm:mt-1">
              Production Intelligence & Critical Path OS
            </div>
          </div>
        </div>

        {/* Center Auth Form Container */}
        <div className="my-auto w-full max-w-[420px] mx-auto relative z-10 py-2 sm:py-3 shrink-0">
          <div className="mb-4 sm:mb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isBuyerRegister ? 'Register as Buyer' : 'Welcome back'}
            </h1>
            <p className="text-xs sm:text-sm text-sky-100/75 mt-1 sm:mt-1.5 leading-relaxed">
              {isBuyerRegister
                ? 'Create your direct sourcing account to track factory lines, milestones, and request new styles.'
                : 'Sign in to access your production intelligence workspace, milestone schedules, and live floor telemetry.'}
            </p>
          </div>

          {/* Feedback Alerts */}
          {inactivityNotice && !isBuyerRegister && (
            <div className="mb-3.5 p-2.5 sm:p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 flex items-start gap-2 text-xs text-amber-200 animate-fadeIn shadow-lg">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="font-medium text-[11px] sm:text-xs">
                Your session ended after 30 minutes of inactivity. Please sign in again.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-3.5 p-2.5 sm:p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-start gap-2 text-xs text-rose-200 animate-fadeIn shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium text-[11px] sm:text-xs">{error}</span>
            </div>
          )}

          {loginSuccessMessage && (
            <div className="mb-3.5 p-2.5 sm:p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2 text-xs text-emerald-200 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-[11px] sm:text-xs">{loginSuccessMessage}</span>
            </div>
          )}

          {isBuyerRegister ? (
            /* ======================================================== */
            /* BUYER SELF-REGISTRATION FORM                            */
            /* ======================================================== */
            <form onSubmit={handleRegisterSubmit} className="space-y-2.5 sm:space-y-3">
              {/* Row 1: Company Name + Country (2 cols) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1 uppercase tracking-wider">
                    Company / Brand
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#0C2D48] z-10">
                      <Building2 className="h-3.5 w-3.5 stroke-[2.2]" />
                    </div>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Nordic Brands"
                      className="block w-full pl-9 pr-3 py-2 text-xs font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1 uppercase tracking-wider">
                    Country
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#0C2D48] z-10">
                      <Globe className="h-3.5 w-3.5 stroke-[2.2]" />
                    </div>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Germany"
                      className="block w-full pl-9 pr-3 py-2 text-xs font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Contact Person Full Name */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1 uppercase tracking-wider">
                  Contact Person Name
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#0C2D48] z-10">
                    <UserCheck className="h-4 w-4 stroke-[2.2]" />
                  </div>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="block w-full pl-10 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Row 3: Work Email Address */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1 uppercase tracking-wider">
                  Work Email Address
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#0C2D48] z-10">
                    <Mail className="h-4 w-4 stroke-[2.2]" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-10 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Row 4: Password Field */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#0C2D48] z-10">
                    <Lock className="h-4 w-4 stroke-[2.2]" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-10 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-600 hover:text-slate-950 transition-colors cursor-pointer z-10"
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 stroke-[2.2]" /> : <Eye className="h-4 w-4 stroke-[2.2]" />}
                  </button>
                </div>
              </div>

              {/* Submit Registration Button */}
              <div className="pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl shadow-lg text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C2D48] focus:ring-amber-400 disabled:opacity-50 transition-all cursor-pointer shadow-amber-400/10"
                >
                  {isLoading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                  ) : (
                    <>
                      Register Buyer Account
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>

              {/* Switch Back to Login */}
              <div className="pt-1.5 text-center text-xs text-sky-200/80">
                Already registered with ThreadFlow?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsBuyerRegister(false);
                    clearError();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors cursor-pointer"
                >
                  Sign In to Workspace
                </button>
              </div>
            </form>
          ) : (
            /* ======================================================== */
            /* EXISTING SIGN-IN FORM                                    */
            /* ======================================================== */
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Work Email Field */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 mb-1.5 uppercase tracking-wider">
                  Work Email Address
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#0C2D48] z-10">
                    <Mail className="h-4.5 w-4.5 stroke-[2.2]" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@threadflow.com"
                    className="block w-full pl-12 pr-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner [&:-webkit-autofill]:bg-[#EAF2FB] [&:-webkit-autofill]:text-slate-900 [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#EAF2FB_inset]"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-sky-100/90 uppercase tracking-wider">
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
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#0C2D48] z-10">
                    <Lock className="h-4.5 w-4.5 stroke-[2.2]" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-12 pr-12 py-3 sm:py-3.5 text-xs sm:text-sm font-medium bg-[#EAF2FB] border border-[#BFDBFE]/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all shadow-inner [&:-webkit-autofill]:bg-[#EAF2FB] [&:-webkit-autofill]:text-slate-900 [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#EAF2FB_inset]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-slate-950 transition-colors cursor-pointer z-10"
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5 stroke-[2.2]" /> : <Eye className="h-4.5 w-4.5 stroke-[2.2]" />}
                  </button>
                </div>
              </div>

              {/* Custom Tactile Checkbox: Remember this device */}
              <div className="flex items-center justify-between pt-0.5">
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
              <div className="pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 sm:py-3.5 px-4 rounded-xl shadow-lg text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0C2D48] focus:ring-amber-400 disabled:opacity-50 transition-all cursor-pointer shadow-amber-400/10"
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

              {/* Option to Register as Buyer */}
              <div className="pt-2 text-center text-xs text-sky-200/80">
                New international buyer partner?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsBuyerRegister(true);
                    clearError();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors cursor-pointer"
                >
                  Register as a Buyer
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Left Bottom Footer */}
        <div className="text-[11px] text-sky-200/40 text-center pt-2 sm:pt-3 border-t border-[#164368]/60 relative z-10 flex items-center justify-between shrink-0">
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
      {/* MULTI-STEP PASSWORD RESET WITH OTP MODAL                 */}
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

            {/* Step Progress Tracker */}
            <div className="flex items-center gap-2 mb-5">
              <span className={`h-1.5 flex-1 rounded-full ${resetStep === 'EMAIL' ? 'bg-[#0C2D48]' : 'bg-emerald-500'}`} />
              <span className={`h-1.5 flex-1 rounded-full ${resetStep === 'OTP' ? 'bg-[#0C2D48]' : resetStep === 'PASSWORD' || resetStep === 'SUCCESS' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              <span className={`h-1.5 flex-1 rounded-full ${resetStep === 'PASSWORD' ? 'bg-[#0C2D48]' : resetStep === 'SUCCESS' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            </div>

            {/* Header Icon */}
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              {resetStep === 'EMAIL' && <Mail className="w-6 h-6" />}
              {resetStep === 'OTP' && <ShieldCheck className="w-6 h-6 text-indigo-600" />}
              {resetStep === 'PASSWORD' && <KeyRound className="w-6 h-6 text-amber-600" />}
              {resetStep === 'SUCCESS' && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
            </div>

            {/* STEP 1: EMAIL */}
            {resetStep === 'EMAIL' && (
              <>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Reset your password</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Enter your registered work email. We will generate and email a secure 6-digit OTP to verify your identity.
                </p>

                {modalError && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
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
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
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
                      disabled={modalLoading}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {modalLoading ? (
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        'Send OTP Code'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 2: OTP VERIFICATION */}
            {resetStep === 'OTP' && (
              <>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Enter Verification Code</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  A 6-digit OTP was dispatched to <strong className="text-slate-800">{resetEmail}</strong>.
                </p>

                {/* PROMINENT SPAM FOLDER CALLOUT */}
                <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Check your Spam / Junk mail:</span>
                    <p className="mt-0.5 text-amber-800">
                      The OTP email has been sent. If you do not see it in your primary inbox within 30 seconds, please check your <strong className="underline">Spam or Junk folder</strong> — the verification code is there.
                    </p>
                  </div>
                </div>

                {modalError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                      6-Digit Security Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="block w-full py-3 text-center tracking-[0.4em] font-mono text-2xl font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0C2D48] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep('EMAIL')}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Change Email
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading || otpCode.length < 6}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {modalLoading ? (
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        'Verify Code'
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={modalLoading}
                      onClick={handleSendOtp}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Resend verification code
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 3: NEW PASSWORD & CONFIRM PASSWORD */}
            {resetStep === 'PASSWORD' && (
              <>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Create New Password</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Enter your new password below. It must be at least 8 characters long.
                </p>

                {modalError && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                      New Password
                    </label>
                    <div className="relative rounded-xl">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0C2D48] focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                      Confirm New Password
                    </label>
                    <div className="relative rounded-xl">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0C2D48] focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep('OTP')}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading || !newPassword || !confirmPassword}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {modalLoading ? (
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        'Save & Update'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 4: SUCCESS */}
            {resetStep === 'SUCCESS' && (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 stroke-[3]" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Password Updated!</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Your credentials have been securely refreshed. You can now log into your ThreadFlow account with your new password.
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleFinishReset}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0C2D48] hover:bg-[#143D60] text-xs font-bold text-white shadow-md transition-all"
                  >
                    Sign In with New Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
