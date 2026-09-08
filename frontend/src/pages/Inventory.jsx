import { useEffect, useState } from 'react';
import { api, errMsg, inr } from '../lib/api';
import { DataTable, PageHeader, StockBadge } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

function StockView({ locationId, testid }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (locationId) api.get(`/inventory/stock?location_id=${locationId}`).then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [locationId]);
  return (
    <DataTable testid={testid} exportName={`${testid}.csv`} searchKeys={['item_name', 'item_code', 'category']}
      columns={[
        { key: 'item_code', label: 'Code' },
        { key: 'item_name', label: 'Item' },
        { key: 'category', label: 'Category' },
        { key: 'stock', label: 'Current Stock', numeric: true, render: (r) => <b className="tabular">{r.stock} {r.unit}</b> },
        { key: 'min_stock', label: 'Min', numeric: true, render: (r) => `${r.min_stock} ${r.unit}` },
        { key: 'reorder_level', label: 'Reorder', numeric: true, render: (r) => `${r.reorder_level} ${r.unit}` },
        { key: 'value', label: 'Value', numeric: true, render: (r) => inr(r.value) },
        { key: 'status', label: 'Status', render: (r) => <StockBadge status={r.status} /> },
      ]}
      rows={rows} />
  );
}

export default function Inventory() {
  const [kitchens, setKitchens] = useState([]);
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState({ item_id: 'all', location_id: 'all', date_from: '', date_to: '' });
  const [transfer, setTransfer] = useState({ from_location_id: '', to_location_id: '', brand_id: '', remarks: '', items: [{ item_id: '', qty: 0, unit: 'KG' }] });
  const [adjustment, setAdjustment] = useState({ location_id: '', item_id: '', qty: 0, unit: 'KG', direction: 'in', reason: '' });
  const [batches, setBatches] = useState([]);
  const [batchLoc, setBatchLoc] = useState('');
  const [reorder, setReorder] = useState([]);
  const [reorderLoc, setReorderLoc] = useState('all');
  const [reorderLoading, setReorderLoading] = useState(false);

  useEffect(() => {
    api.get('/kitchens').then((r) => setKitchens(r.data.filter((k) => k.active))).catch(() => {});
    api.get('/items').then((r) => setItems(r.data.filter((i) => i.active))).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  const locByType = (t) => kitchens.filter((k) => k.type === t)[0];

  const loadLedger = () => {
    const p = new URLSearchParams();
    if (ledgerFilter.item_id !== 'all') p.set('item_id', ledgerFilter.item_id);
    if (ledgerFilter.location_id !== 'all') p.set('location_id', ledgerFilter.location_id);
    if (ledgerFilter.date_from) p.set('date_from', ledgerFilter.date_from);
    if (ledgerFilter.date_to) p.set('date_to', ledgerFilter.date_to);
    api.get(`/inventory/ledger?${p}`).then((r) => setLedger(r.data)).catch((e) => toast.error(errMsg(e)));
  };
  useEffect(() => { loadLedger(); }, [ledgerFilter]);

  const loadBatches = (locId) => {
    setBatchLoc(locId);
    if (locId) api.get(`/inventory/batches?location_id=${locId}`).then((r) => setBatches(r.data)).catch((e) => toast.error(errMsg(e)));
  };

  const loadReorder = () => {
    setReorderLoading(true);
    api.get(`/reports/reorder${reorderLoc !== 'all' ? `?location_id=${reorderLoc}` : ''}`)
      .then((r) => setReorder(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setReorderLoading(false));
  };
  useEffect(() => { loadReorder(); /* eslint-disable-next-line */ }, [reorderLoc]);

  const submitTransfer = async () => {
    try {
      const lines = transfer.items.filter((l) => l.item_id && +l.qty > 0).map((l) => ({ ...l, qty: +l.qty }));
      if (!lines.length) return toast.error('Add at least one item');
      await api.post('/inventory/transfer', { ...transfer, items: lines });
      toast.success('Stock transferred — ledger updated (Transfer Out + Transfer In)');
      setTransfer({ from_location_id: '', to_location_id: '', brand_id: '', remarks: '', items: [{ item_id: '', qty: 0, unit: 'KG' }] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const submitAdjustment = async () => {
    try {
      await api.post('/inventory/adjustment', { ...adjustment, qty: +adjustment.qty });
      toast.success('Adjustment posted to ledger');
      setAdjustment({ location_id: '', item_id: '', qty: 0, unit: 'KG', direction: 'in', reason: '' });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="inventory-page">
      <PageHeader title="Inventory" subtitle="Real-time stock per location — always calculated from the immutable transaction ledger" testid="inventory-title" />
      <Tabs defaultValue="store">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="store" data-testid="tab-inv-store">Store Stock</TabsTrigger>
          <TabsTrigger value="base" data-testid="tab-inv-base">Base Kitchen</TabsTrigger>
          <TabsTrigger value="normal" data-testid="tab-inv-normal">Normal Kitchen</TabsTrigger>
          <TabsTrigger value="rd" data-testid="tab-inv-rd">R&D Stock</TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-inv-ledger">Inventory Ledger</TabsTrigger>
          <TabsTrigger value="transfer" data-testid="tab-inv-transfer">Stock Transfer</TabsTrigger>
          <TabsTrigger value="adjustment" data-testid="tab-inv-adjustment">Adjustments</TabsTrigger>
          <TabsTrigger value="reorder" data-testid="tab-inv-reorder">Reorder List</TabsTrigger>
          <TabsTrigger value="batches" data-testid="tab-inv-batches">Batches / FEFO</TabsTrigger>
        </TabsList>

        {['store', 'base_kitchen', 'normal_kitchen', 'rd'].map((t, i) => (
          <TabsContent key={t} value={['store', 'base', 'normal', 'rd'][i]}>
            {locByType(t) ? <StockView locationId={locByType(t).id} testid={`stock-${t}`} /> : <p className="text-muted-foreground">No location of this type configured.</p>}
          </TabsContent>
        ))}

        <TabsContent value="ledger">
          <DataTable testid="ledger-table" exportName="inventory-ledger.csv" searchKeys={['item_name', 'txn_no', 'reference_no', 'txn_type']}
            filters={
              <>
                <Select value={ledgerFilter.item_id} onValueChange={(v) => setLedgerFilter({ ...ledgerFilter, item_id: v })}>
                  <SelectTrigger className="h-11 w-44" data-testid="ledger-item-filter"><SelectValue placeholder="Item" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Items</SelectItem>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={ledgerFilter.location_id} onValueChange={(v) => setLedgerFilter({ ...ledgerFilter, location_id: v })}>
                  <SelectTrigger className="h-11 w-44" data-testid="ledger-location-filter"><SelectValue placeholder="Location" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Locations</SelectItem>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" className="h-11 w-40" value={ledgerFilter.date_from} onChange={(e) => setLedgerFilter({ ...ledgerFilter, date_from: e.target.value })} data-testid="ledger-date-from" />
                <Input type="date" className="h-11 w-40" value={ledgerFilter.date_to} onChange={(e) => setLedgerFilter({ ...ledgerFilter, date_to: e.target.value })} data-testid="ledger-date-to" />
              </>
            }
            columns={[
              { key: 'txn_no', label: 'Txn #' },
              { key: 'date', label: 'Date' },
              { key: 'item_name', label: 'Item' },
              { key: 'txn_type', label: 'Type', render: (r) => <span className="capitalize">{r.txn_type.replace(/_/g, ' ')}</span> },
              { key: 'display_qty', label: 'Qty', numeric: true, render: (r) => `${r.display_qty} ${r.display_unit}` },
              { key: 'from_location', label: 'From' },
              { key: 'to_location', label: 'To' },
              { key: 'brand_name', label: 'Brand' },
              { key: 'reference_no', label: 'Reference' },
              { key: 'created_by', label: 'By' },
              { key: 'value', label: 'Value', numeric: true, render: (r) => inr(r.value) },
              { key: 'remarks', label: 'Remarks' },
            ]}
            rows={ledger} />
        </TabsContent>

        <TabsContent value="transfer">
          <div className="max-w-3xl rounded-xl border bg-card p-6 space-y-4" data-testid="transfer-form">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>From Location</Label>
                <Select value={transfer.from_location_id} onValueChange={(v) => setTransfer({ ...transfer, from_location_id: v })}>
                  <SelectTrigger className="h-12" data-testid="transfer-from"><SelectValue placeholder="From" /></SelectTrigger>
                  <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Location</Label>
                <Select value={transfer.to_location_id} onValueChange={(v) => setTransfer({ ...transfer, to_location_id: v })}>
                  <SelectTrigger className="h-12" data-testid="transfer-to"><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand (optional)</Label>
                <Select value={transfer.brand_id} onValueChange={(v) => setTransfer({ ...transfer, brand_id: v === 'shared' ? '' : v })}>
                  <SelectTrigger className="h-12" data-testid="transfer-brand"><SelectValue placeholder="Shared" /></SelectTrigger>
                  <SelectContent><SelectItem value="shared">Shared</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {transfer.items.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
                <div className="col-span-12 sm:col-span-6 space-y-1">
                  <Label className="text-xs">Item</Label>
                  <Select value={l.item_id} onValueChange={(v) => { const it = items.find((x) => x.id === v); setTransfer((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, item_id: v, unit: it?.consumption_unit || 'KG' } : x)) })); }}>
                    <SelectTrigger className="h-11" data-testid={`transfer-item-${i}`}><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-5 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min="0" className="h-11" value={l.qty} onChange={(e) => setTransfer((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} data-testid={`transfer-qty-${i}`} />
                </div>
                <div className="col-span-5 sm:col-span-3 space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select value={l.unit} onValueChange={(v) => setTransfer((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, unit: v } : x)) }))}>
                    <SelectTrigger className="h-11" data-testid={`transfer-unit-${i}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setTransfer((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="h-11" onClick={() => setTransfer((f) => ({ ...f, items: [...f.items, { item_id: '', qty: 0, unit: 'KG' }] }))} data-testid="transfer-add-item"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            <div className="space-y-2"><Label>Remarks</Label><Input className="h-12" value={transfer.remarks} onChange={(e) => setTransfer({ ...transfer, remarks: e.target.value })} data-testid="transfer-remarks" /></div>
            <Button className="h-12 w-full" onClick={submitTransfer} data-testid="transfer-submit-btn">Transfer Stock</Button>
          </div>
        </TabsContent>

        <TabsContent value="adjustment">
          <div className="max-w-xl rounded-xl border bg-card p-6 space-y-4" data-testid="adjustment-form">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={adjustment.location_id} onValueChange={(v) => setAdjustment({ ...adjustment, location_id: v })}>
                <SelectTrigger className="h-12" data-testid="adjustment-location"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={adjustment.item_id} onValueChange={(v) => { const it = items.find((x) => x.id === v); setAdjustment({ ...adjustment, item_id: v, unit: it?.consumption_unit || 'KG' }); }}>
                <SelectTrigger className="h-12" data-testid="adjustment-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={adjustment.direction} onValueChange={(v) => setAdjustment({ ...adjustment, direction: v })}>
                  <SelectTrigger className="h-12" data-testid="adjustment-direction"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in">Add (+)</SelectItem><SelectItem value="out">Remove (−)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Qty</Label><Input type="number" min="0" className="h-12" value={adjustment.qty} onChange={(e) => setAdjustment({ ...adjustment, qty: e.target.value })} data-testid="adjustment-qty" /></div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={adjustment.unit} onValueChange={(v) => setAdjustment({ ...adjustment, unit: v })}>
                  <SelectTrigger className="h-12" data-testid="adjustment-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Reason (required)</Label><Input className="h-12" value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} data-testid="adjustment-reason" /></div>
            <Button className="h-12 w-full" onClick={submitAdjustment} data-testid="adjustment-submit-btn">Post Adjustment</Button>
          </div>
        </TabsContent>

        <TabsContent value="reorder">
          <div className="mb-4 rounded-xl border border-[#EAB308] bg-[#FEF9C3] p-4 text-sm text-[#854D0E]" data-testid="reorder-info">
            Daily reorder list — items at or below their reorder / minimum level per kitchen. <b>Suggested Order</b> tops each item back up to its max (par) level.
          </div>
          <DataTable testid="reorder-table" exportName="reorder-list.csv" searchKeys={['item_name', 'item_code', 'category', 'location']}
            filters={
              <Select value={reorderLoc} onValueChange={setReorderLoc}>
                <SelectTrigger className="h-11 w-52" data-testid="reorder-location-filter"><SelectValue placeholder="All Locations" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Locations</SelectItem>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            }
            columns={[
              { key: 'location', label: 'Kitchen' },
              { key: 'item_code', label: 'Code' },
              { key: 'item_name', label: 'Item' },
              { key: 'category', label: 'Category' },
              { key: 'stock', label: 'Current', numeric: true, render: (r) => <b className="tabular">{r.stock} {r.unit}</b> },
              { key: 'reorder_level', label: 'Reorder', numeric: true, render: (r) => `${r.reorder_level} ${r.unit}` },
              { key: 'max_stock', label: 'Max/Par', numeric: true, render: (r) => `${r.max_stock} ${r.unit}` },
              { key: 'suggested_order_qty', label: 'Suggested Order', numeric: true, render: (r) => <b className="tabular text-[#166534]">{r.suggested_order_qty} {r.unit}</b> },
              { key: 'status', label: 'Status', render: (r) => <StockBadge status={r.status} /> },
            ]}
            rows={reorderLoading ? [] : reorder} />
        </TabsContent>

        <TabsContent value="batches">
          <div className="mb-4 max-w-xs space-y-2">
            <Label>Location</Label>
            <Select value={batchLoc} onValueChange={loadBatches}>
              <SelectTrigger className="h-12" data-testid="batches-location"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DataTable testid="batches-table" searchKeys={['item_name', 'batch_number']}
            columns={[
              { key: 'item_name', label: 'Item' },
              { key: 'batch_number', label: 'Batch' },
              { key: 'received_date', label: 'Received' },
              { key: 'expiry_date', label: 'Expiry', render: (r) => {
                  const soon = r.expiry_date && r.expiry_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
                  return <span className={soon ? 'rounded bg-[#FEE2E2] px-2 py-0.5 font-semibold text-[#991B1B]' : ''}>{r.expiry_date || '—'}</span>;
                } },
              { key: 'remaining', label: 'Available (FIFO)', numeric: true, render: (r) => `${r.remaining} ${r.unit}` },
            ]}
            rows={batches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
