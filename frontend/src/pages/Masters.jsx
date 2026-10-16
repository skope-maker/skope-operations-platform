import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { BulkUploadDialog } from '../components/BulkUpload';

const UNIT_CODES = ['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'];
const LOC_TYPES = [['store', 'Main / Dry Store'], ['base_kitchen', 'Base Kitchen'], ['normal_kitchen', 'Normal Kitchen'], ['rd', 'R&D']];

function Field({ label, children, testid }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

export default function Masters() {
  const [brands, setBrands] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [dialog, setDialog] = useState({ type: null, record: null });
  const [form, setForm] = useState({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = () => {
    api.get('/brands').then((r) => setBrands(r.data)).catch(() => {});
    api.get('/items').then((r) => setItems(r.data)).catch(() => {});
    api.get('/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get('/units').then((r) => setUnits(r.data)).catch(() => {});
    api.get('/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
    api.get('/kitchens').then((r) => setKitchens(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const openDialog = (type, record = null) => {
    setDialog({ type, record });
    if (type === 'brand') setForm(record || { name: '', code: '', logo_url: '', kitchen_location: '', status: 'active', description: '' });
    if (type === 'item') setForm(record || { code: '', name: '', category_id: '', subcategory: '', purchase_unit: 'KG', consumption_unit: 'GM', conversion_factor: 1, min_stock: 0, reorder_level: 0, max_stock: 0, supplier_id: '', storage_location: '', batch_tracking: false, expiry_tracking: false, active: true, is_sub_recipe: false, rate: 0 });
    if (type === 'category') setForm(record ? { ...record, subcategories: (record.subcategories || []).join(', ') } : { name: '', subcategories: '' });
    if (type === 'unit') setForm(record || { name: '', code: '', family: 'weight', factor: 1 });
    if (type === 'supplier') setForm(record || { name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', payment_terms: '', active: true });
    if (type === 'kitchen') setForm(record || { name: '', code: '', type: 'store', parent_id: '', active: true });
  };

  const save = async () => {
    const { type, record } = dialog;
    try {
      let payload = { ...form };
      if (type === 'item') payload = { ...payload, min_stock: +form.min_stock, reorder_level: +form.reorder_level, max_stock: +form.max_stock, rate: +form.rate, conversion_factor: +form.conversion_factor };
      if (type === 'category') payload = { name: form.name, subcategories: form.subcategories.split(',').map((s) => s.trim()).filter(Boolean) };
      if (type === 'unit') payload = { ...form, factor: +form.factor };
      const path = { brand: '/brands', item: '/items', category: '/categories', unit: '/units', supplier: '/suppliers', kitchen: '/kitchens' }[type];
      if (record) await api.put(`${path}/${record.id}`, payload);
      else await api.post(path, payload);
      toast.success(`${type} ${record ? 'updated' : 'created'}`);
      setDialog({ type: null, record: null });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const [confirm, confirmNode] = useConfirm();

  const remove = async (type, id, label) => {
    const ok = await confirm({
      title: `Delete this ${type}?`,
      description: `Are you sure you want to delete "${label}"? This action cannot be undone. If the record is used by other entries it will be archived instead, so history stays intact.`,
    });
    if (!ok) return;
    const path = { brand: '/brands', item: '/items', category: '/categories', unit: '/units', supplier: '/suppliers', kitchen: '/kitchens' }[type];
    try {
      const r = await api.delete(`${path}/${id}`);
      toast.success(r.data?.message || 'Deleted');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const editBtn = (type, r, tid) => (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => openDialog(type, r)} data-testid={`edit-${tid}`}><Pencil className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" onClick={() => remove(type, r.id, r.name || r.code)} data-testid={`delete-${tid}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );

  const f = (k) => form[k] ?? '';
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div data-testid="masters-page">
      <PageHeader title="Masters" subtitle="Brands (companies), items, categories, units, suppliers and kitchen locations" testid="masters-title" />
      <Tabs defaultValue="brands">
        <TabsList className="mb-4">
          {[['brands', 'Brands'], ['items', 'Items'], ['categories', 'Categories'], ['units', 'Units'], ['suppliers', 'Suppliers'], ['kitchens', 'Kitchens']].map(([v, l]) => (
            <TabsTrigger key={v} value={v} data-testid={`tab-m-${v}`}>{l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="brands">
          <div className="mb-4"><Button className="h-12" onClick={() => openDialog('brand')} data-testid="new-brand-btn"><Plus className="mr-2 h-5 w-5" /> New Brand</Button></div>
          <DataTable testid="brands-table" searchKeys={['name', 'code']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Brand Name' },
              { key: 'kitchen_location', label: 'Kitchen Location' },
              { key: 'status', label: 'Status', render: (r) => <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${r.status === 'active' ? 'border-[#22C55E] bg-[#DCFCE7] text-[#166534]' : 'border-border bg-secondary text-muted-foreground'}`}>{r.status}</span> },
              { key: 'description', label: 'Description' },
              { key: 'actions', label: '', render: (r) => editBtn('brand', r, `brand-${r.code}`) },
            ]}
            rows={brands} />
        </TabsContent>

        <TabsContent value="items">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button className="h-12" onClick={() => openDialog('item')} data-testid="new-item-btn"><Plus className="mr-2 h-5 w-5" /> New Item</Button>
            <Button variant="outline" className="h-12" onClick={() => setBulkOpen(true)} data-testid="bulk-item-btn"><Upload className="mr-2 h-5 w-5" /> Bulk Upload Items</Button>
          </div>
          <DataTable testid="items-table" exportName="items.csv" searchKeys={['name', 'code', 'category_name']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Item' },
              { key: 'category_name', label: 'Category' },
              { key: 'purchase_unit', label: 'Purchase' },
              { key: 'consumption_unit', label: 'Consumption' },
              { key: 'min_stock', label: 'Min', numeric: true },
              { key: 'reorder_level', label: 'Reorder', numeric: true },
              { key: 'rate', label: 'Rate', numeric: true, render: (r) => `₹${r.rate}/${r.purchase_unit}` },
              { key: 'active', label: 'Status', render: (r) => (r.active ? <span className="text-[#166534] font-semibold">Active</span> : <span className="text-muted-foreground">Inactive</span>) },
              { key: 'actions', label: '', render: (r) => editBtn('item', r, `item-${r.code}`) },
            ]}
            rows={items} />
        </TabsContent>

        <TabsContent value="categories">
          <div className="mb-4"><Button className="h-12" onClick={() => openDialog('category')} data-testid="new-category-btn"><Plus className="mr-2 h-5 w-5" /> New Category</Button></div>
          <DataTable testid="categories-table" searchKeys={['name']}
            columns={[
              { key: 'name', label: 'Category' },
              { key: 'subcategories', label: 'Subcategories', render: (r) => (r.subcategories || []).join(', ') },
              { key: 'actions', label: '', render: (r) => editBtn('category', r, `cat-${r.name}`) },
            ]}
            rows={categories} />
        </TabsContent>

        <TabsContent value="units">
          <div className="mb-4"><Button className="h-12" onClick={() => openDialog('unit')} data-testid="new-unit-btn"><Plus className="mr-2 h-5 w-5" /> New Unit</Button></div>
          <DataTable testid="units-table" searchKeys={['name', 'code']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Unit' },
              { key: 'family', label: 'Family' },
              { key: 'factor', label: 'Base Factor', numeric: true },
              { key: 'actions', label: '', render: (r) => editBtn('unit', r, `unit-${r.code}`) },
            ]}
            rows={units} />
        </TabsContent>

        <TabsContent value="suppliers">
          <div className="mb-4"><Button className="h-12" onClick={() => openDialog('supplier')} data-testid="new-supplier-btn"><Plus className="mr-2 h-5 w-5" /> New Supplier</Button></div>
          <DataTable testid="suppliers-table" exportName="suppliers.csv" searchKeys={['name', 'contact_person', 'gst_number']}
            columns={[
              { key: 'name', label: 'Supplier' },
              { key: 'contact_person', label: 'Contact' },
              { key: 'phone', label: 'Phone' },
              { key: 'gst_number', label: 'GST' },
              { key: 'payment_terms', label: 'Terms' },
              { key: 'active', label: 'Status', render: (r) => (r.active ? 'Active' : 'Inactive') },
              { key: 'actions', label: '', render: (r) => editBtn('supplier', r, `sup-${r.name}`) },
            ]}
            rows={suppliers} />
        </TabsContent>

        <TabsContent value="kitchens">
          <div className="mb-4"><Button className="h-12" onClick={() => openDialog('kitchen')} data-testid="new-kitchen-btn"><Plus className="mr-2 h-5 w-5" /> New Location</Button></div>
          <DataTable testid="kitchens-table" searchKeys={['name', 'code']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Location' },
              { key: 'type', label: 'Type', render: (r) => r.type.replace(/_/g, ' ') },
              { key: 'parent_name', label: 'Supply Source', render: (r) => r.parent_name || (r.type === 'store' ? '-' : 'Main Store') },
              { key: 'active', label: 'Status', render: (r) => (r.active ? 'Active' : 'Inactive') },
              { key: 'actions', label: '', render: (r) => editBtn('kitchen', r, `kitchen-${r.code}`) },
            ]}
            rows={kitchens} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog.type} onOpenChange={() => setDialog({ type: null, record: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="capitalize">{dialog.record ? 'Edit' : 'New'} {dialog.type}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="master-form">
            {dialog.type === 'brand' && (
              <>
                <Field label="Brand Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="brand-name" /></Field>
                <Field label="Brand Code"><Input className="h-12" value={f('code')} onChange={(e) => set('code', e.target.value)} data-testid="brand-code" /></Field>
                <Field label="Kitchen Location"><Input className="h-12" value={f('kitchen_location')} onChange={(e) => set('kitchen_location', e.target.value)} data-testid="brand-location" /></Field>
                <Field label="Status">
                  <Select value={f('status')} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger className="h-12" data-testid="brand-status"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2"><Field label="Description"><Input className="h-12" value={f('description')} onChange={(e) => set('description', e.target.value)} data-testid="brand-description" /></Field></div>
              </>
            )}
            {dialog.type === 'item' && (
              <>
                <Field label="Item Code"><Input className="h-12" value={f('code')} onChange={(e) => set('code', e.target.value)} data-testid="item-code" /></Field>
                <Field label="Item Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="item-name" /></Field>
                <Field label="Category">
                  <Select value={f('category_id')} onValueChange={(v) => set('category_id', v)}>
                    <SelectTrigger className="h-12" data-testid="item-category"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Subcategory"><Input className="h-12" value={f('subcategory')} onChange={(e) => set('subcategory', e.target.value)} data-testid="item-subcategory" /></Field>
                <Field label="Purchase Unit">
                  <Select value={f('purchase_unit')} onValueChange={(v) => set('purchase_unit', v)}>
                    <SelectTrigger className="h-12" data-testid="item-purchase-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNIT_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Consumption Unit">
                  <Select value={f('consumption_unit')} onValueChange={(v) => set('consumption_unit', v)}>
                    <SelectTrigger className="h-12" data-testid="item-consumption-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNIT_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Min Stock"><Input type="number" className="h-12" value={f('min_stock')} onChange={(e) => set('min_stock', e.target.value)} data-testid="item-min" /></Field>
                <Field label="Reorder Level"><Input type="number" className="h-12" value={f('reorder_level')} onChange={(e) => set('reorder_level', e.target.value)} data-testid="item-reorder" /></Field>
                <Field label="Max Stock"><Input type="number" className="h-12" value={f('max_stock')} onChange={(e) => set('max_stock', e.target.value)} data-testid="item-max" /></Field>
                <Field label="Rate (per purchase unit ₹)"><Input type="number" className="h-12" value={f('rate')} onChange={(e) => set('rate', e.target.value)} data-testid="item-rate" /></Field>
                <Field label="Supplier">
                  <Select value={f('supplier_id')} onValueChange={(v) => set('supplier_id', v)}>
                    <SelectTrigger className="h-12" data-testid="item-supplier"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Storage Location"><Input className="h-12" value={f('storage_location')} onChange={(e) => set('storage_location', e.target.value)} data-testid="item-storage" /></Field>
                <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!f('batch_tracking')} onCheckedChange={(v) => set('batch_tracking', v)} data-testid="item-batch" /> Batch Tracking</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!f('expiry_tracking')} onCheckedChange={(v) => set('expiry_tracking', v)} data-testid="item-expiry" /> Expiry Tracking</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!f('is_sub_recipe')} onCheckedChange={(v) => set('is_sub_recipe', v)} data-testid="item-is-sub" /> Prepared (Sub-Recipe Output)</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!f('active')} onCheckedChange={(v) => set('active', v)} data-testid="item-active" /> Active</label>
                </div>
              </>
            )}
            {dialog.type === 'category' && (
              <>
                <Field label="Category Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="category-name" /></Field>
                <Field label="Subcategories (comma separated)"><Input className="h-12" value={f('subcategories')} onChange={(e) => set('subcategories', e.target.value)} data-testid="category-subs" /></Field>
              </>
            )}
            {dialog.type === 'unit' && (
              <>
                <Field label="Unit Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="unit-name" /></Field>
                <Field label="Code"><Input className="h-12" value={f('code')} onChange={(e) => set('code', e.target.value)} data-testid="unit-code" /></Field>
                <Field label="Family">
                  <Select value={f('family')} onValueChange={(v) => set('family', v)}>
                    <SelectTrigger className="h-12" data-testid="unit-family"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="weight">Weight (base GM)</SelectItem><SelectItem value="volume">Volume (base ML)</SelectItem><SelectItem value="count">Count (base PCS)</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Factor to Base"><Input type="number" className="h-12" value={f('factor')} onChange={(e) => set('factor', e.target.value)} data-testid="unit-factor" /></Field>
              </>
            )}
            {dialog.type === 'supplier' && (
              <>
                <Field label="Supplier Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="supplier-name" /></Field>
                <Field label="Contact Person"><Input className="h-12" value={f('contact_person')} onChange={(e) => set('contact_person', e.target.value)} data-testid="supplier-contact" /></Field>
                <Field label="Phone"><Input className="h-12" value={f('phone')} onChange={(e) => set('phone', e.target.value)} data-testid="supplier-phone" /></Field>
                <Field label="Email"><Input className="h-12" value={f('email')} onChange={(e) => set('email', e.target.value)} data-testid="supplier-email" /></Field>
                <Field label="GST Number"><Input className="h-12" value={f('gst_number')} onChange={(e) => set('gst_number', e.target.value)} data-testid="supplier-gst" /></Field>
                <Field label="Payment Terms"><Input className="h-12" value={f('payment_terms')} onChange={(e) => set('payment_terms', e.target.value)} data-testid="supplier-terms" /></Field>
                <div className="sm:col-span-2"><Field label="Address"><Input className="h-12" value={f('address')} onChange={(e) => set('address', e.target.value)} data-testid="supplier-address" /></Field></div>
              </>
            )}
            {dialog.type === 'kitchen' && (
              <>
                <Field label="Location Name"><Input className="h-12" value={f('name')} onChange={(e) => set('name', e.target.value)} data-testid="kitchen-name" /></Field>
                <Field label="Code"><Input className="h-12" value={f('code')} onChange={(e) => set('code', e.target.value)} data-testid="kitchen-code" /></Field>
                <Field label="Type">
                  <Select value={f('type')} onValueChange={(v) => set('type', v)}>
                    <SelectTrigger className="h-12" data-testid="kitchen-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOC_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Supply Source (parent)">
                  <Select value={f('parent_id') || 'none'} onValueChange={(v) => set('parent_id', v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-12" data-testid="kitchen-parent"><SelectValue placeholder="Main Store (default)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Main Store (default)</SelectItem>
                      {kitchens.filter((k) => k.id !== dialog.record?.id).map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.name} ({k.type.replace(/_/g, ' ')})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2 -mt-2 text-xs text-muted-foreground">
                  Stock for this location is issued from its supply source. Chain example: Main Store → Base Kitchen → Normal Kitchen.
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={f('active') !== false} onCheckedChange={(v) => set('active', v)} data-testid="kitchen-active" /> Active</label>
                </div>
              </>
            )}
          </div>
          <Button className="mt-4 h-12 w-full" onClick={save} data-testid="master-save-btn">Save</Button>
        </DialogContent>
      </Dialog>
      {confirmNode}
      <BulkUploadDialog kind="item" open={bulkOpen} onClose={() => setBulkOpen(false)} onImported={load} />
    </div>
  );
}
