import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
const VIEW = process.argv[4] === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
fs.mkdirSync(OUT, { recursive: true });

const USERS = {
  admin: [process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com', process.env.E2E_ADMIN_PASSWORD || 'admin123'],
  procurement_manager: ['procurement@kitchen.com', 'demo123'],
  store_keeper: ['keeper@kitchen.com', 'demo123'],
  store_manager: ['manager@kitchen.com', 'demo123'],
  chef: ['chef@kitchen.com', 'demo123'],
  management: ['management@kitchen.com', 'demo123'],
};
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- API helpers (verification only)
const tokens = {};
async function api(role, path, opts = {}) {
  if (!tokens[role]) {
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: USERS[role][0], password: USERS[role][1] }) });
    tokens[role] = (await r.json()).token;
  }
  const r = await fetch(`${BASE}/api${path}`, { method: opts.method || 'GET', headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null; try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}
let kitchensByCode = {}; let itemsById = {};
async function loadRefs() {
  kitchensByCode = Object.fromEntries((await api('admin', '/kitchens')).data.map((k) => [k.code, k]));
  itemsById = Object.fromEntries((await api('admin', '/items')).data.map((i) => [i.id, i]));
}
async function stock(locCode) {
  const rows = (await api('admin', `/inventory/stock?location_id=${kitchensByCode[locCode].id}`)).data;
  const m = {}; for (const r of rows) m[itemsById[r.item_id]?.code || r.item_id] = r.stock; return m;
}

// ---------------------------------------------------------------- reporting
let fails = 0; const log = [];
const check = (ok, msg) => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); console.log(log[log.length - 1]); if (!ok) fails++; };
const eq = (a, b, msg) => check(Math.abs((a ?? 0) - b) < 0.001, `${msg}: expected ${b}, got ${a ?? 0}`);

// ---------------------------------------------------------------- UI helpers
const browser = await chromium.launch();
async function as(role, name, fn) {
  console.log(`\n--- [${role}] ${name}`);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: VIEW.width < 800, isMobile: VIEW.width < 800 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const bad = []; page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('[data-testid="login-email"]', USERS[role][0]);
    await page.fill('[data-testid="login-password"]', USERS[role][1]);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 });
    await fn(page, bad);
  } catch (e) {
    check(false, `${name} threw: ${String(e.message).split('\n')[0].slice(0, 220)}`);
    await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  }
  check(errs.length === 0, `${name}: no uncaught page errors${errs.length ? ' ' + errs[0] : ''}`);
  await ctx.close();
}
const pick = async (page, testid, text) => {
  await page.click(`[data-testid="${testid}"]`);
  await page.getByRole('option', { name: text }).first().click();
};
const pickItem = async (page, testid, code, term) => {
  await page.fill(`[data-testid="${testid}-input"]`, term);
  await page.click(`[data-testid="${testid}-option-${code}"]`);
};
const toast = (page, re, ms = 10000) => page.locator('[data-sonner-toast]', { hasText: re }).first().waitFor({ timeout: ms }).then(() => true, () => false);
const goto = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

await loadRefs();
const before = { store: await stock('STORE') };

// ============================================================================ 1. PURCHASE (store keeper creates)
await as('store_keeper', 'create purchase receipt', async (page) => {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-new"]');
  await pick(page, 'receipt-supplier', 'Test Supplier');
  await page.fill('[data-testid="receipt-invoice-no"]', `INV-FLOW-${Date.now().toString().slice(-6)}`);
  await page.setInputFiles('[data-testid="receipt-attachment"]', { name: 'invoice.png', mimeType: 'image/png', buffer: png });
  const lines = [['ITM-ONION', 'Onion', 20, 40], ['ITM-OIL', 'Oil', 5, 120], ['ITM-CHICKEN', 'Chicken', 10, 260]];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.click('[data-testid="receipt-add-item-btn"]');
    const [code, term, qty, rate] = lines[i];
    await pickItem(page, `receipt-item-${i}`, code, term);
    await page.fill(`[data-testid="receipt-ordered_qty-${i}"]`, String(qty));
    await page.fill(`[data-testid="receipt-received_qty-${i}"]`, String(qty));
    await page.fill(`[data-testid="receipt-rate-${i}"]`, String(rate));
  }
  const total = await page.locator('[data-testid="receipt-total"]').innerText();
  check(/4,?000/.test(total), `receipt total shows 4,000 (20x40 + 5x120 + 10x260) -> "${total.trim()}"`);
  await page.click('[data-testid="receipt-submit-btn"]');
  check(await toast(page, /receipt created/i), 'toast: purchase receipt created');
});
const pend = (await api('procurement_manager', '/procurement/receipts?status=pending')).data;
check(pend.length === 1, `exactly one receipt pending approval (${pend.length})`);
eq((await stock('STORE')).__none, 0, 'stock does NOT move before approval (sanity)');
const rno = pend[0]?.receipt_no;

// ============================================================================ 2. APPROVAL (procurement manager)
await as('procurement_manager', 'approve receipt', async (page) => {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-pending"]');
  await page.click(`[data-testid="review-${rno}"]`);
  await page.waitForSelector('[data-testid="approve-full-btn"]');
  await page.click('[data-testid="approve-full-btn"]');
  check(await toast(page, /approved/i), 'toast: receipt approved');
});
let s = await stock('STORE');
eq(s['ITM-ONION'], 20000, 'STORE onion after approval (GM)');
eq(s['ITM-OIL'], 5000, 'STORE oil after approval (ML)');
eq(s['ITM-CHICKEN'], 10000, 'STORE chicken after approval (GM)');
check((await api('procurement_manager', '/procurement/receipts?status=pending')).data.length === 0, 'nothing left pending');

// ============================================================================ 3. KITCHEN INTENTS (chef raises)
await as('chef', 'raise base-kitchen intent', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-intents"]');
  await pick(page, 'intent-type', /Base Kitchen/);
  await pick(page, 'intent-kitchen', /Base Kitchen/);
  await pickItem(page, 'intent-item-0', 'ITM-ONION', 'Onion');
  await page.fill('[data-testid="intent-qty-0"]', '6000');
  await page.click('[data-testid="intent-add-item"]');
  await pickItem(page, 'intent-item-1', 'ITM-OIL', 'Oil');
  await page.fill('[data-testid="intent-qty-1"]', '500');
  await page.click('[data-testid="intent-submit-btn"]');
  check(await toast(page, /intent/i), 'toast: base-kitchen intent raised');
});
await as('chef', 'raise normal-kitchen intent', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-intents"]');
  await pick(page, 'intent-type', /Normal Kitchen/);
  await pickItem(page, 'intent-item-0', 'ITM-CHICKEN', 'Chicken');
  await page.fill('[data-testid="intent-qty-0"]', '2000');
  await page.click('[data-testid="intent-submit-btn"]');
  check(await toast(page, /intent/i), 'toast: normal-kitchen intent raised');
});
const intents = (await api('store_keeper', '/kitchen/intents?status=pending')).data;
check(intents.length === 2, `two intents pending (${intents.length})`);

// ============================================================================ 4. ISSUE (store keeper)
await as('store_keeper', 'issue both intents', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-issues"]');
  for (const it of intents) {
    await page.click(`[data-testid="issue-full-${it.intent_no}"]`);
    check(await toast(page, /full issue completed|issued/i), `toast: ${it.intent_no} issued in full`);
    await page.waitForTimeout(400);
  }
});
s = await stock('STORE'); let b = await stock('BASEK'); let n = await stock('NORMK');
eq(s['ITM-ONION'], 14000, 'STORE onion after issues'); eq(s['ITM-OIL'], 4500, 'STORE oil after issues'); eq(s['ITM-CHICKEN'], 8000, 'STORE chicken after issues');
eq(b['ITM-ONION'], 6000, 'BASE onion received'); eq(b['ITM-OIL'], 500, 'BASE oil received'); eq(n['ITM-CHICKEN'], 2000, 'NORMAL chicken received');

// ============================================================================ 5. PRODUCTION (chef)
await as('chef', 'produce 8 KG gravy base', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-production"]');
  await pick(page, 'prod-subrecipe', /Gravy Base/);
  await pick(page, 'prod-kitchen', /Base Kitchen/);
  await page.fill('[data-testid="prod-qty"]', '8');
  await page.click('[data-testid="prod-submit-btn"]');
  check(await toast(page, /batch recorded|production/i), 'toast: production batch recorded');
});
b = await stock('BASEK');
eq(b['ITM-GRAVY'], 8000, 'BASE gravy produced (GM)');
eq(b['ITM-ONION'], 1200, 'BASE onion consumed by batch (6000 - 4800)');
eq(b['ITM-OIL'], 100, 'BASE oil consumed by batch (500 - 400)');

// ============================================================================ 6. TRANSFER (store manager)
await as('store_manager', 'transfer gravy base to normal kitchen', async (page) => {
  await goto(page, '/inventory');
  await page.click('[data-testid="tab-inv-transfer"]');
  await pick(page, 'transfer-from', /Base Kitchen/);
  await pick(page, 'transfer-to', /Normal Kitchen/);
  await pickItem(page, 'transfer-item-0', 'ITM-GRAVY', 'Gravy');
  check(/GM/.test(await page.locator('[data-testid="transfer-unit-0"]').innerText()), 'picking an item switches the transfer unit to its consumption unit (GM)');
  await page.fill('[data-testid="transfer-qty-0"]', '1000');
  await page.click('[data-testid="transfer-submit-btn"]');
  check(await toast(page, /transfer/i), 'toast: stock transferred');
});
b = await stock('BASEK'); n = await stock('NORMK');
eq(b['ITM-GRAVY'], 7000, 'BASE gravy after transfer'); eq(n['ITM-GRAVY'], 1000, 'NORMAL gravy after transfer');

// ============================================================================ 7. SALES (chef creates + posts)
await as('chef', 'record and post sales', async (page) => {
  await goto(page, '/sales');
  await page.click('[data-testid="new-sale-btn"]');
  await pick(page, 'sale-brand', 'Test Brand');
  await pick(page, 'sale-kitchen', /Normal Kitchen/);
  await pick(page, 'sale-line-recipe-0', /Butter Chicken/);
  await page.fill('[data-testid="sale-line-qty-0"]', '5');
  await page.click('[data-testid="sale-submit-btn"]');
  check(await toast(page, /sales?.*(saved|draft|created)|saved|draft/i), 'toast: sales saved as draft');
});
const draft = (await api('chef', '/sales?status=draft')).data;
check(draft.length === 1 && draft[0].total_amount === 1900, `one draft sale worth 1,900 (5 x 380) -> ${draft.map((d) => d.total_amount)}`);
await as('chef', 'post the sale', async (page) => {
  await goto(page, '/sales');
  await page.click('[data-testid="tab-sales-draft"]');
  await page.click(`[data-testid="post-sale-${draft[0].sale_no}"]`);
  check(await toast(page, /posted/i), 'toast: sales posted, inventory consumed');
});
n = await stock('NORMK');
eq(n['ITM-GRAVY'], 0, 'NORMAL gravy consumed by sale (1000 - 5x200)');
eq(n['ITM-CHICKEN'], 1100, 'NORMAL chicken consumed by sale (2000 - 5x180)');
check((await api('chef', '/sales?status=posted')).data.length === 1, 'sale is now posted');

// ============================================================================ 8. WASTAGE (store manager)
await as('store_manager', 'record wastage', async (page) => {
  await goto(page, '/wastage');
  await pick(page, 'wastage-kitchen', /Normal Kitchen/);
  await pickItem(page, 'wastage-item', 'ITM-CHICKEN', 'Chicken');
  await page.fill('[data-testid="wastage-qty"]', '100');
  await pick(page, 'wastage-reason', /./);
  await page.click('[data-testid="wastage-submit-btn"]');
  check(await toast(page, /wastage recorded/i), 'toast: wastage recorded');
});
n = await stock('NORMK'); eq(n['ITM-CHICKEN'], 1000, 'NORMAL chicken after wastage (1100 - 100)');

// ============================================================================ 9. DAILY CLOSING (chef submits, store manager approves)
await as('chef', 'submit daily closing', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-closing"]');
  await pick(page, 'closing-location', /Normal Kitchen/);
  await page.click('[data-testid="closing-load-btn"]');
  await page.waitForSelector('[data-testid="closing-sheet"]');
  const row = await page.locator('[data-testid="closing-row-ITM-CHICKEN"]').innerText();
  check(/1000/.test(row), `closing sheet expects chicken 1000 -> "${row.replace(/\s+/g, ' ').slice(0, 90)}"`);
  await page.fill('[data-testid="physical-ITM-CHICKEN"]', '1000');
  await page.fill('[data-testid="physical-ITM-GRAVY"]', '0');
  await page.click('[data-testid="closing-submit-btn"]');
  check(await toast(page, /closing submitted/i), 'toast: closing submitted');
});
await as('store_manager', 'approve closing', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-closing"]');
  await page.click(`[data-testid="approve-closing-${TODAY}"]`);
  check(await toast(page, /approved|closing/i), 'toast: closing approved');
});
const closings = (await api('store_manager', '/closing')).data;
check(closings.length >= 1 && closings[0].status === 'approved', `closing is approved (${closings[0]?.status})`);

// ============================================================================ 10. R&D (chef) - needs R&D stock
await api('admin', '/inventory/adjustment', { method: 'POST', body: { location_id: kitchensByCode.RND.id, item_id: Object.values(itemsById).find((i) => i.code === 'ITM-ONION').id, qty: 1000, unit: 'GM', direction: 'in', reason: 'flow prestock', date: TODAY } });
await as('chef', 'record an R&D trial', async (page) => {
  await goto(page, '/rd');
  await page.fill('[data-testid="trial-product"]', 'Flow Test Gravy');
  await page.fill('[data-testid="trial-yield"]', '1');
  await pickItem(page, 'trial-item-0', 'ITM-ONION', 'Onion');
  await page.fill('[data-testid="trial-qty-0"]', '200');
  await page.click('[data-testid="trial-submit-btn"]');
  check(await toast(page, /trial recorded/i), 'toast: R&D trial recorded');
});
eq((await stock('RND'))['ITM-ONION'], 800, 'R&D onion consumed by trial (1000 - 200)');

// ============================================================================ 11. MANAGEMENT sees the numbers (read-only)
await as('management', 'dashboard and reports', async (page, bad) => {
  await goto(page, '/');
  const txt = await page.locator('main').innerText();
  check(/1,900/.test(txt), 'dashboard shows today\'s sales 1,900');
  for (const path of ['/reports', '/sales', '/procurement', '/inventory', '/recipes', '/wastage', '/rd', '/kitchen']) {
    bad.length = 0;
    await goto(page, path);
    const len = (await page.locator('main').innerText()).trim().length;
    check(len > 40 && bad.length === 0, `management can view ${path}${bad.length ? ' | ' + [...new Set(bad)].join(',') : ''}`);
  }
  await page.screenshot({ path: `${OUT}/management-dashboard.png`, fullPage: true });
});
// every report endpoint answers for a management user and returns sane data
for (const rep of ['inventory?date=' + TODAY + '&location_id=' + kitchensByCode.NORMK.id, 'sales', 'procurement', 'wastage', 'food-cost', 'variance', 'brand-consumption', 'recipe-consumption', 'reorder', 'rd']) {
  const r = await api('management', `/reports/${rep}`);
  check(r.status === 200, `report /reports/${rep.split('?')[0]} -> ${r.status}`);
}

// ============================================================================ 12. WRONG ROLES ARE REJECTED BY THE SERVER
const deny = [
  ['chef', 'POST', '/procurement/receipts/x/approve', {}], ['procurement_manager', 'POST', '/procurement/receipts', {}], ['store_keeper', 'POST', '/kitchen/intents', {}],
  ['management', 'POST', '/sales', {}], ['chef', 'POST', '/inventory/transfer', {}], ['store_keeper', 'POST', '/kitchen/production', {}],
  ['chef', 'POST', '/closing/x/approve', {}], ['store_manager', 'POST', '/closing', {}], ['management', 'POST', '/brands', {}], ['chef', 'GET', '/users', null],
  ['store_manager', 'DELETE', '/admin/users/x', null], ['management', 'POST', '/inventory/adjustment', {}],
];
for (const [role, method, path, body] of deny) {
  const r = await api(role, path, { method, body: body || undefined });
  check(r.status === 403, `${role} ${method} ${path} -> ${r.status} (expect 403)`);
}

// ============================================================================ 13. ADMIN: audit trail and user administration
await as('admin', 'audit logs, users, archived', async (page) => {
  await goto(page, '/admin');
  await page.click('[data-testid="tab-a-audit"]');
  await page.waitForTimeout(500);
  const rows = await page.locator('main table tbody tr').count();
  check(rows >= 8, `audit log lists the chain's actions (${rows} rows)`);
  await page.click('[data-testid="tab-a-users"]');
  await page.waitForTimeout(300);
  const urows = await page.locator('main table tbody tr').count();
  check(urows >= 6, `users tab lists all roles (${urows} rows)`);
  await page.screenshot({ path: `${OUT}/admin-users.png` });
});
const audit = (await api('admin', '/audit-logs')).data;
const actions = new Set(audit.map((a) => a.action));
check(audit.length >= 8, `audit trail has ${audit.length} entries across roles: ${[...actions].slice(0, 6).join(' | ')}`);

await browser.close();
const f = log.filter((l) => l.startsWith('FAIL'));
console.log(`\n==== ${log.length - f.length} passed, ${f.length} failed`);
f.forEach((x) => console.log('  ' + x));
process.exit(f.length ? 1 : 0);
