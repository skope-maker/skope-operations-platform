import { useEffect, useState } from 'react';
import { api, errMsg, inr } from '../lib/api';
import { DataTable, PageHeader, StatusBadge } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Upload } from 'lucide-react';
import { BulkUploadDialog } from '../components/BulkUpload';

const emptyLine = () => ({ recipe_id: '', qty_sold: 0, cancelled: 0, complimentary: 0 });

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), brand_id: '', kitchen_id: '', items: [emptyLine()] });
  const [detail, setDetail] = useState(null);
  const [theoretical, setTheoretical] = useState([]);
  const [shortages, setShortages] = useState(null);
  const [canOverride, setCanOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [postingId, setPostingId] = useState(null);
  const [bulk, setBulk] = useState(false);

  const load = () => {
    api.get('/sales').then((r) => setSales(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/recipes').then((r) => setRecipes(r.data.filter((x) => x.active))).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.filter((b) => b.status === 'active'))).catch(() => {});
    api.get('/kitchens').then((r) => setKitchens(r.data.filter((k) => k.active))).catch(() => {});
  };
  useEffect(load, []);

  const setLine = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const submit = async () => {
    try {
      const items = form.items.filter((l) => l.recipe_id && l.qty_sold > 0).map((l) => ({ ...l, qty_sold: +l.qty_sold, cancelled: +l.cancelled, complimentary: +l.complimentary }));
      if (!items.length) return toast.error('Add at least one product with quantity');
      await api.post('/sales', { ...form, items });
      toast.success('Draft sales created. Review and post to consume stock.');
      setOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), brand_id: '', kitchen_id: '', items: [emptyLine()] });
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const postSale = async (id, override = false) => {
    try {
      const res = await api.post(`/sales/${id}/post`, { override, override_reason: overrideReason });
      if (!res.data.ok) {
        setShortages(res.data.shortages || []);
        setPostingId(id);
        setCanOverride(!!res.data.needs_override);
        if (override) toast.error('Only Admin / Store Manager can override shortages. This attempt was not posted.');
        return;
      }
      toast.success('Sales posted — inventory consumed');
      setShortages(null);
      setOverrideReason('');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const viewDetail = async (id) => {
    const [d, t] = await Promise.all([api.get(`/sales/${id}`), api.get(`/sales/${id}/theoretical`)]);
    setDetail(d.data);
    setTheoretical(t.data);
  };

  const brandRecipes = recipes.filter((r) => !form.brand_id || r.brand_id === form.brand_id);

  return (
    <div data-testid="sales-page">
      <PageHeader title="Daily Sales" subtitle="Draft → Review → Post. Posting deducts stock via recipes, sub-recipes and yields."
        testid="sales-title"
        actions={<>
          <Button variant="outline" className="h-12" onClick={() => setBulk(true)} data-testid="bulk-sales-btn"><Upload className="mr-2 h-5 w-5" /> Bulk Upload Sales</Button>
          <Button className="h-12" onClick={() => setOpen(true)} data-testid="new-sale-btn"><Plus className="mr-2 h-5 w-5" /> New Sales Entry</Button>
        </>} />

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all" data-testid="tab-sales-all">All Sales</TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-sales-draft">Drafts</TabsTrigger>
          <TabsTrigger value="posted" data-testid="tab-sales-posted">Posted</TabsTrigger>
        </TabsList>
        {['all', 'draft', 'posted'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <DataTable
              testid={`sales-table-${tab}`}
              exportName={`sales-${tab}.csv`}
              searchKeys={['sale_no', 'brand_name', 'date']}
              columns={[
                { key: 'sale_no', label: 'Sale #' },
                { key: 'date', label: 'Date' },
                { key: 'brand_name', label: 'Brand' },
                { key: 'items', label: 'Products', render: (r) => r.items.map((i) => `${i.recipe_name} ×${i.net_qty}`).join(', ') },
                { key: 'total_amount', label: 'Amount', numeric: true, render: (r) => inr(r.total_amount) },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: 'actions', label: 'Actions', render: (r) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => viewDetail(r.id)} data-testid={`view-sale-${r.sale_no}`}>View</Button>
                      {r.status === 'draft' && <Button size="sm" onClick={() => postSale(r.id)} data-testid={`post-sale-${r.sale_no}`}>Post</Button>}
                    </div>
                  ),
                },
              ]}
              rows={sales.filter((s) => tab === 'all' || s.status === tab)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">          <DialogHeader><DialogTitle>New Daily Sales Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" className="h-12" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="sale-date" />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
                <SelectTrigger className="h-12" data-testid="sale-brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kitchen / Outlet</Label>
              <Select value={form.kitchen_id} onValueChange={(v) => setForm({ ...form, kitchen_id: v })}>
                <SelectTrigger className="h-12" data-testid="sale-kitchen"><SelectValue placeholder="Select kitchen" /></SelectTrigger>
                <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Label>Products Sold</Label>
            {form.items.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <Label className="text-xs">Product (Recipe)</Label>
                  <Select value={l.recipe_id} onValueChange={(v) => setLine(i, { recipe_id: v })}>
                    <SelectTrigger className="h-11" data-testid={`sale-line-recipe-${i}`}><SelectValue placeholder="Select recipe" /></SelectTrigger>
                    <SelectContent>{brandRecipes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({inr(r.selling_price)})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Sold</Label>
                  <Input type="number" min="0" className="h-11" value={l.qty_sold} onChange={(e) => setLine(i, { qty_sold: e.target.value })} data-testid={`sale-line-qty-${i}`} />
                </div>
                <div className="col-span-3 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Cancelled</Label>
                  <Input type="number" min="0" className="h-11" value={l.cancelled} onChange={(e) => setLine(i, { cancelled: e.target.value })} data-testid={`sale-line-cancelled-${i}`} />
                </div>
                <div className="col-span-3 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Complimentary</Label>
                  <Input type="number" min="0" className="h-11" value={l.complimentary} onChange={(e) => setLine(i, { complimentary: e.target.value })} data-testid={`sale-line-comp-${i}`} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} data-testid={`sale-line-remove-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="h-11" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }))} data-testid="sale-add-line-btn">
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </div>
          <Button className="mt-4 h-12 w-full" onClick={submit} data-testid="sale-submit-btn">Save Draft Sales</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.sale_no} — {detail?.brand_name} — {detail?.date}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold">Sales Lines</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="py-2">Product</th><th className="text-right">Sold</th><th className="text-right">Cancel</th><th className="text-right">Comp</th><th className="text-right">Net</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {detail.items.map((l, i) => (
                      <tr key={i} className="border-b"><td className="py-2">{l.recipe_name}</td><td className="text-right tabular">{l.qty_sold}</td><td className="text-right tabular">{l.cancelled}</td><td className="text-right tabular">{l.complimentary}</td><td className="text-right tabular">{l.net_qty}</td><td className="text-right tabular">{inr(l.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.consumption?.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">Actual Inventory Consumption (posted)</h3>
                  <table className="w-full text-sm" data-testid="sale-consumption-table">
                    <thead><tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="py-2">Item</th><th>Type</th><th>Recipe</th><th className="text-right">Qty</th></tr></thead>
                    <tbody>
                      {detail.consumption.map((c, i) => (
                        <tr key={i} className="border-b"><td className="py-2">{c.item_name}</td><td>{c.kind === 'sub_recipe_output' ? 'Sub-Recipe' : 'Raw'}</td><td>{c.recipe_name} v{c.recipe_version}</td><td className="text-right tabular">{c.qty} {c.unit}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <h3 className="mb-2 font-semibold">Theoretical Raw Material Consumption (recipes expanded through sub-recipes & yields)</h3>
                <table className="w-full text-sm" data-testid="sale-theoretical-table">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="py-2">Product</th><th className="text-right">Sales</th><th>Raw Ingredient</th><th className="text-right">Theoretical Qty</th></tr></thead>
                  <tbody>
                    {theoretical.map((t, i) => (
                      <tr key={i} className="border-b"><td className="py-2">{t.product}</td><td className="text-right tabular">{t.sales_qty}</td><td>{t.ingredient}</td><td className="text-right tabular">{t.theoretical_qty} {t.unit}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {bulk && <BulkUploadDialog kind="sales" open={bulk} onClose={() => setBulk(false)} onImported={load} />}

      <Dialog open={!!shortages} onOpenChange={() => setShortages(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Insufficient Stock</DialogTitle></DialogHeader>
          <div className="space-y-3" data-testid="shortage-dialog">
            {shortages?.map((s, i) => (
              <div key={i} className="rounded-lg border border-[#EF4444] bg-[#FEE2E2] p-3 text-sm text-[#991B1B]">
                <b>{s.item_name}</b> — Available: {s.available} {s.unit} · Required: {s.required} {s.unit} · Shortage: {s.shortage} {s.unit}
              </div>
            ))}
            <p className="text-sm text-muted-foreground">Only Admin / Store Manager can override. All overrides are recorded in audit logs.</p>
            {canOverride ? (
              <>
                <Label>Override Reason</Label>
                <Input className="h-12" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for override" data-testid="override-reason" />
                <Button className="h-12 w-full" variant="destructive" onClick={() => postSale(postingId, true)} data-testid="override-post-btn">Override & Post Anyway</Button>
              </>
            ) : (
              <div className="rounded-lg border border-[#EAB308] bg-[#FEF9C3] p-3 text-sm font-medium text-[#854D0E]" data-testid="override-not-allowed">
                Your role cannot override shortages. Ask an Admin or Store Manager to post this sale, or add stock first.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
