import { useEffect, useState } from 'react';
import { api, errMsg, inr } from '../lib/api';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const REPORTS = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'inventory', label: 'Inventory Report (Daily)' },
  { value: 'ledger', label: 'Item Ledger' },
  { value: 'brand-consumption', label: 'Brand Consumption' },
  { value: 'recipe-consumption', label: 'Recipe Consumption' },
  { value: 'variance', label: 'Variance Report' },
  { value: 'wastage', label: 'Wastage Report' },
  { value: 'procurement', label: 'Procurement Report' },
  { value: 'rd', label: 'R&D Report' },
  { value: 'food-cost', label: 'Food Cost Report' },
];

export default function Reports() {
  const [report, setReport] = useState('sales');
  const [rows, setRows] = useState([]);
  // Which report the loaded rows belong to, so stale rows are never rendered with another report's columns.
  const [rowsReport, setRowsReport] = useState('sales');
  const [brands, setBrands] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', brand_id: 'all', location_id: '', item_id: 'all', date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    api.get('/brands').then((r) => setBrands(r.data)).catch(() => {});
    api.get('/kitchens').then((r) => setKitchens(r.data)).catch(() => {});
    api.get('/items').then((r) => setItems(r.data)).catch(() => {});
  }, []);

  const run = async () => {
    try {
      const p = new URLSearchParams();
      if (report === 'inventory') {
        if (!filters.location_id) return toast.error('Select a location');
        p.set('date', filters.date);
        p.set('location_id', filters.location_id);
      } else if (report === 'ledger') {
        if (filters.item_id !== 'all') p.set('item_id', filters.item_id);
        if (filters.location_id) p.set('location_id', filters.location_id);
        if (filters.date_from) p.set('date_from', filters.date_from);
        if (filters.date_to) p.set('date_to', filters.date_to);
      } else {
        if (filters.date_from) p.set('date_from', filters.date_from);
        if (filters.date_to) p.set('date_to', filters.date_to);
        if (report === 'sales' && filters.brand_id !== 'all') p.set('brand_id', filters.brand_id);
      }
      const url = report === 'ledger' ? `/inventory/ledger?${p}` : `/reports/${report}?${p}`;
      const r = await api.get(url);
      setRows(r.data);
      setRowsReport(report);
    } catch (e) { toast.error(errMsg(e)); }
  };

  useEffect(() => { setRows([]); }, [report]);

  const columnsFor = () => {
    switch (report) {
      case 'sales':
        return [
          { key: 'sale_no', label: 'Sale #' }, { key: 'date', label: 'Date' }, { key: 'brand', label: 'Brand' },
          { key: 'product', label: 'Product' }, { key: 'qty_sold', label: 'Sold', numeric: true },
          { key: 'cancelled', label: 'Cancel', numeric: true }, { key: 'complimentary', label: 'Comp', numeric: true },
          { key: 'net_qty', label: 'Net', numeric: true }, { key: 'amount', label: 'Amount', numeric: true, render: (r) => inr(r.amount) },
          { key: 'status', label: 'Status' },
        ];
      case 'inventory':
        return [
          { key: 'item_name', label: 'Item' }, { key: 'unit', label: 'Unit' },
          { key: 'opening', label: 'Opening', numeric: true }, { key: 'receipts', label: 'Receipts', numeric: true },
          { key: 'transfers_in', label: 'Transfers In', numeric: true }, { key: 'production', label: 'Production', numeric: true },
          { key: 'issues', label: 'Issues', numeric: true }, { key: 'consumption', label: 'Consumption', numeric: true },
          { key: 'wastage', label: 'Wastage', numeric: true }, { key: 'expected', label: 'Expected Closing', numeric: true, render: (r) => <b>{r.expected}</b> },
        ];
      case 'ledger':
        return [
          { key: 'txn_no', label: 'Txn #' }, { key: 'date', label: 'Date' }, { key: 'item_name', label: 'Item' },
          { key: 'txn_type', label: 'Type', render: (r) => (r.txn_type || '').replace(/_/g, ' ') },
          { key: 'display_qty', label: 'Qty', numeric: true, render: (r) => `${r.display_qty} ${r.display_unit}` },
          { key: 'from_location', label: 'From' }, { key: 'to_location', label: 'To' },
          { key: 'brand_name', label: 'Brand' }, { key: 'reference_no', label: 'Reference' }, { key: 'created_by', label: 'By' },
        ];
      case 'brand-consumption':
        return [
          { key: 'brand', label: 'Brand' }, { key: 'item', label: 'Raw Material' },
          { key: 'qty', label: 'Consumption', numeric: true, render: (r) => `${r.qty} ${r.unit}` },
          { key: 'value', label: 'Value', numeric: true, render: (r) => inr(r.value) },
        ];
      case 'recipe-consumption':
        return [
          { key: 'product', label: 'Product' }, { key: 'sales', label: 'Sales Qty', numeric: true },
          { key: 'ingredient', label: 'Raw Ingredient' },
          { key: 'theoretical', label: 'Theoretical Consumption', numeric: true, render: (r) => `${r.theoretical} ${r.unit}` },
        ];
      case 'variance':
        return [
          { key: 'date', label: 'Date' }, { key: 'location', label: 'Location' }, { key: 'item', label: 'Item' },
          { key: 'expected', label: 'Theoretical', numeric: true, render: (r) => `${r.expected} ${r.unit}` },
          { key: 'physical', label: 'Physical', numeric: true },
          { key: 'variance', label: 'Variance', numeric: true, render: (r) => <b className={r.breach ? 'text-[#991B1B]' : 'text-[#166534]'}>{r.variance} {r.unit}</b> },
          { key: 'variance_pct', label: 'Variance %', numeric: true, render: (r) => <span className={r.breach ? 'rounded bg-[#FEE2E2] px-2 py-0.5 font-bold text-[#991B1B]' : ''}>{r.variance_pct}%</span> },
          { key: 'status', label: 'Status' },
        ];
      case 'wastage':
        return [
          { key: 'date', label: 'Date' }, { key: 'brand', label: 'Brand' }, { key: 'kitchen', label: 'Kitchen' },
          { key: 'item', label: 'Item' }, { key: 'qty', label: 'Qty', numeric: true, render: (r) => `${r.qty} ${r.unit}` },
          { key: 'reason', label: 'Reason' }, { key: 'value', label: 'Value', numeric: true, render: (r) => inr(r.value) }, { key: 'by', label: 'By' },
        ];
      case 'procurement':
        return [
          { key: 'receipt_no', label: 'Receipt #' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' },
          { key: 'invoice', label: 'Invoice' }, { key: 'item', label: 'Item' },
          { key: 'ordered', label: 'Ordered', numeric: true }, { key: 'received', label: 'Received', numeric: true },
          { key: 'approved', label: 'Approved', numeric: true }, { key: 'unit', label: 'Unit' },
          { key: 'total', label: 'Amount', numeric: true, render: (r) => inr(r.total) }, { key: 'status', label: 'Status' },
        ];
      case 'rd':
        return [
          { key: 'trial_no', label: 'Trial #' }, { key: 'date', label: 'Date' }, { key: 'brand', label: 'Brand' },
          { key: 'product', label: 'Product' },
          { key: 'items', label: 'Ingredients', render: (r) => r.items.map((i) => `${i.item_name} ${i.qty}${i.unit}`).join(', ') },
          { key: 'cost', label: 'Cost', numeric: true, render: (r) => inr(r.cost) },
          { key: 'yield_qty', label: 'Yield', numeric: true, render: (r) => `${r.yield_qty} ${r.yield_unit}` },
          { key: 'result', label: 'Result' }, { key: 'chef', label: 'Chef' },
        ];
      case 'food-cost':
        return [
          { key: 'code', label: 'Code' }, { key: 'recipe', label: 'Recipe' }, { key: 'brand', label: 'Brand' },
          { key: 'cost', label: 'Ingredient Cost', numeric: true, render: (r) => inr(r.cost) },
          { key: 'price', label: 'Selling Price', numeric: true, render: (r) => inr(r.price) },
          { key: 'food_cost_pct', label: 'Food Cost %', numeric: true, render: (r) => <b className={r.food_cost_pct > 40 ? 'text-[#991B1B]' : 'text-[#166534]'}>{r.food_cost_pct}%</b> },
        ];
      default:
        return [];
    }
  };

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" subtitle="All reports computed live from the inventory transaction ledger" testid="reports-title" />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5" data-testid="report-controls">
        <div className="space-y-2">
          <Label>Report</Label>
          <Select value={report} onValueChange={setReport}>
            <SelectTrigger className="h-12 w-64" data-testid="report-select"><SelectValue /></SelectTrigger>
            <SelectContent>{REPORTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {report === 'inventory' && (
          <>
            <div className="space-y-2"><Label>Date</Label><Input type="date" className="h-12" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} data-testid="report-date" /></div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={filters.location_id} onValueChange={(v) => setFilters({ ...filters, location_id: v })}>
                <SelectTrigger className="h-12 w-52" data-testid="report-location"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{kitchens.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        )}
        {report !== 'inventory' && report !== 'rd' && report !== 'food-cost' && (
          <>
            <div className="space-y-2"><Label>From</Label><Input type="date" className="h-12" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} data-testid="report-from" /></div>
            <div className="space-y-2"><Label>To</Label><Input type="date" className="h-12" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} data-testid="report-to" /></div>
          </>
        )}
        {report === 'sales' && (
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={filters.brand_id} onValueChange={(v) => setFilters({ ...filters, brand_id: v })}>
              <SelectTrigger className="h-12 w-44" data-testid="report-brand"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Brands</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {report === 'ledger' && (
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={filters.item_id} onValueChange={(v) => setFilters({ ...filters, item_id: v })}>
              <SelectTrigger className="h-12 w-44" data-testid="report-item"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Items</SelectItem>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <Button className="h-12 px-8" onClick={run} data-testid="report-run-btn">Run Report</Button>
      </div>
      <DataTable testid="report-table" exportName={`${report}-report.csv`} columns={columnsFor()} rows={rowsReport === report ? rows : []} />
    </div>
  );
}
