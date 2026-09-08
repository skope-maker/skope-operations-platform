import { useState } from 'react';
import { api, errMsg, toCSV } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const TITLES = {
  item: 'Item & Opening Stock Bulk Upload',
  subrecipe: 'Sub-Recipe Bulk Upload',
  recipe: 'Main Recipe Bulk Upload',
  sales: 'Daily Sales Bulk Upload',
};

const GROUP_LABEL = { item: 'items', subrecipe: 'sub-recipes', recipe: 'recipes', sales: 'sales entries' };

export function BulkUploadDialog({ kind, open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);

  const reset = () => { setFile(null); setResult(null); setSummary(null); setBusy(''); };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const r = await api.get(`/bulk/template/${kind}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-bulk-upload-template.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success('Template downloaded');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  const validate = async (f) => {
    setBusy('validate');
    setResult(null);
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api.post(`/bulk/${kind}/validate`, fd);
      setResult(r.data);
      if (r.data.failed_rows) toast.warning(`${r.data.failed_rows} row(s) have errors and will be skipped`);
      else toast.success('File validated — no errors found');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return toast.error('Upload the .xlsx template file');
    setFile(f);
    validate(f);
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const r = await api.post(`/bulk/${kind}/import`, { groups: result.groups.filter((g) => g.valid) });
      setSummary(r.data);
      toast.success(`${r.data.imported_groups} ${GROUP_LABEL[kind]} imported`);
      onImported?.();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  const downloadErrors = () => {
    const rows = (result?.errors || []).map((e) => ({
      excel_row: e.row, error_field: e.field, error_reason: e.reason, original_value: e.value,
    }));
    if (!rows.length) return toast.info('No errors to download');
    toCSV(rows, `${kind}-upload-errors.csv`);
  };

  const label = (g) => {
    if (kind === 'sales') return `${g.date} · ${g.brand_name || '—'} · ${g.kitchen_name || '—'}`;
    return `${g.code || '(no code)'} · ${g.name || ''}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid={`bulk-dialog-${kind}`}>
        <DialogHeader><DialogTitle>{TITLES[kind]}</DialogTitle></DialogHeader>

        <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs uppercase tracking-widest text-muted-foreground">
          <li className={!result ? 'font-bold text-primary' : ''}>1. Download template</li>
          <li>→</li>
          <li className={file && !result ? 'font-bold text-primary' : ''}>2. Upload & validate</li>
          <li>→</li>
          <li className={result && !summary ? 'font-bold text-primary' : ''}>3. Preview & confirm</li>
          <li>→</li>
          <li className={summary ? 'font-bold text-primary' : ''}>4. Summary</li>
        </ol>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-secondary/30 p-4">
          <Button variant="outline" className="h-11" onClick={downloadTemplate} disabled={busy === 'template'} data-testid={`bulk-template-${kind}`}>
            {busy === 'template' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download Excel Template
          </Button>
          <div className="min-w-56 flex-1">
            <Input type="file" accept=".xlsx" className="h-11 pt-2" onChange={onFile} data-testid={`bulk-file-${kind}`} />
          </div>
          {busy === 'validate' && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validating…</span>}
        </div>

        {result && !summary && (
          <div className="space-y-4" data-testid={`bulk-preview-${kind}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Total Rows', result.total_rows, ''], [`Total ${GROUP_LABEL[kind]}`, result.total_groups, ''],
                ['Valid', result.valid_groups, 'text-[#166534]'], ['Failed', result.failed_groups, 'text-[#991B1B]']].map(([l, v, cls]) => (
                <div key={l} className="rounded-lg border bg-card p-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{l}</div>
                  <div className={`text-2xl font-bold tabular ${cls}`}>{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border">
              <div className="border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Preview</div>
              <div className="max-h-72 overflow-y-auto divide-y">
                {result.groups.map((g) => (
                  <div key={g.key} className="p-3 text-sm" data-testid={`bulk-group-${g.key}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{label(g)}</b>
                      {g.valid
                        ? <span className="inline-flex items-center gap-1 rounded-full border border-[#22C55E] bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-semibold text-[#166534]"><CheckCircle2 className="h-3 w-3" /> Will import</span>
                        : <span className="inline-flex items-center gap-1 rounded-full border border-[#EF4444] bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-semibold text-[#991B1B]"><AlertTriangle className="h-3 w-3" /> Skipped</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Excel rows {g.rows?.[0]}–{g.rows?.[g.rows.length - 1]} ·{' '}
                      {kind === 'sales'
                        ? `${g.items.length} product line(s), total ₹${g.total_amount ?? 0}`
                        : kind === 'item'
                          ? `${g.purchase_unit || '?'} / ${g.consumption_unit || '?'}${g.opening ? ` · opening ${g.opening.qty} ${g.opening.unit} @ ${g.opening.location_name}` : ''}`
                          : `${g.items.length} ingredient line(s)`}
                      {kind === 'subrecipe' && g.yield_qty ? ` · yield ${g.yield_qty} ${g.yield_unit}` : ''}
                    </div>
                    {g.items?.length > 0 && (
                      <div className="mt-1 text-xs">
                        {g.items.map((i, x) => (
                          <span key={x} className="mr-2 inline-block rounded bg-secondary px-1.5 py-0.5">
                            {i.item_name || i.name || i.recipe_name} {kind === 'sales' ? `×${i.qty_sold}` : `${i.qty} ${i.unit}`}
                          </span>
                        ))}
                      </div>
                    )}
                    {g.errors?.map((e, x) => (
                      <div key={x} className="mt-1 rounded border border-[#EF4444] bg-[#FEE2E2] px-2 py-1 text-xs text-[#991B1B]" data-testid={`bulk-error-${e.row}`}>
                        Row {e.row} · {e.field}: {e.reason}{e.value ? ` (value: "${e.value}")` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="h-12" onClick={doImport} disabled={!result.valid_groups || busy === 'import'} data-testid={`bulk-import-${kind}`}>
                {busy === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Confirm & Import {result.valid_groups} {GROUP_LABEL[kind]}
              </Button>
              {result.errors?.length > 0 && (
                <Button variant="outline" className="h-12" onClick={downloadErrors} data-testid={`bulk-error-report-${kind}`}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Error Report
                </Button>
              )}
            </div>
          </div>
        )}

        {summary && (
          <div className="space-y-4" data-testid={`bulk-summary-${kind}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Total Records', result.total_rows, ''], ['Imported Rows', summary.imported_rows, 'text-[#166534]'],
                ['Skipped Rows', result.failed_rows, 'text-[#991B1B]'], ['Failed on Import', summary.failed_groups, 'text-[#991B1B]']].map(([l, v, cls]) => (
                <div key={l} className="rounded-lg border bg-card p-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{l}</div>
                  <div className={`text-2xl font-bold tabular ${cls}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {summary.imported.map((i, x) => (
                <div key={x} className="rounded border border-[#22C55E] bg-[#DCFCE7] px-3 py-1.5 text-[#166534]">
                  <b>{i.ref}</b> — {i.label} · {i.detail}
                </div>
              ))}
              {summary.failed.map((f, x) => (
                <div key={x} className="rounded border border-[#EF4444] bg-[#FEE2E2] px-3 py-1.5 text-[#991B1B]">
                  <b>{f.ref || `Row ${f.row}`}</b> — {f.reason}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {result.errors?.length > 0 && (
                <Button variant="outline" className="h-12" onClick={downloadErrors} data-testid={`bulk-error-report-${kind}`}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Error Report
                </Button>
              )}
              <Button variant="secondary" className="h-12" onClick={reset} data-testid={`bulk-again-${kind}`}>Upload Another File</Button>
              <Button className="h-12" onClick={() => { reset(); onClose(); }} data-testid={`bulk-close-${kind}`}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
