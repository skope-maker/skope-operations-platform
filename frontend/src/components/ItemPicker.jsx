import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SearchSelect } from './SearchSelect';

// One shared "which item is this id?" lookup, so several pickers on a screen (for example a recipe with
// many ingredient lines) don't each download the whole item list just to show a name.
let lookup = null;
function loadAllItems() {
  if (!lookup) {
    lookup = api.get('/items').then((r) => r.data).catch(() => []);
    setTimeout(() => { lookup = null; }, 30000);
  }
  return lookup;
}

/**
 * The one item search box used everywhere an item is picked: search by name, code/SKU or category.
 * - locationId: also show live stock at that location next to each result.
 * - includeInactive: also find deactivated items (use for history filters such as the ledger).
 * - onSelect(item | null): called with the full item (including its units), or null when cleared.
 */
export function ItemPicker({ value, onSelect, locationId = '', includeInactive = false, testid = 'item-picker', placeholder = 'Search item by name, code or category' }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    loadAllItems().then((all) => setSelected(all.find((i) => i.id === value) || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const search = (q) => api
    .get(`/items/search?q=${encodeURIComponent(q)}&limit=25${locationId ? `&location_id=${locationId}` : ''}${includeInactive ? '&active_only=false' : ''}`)
    .then((r) => r.data);

  return (
    <SearchSelect
      testid={testid} placeholder={placeholder} selected={selected}
      search={search} searchKey={`${locationId}|${includeInactive}`}
      emptyText={(q) => `No items match “${q}”. Check the Items master.`}
      onPick={(item) => { setSelected(item); onSelect(item); }}
      onClear={() => { setSelected(null); onSelect(null); }}
      describe={(it) => ({
        title: it.name,
        badge: it.is_sub_recipe && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground" data-testid={`${testid}-prepared-${it.code}`}>Prepared</span>,
        meta: `${it.code}${it.category_name ? ` · ${it.category_name}` : ''}${it.subcategory ? ` · ${it.subcategory}` : ''}`,
        side: locationId && it.stock !== undefined && (
          <span className={it.stock > 0 ? 'text-[#166534]' : 'text-[#991B1B]'}>{it.stock} {it.stock_unit}</span>
        ),
      })}
    />
  );
}
