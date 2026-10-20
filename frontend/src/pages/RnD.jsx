import { useEffect, useState } from 'react';
import { api, errMsg, inr } from '../lib/api';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ItemPicker } from '../components/ItemPicker';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export default function RnD() {
  const [trials, setTrials] = useState([]);
  const [brands, setBrands] = useState([]);
  const [rdLocationId, setRdLocationId] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), brand_id: '', product: '', yield_qty: 0, yield_unit: 'KG', result: '', remarks: '', items: [{ item_id: '', qty: 0, unit: 'KG' }] });

  const load = () => {
    api.get('/rd/trials').then((r) => setTrials(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/brands').then((r) => setBrands(r.data.filter((b) => b.status === 'active'))).catch(() => {});
    // Trials take stock from the R&D location, so the item search shows stock there.
    api.get('/kitchens').then((r) => setRdLocationId(r.data.find((k) => k.type === 'rd' && k.active)?.id || '')).catch(() => {});
  };
  useEffect(load, []);

  const submit = async () => {
    try {
      const lines = form.items.filter((l) => l.item_id && +l.qty > 0).map((l) => ({ ...l, qty: +l.qty }));
      if (!form.product.trim()) return toast.error('Product name is required');
      if (!lines.length) return toast.error('Add at least one ingredient');
      await api.post('/rd/trials', { ...form, brand_id: form.brand_id === 'shared' ? '' : form.brand_id, yield_qty: +form.yield_qty, items: lines });
      toast.success('R&D trial recorded: ingredients consumed from R&D stock (not sales)');
      setForm({ date: new Date().toISOString().slice(0, 10), brand_id: '', product: '', yield_qty: 0, yield_unit: 'KG', result: '', remarks: '', items: [{ item_id: '', qty: 0, unit: 'KG' }] });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="rnd-page">
      <PageHeader title="R&D Trials" subtitle="Trial consumption is tracked separately as R&D Consumption, never as sales consumption" testid="rnd-title" />
      <div className="mb-6 max-w-4xl rounded-xl border bg-card p-4 sm:p-6 space-y-4" data-testid="trial-form">
        <h3 className="text-lg font-semibold">New Trial</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2"><Label>Date</Label><Input type="date" className="h-12" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="trial-date" /></div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
              <SelectTrigger className="h-12" data-testid="trial-brand"><SelectValue placeholder="Shared" /></SelectTrigger>
              <SelectContent><SelectItem value="shared">Shared</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2"><Label>Product / Trial Name</Label><Input className="h-12" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} data-testid="trial-product" /></div>
          <div className="space-y-2"><Label>Yield Qty</Label><Input type="number" min="0" className="h-12" value={form.yield_qty} onChange={(e) => setForm({ ...form, yield_qty: e.target.value })} data-testid="trial-yield" /></div>
          <div className="space-y-2">
            <Label>Yield Unit</Label>
            <Select value={form.yield_unit} onValueChange={(v) => setForm({ ...form, yield_unit: v })}>
              <SelectTrigger className="h-12" data-testid="trial-yield-unit"><SelectValue /></SelectTrigger>
              <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2"><Label>Result</Label><Input className="h-12" placeholder="e.g. Approved for menu / Needs work" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} data-testid="trial-result" /></div>
        </div>
        {form.items.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">Ingredient</Label>
              <ItemPicker testid={`trial-item-${i}`} value={l.item_id} locationId={rdLocationId} onSelect={(it) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, item_id: it?.id || '', unit: it?.consumption_unit || 'KG' } : x)) }))} placeholder="Search item name / code" />
            </div>
            <div className="col-span-5 sm:col-span-2 space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min="0" className="h-11" value={l.qty} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} data-testid={`trial-qty-${i}`} /></div>
            <div className="col-span-5 sm:col-span-3 space-y-1">
              <Label className="text-xs">Unit</Label>
              <Select value={l.unit} onValueChange={(v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, unit: v } : x)) }))}>
                <SelectTrigger className="h-11" data-testid={`trial-unit-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1"><Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button></div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { item_id: '', qty: 0, unit: 'KG' }] }))} data-testid="trial-add-item"><Plus className="mr-2 h-4 w-4" /> Add Ingredient</Button>
        </div>
        <div className="space-y-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} data-testid="trial-remarks" /></div>
        <Button className="h-12 px-8" onClick={submit} data-testid="trial-submit-btn">Record Trial</Button>
      </div>

      <DataTable testid="trials-table" exportName="rd-trials.csv" searchKeys={['trial_no', 'product', 'chef']}
        columns={[
          { key: 'trial_no', label: 'Trial #' },
          { key: 'date', label: 'Date' },
          { key: 'brand_name', label: 'Brand' },
          { key: 'product', label: 'Product' },
          { key: 'items', label: 'Ingredients', render: (r) => r.items.map((i) => `${i.item_name} ${i.qty}${i.unit}`).join(', ') },
          { key: 'cost', label: 'Cost', numeric: true, render: (r) => inr(r.cost) },
          { key: 'yield_qty', label: 'Yield', numeric: true, render: (r) => `${r.yield_qty} ${r.yield_unit}` },
          { key: 'result', label: 'Result' },
          { key: 'chef', label: 'Chef' },
        ]}
        rows={trials} />
    </div>
  );
}
