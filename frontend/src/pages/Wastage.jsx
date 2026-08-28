import { useEffect, useState } from 'react';
import { api, errMsg, inr, fileToDataUrl } from '../lib/api';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

export default function Wastage() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [brands, setBrands] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), brand_id: '', kitchen_id: '', item_id: '', qty: 0, unit: 'KG', reason: '', photo: '', remarks: '' });

  const load = () => {
    api.get('/wastage').then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/items').then((r) => setItems(r.data.filter((i) => i.active))).catch(() => {});
    api.get('/kitchens').then((r) => setKitchens(r.data.filter((k) => k.active))).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.filter((b) => b.status === 'active'))).catch(() => {});
    api.get('/wastage/reasons').then((r) => setReasons(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const submit = async () => {
    try {
      if (!form.item_id || !form.kitchen_id || !form.reason) return toast.error('Item, kitchen and reason are required');
      await api.post('/wastage', { ...form, qty: +form.qty, brand_id: form.brand_id === 'shared' ? '' : form.brand_id });
      toast.success('Wastage recorded — stock deducted via ledger');
      setForm({ ...form, item_id: '', qty: 0, reason: '', remarks: '', photo: '' });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const total = rows.reduce((s, r) => s + (r.value || 0), 0);

  return (
    <div data-testid="wastage-page">
      <PageHeader title="Wastage" subtitle={`Recorded wastage creates ledger transactions · Total value: ${inr(total)}`} testid="wastage-title" />
      <div className="mb-6 max-w-4xl rounded-xl border bg-card p-6" data-testid="wastage-form">
        <h3 className="mb-4 text-lg font-semibold">Record Wastage</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2"><Label>Date</Label><Input type="date" className="h-12" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="wastage-date" /></div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
              <SelectTrigger className="h-12" data-testid="wastage-brand"><SelectValue placeholder="Shared" /></SelectTrigger>
              <SelectContent><SelectItem value="shared">Shared</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kitchen / Location</Label>
            <Select value={form.kitchen_id} onValueChange={(v) => setForm({ ...form, kitchen_id: v })}>
              <SelectTrigger className="h-12" data-testid="wastage-kitchen"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={form.item_id} onValueChange={(v) => { const it = items.find((x) => x.id === v); setForm({ ...form, item_id: v, unit: it?.consumption_unit || 'KG' }); }}>
              <SelectTrigger className="h-12" data-testid="wastage-item"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Qty</Label><Input type="number" min="0" className="h-12" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} data-testid="wastage-qty" /></div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger className="h-12" data-testid="wastage-unit"><SelectValue /></SelectTrigger>
              <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
              <SelectTrigger className="h-12" data-testid="wastage-reason"><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>{reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <Input type="file" accept="image/*" className="h-12 pt-2.5" data-testid="wastage-photo"
              onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setForm({ ...form, photo: await fileToDataUrl(fl) }); }} />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-2"><Label>Remarks</Label><Input className="h-12" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} data-testid="wastage-remarks" /></div>
        </div>
        <Button className="mt-4 h-12 px-8" onClick={submit} data-testid="wastage-submit-btn">Record Wastage</Button>
      </div>

      <DataTable testid="wastage-table" exportName="wastage.csv" searchKeys={['item_name', 'reason', 'kitchen_name', 'brand_name']}
        columns={[
          { key: 'wastage_no', label: 'Ref #' },
          { key: 'date', label: 'Date' },
          { key: 'brand_name', label: 'Brand' },
          { key: 'kitchen_name', label: 'Kitchen' },
          { key: 'item_name', label: 'Item' },
          { key: 'qty', label: 'Qty', numeric: true, render: (r) => `${r.qty} ${r.unit}` },
          { key: 'reason', label: 'Reason' },
          { key: 'value', label: 'Value', numeric: true, render: (r) => inr(r.value) },
          { key: 'created_by', label: 'By' },
        ]}
        rows={rows} />
    </div>
  );
}
