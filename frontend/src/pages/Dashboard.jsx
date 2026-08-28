import { useEffect, useState } from 'react';
import { api, inr, fmt } from '../lib/api';
import { PageHeader, StockBadge, DataTable } from '../components/DataTable';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, Package, ClipboardCheck, ChefHat, CalendarClock, TrendingUp } from 'lucide-react';

function Kpi({ label, value, sub, testid, tone }) {
  return (
    <div className="rounded-xl border bg-card p-5" data-testid={testid}>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold tabular tracking-tight ${tone || ''}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="py-20 text-center text-muted-foreground" data-testid="dashboard-loading">Loading dashboard...</div>;

  const a = data.alerts;
  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Dashboard" subtitle="Live operational overview — all figures computed from the transaction ledger" testid="dashboard-title" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Today's Sales" value={inr(data.today_sales)} sub={`${fmt(data.today_orders)} orders`} testid="kpi-today-sales" />
        <Kpi label="MTD Sales" value={inr(data.mtd_sales)} testid="kpi-mtd-sales" />
        <Kpi label="Inventory Value" value={inr(data.inventory_value)} sub={`Store ${inr(data.store_value)} · Kitchen ${inr(data.kitchen_value)}`} testid="kpi-inventory-value" />
        <Kpi label="Food Cost" value={`${data.food_cost_pct}%`} sub={`Consumption ${inr(data.today_consumption)}`} testid="kpi-food-cost" tone={data.food_cost_pct > 40 ? 'text-[#991B1B]' : 'text-[#166534]'} />
        <Kpi label="Today's Wastage" value={inr(data.today_wastage)} testid="kpi-wastage" tone={data.today_wastage > 0 ? 'text-[#854D0E]' : ''} />
        <Kpi label="Variance" value={`${data.variance_pct}%`} testid="kpi-variance" tone={data.variance_pct > 2 ? 'text-[#991B1B]' : 'text-[#166534]'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-6">
        <div className="rounded-xl border bg-card p-6 lg:col-span-3" data-testid="sales-trend-card">
          <h3 className="mb-4 text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Daily Sales Trend (14 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.sales_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="sales" stroke="#E05D3A" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-card p-6 lg:col-span-3" data-testid="brand-sales-card">
          <h3 className="mb-4 text-lg font-semibold">Brand-wise Sales & Food Cost (MTD)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.brand_wise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="brand" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => (name === 'sales' ? inr(v) : `${v}%`)} />
              <Bar dataKey="sales" fill="#E05D3A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="food_cost_pct" fill="#09090B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-6 lg:col-span-2" data-testid="alerts-card">
          <h3 className="mb-4 text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#EAB308]" /> Alerts</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between" data-testid="alert-procurement"><span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Pending procurement approvals</span><b className="tabular">{a.pending_procurement}</b></div>
            <div className="flex items-center justify-between" data-testid="alert-intents"><span className="flex items-center gap-2"><ChefHat className="h-4 w-4" /> Pending kitchen intents</span><b className="tabular">{a.pending_intents}</b></div>
            <div className="flex items-center justify-between" data-testid="alert-closing"><span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Pending daily closings</span><b className="tabular">{a.pending_closing}</b></div>
            <div className="flex items-center justify-between" data-testid="alert-lowstock"><span className="flex items-center gap-2"><Package className="h-4 w-4" /> Low stock items</span><b className="tabular text-[#991B1B]">{data.low_stock_count}</b></div>
            {a.expiring_items.length > 0 && (
              <div className="rounded-lg border border-[#EAB308] bg-[#FEF9C3] p-3" data-testid="alert-expiring">
                <p className="font-semibold text-[#854D0E]">Expiring within 7 days</p>
                {a.expiring_items.map((e, i) => <p key={i} className="text-[#854D0E]">{e.item} · batch {e.batch || '—'} · {e.expiry}</p>)}
              </div>
            )}
            {a.high_variance_items.length > 0 && (
              <div className="rounded-lg border border-[#EF4444] bg-[#FEE2E2] p-3" data-testid="alert-variance">
                <p className="font-semibold text-[#991B1B]">High variance items (last closing)</p>
                {a.high_variance_items.map((v, i) => <p key={i} className="text-[#991B1B]">{v.item}: {v.variance} {v.unit} ({v.variance_pct}%)</p>)}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 lg:col-span-2" data-testid="inv-location-card">
          <h3 className="mb-4 text-lg font-semibold">Inventory by Location</h3>
          <div className="space-y-3">
            {data.inv_by_location.map((l) => (
              <div key={l.location} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm">{l.location}</span>
                <span className="font-semibold tabular">{inr(l.value)}</span>
              </div>
            ))}
          </div>
          <h3 className="mb-3 mt-6 text-lg font-semibold">Top Selling Products</h3>
          <div className="space-y-2">
            {data.top_products.length === 0 && <p className="text-sm text-muted-foreground">No posted sales yet</p>}
            {data.top_products.map((p) => (
              <div key={p.product} className="flex items-center justify-between text-sm">
                <span>{p.product}</span><span className="font-semibold tabular">{fmt(p.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2" data-testid="low-stock-card">
          <DataTable
            testid="low-stock-table"
            columns={[
              { key: 'item_name', label: 'Low Stock Item' },
              { key: 'location', label: 'Location' },
              { key: 'stock', label: 'Stock', numeric: true, render: (r) => `${r.stock} ${r.unit}` },
              { key: 'status', label: 'Status', render: (r) => <StockBadge status={r.status} /> },
            ]}
            rows={data.low_stock}
            searchKeys={['item_name', 'location']}
          />
        </div>
      </div>
    </div>
  );
}
