import { useMemo, useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Download, Search } from 'lucide-react';
import { toCSV } from '../lib/api';

export function DataTable({ columns, rows, searchKeys = [], testid, exportName, filters }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      (searchKeys.length ? searchKeys : Object.keys(r)).some((k) =>
        String(r[k] ?? '').toLowerCase().includes(needle)
      )
    );
  }, [rows, q, searchKeys]);

  return (
    <div className="rounded-xl border bg-card" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="h-11 pl-9"
            data-testid={`${testid}-search`}
          />
        </div>
        {filters}
        {exportName && (
          <Button variant="outline" className="h-11" onClick={() => toCSV(filtered, exportName)} data-testid={`${testid}-export-btn`}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap ${c.numeric ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground" data-testid={`${testid}-empty`}>
                  No records found
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id || i} className="border-b last:border-0 hover:bg-secondary/30 transition-colors duration-150" data-testid={`${testid}-row-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.numeric ? 'text-right tabular' : ''}`}>
                    {c.render ? c.render(r, i) : String(r[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StockBadge({ status }) {
  const map = {
    ok: ['In Stock', 'bg-[#DCFCE7] text-[#166534] border-[#22C55E]'],
    warning: ['Reorder Soon', 'bg-[#FEF9C3] text-[#854D0E] border-[#EAB308]'],
    low: ['Low Stock', 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]'],
  };
  const [label, cls] = map[status] || map.ok;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`} data-testid={`stock-badge-${status}`}>{label}</span>;
}

export function StatusBadge({ status }) {
  const map = {
    pending: 'bg-[#FEF9C3] text-[#854D0E] border-[#EAB308]',
    partial: 'bg-[#FEF9C3] text-[#854D0E] border-[#EAB308]',
    draft: 'bg-secondary text-secondary-foreground border-border',
    submitted: 'bg-[#FEF9C3] text-[#854D0E] border-[#EAB308]',
    approved: 'bg-[#DCFCE7] text-[#166534] border-[#22C55E]',
    posted: 'bg-[#DCFCE7] text-[#166534] border-[#22C55E]',
    issued: 'bg-[#DCFCE7] text-[#166534] border-[#22C55E]',
    rejected: 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || map.draft}`} data-testid={`status-${status}`}>
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid={testid}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
