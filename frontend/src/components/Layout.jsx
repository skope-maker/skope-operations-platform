import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTE_ROLES } from '../lib/permissions';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, Boxes, ChefHat, BookOpen,
  FlaskConical, Trash2, Database, BarChart3, Settings, LogOut, Menu, X, Store,
} from 'lucide-react';

const SECTIONS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ROUTE_ROLES['/'] },
  { label: 'Sales', icon: ShoppingCart, path: '/sales', roles: ROUTE_ROLES['/sales'] },
  { label: 'Procurement', icon: ShoppingBag, path: '/procurement', roles: ROUTE_ROLES['/procurement'] },
  { label: 'Inventory', icon: Boxes, path: '/inventory', roles: ROUTE_ROLES['/inventory'] },
  { label: 'Kitchen', icon: ChefHat, path: '/kitchen', roles: ROUTE_ROLES['/kitchen'] },
  { label: 'Recipes', icon: BookOpen, path: '/recipes', roles: ROUTE_ROLES['/recipes'] },
  { label: 'R&D', icon: FlaskConical, path: '/rd', roles: ROUTE_ROLES['/rd'] },
  { label: 'Wastage', icon: Trash2, path: '/wastage', roles: ROUTE_ROLES['/wastage'] },
  { label: 'Masters', icon: Database, path: '/masters', roles: ROUTE_ROLES['/masters'] },
  { label: 'Reports', icon: BarChart3, path: '/reports', roles: ROUTE_ROLES['/reports'] },
  { label: 'Rista Sales', icon: Store, path: '/rista', roles: ROUTE_ROLES['/rista'] },
  { label: 'Administration', icon: Settings, path: '/admin', roles: ROUTE_ROLES['/admin'] },
];

export default function Layout({ children }) {
  const { user, logout, settings } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {SECTIONS.filter((s) => s.roles.includes(user?.role)).map((s) => (
        <NavLink
          key={s.path}
          to={s.path}
          end={s.path === '/'}
          onClick={() => setOpen(false)}
          data-testid={`nav-${s.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150 ${
              isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
            }`
          }
        >
          <s.icon className="h-5 w-5 shrink-0" />
          {s.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src="/skope-logo.png" alt="SKOPE Kitchens" className="h-9 w-auto" data-testid="sidebar-logo" />
          <div>
            <div className="font-extrabold leading-tight tracking-tight" data-testid="company-name">{settings.company_name}</div>
            <div className="text-xs text-muted-foreground">Kitchen Inventory Suite</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="font-extrabold">{settings.company_name}</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary" data-testid="close-menu-btn"><X className="h-6 w-6" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)} data-testid="open-menu-btn">
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-sm text-muted-foreground hidden sm:block">Multi-Brand Sales, Recipe & Inventory Management</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 text-right">
              <div className="max-w-[9rem] truncate text-sm font-semibold sm:max-w-none" data-testid="current-user-name">{user?.name}</div>
              <div className="text-xs text-muted-foreground capitalize" data-testid="current-user-role">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              data-testid="logout-btn"
              aria-label="Log out"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border hover:bg-secondary transition-colors duration-150"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
