import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionPicker } from './SearchSelect';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SUBS = [
  { id: 'a', code: 'SR-GRAVY', name: 'Gravy Base', yield_pct: 90 },
  { id: 'b', code: 'SR-RICE', name: 'Steamed Rice', yield_pct: 100 },
];

let root; let host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

function mount(ui) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(ui));
}
const $ = (testid) => host.querySelector(`[data-testid="${testid}"]`);
async function type(testid, text) {
  const input = $(`${testid}-input`);
  await act(async () => { input.focus(); });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => { setValue.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('OptionPicker (search over a list already on the screen)', () => {
  it('finds by name or code, case-insensitively', async () => {
    mount(<OptionPicker testid="s" options={SUBS} onSelect={() => {}} />);
    await type('s', 'gravy');
    expect($('s-option-SR-GRAVY')).not.toBeNull();
    expect($('s-option-SR-RICE')).toBeNull();
    await type('s', 'sr-ri');
    expect($('s-option-SR-RICE')).not.toBeNull();
    expect($('s-option-SR-GRAVY')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    mount(<OptionPicker testid="s" options={SUBS} onSelect={() => {}} emptyText={(q) => `No sub-recipe matches ${q}`} />);
    await type('s', 'zzz');
    expect($('s-no-results').textContent).toBe('No sub-recipe matches zzz');
  });

  it('reports the chosen option and shows it, and clearing reports null', async () => {
    const onSelect = vi.fn();
    let value = '';
    const ui = () => <OptionPicker testid="s" options={SUBS} value={value} onSelect={(o) => { onSelect(o); value = o?.id || ''; }}
      describe={(o) => ({ title: o.name, meta: o.code, side: `yield ${o.yield_pct}%` })} />;
    mount(ui());
    await type('s', 'rice');
    expect($('s-option-SR-RICE').textContent).toContain('yield 100%');
    await click($('s-option-SR-RICE'));
    expect(onSelect).toHaveBeenLastCalledWith(SUBS[1]);
    act(() => root.render(ui()));
    expect($('s-selected').textContent).toContain('Steamed Rice');
    await click($('s-clear'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
