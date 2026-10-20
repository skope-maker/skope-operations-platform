import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../lib/api', () => ({ api: { get: (...args) => get(...args) } }));

import { ItemPicker } from './ItemPicker';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ITEMS = [
  { id: '1', code: 'ITM-ONION', name: 'Onion', category_name: 'Veg', consumption_unit: 'GM', is_sub_recipe: false, stock: 5, stock_unit: 'GM' },
  { id: '2', code: 'ITM-GRAVY', name: 'Gravy Base', category_name: 'Prepared', consumption_unit: 'GM', is_sub_recipe: true, stock: 0, stock_unit: 'GM' },
];

let root; let host;
beforeEach(async () => {
  vi.useFakeTimers();
  await vi.advanceTimersByTimeAsync(31000); // expire the shared name lookup from any earlier test
  get.mockReset();
  get.mockImplementation(() => Promise.resolve({ data: ITEMS }));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
});

function mount(ui) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(ui));
}
const $ = (testid) => host.querySelector(`[data-testid="${testid}"]`);
async function search(testid, text) {
  const input = $(`${testid}-input`);
  await act(async () => { input.focus(); });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); }); // 250 ms debounce + request
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const searchUrls = () => get.mock.calls.map((c) => c[0]).filter((u) => u.startsWith('/items/search'));

describe('ItemPicker (the shared item search box)', () => {
  it('searches as you type and shows live stock at the given location', async () => {
    mount(<ItemPicker testid="p" locationId="LOC1" onSelect={() => {}} />);
    await search('p', 'oni');
    const url = searchUrls().at(-1);
    expect(url).toContain('q=oni');
    expect(url).toContain('location_id=LOC1');
    expect(url).not.toContain('active_only=false');
    expect($('p-option-ITM-ONION')).not.toBeNull();
    expect($('p-option-ITM-ONION').textContent).toContain('5 GM');
  });

  it('labels prepared (sub-recipe) items only', async () => {
    mount(<ItemPicker testid="p" onSelect={() => {}} />);
    await search('p', '');
    expect($('p-prepared-ITM-GRAVY')).not.toBeNull();
    expect($('p-prepared-ITM-ONION')).toBeNull();
  });

  it('includes deactivated items when used as a history filter', async () => {
    mount(<ItemPicker testid="p" includeInactive onSelect={() => {}} />);
    await search('p', 'on');
    expect(searchUrls().at(-1)).toContain('active_only=false');
  });

  it('hands the whole item (with its units) to the page, then can be cleared', async () => {
    const onSelect = vi.fn();
    mount(<ItemPicker testid="p" onSelect={onSelect} />);
    await search('p', 'oni');
    await click($('p-option-ITM-ONION'));
    expect(onSelect).toHaveBeenLastCalledWith(ITEMS[0]);
    expect($('p-selected').textContent).toContain('Onion');
    await click($('p-clear'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect($('p-input')).not.toBeNull();
  });

  it('shows names for already-chosen items with one shared lookup', async () => {
    mount(<div><ItemPicker testid="a" value="1" onSelect={() => {}} /><ItemPicker testid="b" value="2" onSelect={() => {}} /></div>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect($('a-selected').textContent).toContain('Onion');
    expect($('b-selected').textContent).toContain('Gravy Base');
    expect(get.mock.calls.filter((c) => c[0] === '/items').length).toBe(1);
  });
});
