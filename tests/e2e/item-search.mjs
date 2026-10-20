// Item search: the same search box on every screen where an item is picked, used by the role that does that job.
// Checks: results appear while typing, stock is shown for the location that step works with, the choice sticks
// (and sets the unit where the screen did that before), history filters can find deactivated items while
// data-entry screens cannot, prepared items are labelled, and it works at phone width.
//   node item-search.mjs <app address> <screenshot folder> [desktop|phone]
// Needs prepare.py data. Adds 5 KG onion to the main store and one deactivated item.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3] || './out';
const VIEW = process.argv[4] === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
fs.mkdirSync(OUT, { recursive: true });
const USERS = {
  admin: [process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com', process.env.E2E_ADMIN_PASSWORD || 'admin123'],
  store_keeper: ['keeper@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
  store_manager: ['manager@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
  chef: ['chef@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
  management: ['management@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
};
const TODAY = new Date().toISOString().slice(0, 10);
const TAG = Date.now().toString().slice(-5);

let token = null;
async function api(path, opts = {}) {
  if (!token) {
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: USERS.admin[0], password: USERS.admin[1] }) });
    token = (await r.json()).token;
  }
  const r = await fetch(`${BASE}/api${path}`, { method: opts.method || 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
}

const log = [];
const check = (ok, msg) => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); console.log(log.at(-1)); };

const browser = await chromium.launch();
async function as(role, name, fn) {
  console.log(`\n--- [${role}] ${name}`);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: VIEW.width < 800, isMobile: VIEW.width < 800 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('[data-testid="login-email"]', USERS[role][0]);
    await page.fill('[data-testid="login-password"]', USERS[role][1]);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 });
    await fn(page);
  } catch (e) {
    check(false, `${name} threw: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    await page.screenshot({ path: `${OUT}/FAIL-search-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  }
  check(errs.length === 0, `${name}: no page errors${errs.length ? ' ' + errs[0] : ''}`);
  await ctx.close();
}
const goto = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); };
const pick = async (page, testid, text) => { await page.click(`[data-testid="${testid}"]`); await page.getByRole('option', { name: text }).first().click(); };
// Type into a search box and wait for the results list; returns the option for `code` (or null if absent).
async function searchFor(page, testid, term, code) {
  await page.fill(`[data-testid="${testid}-input"]`, term);
  await page.waitForSelector(`[data-testid="${testid}-results"]`, { timeout: 8000 });
  await page.waitForFunction((t) => !document.querySelector(`[data-testid="${t}-results"]`)?.textContent.includes('Searching'), testid, { timeout: 8000 });
  const opt = page.locator(`[data-testid="${testid}-option-${code}"]`);
  return (await opt.count()) ? opt : null;
}
async function chooseAndCheck(page, testid, term, code, name, label) {
  const opt = await searchFor(page, testid, term, code);
  check(!!opt, `${label}: typing "${term}" finds ${code}`);
  if (!opt) return null;
  const text = (await opt.innerText()).replace(/\s+/g, ' ');
  await opt.click();
  const chosen = (await page.locator(`[data-testid="${testid}-selected"]`).innerText().catch(() => '')).replace(/\s+/g, ' ');
  check(chosen.includes(name), `${label}: choosing it shows "${name}" in the box`);
  return text;
}

// ---- data this test relies on
const kitchens = Object.fromEntries((await api('/kitchens')).data.map((k) => [k.code, k]));
const items = Object.fromEntries((await api('/items')).data.map((i) => [i.code, i]));
await api('/inventory/adjustment', { method: 'POST', body: { location_id: kitchens.STORE.id, item_id: items['ITM-ONION'].id, qty: 5000, unit: 'GM', direction: 'in', reason: 'item search test', date: TODAY } });
const storeOnion = ((await api(`/inventory/stock?location_id=${kitchens.STORE.id}`)).data.find((r) => r.item_id === items['ITM-ONION'].id) || {}).stock;
const oldCode = `ITM-OLD${TAG}`;
const created = await api('/items', { method: 'POST', body: { code: oldCode, name: `Retired Salt ${TAG}`, purchase_unit: 'KG', consumption_unit: 'GM', active: false } });
check(created.status === 200, `setup: a deactivated item ${oldCode} exists (${created.status})`);

// 1. Purchase receipt (already had search): still works
await as('store_keeper', 'purchase receipt', async (page) => {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-new"]');
  await chooseAndCheck(page, 'receipt-item-0', 'oni', 'ITM-ONION', 'Onion', 'Purchase receipt');
});

// 2. Kitchen intent (already had search): stock shown at the supplying store
await as('chef', 'kitchen intent', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-intents"]');
  await pick(page, 'intent-type', /Normal Kitchen/);
  const text = await chooseAndCheck(page, 'intent-item-0', 'oni', 'ITM-ONION', 'Onion', 'Kitchen intent');
  check(text && text.includes(`${storeOnion} GM`), `Kitchen intent: shows main-store stock (${storeOnion} GM) -> "${text}"`);
});

// 3. Stock transfer: stock at the FROM location, unit follows the item
await as('store_manager', 'stock transfer', async (page) => {
  await goto(page, '/inventory');
  await page.click('[data-testid="tab-inv-transfer"]');
  await pick(page, 'transfer-from', /Main Store/);
  const text = await chooseAndCheck(page, 'transfer-item-0', 'oni', 'ITM-ONION', 'Onion', 'Transfer');
  check(text && text.includes(`${storeOnion} GM`), `Transfer: shows stock at the source (${storeOnion} GM)`);
  check(/GM/.test(await page.locator('[data-testid="transfer-unit-0"]').innerText()), 'Transfer: unit switches to the item\'s usage unit (GM)');
});

// 4. Stock adjustment: stock at the chosen location
await as('store_manager', 'stock adjustment', async (page) => {
  await goto(page, '/inventory');
  await page.click('[data-testid="tab-inv-adjustment"]');
  await pick(page, 'adjustment-location', /Main Store/);
  const text = await chooseAndCheck(page, 'adjustment-item', 'oni', 'ITM-ONION', 'Onion', 'Adjustment');
  check(text && text.includes(`${storeOnion} GM`), 'Adjustment: shows stock at the chosen location');
});

// 5. Wastage: stock at the chosen kitchen; deactivated items are NOT offered for new entries
await as('chef', 'wastage', async (page) => {
  await goto(page, '/wastage');
  await pick(page, 'wastage-kitchen', /Main Store/);
  const gone = await searchFor(page, 'wastage-item', 'Retired Salt', oldCode);
  check(!gone, 'Wastage: a deactivated item is not offered for a new entry');
  const text = await chooseAndCheck(page, 'wastage-item', 'oni', 'ITM-ONION', 'Onion', 'Wastage');
  check(text && text.includes(`${storeOnion} GM`), 'Wastage: shows stock at the chosen kitchen');
  await page.screenshot({ path: `${OUT}/search-wastage.png` });
});

// 6. R&D trial: stock at the R&D kitchen (not the main store)
await as('chef', 'R&D trial', async (page) => {
  await goto(page, '/rd');
  const rdStock = ((await api(`/inventory/stock?location_id=${kitchens.RND.id}`)).data.find((r) => r.item_id === items['ITM-ONION'].id) || {}).stock || 0;
  const text = await chooseAndCheck(page, 'trial-item-0', 'oni', 'ITM-ONION', 'Onion', 'R&D trial');
  check(text && text.includes(`${rdStock} GM`) && rdStock !== storeOnion, `R&D trial: shows R&D-kitchen stock (${rdStock} GM), not the main store`);
});

// 7. Recipes: raw-item lines search; sub-recipe lines keep their own list; prepared items are labelled
await as('chef', 'recipes and sub-recipes', async (page) => {
  await goto(page, '/recipes');
  await page.click('[data-testid="tab-r-recipes"]');
  await page.click('[data-testid="new-recipe-btn"]');
  await page.click('[data-testid="recipe-add-line"]');
  await chooseAndCheck(page, 'recipe-line-ing-0', 'chick', 'ITM-CHICKEN', 'Chicken', 'Recipe ingredient');
  await pick(page, 'recipe-line-type-0', /Sub-Recipe/);
  await page.click('[data-testid="recipe-line-ing-0"]');
  const subOpt = await page.getByRole('option', { name: /Gravy Base/ }).count();
  check(subOpt > 0, 'Recipe line set to "Sub-Recipe" lists sub-recipes (not raw items)');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await goto(page, '/recipes');
  await page.click('[data-testid="tab-r-subrecipes"]');
  await page.click('[data-testid="new-subrecipe-btn"]');
  const opt = await searchFor(page, 'sub-output', 'gravy', 'ITM-GRAVY');
  check(opt && (await page.locator('[data-testid="sub-output-prepared-ITM-GRAVY"]').count()) === 1, 'Sub-recipe output: prepared item is labelled "Prepared"');
  check((await page.locator('[data-testid="sub-output-prepared-ITM-ONION"]').count()) === 0, 'Sub-recipe output: raw items carry no "Prepared" label');
  if (opt) await opt.click();
  await page.click('[data-testid="sub-add-line"]');
  await chooseAndCheck(page, 'sub-line-item-0', 'oni', 'ITM-ONION', 'Onion', 'Sub-recipe ingredient');
});

// 8. Inventory ledger filter: narrows to one item, finds deactivated items, clearing restores all
await as('admin', 'ledger filter', async (page) => {
  await goto(page, '/inventory');
  await page.click('[data-testid="tab-inv-ledger"]');
  await page.waitForTimeout(600);
  const before = await page.locator('[data-testid^="ledger-table-row-"]').count();
  check(!!(await searchFor(page, 'ledger-item-filter', 'Retired Salt', oldCode)), 'Ledger filter: finds a deactivated item (history)');
  await chooseAndCheck(page, 'ledger-item-filter', 'oni', 'ITM-ONION', 'Onion', 'Ledger filter');
  await page.waitForTimeout(800);
  const names = await page.locator('[data-testid^="ledger-table-row-"]').allInnerTexts();
  check(names.length > 0 && names.every((t) => /Onion/.test(t)), `Ledger filter: only Onion rows shown (${names.length})`);
  await page.click('[data-testid="ledger-item-filter-clear"]');
  await page.waitForTimeout(800);
  const after = await page.locator('[data-testid^="ledger-table-row-"]').count();
  check(after >= before && after > names.length, `Ledger filter: clearing shows all items again (${after} rows)`);
});

// 9. Reports > Item Ledger filter (management, read-only)
await as('management', 'report item filter', async (page) => {
  await goto(page, '/reports');
  await pick(page, 'report-select', /Item Ledger/);
  await chooseAndCheck(page, 'report-item', 'oni', 'ITM-ONION', 'Onion', 'Report item filter');
  await page.click('[data-testid="report-run-btn"]');
  await page.waitForTimeout(1000);
  const rows = await page.locator('[data-testid^="report-table-row-"]').allInnerTexts();
  check(rows.length > 0 && rows.every((t) => /Onion/.test(t)), `Report: Item Ledger shows only Onion (${rows.length} rows)`);
});

// 10. Results stay on screen at phone width
// Dishes on a sales entry and sub-recipes on a production batch use the same search box over their own lists.
await as('chef', 'sales dish search', async (page) => {
  await goto(page, '/sales');
  await page.click('[data-testid="new-sale-btn"]');
  await pick(page, 'sale-brand', 'Test Brand');
  const opt = await searchFor(page, 'sale-line-recipe-0', 'butter', 'RCP-BC');
  check(!!opt, 'Sales: typing "butter" finds the Butter Chicken dish (RCP-BC)');
  check(opt && (await opt.textContent()).includes('380'), 'Sales: the result shows the selling price');
  await opt.click();
  check((await page.textContent('[data-testid="sale-line-recipe-0-selected"]')).includes('Butter Chicken'), 'Sales: the chosen dish sticks');
  await page.click('[data-testid="sale-line-recipe-0-change"]');
  check(!(await searchFor(page, 'sale-line-recipe-0', 'zzzz', 'RCP-BC')) && (await page.locator('[data-testid="sale-line-recipe-0-no-results"]').count()) === 1, 'Sales: a search with no match says so');
});

await as('chef', 'production sub-recipe search', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-production"]');
  const opt = await searchFor(page, 'prod-subrecipe', 'gravy', 'SR-GRAVY');
  check(!!opt, 'Production: typing "gravy" finds the Gravy Base sub-recipe (SR-GRAVY)');
  await opt.click();
  check((await page.textContent('[data-testid="prod-subrecipe-selected"]')).includes('Gravy Base'), 'Production: the chosen sub-recipe sticks');
  check((await page.textContent('[data-testid="prod-unit"]')).includes('KG'), 'Production: choosing it sets the yield unit (KG)');
  await page.click('[data-testid="prod-subrecipe-change"]');
  check(!!(await searchFor(page, 'prod-subrecipe', 'sr-gra', 'SR-GRAVY')), 'Production: the sub-recipe can also be found by its code');
});

if (VIEW.width < 800) {
  await as('chef', 'phone layout of the results', async (page) => {
    await goto(page, '/wastage');
    await page.fill('[data-testid="wastage-item-input"]', 'o');
    await page.waitForSelector('[data-testid="wastage-item-results"]');
    const box = await page.locator('[data-testid="wastage-item-results"]').boundingBox();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    check(box && box.x >= 0 && box.x + box.width <= vw + 1, `Phone: results list fits the screen (${Math.round(box?.width || 0)}px of ${vw}px)`);
  });
}

await browser.close();
const f = log.filter((l) => l.startsWith('FAIL'));
console.log(`\n==== ${log.length - f.length} passed, ${f.length} failed`);
f.forEach((x) => console.log('  ' + x));
process.exit(f.length ? 1 : 0);
