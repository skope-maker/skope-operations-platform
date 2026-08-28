import { useEffect, useState } from 'react';
import { api, errMsg, inr, fileToDataUrl } from '../lib/api';
import { DataTable, PageHeader, StatusBadge } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, FileText } from 'lucide-react';

const emptyLine = () => ({ item_id: '', ordered_qty: 0, received_qty: 0, unit: 'KG', rate: 0, tax: 0, batch_number: '', expiry_date: '', remarks: '' });

export default function Procurement() {
  const [receipts, setReceipts] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), receipt_date: new Date().toISOString().slice(0, 10), remarks: '', attachment: '', attachment_name: '', items: [emptyLine()] });
  const [approval, setApproval] = useState(null);
  const [approvalLines, setApprovalLines] = useState([]);
  const [approvalRemarks, setApprovalRemarks] = useState('');

  const load = () => {
    api.get('/procurement/receipts').then((r) => setReceipts(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/items').then((r) => setItems(r.data.filter((i) => i.active))).catch(() => {});
    api.get('/suppliers').then((r) => setSuppliers(r.data.filter((s) => s.active))).catch(() => {});
  };
  useEffect(load, []);

  const setLine = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('File must be under 2MB');
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({ ...f, attachment: dataUrl, attachment_name: file.name }));
    toast.success('Invoice attached');
  };

  const submit = async () => {
    try {
      if (!form.attachment) return toast.error('Invoice photo/PDF is mandatory');
      const lines = form.items.filter((l) => l.item_id && l.received_qty > 0).map((l) => ({ ...l, ordered_qty: +l.ordered_qty, received_qty: +l.received_qty, rate: +l.rate, tax: +l.tax }));
      if (!lines.length) return toast.error('Add at least one received item');
      await api.post('/procurement/receipts', { ...form, items: lines });
      toast.success('Purchase receipt created — pending approval');
      setForm({ supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), receipt_date: new Date().toISOString().slice(0, 10), remarks: '', attachment: '', attachment_name: '', items: [emptyLine()] });
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const openApproval = async (id) => {
    const r = await api.get(`/procurement/receipts/${id}`);
    setApproval(r.data);
    setApprovalLines(r.data.items.map((i) => i.received_qty));
    setApprovalRemarks('');
  };

  const decide = async (action) => {
    try {
      await api.post(`/procurement/receipts/${approval.id}/approve`, {
        action,
        items: approvalLines.map((q, index) => ({ index, approved_qty: +q })),
        remarks: approvalRemarks,
      });
      toast.success(`Receipt ${action === 'reject' ? 'rejected' : 'approved'} — approved quantities entered store stock`);
      setApproval(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const pending = receipts.filter((r) => r.status === 'pending');

  return (
    <div data-testid="procurement-page">
      <PageHeader title="Procurement" subtitle="Receive purchases with invoice upload → approve → stock enters store" testid="procurement-title" />
      <Tabs defaultValue="new">
        <TabsList className="mb-4">
          <TabsTrigger value="new" data-testid="tab-pr-new">Purchase Receipt</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pr-pending">Pending Approval {pending.length > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-pr-history">Purchase History</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <div className="rounded-xl border bg-card p-6 space-y-5" data-testid="receipt-form">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger className="h-12" data-testid="receipt-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Invoice Number</Label><Input className="h-12" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} data-testid="receipt-invoice-no" /></div>
              <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" className="h-12" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} data-testid="receipt-invoice-date" /></div>
              <div className="space-y-2"><Label>Receipt Date</Label><Input type="date" className="h-12" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} data-testid="receipt-date" /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Invoice Photo / PDF (mandatory)</Label>
                <div className="flex items-center gap-3">
                  <Input type="file" accept="image/*,application/pdf" className="h-12 pt-2.5" onChange={onFile} data-testid="receipt-attachment" />
                  {form.attachment_name && <span className="flex items-center gap-1 text-sm text-[#166534]"><FileText className="h-4 w-4" />{form.attachment_name}</span>}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Items</Label>
              {form.items.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
                  <div className="col-span-12 sm:col-span-3 space-y-1">
                    <Label className="text-xs">Item</Label>
                    <Select value={l.item_id} onValueChange={(v) => { const it = items.find((x) => x.id === v); setLine(i, { item_id: v, unit: it?.purchase_unit || 'KG', rate: it?.rate || 0 }); }}>
                      <SelectTrigger className="h-11" data-testid={`receipt-item-${i}`}><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name} ({it.code})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {[['ordered_qty', 'Ordered'], ['received_qty', 'Received'], ['rate', 'Rate'], ['tax', 'Tax']].map(([k, lbl]) => (
                    <div key={k} className="col-span-3 sm:col-span-1 space-y-1">
                      <Label className="text-xs">{lbl}</Label>
                      <Input type="number" min="0" className="h-11" value={l[k]} onChange={(e) => setLine(i, { [k]: e.target.value })} data-testid={`receipt-${k}-${i}`} />
                    </div>
                  ))}
                  <div className="col-span-3 sm:col-span-1 space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select value={l.unit} onValueChange={(v) => setLine(i, { unit: v })}>
                      <SelectTrigger className="h-11" data-testid={`receipt-unit-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Batch #</Label>
                    <Input className="h-11" value={l.batch_number} onChange={(e) => setLine(i, { batch_number: e.target.value })} data-testid={`receipt-batch-${i}`} />
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Expiry</Label>
                    <Input type="date" className="h-11" value={l.expiry_date} onChange={(e) => setLine(i, { expiry_date: e.target.value })} data-testid={`receipt-expiry-${i}`} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="h-11" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }))} data-testid="receipt-add-item-btn"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            </div>
            <div className="space-y-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} data-testid="receipt-remarks" /></div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold tabular" data-testid="receipt-total">
                Total: {inr(form.items.reduce((s, l) => s + (+l.received_qty || 0) * (+l.rate || 0) + (+l.tax || 0), 0))}
              </div>
              <Button className="h-12 px-8" onClick={submit} data-testid="receipt-submit-btn">Create Receipt</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <DataTable testid="pending-receipts-table" searchKeys={['receipt_no', 'supplier_name', 'invoice_number']}
            columns={[
              { key: 'receipt_no', label: 'Receipt #' },
              { key: 'receipt_date', label: 'Date' },
              { key: 'supplier_name', label: 'Supplier' },
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'items', label: 'Items', render: (r) => r.items.map((i) => `${i.item_name} ${i.received_qty}${i.unit}`).join(', ') },
              { key: 'grand_total', label: 'Amount', numeric: true, render: (r) => inr(r.grand_total) },
              { key: 'actions', label: '', render: (r) => <Button size="sm" onClick={() => openApproval(r.id)} data-testid={`review-${r.receipt_no}`}>Review</Button> },
            ]}
            rows={pending} />
        </TabsContent>

        <TabsContent value="history">
          <DataTable testid="receipt-history-table" exportName="purchase-history.csv" searchKeys={['receipt_no', 'supplier_name', 'invoice_number']}
            columns={[
              { key: 'receipt_no', label: 'Receipt #' },
              { key: 'receipt_date', label: 'Date' },
              { key: 'supplier_name', label: 'Supplier' },
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'grand_total', label: 'Amount', numeric: true, render: (r) => inr(r.grand_total) },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'created_by', label: 'Created By' },
              { key: 'approved_by', label: 'Approved By', render: (r) => r.approved_by || '—' },
              { key: 'view', label: '', render: (r) => <Button size="sm" variant="outline" onClick={() => openApproval(r.id)} data-testid={`view-${r.receipt_no}`}>View</Button> },
            ]}
            rows={receipts} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!approval} onOpenChange={() => setApproval(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{approval?.receipt_no} — Invoice {approval?.invoice_number} ({approval?.supplier_name})</DialogTitle></DialogHeader>
          {approval && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => window.open(approval.attachment, '_blank')} data-testid="view-invoice-btn">
                  <FileText className="mr-2 h-4 w-4" /> View Invoice Attachment
                </Button>
                <StatusBadge status={approval.status} />
              </div>
              <table className="w-full text-sm" data-testid="approval-lines-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="py-2">Item</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th className="text-right">Approve Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {approval.items.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{l.item_name}</td>
                      <td className="text-right tabular">{l.ordered_qty} {l.unit}</td>
                      <td className="text-right tabular">{l.received_qty} {l.unit}</td>
                      <td className="text-right tabular">{inr(l.rate)}</td>
                      <td className="text-right tabular">{inr(l.total)}</td>
                      <td className="text-right">
                        {approval.status === 'pending' ? (
                          <Input type="number" min="0" max={l.received_qty} className="ml-auto h-10 w-24 text-right" value={approvalLines[i]}
                            onChange={(e) => setApprovalLines((p) => p.map((q, j) => (j === i ? e.target.value : q)))} data-testid={`approve-qty-${i}`} />
                        ) : (
                          <span className="tabular">{l.approved_qty} {l.unit}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {approval.status === 'pending' && (
                <div className="space-y-3">
                  <Label>Approval Remarks</Label>
                  <Input className="h-12" value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} data-testid="approval-remarks" />
                  <div className="flex flex-wrap gap-3">
                    <Button className="h-12" onClick={() => decide('approve')} data-testid="approve-full-btn">Approve Full</Button>
                    <Button className="h-12" variant="secondary" onClick={() => decide('partial')} data-testid="approve-partial-btn">Approve Entered Qty (Partial)</Button>
                    <Button className="h-12" variant="destructive" onClick={() => decide('reject')} data-testid="reject-btn">Reject</Button>
                  </div>
                </div>
              )}
              {approval.approval_remarks && <p className="text-sm text-muted-foreground">Remarks: {approval.approval_remarks}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
