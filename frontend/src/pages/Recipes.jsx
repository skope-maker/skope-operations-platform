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

const UNITS = ['KG', 'GM', 'LTR', 'ML', 'PCS', 'PKT', 'BOX', 'BTL'];

function RecipeDialog({ open, onClose, onSaved, recipe, brands, items, subRecipes }) {
  const [form, setForm] = useState({ name: '', code: '', brand_id: '', category: '', portion_size: '', selling_unit: 'Portion', selling_price: 0, effective_date: new Date().toISOString().slice(0, 10), notes: '', items: [] });

  useEffect(() => {
    if (recipe) {
      api.get(`/recipes/${recipe.id}`).then((r) => {
        const v = r.data.versions?.[0];
        setForm({
          name: r.data.name, code: r.data.code, brand_id: r.data.brand_id, category: r.data.category || '',
          portion_size: r.data.portion_size || '', selling_unit: r.data.selling_unit || 'Portion',
          selling_price: r.data.selling_price, effective_date: new Date().toISOString().slice(0, 10), notes: '',
          items: (v?.items || []).map((l) => ({ line_type: l.sub_recipe_id ? 'sub' : 'item', item_id: l.item_id || '', sub_recipe_id: l.sub_recipe_id || '', qty: l.qty, unit: l.unit })),
        });
      });
    } else {
      setForm({ name: '', code: '', brand_id: '', category: '', portion_size: '', selling_unit: 'Portion', selling_price: 0, effective_date: new Date().toISOString().slice(0, 10), notes: '', items: [] });
    }
  }, [recipe, open]);

  const setLine = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const submit = async () => {
    try {
      const payload = { ...form, selling_price: +form.selling_price, items: form.items.filter((l) => (l.item_id || l.sub_recipe_id) && +l.qty > 0).map((l) => ({ item_id: l.line_type === 'item' ? l.item_id : '', sub_recipe_id: l.line_type === 'sub' ? l.sub_recipe_id : '', qty: +l.qty, unit: l.unit })) };
      if (!payload.items.length) return toast.error('Add at least one ingredient');
      if (recipe) {
        await api.put(`/recipes/${recipe.id}`, payload);
        toast.success('Recipe updated — new version created (old versions preserved)');
      } else {
        await api.post('/recipes', payload);
        toast.success('Recipe created (v1)');
      }
      onSaved();
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{recipe ? `Edit ${recipe.name} (creates v${(recipe.current_version || 1) + 1})` : 'New Recipe'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2 col-span-2"><Label>Recipe Name</Label><Input className="h-12" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="recipe-name" /></div>
          <div className="space-y-2"><Label>Code</Label><Input className="h-12" value={form.code} disabled={!!recipe} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="recipe-code" /></div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
              <SelectTrigger className="h-12" data-testid="recipe-brand"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Category</Label><Input className="h-12" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="recipe-category" /></div>
          <div className="space-y-2"><Label>Portion Size</Label><Input className="h-12" value={form.portion_size} onChange={(e) => setForm({ ...form, portion_size: e.target.value })} data-testid="recipe-portion" /></div>
          <div className="space-y-2"><Label>Selling Price (₹)</Label><Input type="number" min="0" className="h-12" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} data-testid="recipe-price" /></div>
          <div className="space-y-2"><Label>Effective Date</Label><Input type="date" className="h-12" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} data-testid="recipe-effective" /></div>
        </div>
        <div className="mt-4 space-y-3">
          <Label>Ingredients (raw items or sub-recipes)</Label>
          {form.items.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={l.line_type} onValueChange={(v) => setLine(i, { line_type: v, item_id: '', sub_recipe_id: '' })}>
                  <SelectTrigger className="h-11" data-testid={`recipe-line-type-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="item">Raw Item</SelectItem><SelectItem value="sub">Sub-Recipe</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-8 sm:col-span-5 space-y-1">
                <Label className="text-xs">Ingredient</Label>
                <Select value={l.line_type === 'sub' ? l.sub_recipe_id : l.item_id} onValueChange={(v) => setLine(i, l.line_type === 'sub' ? { sub_recipe_id: v } : { item_id: v })}>
                  <SelectTrigger className="h-11" data-testid={`recipe-line-ing-${i}`}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {l.line_type === 'sub'
                      ? subRecipes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      : items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5 sm:col-span-2 space-y-1"><Label className="text-xs">Qty / portion</Label><Input type="number" min="0" className="h-11" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} data-testid={`recipe-line-qty-${i}`} /></div>
              <div className="col-span-5 sm:col-span-2 space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={l.unit} onValueChange={(v) => setLine(i, { unit: v })}>
                  <SelectTrigger className="h-11" data-testid={`recipe-line-unit-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1"><Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
          <Button variant="outline" className="h-11" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { line_type: 'item', item_id: '', sub_recipe_id: '', qty: 0, unit: 'GM' }] }))} data-testid="recipe-add-line"><Plus className="mr-2 h-4 w-4" /> Add Ingredient</Button>
        </div>
        <Button className="mt-4 h-12 w-full" onClick={submit} data-testid="recipe-save-btn">{recipe ? 'Save as New Version' : 'Create Recipe'}</Button>
      </DialogContent>
    </Dialog>
  );
}

function SubRecipeDialog({ open, onClose, onSaved, sub, brands, items }) {
  const [form, setForm] = useState({ name: '', code: '', brand_id: '', output_item_id: '', yield_qty: 0, yield_unit: 'KG', items: [] });

  useEffect(() => {
    if (sub) {
      setForm({ name: sub.name, code: sub.code, brand_id: sub.brand_id || '', output_item_id: sub.output_item_id, yield_qty: sub.yield_qty, yield_unit: sub.yield_unit, items: sub.items.map((i) => ({ item_id: i.item_id, qty: i.qty, unit: i.unit })) });
    } else {
      setForm({ name: '', code: '', brand_id: '', output_item_id: '', yield_qty: 0, yield_unit: 'KG', items: [] });
    }
  }, [sub, open]);

  const submit = async () => {
    try {
      const payload = { ...form, yield_qty: +form.yield_qty, items: form.items.filter((l) => l.item_id && +l.qty > 0).map((l) => ({ ...l, qty: +l.qty })) };
      if (!payload.output_item_id) return toast.error('Select output item');
      if (!payload.items.length) return toast.error('Add at least one ingredient');
      if (sub) {
        await api.put(`/subrecipes/${sub.id}`, payload);
        toast.success('Sub-recipe updated');
      } else {
        await api.post('/subrecipes', payload);
        toast.success('Sub-recipe created — yield calculated automatically');
      }
      onSaved();
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sub ? 'Edit Sub-Recipe' : 'New Sub-Recipe'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label>Name</Label><Input className="h-12" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="sub-name" /></div>
          <div className="space-y-2"><Label>Code</Label><Input className="h-12" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="sub-code" /></div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v === 'shared' ? '' : v })}>
              <SelectTrigger className="h-12" data-testid="sub-brand"><SelectValue placeholder="Shared" /></SelectTrigger>
              <SelectContent><SelectItem value="shared">Shared</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Output Item (produced)</Label>
            <Select value={form.output_item_id} onValueChange={(v) => setForm({ ...form, output_item_id: v })}>
              <SelectTrigger className="h-12" data-testid="sub-output"><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}{it.is_sub_recipe ? ' (prepared)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Final Yield Qty</Label><Input type="number" min="0" className="h-12" value={form.yield_qty} onChange={(e) => setForm({ ...form, yield_qty: e.target.value })} data-testid="sub-yield" /></div>
          <div className="space-y-2">
            <Label>Yield Unit</Label>
            <Select value={form.yield_unit} onValueChange={(v) => setForm({ ...form, yield_unit: v })}>
              <SelectTrigger className="h-12" data-testid="sub-yield-unit"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <Label>Raw Ingredients (input batch)</Label>
          {form.items.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <Label className="text-xs">Ingredient</Label>
                <Select value={l.item_id} onValueChange={(v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, item_id: v } : x)) }))}>
                  <SelectTrigger className="h-11" data-testid={`sub-line-item-${i}`}><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-5 sm:col-span-2 space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min="0" className="h-11" value={l.qty} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} data-testid={`sub-line-qty-${i}`} /></div>
              <div className="col-span-5 sm:col-span-3 space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={l.unit} onValueChange={(v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, unit: v } : x)) }))}>
                  <SelectTrigger className="h-11" data-testid={`sub-line-unit-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1"><Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
          <Button variant="outline" className="h-11" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { item_id: '', qty: 0, unit: 'KG' }] }))} data-testid="sub-add-line"><Plus className="mr-2 h-4 w-4" /> Add Ingredient</Button>
        </div>
        <Button className="mt-4 h-12 w-full" onClick={submit} data-testid="sub-save-btn">{sub ? 'Save Sub-Recipe' : 'Create Sub-Recipe'}</Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [subRecipes, setSubRecipes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [items, setItems] = useState([]);
  const [foodCost, setFoodCost] = useState([]);
  const [recipeDialog, setRecipeDialog] = useState({ open: false, recipe: null });
  const [subDialog, setSubDialog] = useState({ open: false, sub: null });
  const [versionView, setVersionView] = useState(null);
  const [bulk, setBulk] = useState(null);

  const load = () => {
    api.get('/recipes').then((r) => setRecipes(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/subrecipes').then((r) => setSubRecipes(r.data)).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.filter((b) => b.status === 'active'))).catch(() => {});
    api.get('/items').then((r) => setItems(r.data.filter((i) => i.active))).catch(() => {});
    api.get('/reports/food-cost').then((r) => setFoodCost(r.data)).catch(() => {});
  };
  useEffect(load, []);

  return (
    <div data-testid="recipes-page">
      <PageHeader title="Recipes" subtitle="Recipes, sub-recipes, yields and version-controlled costing" testid="recipes-title" />
      <Tabs defaultValue="recipes">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="recipes" data-testid="tab-r-recipes">Recipe Master</TabsTrigger>
          <TabsTrigger value="subrecipes" data-testid="tab-r-subrecipes">Sub-Recipe Master</TabsTrigger>
          <TabsTrigger value="costing" data-testid="tab-r-costing">Recipe Costing</TabsTrigger>
        </TabsList>

        <TabsContent value="recipes">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button className="h-12" onClick={() => setRecipeDialog({ open: true, recipe: null })} data-testid="new-recipe-btn"><Plus className="mr-2 h-5 w-5" /> New Recipe</Button>
            <Button variant="outline" className="h-12" onClick={() => setBulk('recipe')} data-testid="bulk-recipe-btn"><Upload className="mr-2 h-5 w-5" /> Bulk Upload Recipes</Button>
          </div>
          <DataTable testid="recipes-table" exportName="recipes.csv" searchKeys={['name', 'code', 'brand_name']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Recipe' },
              { key: 'brand_name', label: 'Brand' },
              { key: 'current_version', label: 'Version', numeric: true, render: (r) => `v${r.current_version}` },
              { key: 'items', label: 'Ingredients', render: (r) => (r.items || []).map((i) => `${i.name} ${i.qty}${i.unit}`).join(', ') },
              { key: 'selling_price', label: 'Price', numeric: true, render: (r) => inr(r.selling_price) },
              { key: 'cost', label: 'Cost', numeric: true, render: (r) => inr(r.cost || 0) },
              { key: 'food_cost_pct', label: 'Food Cost %', numeric: true, render: (r) => <span className={r.food_cost_pct > 40 ? 'font-semibold text-[#991B1B]' : 'text-[#166534]'}>{r.food_cost_pct ?? 0}%</span> },
              {
                key: 'actions', label: 'Actions', render: (r) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => { const res = await api.get(`/recipes/${r.id}`); setVersionView(res.data); }} data-testid={`versions-${r.code}`}>Versions</Button>
                    <Button size="sm" onClick={() => setRecipeDialog({ open: true, recipe: r })} data-testid={`edit-recipe-${r.code}`}>Edit</Button>
                  </div>
                ),
              },
            ]}
            rows={recipes} />
        </TabsContent>

        <TabsContent value="subrecipes">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button className="h-12" onClick={() => setSubDialog({ open: true, sub: null })} data-testid="new-subrecipe-btn"><Plus className="mr-2 h-5 w-5" /> New Sub-Recipe</Button>
            <Button variant="outline" className="h-12" onClick={() => setBulk('subrecipe')} data-testid="bulk-subrecipe-btn"><Upload className="mr-2 h-5 w-5" /> Bulk Upload Sub-Recipes</Button>
          </div>
          <DataTable testid="subrecipes-table" exportName="subrecipes.csv" searchKeys={['name', 'code']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Sub-Recipe' },
              { key: 'items', label: 'Raw Ingredients', render: (r) => r.items.map((i) => `${i.item_name} ${i.qty}${i.unit}`).join(', ') },
              { key: 'yield_qty', label: 'Final Yield', numeric: true, render: (r) => `${r.yield_qty} ${r.yield_unit}` },
              { key: 'yield_pct', label: 'Yield %', numeric: true, render: (r) => <b className="text-primary">{r.yield_pct}%</b> },
              { key: 'batch_cost', label: 'Batch Cost', numeric: true, render: (r) => inr(r.batch_cost) },
              { key: 'actions', label: '', render: (r) => <Button size="sm" variant="outline" onClick={() => setSubDialog({ open: true, sub: r })} data-testid={`edit-sub-${r.code}`}>Edit</Button> },
            ]}
            rows={subRecipes} />
        </TabsContent>

        <TabsContent value="costing">
          <DataTable testid="costing-table" exportName="recipe-costing.csv" searchKeys={['recipe', 'brand']}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'recipe', label: 'Recipe' },
              { key: 'brand', label: 'Brand' },
              { key: 'version', label: 'Ver', numeric: true, render: (r) => `v${r.version}` },
              { key: 'cost', label: 'Ingredient Cost', numeric: true, render: (r) => inr(r.cost) },
              { key: 'price', label: 'Selling Price', numeric: true, render: (r) => inr(r.price) },
              { key: 'food_cost_pct', label: 'Food Cost %', numeric: true, render: (r) => <b className={r.food_cost_pct > 40 ? 'text-[#991B1B]' : 'text-[#166534]'}>{r.food_cost_pct}%</b> },
            ]}
            rows={foodCost} />
        </TabsContent>
      </Tabs>

      <RecipeDialog open={recipeDialog.open} recipe={recipeDialog.recipe} brands={brands} items={items} subRecipes={subRecipes}
        onClose={() => setRecipeDialog({ open: false, recipe: null })} onSaved={load} />
      <SubRecipeDialog open={subDialog.open} sub={subDialog.sub} brands={brands} items={items}
        onClose={() => setSubDialog({ open: false, sub: null })} onSaved={load} />

      {bulk && <BulkUploadDialog kind={bulk} open={!!bulk} onClose={() => setBulk(null)} onImported={load} />}

      <Dialog open={!!versionView} onOpenChange={() => setVersionView(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{versionView?.name} — Version History</DialogTitle></DialogHeader>
          <div className="space-y-4" data-testid="version-history">
            {versionView?.versions?.map((v) => (
              <div key={v.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <b>Version {v.version}</b>
                  <span className="text-sm text-muted-foreground">effective {v.effective_date} · by {v.created_by} · cost {inr(v.cost)}</span>
                </div>
                <ul className="list-inside list-disc text-sm">
                  {v.items.map((l, i) => <li key={i}>{l.name} — {l.qty} {l.unit}{l.sub_recipe_id ? ' (sub-recipe)' : ''}</li>)}
                </ul>
                {v.notes && <p className="mt-1 text-sm text-muted-foreground">{v.notes}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
