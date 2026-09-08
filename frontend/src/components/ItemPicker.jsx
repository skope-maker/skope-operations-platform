import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, X, Check } from 'lucide-react';

/** Server-side searchable item picker: search by name, code/SKU or category. */
export function ItemPicker({ value, onSelect, locationId = '', testid = 'item-picker', placeholder = 'Search item by name, code or category' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    api.get(`/items`).then((r) => setSelected(r.data.find((i) => i.id === value) || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/items/search?q=${encodeURIComponent(q)}&limit=25${locationId ? `&location_id=${locationId}` : ''}`)
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, locationId]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (item) => {
    setSelected(item);
    setOpen(false);
    setQ('');
    onSelect(item);
  };

  return (
    <div className="relative" ref={boxRef} data-testid={testid}>
      {selected && !open ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm" data-testid={`${testid}-selected`}>
          <span className="truncate"><b>{selected.name}</b> <span className="text-muted-foreground">({selected.code})</span></span>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)} data-testid={`${testid}-change`}><Search className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelected(null); onSelect(null); }} data-testid={`${testid}-clear`}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus={open} className="h-11 pl-9" placeholder={placeholder} value={q}
            onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            data-testid={`${testid}-input`} />
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg" data-testid={`${testid}-results`}>
          {loading && <div className="px-3 py-3 text-sm text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground" data-testid={`${testid}-no-results`}>
              No items match “{q}”. Check the Items master.
            </div>
          )}
          {!loading && results.map((it) => (
            <button type="button" key={it.id} onClick={() => pick(it)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
              data-testid={`${testid}-option-${it.code}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {it.code}{it.category_name ? ` · ${it.category_name}` : ''}{it.subcategory ? ` · ${it.subcategory}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs">
                {locationId && it.stock !== undefined && (
                  <span className={it.stock > 0 ? 'text-[#166534]' : 'text-[#991B1B]'}>{it.stock} {it.stock_unit}</span>
                )}
                {selected?.id === it.id && <Check className="ml-2 inline h-3.5 w-3.5" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
