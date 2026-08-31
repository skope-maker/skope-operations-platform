import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { errMsg } from '../lib/api';

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm" data-testid="login-card">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/skope-logo.png" alt="SKOPE Kitchens" className="h-16 w-auto" data-testid="login-brand-logo" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">SKOPE Kitchen</h1>
            <p className="text-sm text-muted-foreground">Sales, Recipes & Stock Management</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-12" placeholder="you@company.com" data-testid="login-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12" placeholder="Enter your password" data-testid="login-password" />
          </div>
          {error && <div className="rounded-lg border border-[#EF4444] bg-[#FEE2E2] px-4 py-3 text-sm font-medium text-[#991B1B]" data-testid="login-error">{error}</div>}
          <Button type="submit" disabled={busy} className="h-12 w-full text-base" data-testid="login-submit-btn">
            {busy ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <div className="mt-6 rounded-lg bg-secondary p-4" data-testid="demo-credentials-box">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">User Logins — tap to fill</p>
          <div className="space-y-1.5">
            {DEMO_USERS.map((u) => (
              <button key={u.email} type="button" onClick={() => fill(u)} data-testid={`fill-${u.email}`}
                className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors duration-150 hover:border-primary hover:bg-card">
                <span className="font-medium text-foreground">{u.label}</span>
                <span className="text-muted-foreground">{u.email} / {u.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
