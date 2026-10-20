import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errMsg, inr, fmt } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { Download, Upload, Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react';

const ALL = 'all';
const SOURCE_LABELS = { zomato: 'Zomato', swiggy: 'Swiggy', ownly: 'Ownly', POS: 'In-store (POS)' };
const sourceLabel = (s) => SOURCE_LABELS[s] || s;

const FILES = [
  { kind: 'sales', title: 'Sales', report: 'Sales Items By Transaction', where: 'Reports > Sales > Sales Items > Sales Items By Transaction. Pick the dates and all branches, then Download (up to a month at a time works).' },
  { kind: 'cancelled', title: 'Cancelled orders', report: 'Cancelled Transactions', where: 'Reports > Sales > Sale Transactions > Cancelled Transactions. Same dates and branches as the sales file, then Download.' },
  { kind: 'menu', title: 'Menu', report: 'Export Items', where: 'Business Settings > Items > three dots (⋮) > Export Items. Rista emails the file to the account\'s email address.' },
];

function Kpi({ label, value, sub, testid }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5" data-testid={testid}>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-extrabold tabular tracking-tight sm:text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Pick({ label, value, onChange, options, testid, allLabel = 'All' }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
        <SelectTrigger className="h-11" data-testid={testid}><SelectValue /></SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

async function download(path, params, fallbackName) {
  try {
    const r = await api.get(path, { params, responseType: 'blob', timeout: 180000 });
    const name = (r.headers['content-disposition'] || '').match(/filename="(.+?)"/)?.[1] || fallbackName;
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) {
    // A failed download arrives as a file: read the message out of it.
    let msg = e.code === 'ECONNABORTED' ? 'The download took too long. Try a shorter date range.' : errMsg(e);
    const body = e.response?.data;
    if (body instanceof Blob) {
      try { msg = JSON.parse(await body.text()).detail || msg; } catch { /* keep the general message */ }
    }
    toast.error(msg);
  }
}

function DownloadButton({ path, params, name, label, testid }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await download(path, params, name); } finally { setBusy(false); }
  };
  return (
    <Button variant="outline" className="h-11" onClick={run} disabled={busy} data-testid={testid}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} {busy ? 'Preparing…' : label}
    </Button>
  );
}

const clean = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v));

export default function RistaSales() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('report');
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState({ date_from: '', date_to: '', branch: '', brand: '', brand_field: 'business_brand', channel: '', source: '' });
  const [summary, setSummary] = useState(null);
  const [cancelled, setCancelled] = useState(null);
  const [imports, setImports] = useState([]);

  const loadMeta = () => {
    api.get('/rista/sales/filters').then((r) => {
      setMeta(r.data);
      // Show everything loaded so far; after a new upload the range grows to include it.
      setF((x) => ({ ...x, date_from: r.data.date_from || '', date_to: r.data.date_to || '' }));
    }).catch((e) => toast.error(errMsg(e)));
    api.get('/rista/imports').then((r) => setImports(r.data)).catch(() => {});
  };
  useEffect(loadMeta, []);

  const params = useMemo(() => clean(f), [f]);
  const cancelledParams = useMemo(() => { const { brand_field, ...rest } = params; return brand_field === 'account_name' ? { ...rest, brand: '' } : rest; }, [params]);

  useEffect(() => {
    if (!meta?.date_from) return;
    api.get('/rista/sales/summary', { params }).then((r) => setSummary(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/rista/cancelled', { params: clean(cancelledParams) }).then((r) => setCancelled(r.data)).catch(() => {});
  }, [params, cancelledParams, meta]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const brandOptions = (f.brand_field === 'account_name' ? meta?.account_names : meta?.business_brands) || [];
  const hasData = !!meta?.date_from;

  const filterBar = meta && (
    <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 sm:p-4 md:grid-cols-4 xl:grid-cols-7" data-testid="rista-filters">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" className="h-11" value={f.date_from} min={meta.date_from || undefined} max={f.date_to || undefined}
          onChange={(e) => set({ date_from: e.target.value })} data-testid="rista-from" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" className="h-11" value={f.date_to} min={f.date_from || undefined} max={meta.date_to || undefined}
          onChange={(e) => set({ date_to: e.target.value })} data-testid="rista-to" />
      </div>
      <Pick label="Branch" value={f.branch} onChange={(v) => set({ branch: v })} testid="rista-branch"
        options={meta.branches.map((b) => ({ value: b.code, label: b.name }))} />
      <Pick label="Count brand as" value={f.brand_field} allLabel="" testid="rista-brand-field"
        onChange={(v) => set({ brand_field: v || 'business_brand', brand: '' })}
        options={[{ value: 'business_brand', label: 'Ordered from' }, { value: 'account_name', label: 'Dish owner' }]} />
      <Pick label="Brand" value={f.brand} onChange={(v) => set({ brand: v })} testid="rista-brand"
        options={brandOptions.map((b) => ({ value: b, label: b }))} />
      <Pick label="Source" value={f.source} onChange={(v) => set({ source: v })} testid="rista-source"
        options={meta.sources.map((s) => ({ value: s, label: sourceLabel(s) }))} />
      <Pick label="Channel" value={f.channel} onChange={(v) => set({ channel: v })} testid="rista-channel"
        options={meta.channels.map((c) => ({ value: c, label: c }))} />
    </div>
  );

  const shareCols = (label) => [
    { key: 'key', label, render: (r) => (label === 'Source' ? sourceLabel(r.key) : r.key) },
    { key: 'orders', label: 'Orders', numeric: true, render: (r) => fmt(r.orders) },
    { key: 'net', label: 'Net sales', numeric: true, render: (r) => inr(r.net) },
    { key: 'share', label: 'Share', numeric: true, render: (r) => `${r.share}%` },
    { key: 'discounts', label: 'Discounts', numeric: true, render: (r) => inr(r.discounts) },
  ];
  const t = summary?.totals;

  return (
    <div data-testid="rista-page">
      <PageHeader title="Rista Sales" testid="rista-title"
        subtitle={hasData
          ? `Loaded from Rista downloads: ${meta.date_from} to ${meta.date_to}. Updated whenever an admin uploads new files.`
          : 'Sales, cancelled orders and the menu, loaded from files downloaded in the Rista portal.'} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="report" data-testid="tab-rista-report">Sales report</TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-rista-cancelled">Cancelled orders</TabsTrigger>
          <TabsTrigger value="menu" data-testid="tab-rista-menu">Menu</TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-rista-files">{isAdmin ? 'Upload files' : 'Files loaded'}</TabsTrigger>
        </TabsList>

        {!hasData && meta && tab !== 'files' && tab !== 'menu' && (
          <div className="rounded-xl border bg-card p-8 text-center" data-testid="rista-empty">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No Rista sales loaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? 'Upload the "Sales Items By Transaction" file from Rista in the Upload files tab.' : 'An admin needs to upload the Rista sales file first.'}</p>
            {isAdmin && <Button className="mt-4 h-11" onClick={() => setTab('files')} data-testid="rista-go-upload"><Upload className="mr-2 h-4 w-4" /> Upload files</Button>}
          </div>
        )}

        <TabsContent value="report">
          {hasData && filterBar}
          {hasData && t && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi label="Net sales" value={inr(t.net)} sub={`after ${inr(-t.discounts)} discounts`} testid="rista-kpi-net" />
                <Kpi label="Orders" value={fmt(t.orders)} sub={`${t.orders_per_day} a day over ${t.days} days`} testid="rista-kpi-orders" />
                <Kpi label="Average order" value={inr(t.avg_order)} testid="rista-kpi-avg" />
                <Kpi label="Gross sales" value={inr(t.gross)} sub="before discounts" testid="rista-kpi-gross" />
                <Kpi label="Dishes sold" value={fmt(t.qty)} sub={`${fmt(t.lines)} lines incl. options`} testid="rista-kpi-qty" />
                <Kpi label="Tax and charges" value={inr(t.taxes + t.aggregator_tax + t.charges)} sub={`aggregator tax ${inr(t.aggregator_tax)}`} testid="rista-kpi-tax" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <DownloadButton path="/rista/sales/export" params={{ ...params, format: 'xlsx' }} name="rista-sales.xlsx" label="Download lines (Excel)" testid="rista-download-xlsx" />
                <DownloadButton path="/rista/sales/export" params={{ ...params, format: 'csv' }} name="rista-sales.csv" label="Download lines (CSV)" testid="rista-download-csv" />
              </div>
              <div className="mt-5 rounded-xl border bg-card p-4 sm:p-6" data-testid="rista-daily-chart">
                <h3 className="mb-4 text-lg font-semibold">Net sales by business day</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={summary.by_day.map((d) => ({ ...d, day: d.key.slice(5) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => (n === 'net' ? inr(v) : v)} />
                    <Bar dataKey="net" fill="#35A9E1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div><h3 className="mb-2 font-semibold">By source</h3><DataTable testid="rista-by-source" exportName="rista-by-source.csv" columns={shareCols('Source')} rows={summary.by_source} /></div>
                <div><h3 className="mb-2 font-semibold">By branch</h3><DataTable testid="rista-by-branch" exportName="rista-by-branch.csv" columns={shareCols('Branch')} rows={summary.by_branch} /></div>
                <div><h3 className="mb-2 font-semibold">By brand</h3><DataTable testid="rista-by-brand" exportName="rista-by-brand.csv" searchKeys={['key']} columns={shareCols('Brand')} rows={summary.by_brand} /></div>
                <div><h3 className="mb-2 font-semibold">By channel</h3><DataTable testid="rista-by-channel" exportName="rista-by-channel.csv" searchKeys={['key']} columns={shareCols('Channel')} rows={summary.by_channel} /></div>
              </div>
              <div className="mt-5">
                <h3 className="mb-2 font-semibold">Top 50 dishes</h3>
                <DataTable testid="rista-top-dishes" exportName="rista-top-dishes.csv" searchKeys={['sku', 'item_name', 'account_name']}
                  columns={[
                    { key: 'item_name', label: 'Dish' }, { key: 'sku', label: 'SKU' }, { key: 'account_name', label: 'Brand (dish owner)' },
                    { key: 'qty', label: 'Qty', numeric: true, render: (r) => fmt(r.qty) },
                    { key: 'net', label: 'Net sales', numeric: true, render: (r) => inr(r.net) },
                    { key: 'share', label: 'Share', numeric: true, render: (r) => `${r.share}%` },
                  ]} rows={summary.top_dishes} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="cancelled">
          {hasData && filterBar}
          {hasData && f.brand_field === 'account_name' && f.brand && (
            <p className="mb-3 text-sm text-muted-foreground" data-testid="rista-cancelled-brand-note">Cancelled orders only carry the brand ordered from, so the brand filter is not applied here.</p>
          )}
          {hasData && cancelled && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Cancelled orders" value={fmt(cancelled.totals.orders)} testid="rista-kpi-cancelled" />
                <Kpi label="Value" value={inr(cancelled.totals.total)} testid="rista-kpi-cancelled-value" />
                <Kpi label="By Zomato, Swiggy, Ownly" value={fmt(cancelled.totals.by_platform)} sub="cancelled automatically" testid="rista-kpi-by-platform" />
                <Kpi label="By staff" value={fmt(cancelled.totals.by_staff)} sub="cancelled in Rista by a person" testid="rista-kpi-by-staff" />
              </div>
              <div className="mt-3">
                <DownloadButton path="/rista/cancelled/export" params={{ ...clean(cancelledParams), format: 'xlsx' }} name="rista-cancelled.xlsx" label="Download (Excel)" testid="rista-cancelled-download" />
              </div>
              <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="xl:col-span-1">
                  <h3 className="mb-2 font-semibold">Reasons</h3>
                  <DataTable testid="rista-cancel-reasons" columns={[{ key: 'reason', label: 'Reason', render: (r) => <span className="whitespace-normal">{r.reason}</span> }, { key: 'orders', label: 'Orders', numeric: true }]} rows={cancelled.by_reason} />
                </div>
                <div className="xl:col-span-2">
                  <h3 className="mb-2 font-semibold">Orders</h3>
                  <DataTable testid="rista-cancelled-table" exportName="rista-cancelled.csv" searchKeys={['invoice_number', 'source_order_number', 'business_brand', 'reason', 'channel']}
                    columns={[
                      { key: 'cancel_date', label: 'Cancelled at' }, { key: 'branch_name', label: 'Branch' },
                      { key: 'business_brand', label: 'Brand' }, { key: 'order_source', label: 'Source', render: (r) => sourceLabel(r.order_source) },
                      { key: 'invoice_number', label: 'Invoice' }, { key: 'fulfillment_status', label: 'Stage' },
                      { key: 'cancelled_by', label: 'By', render: (r) => (r.cancelled_by_platform ? 'Platform' : r.cancelled_by) },
                      { key: 'reason', label: 'Reason' },
                      { key: 'total', label: 'Total', numeric: true, render: (r) => inr(r.total) },
                    ]} rows={cancelled.rows} />
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="menu"><MenuTab isAdmin={isAdmin} goUpload={() => setTab('files')} /></TabsContent>

        <TabsContent value="files">
          {isAdmin && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {FILES.map((fl) => <UploadCard key={fl.kind} {...fl} onDone={loadMeta} />)}
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Customer names, phone numbers and staff names in the files are not stored. Loading a file again, or one that overlaps, replaces the same branches and days instead of adding them twice.</p>
          <h3 className="mb-2 mt-6 font-semibold">Files loaded</h3>
          <DataTable testid="rista-imports" columns={[
            { key: 'imported_at', label: 'Loaded at', render: (r) => new Date(r.imported_at).toLocaleString() },
            { key: 'kind', label: 'File', render: (r) => FILES.find((x) => x.kind === r.kind)?.title || r.kind },
            { key: 'filename', label: 'Name' },
            { key: 'rows', label: 'Rows', numeric: true, render: (r) => fmt(r.rows) },
            { key: 'range', label: 'Business days', render: (r) => (r.date_from ? `${r.date_from} to ${r.date_to}` : '') },
            { key: 'imported_by', label: 'By' },
          ]} rows={imports} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UploadCard({ kind, title, report, where, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!file) return toast.error('Choose the file first');
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/rista/import/${kind}`, fd, { timeout: 180000 });
      setResult(r.data);
      toast.success(`${title} loaded: ${fmt(r.data.rows)} rows`);
      onDone();
    } catch (e) {
      if (e.code === 'ECONNABORTED') toast.error('The upload took too long. Check the internet connection and try again, or load a shorter date range.');
      else if (!e.response) toast.error('Could not reach the website. Check the internet connection and try again.');
      else toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 sm:p-5" data-testid={`rista-upload-${kind}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm font-medium">Rista report: “{report}”</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{where}</p>
      <Input type="file" accept=".csv,.xlsx" className="mt-3 h-11 pt-2" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} data-testid={`rista-file-${kind}`} />
      <Button className="mt-3 h-11" onClick={send} disabled={busy || !file} data-testid={`rista-send-${kind}`}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {busy ? 'Loading…' : 'Load file'}
      </Button>
      {result && (
        <div className="mt-3 rounded-md bg-secondary p-3 text-xs" data-testid={`rista-result-${kind}`}>
          <b>{fmt(result.rows)}</b> rows loaded{result.date_from ? ` for ${result.date_from} to ${result.date_to}` : ''}
          {result.branches ? ` (${result.branches.join(', ')})` : ''}.
          {result.orders !== undefined && <> {fmt(result.orders)} orders, net {inr(result.net)}.</>}
          {result.total !== undefined && <> Value {inr(result.total)}.</>}
          {result.active !== undefined && <> {fmt(result.active)} active dishes, {result.accounts} brand accounts.</>}
          {result.replaced > 0 && <> Replaced {fmt(result.replaced)} rows loaded earlier for the same days.</>}
          {result.skipped > 0 && <> Skipped {result.skipped} rows without a branch, date or invoice.</>}
        </div>
      )}
    </div>
  );
}

const MENU_PAGE_SIZE = 50;

function MenuTab({ isAdmin, goUpload }) {
  const [data, setData] = useState(null); // { rows, total, page, pages }
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [checks, setChecks] = useState(null);
  const [f, setF] = useState({ q: '', account: '', status: 'active', page: 1 });
  const [dq, setDq] = useState('');
  const [prices, setPrices] = useState(null);
  const latest = useRef(0);

  useEffect(() => {
    api.get('/rista/menu/accounts').then((r) => setAccounts(r.data)).catch(() => {});
    api.get('/rista/menu/checks').then((r) => setChecks(r.data)).catch(() => {});
  }, []);
  // Search after a pause in typing, not on every key.
  useEffect(() => {
    const t = setTimeout(() => setDq(f.q), 250);
    return () => clearTimeout(t);
  }, [f.q]);
  useEffect(() => {
    const n = ++latest.current; // an older, slower answer must never replace a newer one
    setLoading(true);
    api.get('/rista/menu', { params: clean({ q: dq, account: f.account, status: f.status, page: f.page, page_size: MENU_PAGE_SIZE }) })
      .then((r) => { if (n === latest.current) setData(r.data); })
      .catch((e) => {
        if (n !== latest.current) return;
        setData((d) => d || { rows: [], total: 0, page: 1, pages: 1 });
        toast.error(errMsg(e));
      })
      .finally(() => { if (n === latest.current) setLoading(false); });
  }, [dq, f.account, f.status, f.page]);

  const change = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));
  const goPage = (n) => setF((x) => ({ ...x, page: n }));
  const openPrices = (sku) => api.get(`/rista/menu/${encodeURIComponent(sku)}`).then((r) => setPrices(r.data)).catch((e) => toast.error(errMsg(e)));
  const priceText = (r) => (r.price_min == null ? '' : r.price_min === r.price_max ? inr(r.price_min) : `${inr(r.price_min)} to ${inr(r.price_max)}`);

  if (checks && !checks.menu_loaded && data && data.total === 0 && !f.q && !f.account) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center" data-testid="rista-menu-empty">
        <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No Rista menu loaded yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? 'Upload the "Export Items" file from Rista.' : 'An admin needs to upload the Rista menu file first.'}</p>
        {isAdmin && <Button className="mt-4 h-11" onClick={goUpload} data-testid="rista-menu-go-upload"><Upload className="mr-2 h-4 w-4" /> Upload files</Button>}
      </div>
    );
  }

  const from = data && data.total ? (data.page - 1) * MENU_PAGE_SIZE + 1 : 0;
  const to = data ? Math.min(data.page * MENU_PAGE_SIZE, data.total) : 0;
  const pager = data && (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="rista-menu-pager">
      <span data-testid="rista-menu-page-info">{data.total ? `${fmt(from)} to ${fmt(to)} of ${fmt(data.total)} ${data.total === 1 ? 'dish' : 'dishes'}` : '0 dishes'}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-11" disabled={loading || data.page <= 1} onClick={() => goPage(data.page - 1)} data-testid="rista-menu-prev">Previous</Button>
        <span className="tabular" data-testid="rista-menu-page-number">Page {data.page} of {data.pages}</span>
        <Button variant="outline" className="h-11" disabled={loading || data.page >= data.pages} onClick={() => goPage(data.page + 1)} data-testid="rista-menu-next">Next</Button>
      </div>
    </div>
  );

  return (
    <div data-testid="rista-menu">
      {checks?.menu_loaded && (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4" data-testid="rista-check-not-in-menu">
            <div className="flex items-center gap-2 font-semibold">{checks.not_in_menu.length > 0 && <AlertTriangle className="h-4 w-4 text-[#EAB308]" />} Sold but not in the menu file: {checks.not_in_menu.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Dish codes in the sales that the menu export does not have. They cannot be matched until fixed in Rista.</p>
            {checks.not_in_menu.length > 0 && <p className="mt-2 text-sm">{checks.not_in_menu.map((x) => `${x.sku} ${x.item_name} (${x.lines} lines)`).join(' · ')}</p>}
          </div>
          <div className="rounded-xl border bg-card p-4" data-testid="rista-check-no-recipe">
            <div className="font-semibold">Sold dishes without a recipe in this app: {checks.without_recipe.length} of {checks.sold_dishes}</div>
            <p className="mt-1 text-xs text-muted-foreground">A recipe is linked when its code equals the Rista SKU. Needed only if Rista sales should use up stock (question Q33).</p>
          </div>
        </div>
      )}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input className="h-11" placeholder="Dish name, SKU or category" value={f.q} onChange={(e) => change({ q: e.target.value })} data-testid="rista-menu-search" />
        </div>
        <Pick label="Brand account" value={f.account} onChange={(v) => change({ account: v })} testid="rista-menu-account" options={accounts.map((a) => ({ value: a, label: a }))} />
        <Pick label="Status" value={f.status} onChange={(v) => change({ status: v })} testid="rista-menu-status" allLabel="All dishes"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </div>
      <div className="mb-3">
        <DownloadButton path="/rista/menu/export" params={clean({ q: dq, account: f.account, status: f.status, format: 'xlsx' })}
          name="rista-menu.xlsx" label="Download menu (Excel)" testid="rista-menu-download" />
      </div>
      {data === null && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground" data-testid="rista-menu-loading"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading menu…</div>}
      {data !== null && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <DataTable testid="rista-menu-table" search={false} footer={pager}
            columns={[
              { key: 'name', label: 'Dish', render: (r) => <span>{r.name}{r.variant ? <span className="text-muted-foreground"> · {r.variant}</span> : ''}</span> },
              { key: 'sku', label: 'SKU' },
              { key: 'account', label: 'Brand account' },
              { key: 'category', label: 'Category' },
              { key: 'status', label: 'Status' },
              { key: 'price', label: 'Price', numeric: true, render: priceText },
              { key: 'sold_qty', label: 'Sold', numeric: true, render: (r) => fmt(r.sold_qty) },
              { key: 'has_recipe', label: 'Recipe here', render: (r) => (r.has_recipe ? 'Yes' : 'No') },
              { key: 'actions', label: '', render: (r) => <Button size="sm" variant="outline" onClick={() => openPrices(r.sku)} data-testid={`rista-prices-${r.sku}`}>Prices</Button> },
            ]} rows={data.rows} />
        </div>
      )}

      <Dialog open={!!prices} onOpenChange={(o) => !o && setPrices(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="rista-prices-dialog">
          <DialogHeader><DialogTitle>{prices?.name} <span className="text-muted-foreground">({prices?.sku})</span></DialogTitle></DialogHeader>
          {prices && (
            <>
              <p className="text-sm text-muted-foreground">{prices.account} · {prices.category} · {prices.status}{prices.price_includes_tax === 'Yes' ? ' · prices include tax' : ''}</p>
              {prices.description && <p className="text-sm">{prices.description}</p>}
              {!prices.prices.length && <p className="text-sm">No prices set in Rista.</p>}
              {[...new Set(prices.prices.map((p) => p.branch))].map((b) => (
                <div key={b} className="mt-2">
                  <h4 className="mb-1 text-sm font-semibold">{b}</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      {prices.prices.filter((p) => p.branch === b).map((p) => (
                        <tr key={p.channel} className="border-b last:border-0"><td className="py-1.5 pr-3">{p.channel}</td><td className="py-1.5 text-right tabular">{inr(p.price)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
