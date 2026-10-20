import { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, X, Check } from 'lucide-react';

/**
 * The one search-as-you-type picker look used across the app (items, sub-recipes, dishes).
 * - search(q): returns the results (an array, or a promise of one). Re-run when q, open or searchKey changes.
 * - describe(option): { title, badge, meta, side } shown for each result.
 * - selected: the chosen option or null; onPick(option) / onClear() report changes.
 * Test ids: `${testid}`, -input, -results, -no-results, -option-<code>, -selected, -change, -clear.
 */
export function SearchSelect({
  selected, search, searchKey = '', onPick, onClear, describe, optionCode = (o) => o.code,
  testid, placeholder, emptyText = (q) => `Nothing matches “${q}”.`, debounce = 250, noun = 'item',
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let live = true;
    const t = setTimeout(() => {
      Promise.resolve(searchRef.current(q))
        .then((r) => { if (live) setResults(r || []); })
        .catch(() => { if (live) setResults([]); })
        .finally(() => { if (live) setLoading(false); });
    }, debounce);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, searchKey, debounce]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (o) => {
    setOpen(false);
    setQ('');
    onPick(o);
  };

  return (
    <div className="relative" ref={boxRef} data-testid={testid}>
      {selected && !open ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm" data-testid={`${testid}-selected`}>
          <span className="truncate"><b>{selected.name}</b> <span className="text-muted-foreground">({optionCode(selected)})</span></span>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7" aria-label={`Change ${noun}`} onClick={() => setOpen(true)} data-testid={`${testid}-change`}><Search className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7" aria-label={`Clear ${noun}`} onClick={onClear} data-testid={`${testid}-clear`}><X className="h-3.5 w-3.5" /></Button>
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
            <div className="px-3 py-3 text-sm text-muted-foreground" data-testid={`${testid}-no-results`}>{emptyText(q)}</div>
          )}
          {!loading && results.map((o) => {
            const d = describe(o);
            return (
              <button type="button" key={o.id} onClick={() => pick(o)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                data-testid={`${testid}-option-${optionCode(o)}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.title}{d.badge}</span>
                  {d.meta && <span className="block truncate text-xs text-muted-foreground">{d.meta}</span>}
                </span>
                <span className="shrink-0 text-right text-xs">
                  {d.side}
                  {selected?.id === o.id && <Check className="ml-2 inline h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Search over a list already loaded on the screen (for example sub-recipes or dishes). */
export function OptionPicker({ options, value, onSelect, keys = ['name', 'code'], describe, testid, placeholder, emptyText, noun, limit = 50 }) {
  const selected = options.find((o) => o.id === value) || null;
  const search = (q) => {
    const t = q.trim().toLowerCase();
    return options.filter((o) => !t || keys.some((k) => String(o[k] ?? '').toLowerCase().includes(t))).slice(0, limit);
  };
  return (
    <SearchSelect testid={testid} placeholder={placeholder} selected={selected} debounce={0}
      search={search} searchKey={options.map((o) => o.id).join(',')}
      describe={describe || ((o) => ({ title: o.name, meta: o.code }))}
      emptyText={emptyText} noun={noun} onPick={(o) => onSelect(o)} onClear={() => onSelect(null)} />
  );
}
