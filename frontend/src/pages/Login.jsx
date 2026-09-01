import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { errMsg } from '../lib/api';
import { Boxes, ChefHat, LineChart, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Boxes, text: 'Real-time multi-location inventory ledger' },
  { icon: ChefHat, text: 'Recipes, sub-recipes & automatic yield costing' },
  { icon: LineChart, text: 'Sales-driven consumption & variance tracking' },
  { icon: ShieldCheck, text: 'Role-based approvals with full audit trail' },
];

const DEMO_USERS = [
  { label: 'Admin', email: 'chennakeshavaediga@gmail.com', password: 'admin123' },
  { label: 'Chef / Kitchen Manager', email: 'chef@kitchen.com', password: 'demo123' },
  { label: 'Store Manager', email: 'manager@kitchen.com', password: 'demo123' },
  { label: 'Store Keeper', email: 'keeper@kitchen.com', password: 'demo123' },
  { label: 'Procurement Manager', email: 'procurement@kitchen.com', password: 'demo123' },
  { label: 'Management', email: 'management@kitchen.com', password: 'demo123' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const fill = (u) => {
    setEmail(u.email);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="flex min-h-screen bg-white" data-testid="login-page">
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-[#0B1526] p-12 lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[460px] w-[460px] rounded-full bg-[#35A9E1] opacity-20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[360px] w-[360px] rounded-full bg-[#35A9E1] opacity-10 blur-[100px]" />

        <div className="relative animate-[fadeUp_0.6s_ease-out]">
          <div className="inline-block rounded-2xl bg-white px-6 py-4 shadow-2xl">
            <img src="/skope-logo.png" alt="SKOPE Kitchens" className="h-16 w-auto" data-testid="login-brand-logo" />
          </div>
        </div>

        <div className="relative animate-[fadeUp_0.7s_ease-out]">
          <h1 className="max-w-lg text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
            Scaling kitchen <span className="text-[#35A9E1]">operations</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-400">
            One system for sales, procurement, recipes, sub-recipes, yields, stock and variance — across every brand and kitchen.
          </p>
          <div className="mt-8 space-y-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-4 animate-[fadeUp_0.7s_ease-out]" style={{ animationDelay: `${0.15 + i * 0.1}s`, animationFillMode: 'backwards' }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#35A9E1]/30 bg-[#35A9E1]/10">
                  <f.icon className="h-5 w-5 text-[#35A9E1]" />
                </div>
                <span className="text-sm font-medium text-slate-300">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs tracking-widest text-slate-500 uppercase">SKOPE Kitchens · Multi-Brand Suite</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
          <div className="mb-8 lg:hidden">
            <img src="/skope-logo.png" alt="SKOPE Kitchens" className="h-14 w-auto" data-testid="login-brand-logo-mobile" />
          </div>
          <div data-testid="login-card">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your SKOPE Kitchen account</p>

            <form onSubmit={submit} className="mt-8 space-y-5" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email address</Label>
                <Input id="email" type="email" required autoComplete="off" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-13 rounded-xl border-slate-200 bg-slate-50 px-4 text-base focus-visible:ring-[#35A9E1]"
                  placeholder="you@company.com" data-testid="login-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <Input id="password" type="password" required autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-13 rounded-xl border-slate-200 bg-slate-50 px-4 text-base focus-visible:ring-[#35A9E1]"
                  placeholder="Enter your password" data-testid="login-password" />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" data-testid="login-error">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={busy}
                className="h-13 w-full rounded-xl bg-[#0B1526] text-base font-semibold text-white transition-colors duration-150 hover:bg-[#35A9E1]"
                data-testid="login-submit-btn">
                {busy ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="demo-credentials-box">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">User Logins — tap to fill</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {DEMO_USERS.map((u) => (
                  <button key={u.email} type="button" onClick={() => fill(u)} data-testid={`fill-${u.email}`}
                    className="rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors duration-150 hover:border-[#35A9E1] hover:bg-white">
                    <div className="text-xs font-semibold text-slate-800">{u.label}</div>
                    <div className="truncate text-[11px] text-slate-400">{u.email} / {u.password}</div>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">Authorized access only · All activity is audit-logged</p>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
