import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertCircle,
  Factory,
} from 'lucide-react';
import { useAuthStore } from './authStore';

interface DemoUserCard {
  roleTitle: string;
  name: string;
  email: string;
  passwordPlain: string;
  scopeBadge: string;
  icon: React.ReactNode;
  accentBorder: string;
  accentBg: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithMagicLink, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [magicTokenInput, setMagicTokenInput] = useState('');
  const [activeTab, setActiveTab] = useState<'password' | 'magicLink'>('password');
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  const demoAccounts: DemoUserCard[] = [
    {
      roleTitle: 'Merchandiser',
      name: 'Ramesh (Internal Lead)',
      email: 'merchandiser@company-a.com',
      passwordPlain: 'ThreadFlow@2026',
      scopeBadge: 'All 3 Units + TNA Setup + AI Review',
      icon: <Building2 className="w-5 h-5 text-indigo-400" />,
      accentBorder: 'hover:border-indigo-500/50',
      accentBg: 'hover:bg-indigo-950/20',
    },
    {
      roleTitle: 'Floor Supervisor',
      name: 'Muthu (Unit 1 Floor)',
      email: 'supervisor.muthu@company-a.com',
      passwordPlain: 'ThreadFlow@2026',
      scopeBadge: 'Unit 1 Mobile Keypad + Tamil Voice',
      icon: <Factory className="w-5 h-5 text-emerald-400" />,
      accentBorder: 'hover:border-emerald-500/50',
      accentBg: 'hover:bg-emerald-950/20',
    },
    {
      roleTitle: 'Buyer B (UK)',
      name: 'Sarah (UK Brand)',
      email: 'buyer@company-b.co.uk',
      passwordPlain: 'ThreadFlow@2026',
      scopeBadge: 'Strictly Isolated: Company B POs Only',
      icon: <UserCheck className="w-5 h-5 text-sky-400" />,
      accentBorder: 'hover:border-sky-500/50',
      accentBg: 'hover:bg-sky-950/20',
    },
    {
      roleTitle: 'Buyer C (Germany)',
      name: 'Klaus (EU Compliance)',
      email: 'compliance@company-c.de',
      passwordPlain: 'ThreadFlow@2026',
      scopeBadge: 'Strictly Isolated: Company C POs Only',
      icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
      accentBorder: 'hover:border-amber-500/50',
      accentBg: 'hover:bg-amber-950/20',
    },
  ];

  const handleQuickFill = async (account: DemoUserCard) => {
    clearError();
    setEmail(account.email);
    setPassword(account.passwordPlain);
    try {
      const user = await login(account.email, account.passwordPlain);
      setLoginSuccessMessage(`Signed in as ${user.name} (${user.role})`);
      setTimeout(() => redirectByRole(user.role), 600);
    } catch {
      // Error handled by store
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password) return;
    try {
      const user = await login(email, password);
      setLoginSuccessMessage(`Signed in as ${user.name} (${user.role})`);
      setTimeout(() => redirectByRole(user.role), 600);
    } catch {
      // Error is set in store
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!magicTokenInput) return;
    try {
      const user = await loginWithMagicLink(magicTokenInput.trim());
      setLoginSuccessMessage(`Authenticated via Magic Link as ${user.name}`);
      setTimeout(() => redirectByRole(user.role), 600);
    } catch {
      // Error is set in store
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Background radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/15 via-slate-950 to-slate-950 -z-10 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-4 shadow-sm shadow-sky-500/20">
          <Factory className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono">
          Thread<span className="text-sky-400">Flow</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Production Intelligence & Shipment Risk Management
          <br />
          <span className="text-xs text-slate-500">Company A — Tiruppur Knitwear Operations</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        {/* Reviewer Quick-Fill Panel */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
                Reviewer Evaluation — 1-Click Demo Quick-Fill
              </span>
            </div>
            <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
              Auto-login
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleQuickFill(account)}
                disabled={isLoading}
                className={`text-left p-3 rounded-xl border border-slate-800 bg-slate-950/60 transition-all duration-150 ${account.accentBorder} ${account.accentBg} focus:outline-none focus:ring-1 focus:ring-sky-500 group`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {account.icon}
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                      {account.roleTitle}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 transition-colors" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{account.email}</div>
                <div className="mt-1 text-[10px] text-slate-500 line-clamp-1">{account.scopeBadge}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Tab Selection */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                clearError();
              }}
              className={`flex-1 py-3 text-xs font-medium text-center transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'password'
                  ? 'border-b-2 border-sky-400 text-sky-400 bg-slate-800/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Standard Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('magicLink');
                clearError();
              }}
              className={`flex-1 py-3 text-xs font-medium text-center transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'magicLink'
                  ? 'border-b-2 border-sky-400 text-sky-400 bg-slate-800/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Buyer Magic Link
            </button>
          </div>

          <div className="p-6">
            {/* Feedback Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loginSuccessMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loginSuccessMessage}</span>
              </div>
            )}

            {activeTab === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. merchandiser@company-a.com"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="block w-full pl-9 pr-10 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                    ) : (
                      <>
                        Sign In to ThreadFlow
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Buyer Magic Link Token
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={magicTokenInput}
                      onChange={(e) => setMagicTokenInput(e.target.value)}
                      placeholder="e.g. demo_magic_link_company_b_uk_2026"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-mono text-xs"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Foreign buyer sourcing representatives can authenticate passwordlessly using their
                    unique cryptographic token.
                  </p>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                  <span className="text-slate-300 font-semibold">Test Token:</span>{' '}
                  <code
                    className="text-sky-400 cursor-pointer hover:underline"
                    onClick={() => setMagicTokenInput('demo_magic_link_company_b_uk_2026')}
                  >
                    demo_magic_link_company_b_uk_2026
                  </code>{' '}
                  (Click to paste)
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                    ) : (
                      <>
                        Verify Magic Link & Enter Portal
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
