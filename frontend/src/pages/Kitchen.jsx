import { useEffect, useState } from 'react';
import { api, errMsg, inr } from '../lib/api';
import { DataTable, PageHeader, StatusBadge } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { ItemPicker } from '../components/ItemPicker';

const ISSUE_TYPES = [
  { value: 'base_kitchen', label: 'Base Kitchen (sub-recipes / prep)' },
  { value: 'normal_kitchen', label: 'Normal Kitchen (daily service)' },
  { value: 'rd', label: 'R&D (trials)' },
  { value: 'store', label: 'Main / Dry Store' },
];

export default function Kitchen() {
  const [kitchens, setKitchens] = useState([]);
  const [brands, setBrands] = useState([]);
  const [subRecipes, setSubRecipes] = useState([]);
  const [intents, setIntents] = useState([]);
  const [issues, setIssues] = useState([]);
  const [productions, setProductions] = useState([]);
  const [closings, setClosings] = useState([]);
  const [intent, setIntent] = useState({ date: new Date().toISOString().slice(0, 10), brand_id: '', kitchen_id: '', issue_type: 'base_kitchen', priority: 'normal', remarks: '', items: [{ item_id: '', qty: 0, unit: 'KG', purpose: '' }] });
  const [issueInputs, setIssueInputs] = useState({});
  const [prod, setProd] = useState({ sub_recipe_id: '', brand_id: '', kitchen_id: '', produced_qty: 0, unit: 'KG', remarks: '' });
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));
  const [closingLoc, setClosingLoc] = useState('');
  const [preview, setPreview] = useState(null);
  const [physical, setPhysical] = useState({});
  const [reopenReason, setReopenReason] = useState('');

  const load = () => {
    api.get('/kitchens').then((r) => setKitchens(r.data.filter((k) => k.active))).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.filter((b) => b.status === 'active'))).catch(() => {});
    api.get('/subrecipes').then((r) => setSubRecipes(r.data.filter((s) => s.active))).catch(() => {});
    api.get('/kitchen/intents').then((r) => setIntents(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/kitchen/issues').then((r) => setIssues(r.data)).catch(() => {});
    api.get('/kitchen/production').then((r) => setProductions(r.data)).catch(() => {});
    api.get('/closing').then((r) => setClosings(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const kitchensForType = (t) => kitchens.filter((k) => k.type === t);
  const intentTargets = kitchensForType(intent.issue_type);
  const targetKitchen = kitchens.find((k) => k.id === intent.kitchen_id);
  const sourceName = targetKitchen ? (kitchens.find((k) => k.id === targetKitchen.parent_id)?.name || 'Main Store') : '';

  const submitIntent = async () => {
    try {
      const lines = intent.items.filter((l) => l.item_id && +l.qty > 0).map((l) => ({ ...l, qty: +l.qty }));
      if (!lines.length) return toast.error('Add at least one item');
      await api.post('/kitchen/intents', { ...intent, items: lines });
      toast.success('Kitchen intent raised');
      setIntent({ ...intent, items: [{ item_id: '', qty: 0, unit: 'KG', purpose: '' }], remarks: '' });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const issueLine = async (intentDoc, index) => {
    const key = `${intentDoc.id}-${index}`;
    const qty = +issueInputs[key];
    if (!qty) return toast.error('Enter quantity to issue');
    try {
      await api.post(`/kitchen/intents/${intentDoc.id}/issue`, { items: [{ index, qty }] });
      toast.success('Stock issued: store deducted, kitchen credited');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const issueFull = async (intentDoc) => {
    try {
      const lines = intentDoc.items.map((l, index) => ({ index, qty: l.balance ?? (l.qty - (l.issued || 0)) })).filter((l) => l.qty > 0);
      await api.post(`/kitchen/intents/${intentDoc.id}/issue`, { items: lines });
      toast.success('Full issue completed');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const submitProduction = async () => {
    try {
      await api.post('/kitchen/production', { ...prod, produced_qty: +prod.produced_qty });
      toast.success('Production batch recorded: raw materials consumed, sub-recipe stock added');
      setProd({ sub_recipe_id: '', brand_id: '', kitchen_id: '', produced_qty: 0, unit: 'KG', remarks: '' });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const loadPreview = async () => {
    if (!closingLoc) return toast.error('Select location');
    try {
      const r = await api.get(`/closing/preview?date=${closingDate}&location_id=${closingLoc}`);
      setPreview(r.data);
      const p = {};
      r.data.rows.forEach((row) => { p[row.item_id] = row.expected; });
      setPhysical(p);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const submitClosing = async () => {
    try {
      const items = Object.entries(physical).map(([item_id, v]) => ({ item_id, physical_qty: +v }));
      await api.post('/closing', { date: closingDate, location_id: closingLoc, items });
      toast.success('Closing submitted: variance calculated');
      loadPreview();
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const approveClosing = async (id) => {
    try {
      await api.post(`/closing/${id}/approve`);
      toast.success('Day approved & locked');
      load();
      if (preview) loadPreview();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const reopenDay = async (date, location_id) => {
    if (!reopenReason.trim()) return toast.error('Enter reopen reason');
    try {
      await api.post('/closing/reopen', { date, location_id, reason: reopenReason });
      toast.success('Day reopened: audit logged');
      setReopenReason('');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const pendingIntents = intents.filter((i) => i.status === 'pending' || i.status === 'partial');

  return (
    <div data-testid="kitchen-page">
      <PageHeader title="Kitchen Operations" subtitle="Intents → Issues → Production → Daily Closing" testid="kitchen-title" />
      <Tabs defaultValue="intents">
        <TabsList className="mb-4">
          <TabsTrigger value="intents" data-testid="tab-k-intents">Kitchen Intent</TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-k-issues">Store Issues {pendingIntents.length > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{pendingIntents.length}</span>}</TabsTrigger>
          <TabsTrigger value="production" data-testid="tab-k-production">Sub-Recipe Production</TabsTrigger>
          <TabsTrigger value="closing" data-testid="tab-k-closing">Daily Closing</TabsTrigger>
        </TabsList>

        <TabsContent value="intents">
          <div className="mb-6 max-w-4xl rounded-xl border bg-card p-4 sm:p-6 space-y-4" data-testid="intent-form">
            <h3 className="text-lg font-semibold">Raise Kitchen Intent</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-2"><Label>Date</Label><Input type="date" className="h-12" value={intent.date} onChange={(e) => setIntent({ ...intent, date: e.target.value })} data-testid="intent-date" /></div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={intent.brand_id} onValueChange={(v) => setIntent({ ...intent, brand_id: v === 'shared' ? '' : v })}>
                  <SelectTrigger className="h-12" data-testid="intent-brand"><SelectValue placeholder="Shared" /></SelectTrigger>
                  <SelectContent><SelectItem value="shared">Shared</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Type</Label>
                <Select value={intent.issue_type} onValueChange={(v) => {
                  const target = kitchensForType(v)[0];
                  setIntent({ ...intent, issue_type: v, kitchen_id: target?.id || '' });
                }}>
                  <SelectTrigger className="h-12" data-testid="intent-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kitchen</Label>
                <Select value={intent.kitchen_id} onValueChange={(v) => setIntent({ ...intent, kitchen_id: v })}>
                  <SelectTrigger className="h-12" data-testid="intent-kitchen"><SelectValue placeholder={intentTargets.length ? 'Select' : 'No location of this type'} /></SelectTrigger>
                  <SelectContent>{intentTargets.map((k) => <SelectItem key={k.id} value={k.id}>{k.name} ({k.code})</SelectItem>)}</SelectContent>
                </Select>
                {intentTargets.length === 0 && (
                  <p className="text-xs font-medium text-[#991B1B]" data-testid="intent-no-kitchen-hint">
                    No active {intent.issue_type.replace(/_/g, ' ')} location exists. Add one in Masters → Kitchens.
                  </p>
                )}
                {targetKitchen && (
                  <p className="text-xs text-muted-foreground" data-testid="intent-source-hint">Stock will be issued from <b>{sourceName}</b></p>
                )}
              </div>
            </div>
            {intent.items.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
                <div className="col-span-12 sm:col-span-4 space-y-1">
                  <Label className="text-xs">Item</Label>
                  <ItemPicker
                    testid={`intent-item-${i}`}
                    value={l.item_id}
                    locationId={targetKitchen?.parent_id || ''}
                    onSelect={(it) => setIntent((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, item_id: it?.id || '', unit: it?.consumption_unit || 'KG' } : x)) }))}
                    placeholder="Search item name / code" />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min="0" className="h-11" value={l.qty} onChange={(e) => setIntent((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} data-testid={`intent-qty-${i}`} /></div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select value={l.unit} onValueChange={(v) => setIntent((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, unit: v } : x)) }))}>
                    <SelectTrigger className="h-11" data-testid={`intent-unit-${i}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-3 space-y-1"><Label className="text-xs">Purpose</Label><Input className="h-11" value={l.purpose} onChange={(e) => setIntent((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, purpose: e.target.value } : x)) }))} data-testid={`intent-purpose-${i}`} /></div>
                <div className="col-span-12 sm:col-span-1"><Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setIntent((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="h-11" onClick={() => setIntent((f) => ({ ...f, items: [...f.items, { item_id: '', qty: 0, unit: 'KG', purpose: '' }] }))} data-testid="intent-add-item"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
              <Input className="h-11 flex-1 min-w-52" placeholder="Remarks" value={intent.remarks} onChange={(e) => setIntent({ ...intent, remarks: e.target.value })} data-testid="intent-remarks" />
              <Button className="h-12 px-8" onClick={submitIntent} data-testid="intent-submit-btn">Raise Intent</Button>
            </div>
          </div>
          <DataTable testid="intents-table" exportName="kitchen-intents.csv" searchKeys={['intent_no', 'brand_name', 'kitchen_name']}
            columns={[
              { key: 'intent_no', label: 'Intent #' },
              { key: 'date', label: 'Date' },
              { key: 'brand_name', label: 'Brand' },
              { key: 'kitchen_name', label: 'Kitchen' },
              { key: 'source_location_name', label: 'Issued From', render: (r) => r.source_location_name || 'Main Store' },
              { key: 'issue_type', label: 'Type', render: (r) => r.issue_type.replace(/_/g, ' ') },
              { key: 'items', label: 'Items', render: (r) => r.items.map((i) => `${i.item_name} ${i.qty}${i.unit}`).join(', ') },
              { key: 'requested_by', label: 'By' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            ]}
            rows={intents} />
        </TabsContent>

        <TabsContent value="issues">
          <div className="mb-6 space-y-4">
            {pendingIntents.length === 0 && <p className="rounded-xl border bg-card p-4 sm:p-6 text-muted-foreground" data-testid="no-pending-intents">No pending kitchen intents.</p>}
            {pendingIntents.map((intentDoc) => (
              <div key={intentDoc.id} className="rounded-xl border bg-card p-4 sm:p-6" data-testid={`intent-card-${intentDoc.intent_no}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>{intentDoc.intent_no}</b> · {intentDoc.brand_name} · {intentDoc.kitchen_name} · {intentDoc.date} · by {intentDoc.requested_by}
                    <div className="text-xs text-muted-foreground">Issuing from {intentDoc.source_location_name || 'Main Store'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-10" onClick={() => issueFull(intentDoc)} data-testid={`issue-full-${intentDoc.intent_no}`}>Full Issue</Button>
                    <Button size="sm" variant="destructive" className="h-10" onClick={async () => { await api.post(`/kitchen/intents/${intentDoc.id}/reject`); toast.success('Intent rejected'); load(); }} data-testid={`reject-intent-${intentDoc.intent_no}`}>Reject</Button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="py-2">Item</th><th className="text-right">Requested</th><th className="text-right">Available (Source)</th><th className="text-right">Issued</th><th className="text-right">Balance</th><th className="text-right">Issue Qty</th><th></th></tr></thead>
                  <tbody>
                    {intentDoc.items.map((l, i) => {
                      const key = `${intentDoc.id}-${i}`;
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{l.item_name}</td>
                          <td className="text-right tabular">{l.qty} {l.unit}</td>
                          <td className={`text-right tabular ${l.available < l.qty - (l.issued || 0) ? 'font-semibold text-[#991B1B]' : ''}`}>{l.available} {l.unit}</td>
                          <td className="text-right tabular">{l.issued || 0} {l.unit}</td>
                          <td className="text-right tabular">{l.balance} {l.unit}</td>
                          <td className="text-right"><Input type="number" min="0" className="ml-auto h-10 w-24 text-right" value={issueInputs[key] ?? ''} onChange={(e) => setIssueInputs({ ...issueInputs, [key]: e.target.value })} data-testid={`issue-qty-${intentDoc.intent_no}-${i}`} /></td>
                          <td className="pl-2 text-right"><Button size="sm" variant="secondary" className="h-10" onClick={() => issueLine(intentDoc, i)} data-testid={`issue-btn-${intentDoc.intent_no}-${i}`}>Issue</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <h3 className="mb-3 text-lg font-semibold">Issue History</h3>
          <DataTable testid="issues-table" exportName="stock-issues.csv" searchKeys={['issue_no', 'intent_no', 'issued_by']}
            columns={[
              { key: 'issue_no', label: 'Issue #' },
              { key: 'intent_no', label: 'Intent' },
              { key: 'date', label: 'Date' },
              { key: 'to_location', label: 'To' },
              { key: 'items', label: 'Items', render: (r) => r.items.map((i) => `${i.item_name} ${i.qty}${i.unit}`).join(', ') },
              { key: 'issued_by', label: 'Issued By' },
            ]}
            rows={issues} />
        </TabsContent>

        <TabsContent value="production">
          <div className="mb-6 max-w-3xl rounded-xl border bg-card p-4 sm:p-6 space-y-4" data-testid="production-form">
            <h3 className="text-lg font-semibold">Create Production Batch</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sub-Recipe</Label>
                <Select value={prod.sub_recipe_id} onValueChange={(v) => { const s = subRecipes.find((x) => x.id === v); setProd({ ...prod, sub_recipe_id: v, unit: s?.yield_unit || 'KG', brand_id: s?.brand_id || '' }); }}>
                  <SelectTrigger className="h-12" data-testid="prod-subrecipe"><SelectValue placeholder="Select sub-recipe" /></SelectTrigger>
                  <SelectContent>{subRecipes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} (yield {s.yield_pct}%)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kitchen</Label>
                <Select value={prod.kitchen_id} onValueChange={(v) => setProd({ ...prod, kitchen_id: v })}>
                  <SelectTrigger className="h-12" data-testid="prod-kitchen"><SelectValue placeholder="Select kitchen" /></SelectTrigger>
                  <SelectContent>{kitchens.filter((k) => k.type === 'base_kitchen' || k.type === 'normal_kitchen').map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Produced Qty</Label><Input type="number" min="0" className="h-12" value={prod.produced_qty} onChange={(e) => setProd({ ...prod, produced_qty: e.target.value })} data-testid="prod-qty" /></div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={prod.unit} onValueChange={(v) => setProd({ ...prod, unit: v })}>
                  <SelectTrigger className="h-12" data-testid="prod-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {prod.sub_recipe_id && (
              <div className="rounded-lg bg-secondary p-4 text-sm" data-testid="prod-recipe-preview">
                <b>Ingredients (per batch yielding {subRecipes.find((s) => s.id === prod.sub_recipe_id)?.yield_qty} {subRecipes.find((s) => s.id === prod.sub_recipe_id)?.yield_unit}):</b>
                <ul className="mt-1 list-inside list-disc">
                  {subRecipes.find((s) => s.id === prod.sub_recipe_id)?.items.map((i, idx) => <li key={idx}>{i.item_name}: {i.qty} {i.unit}</li>)}
                </ul>
              </div>
            )}
            <div className="space-y-2"><Label>Remarks</Label><Input className="h-12" value={prod.remarks} onChange={(e) => setProd({ ...prod, remarks: e.target.value })} data-testid="prod-remarks" /></div>
            <Button className="h-12 w-full" onClick={submitProduction} data-testid="prod-submit-btn">Record Production</Button>
          </div>
          <DataTable testid="production-table" exportName="production-batches.csv" searchKeys={['batch_no', 'sub_recipe_name', 'chef']}
            columns={[
              { key: 'batch_no', label: 'Batch #' },
              { key: 'date', label: 'Date' },
              { key: 'sub_recipe_name', label: 'Sub-Recipe' },
              { key: 'kitchen_name', label: 'Kitchen' },
              { key: 'produced_qty', label: 'Produced', numeric: true, render: (r) => `${r.produced_qty} ${r.unit}` },
              { key: 'consumed', label: 'Raw Consumed', render: (r) => r.consumed.map((c) => `${c.item_name} ${c.qty}${c.unit}`).join(', ') },
              { key: 'yield_pct', label: 'Yield %', numeric: true },
              { key: 'cost', label: 'Cost', numeric: true, render: (r) => inr(r.cost) },
              { key: 'chef', label: 'Chef' },
            ]}
            rows={productions} />
        </TabsContent>

        <TabsContent value="closing">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 sm:p-6" data-testid="closing-controls">
            <div className="space-y-2"><Label>Date</Label><Input type="date" className="h-12" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} data-testid="closing-date" /></div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={closingLoc} onValueChange={setClosingLoc}>
                <SelectTrigger className="h-12 w-56" data-testid="closing-location"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="h-12" onClick={loadPreview} data-testid="closing-load-btn">Load Day Sheet</Button>
            {preview?.locked && <span className="rounded-full border border-[#EF4444] bg-[#FEE2E2] px-3 py-1.5 text-sm font-semibold text-[#991B1B]" data-testid="closing-locked-badge">Day Locked</span>}
          </div>

          {preview && (
            <div className="mb-6 rounded-xl border bg-card" data-testid="closing-sheet">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="px-3 py-3">Item</th><th className="px-2 py-3 text-right">Opening</th><th className="px-2 py-3 text-right">Receipts</th><th className="px-2 py-3 text-right">Transfers In</th><th className="px-2 py-3 text-right">Production</th><th className="px-2 py-3 text-right">Issues</th><th className="px-2 py-3 text-right">Consumption</th><th className="px-2 py-3 text-right">Wastage</th><th className="px-2 py-3 text-right">Expected</th><th className="px-2 py-3 text-right">Physical</th><th className="px-2 py-3 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => {
                      const phys = physical[r.item_id];
                      const variance = phys !== undefined && phys !== '' ? Math.round((+phys - r.expected) * 1000) / 1000 : null;
                      const vpct = variance !== null && r.expected ? Math.round((variance / r.expected) * 10000) / 100 : null;
                      return (
                        <tr key={r.item_id} className="border-b last:border-0" data-testid={`closing-row-${r.item_code}`}>
                          <td className="px-3 py-2">{r.item_name} <span className="text-xs text-muted-foreground">({r.unit})</span></td>
                          <td className="px-2 py-2 text-right tabular">{r.opening}</td>
                          <td className="px-2 py-2 text-right tabular text-[#166534]">{r.receipts}</td>
                          <td className="px-2 py-2 text-right tabular text-[#166534]">{r.transfers_in}</td>
                          <td className="px-2 py-2 text-right tabular text-[#166534]">{r.production}</td>
                          <td className="px-2 py-2 text-right tabular text-[#991B1B]">{r.issues}</td>
                          <td className="px-2 py-2 text-right tabular text-[#991B1B]">{r.consumption}</td>
                          <td className="px-2 py-2 text-right tabular text-[#991B1B]">{r.wastage}</td>
                          <td className="px-2 py-2 text-right font-bold tabular">{r.expected}</td>
                          <td className="px-2 py-2 text-right">
                            <Input type="number" className="ml-auto h-10 w-24 text-right" value={phys ?? ''} onChange={(e) => setPhysical({ ...physical, [r.item_id]: e.target.value })} data-testid={`physical-${r.item_code}`} />
                          </td>
                          <td className={`px-2 py-2 text-right font-semibold tabular ${vpct !== null && Math.abs(vpct) > (preview.tolerance || 2) ? 'text-[#991B1B]' : 'text-[#166534]'}`}>
                            {variance !== null ? `${variance} (${vpct}%)` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!preview.locked && (
                <div className="border-t p-4">
                  <Button className="h-12 px-8" onClick={submitClosing} data-testid="closing-submit-btn">Submit Closing</Button>
                </div>
              )}
            </div>
          )}

          <h3 className="mb-3 text-lg font-semibold">Closing History</h3>
          <DataTable testid="closings-table" searchKeys={['date', 'location_name']}
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'location_name', label: 'Location' },
              { key: 'items', label: 'Items Closed', numeric: true, render: (r) => r.items.length },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'created_by', label: 'Submitted By' },
              { key: 'approved_by', label: 'Approved By', render: (r) => r.approved_by || '-' },
              {
                key: 'actions', label: 'Actions', render: (r) => (
                  <div className="flex items-center gap-2">
                    {r.status === 'submitted' && <Button size="sm" onClick={() => approveClosing(r.id)} data-testid={`approve-closing-${r.date}`}>Approve & Lock</Button>}
                    {r.status === 'approved' && (
                      <div className="flex items-center gap-1">
                        <Input className="h-9 w-36" placeholder="Reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} data-testid={`reopen-reason-${r.date}`} />
                        <Button size="sm" variant="outline" onClick={() => reopenDay(r.date, r.location_id)} data-testid={`reopen-${r.date}`}>Reopen</Button>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
            rows={closings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
