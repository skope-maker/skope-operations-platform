import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { errMsg } from '../lib/api';
import { UtensilsCrossed } from 'lucide-react';

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8" data-testid="login-card">
        <div className="mb-8 flex items-center gap-3">
          <UtensilsCrossed className="h-9 w-9 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Kitchen Inventory Suite</h1>
            <p className="text-sm text-muted-foreground">Sales, Recipes & Stock Management</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-12" placeholder="you@company.com" data-testid="login-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12" placeholder="••••••••" data-testid="login-password" />
          </div>
          {error && <div className="rounded-lg border border-[#EF4444] bg-[#FEE2E2] px-4 py-3 text-sm font-medium text-[#991B1B]" data-testid="login-error">{error}</div>}
          <Button type="submit" disabled={busy} className="h-12 w-full text-base" data-testid="login-submit-btn">
            {busy ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <div className="mt-6 rounded-lg bg-secondary p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Admin: chennakeshavaediga@gmail.com / admin123</p>
          <p className="font-semibold text-foreground mb-1">Demo accounts (password: demo123)</p>
          <p>chef@kitchen.com · manager@kitchen.com · keeper@kitchen.com</p>
          <p>procurement@kitchen.com · management@kitchen.com</p>
        </div>
      </div>
    </div>
  );
}
