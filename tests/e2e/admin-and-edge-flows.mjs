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
const TAG = Date.now().toString().slice(-6);

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
const log = [];
const check = (ok, msg) => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); console.log(log[log.length - 1]); };

const browser = await chromium.launch();
async function loginPage(ctx, email, pw) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', pw);
  await page.click('[data-testid="login-submit-btn"]');
  return page;
}
async function as(role, name, fn) {
  console.log(`\n--- [${role}] ${name}`);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: VIEW.width < 800, isMobile: VIEW.width < 800 });
  const errs = [];
  try {
    const page = await loginPage(ctx, ...USERS[role]);
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 });
    await fn(page);
  } catch (e) {
    check(false, `${name} threw: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    for (const pg of ctx.pages()) await pg.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  }
  check(errs.length === 0, `${name}: no uncaught page errors${errs.length ? ' ' + errs[0] : ''}`);
  await ctx.close();
}
const pick = async (page, testid, text) => { await page.click(`[data-testid="${testid}"]`); await page.getByRole('option', { name: text }).first().click(); };
const pickItem = async (page, testid, code, term) => { await page.fill(`[data-testid="${testid}-input"]`, term); await page.click(`[data-testid="${testid}-option-${code}"]`); };
const toast = (page, re, ms = 10000) => page.locator('[data-sonner-toast]', { hasText: re }).first().waitFor({ timeout: ms }).then(() => true, () => false);
const goto = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const kitchens = Object.fromEntries((await api('admin', '/kitchens')).data.map((k) => [k.code, k]));
const items = Object.fromEntries((await api('admin', '/items')).data.map((i) => [i.code, i]));
const stockOf = async (loc, code) => ((await api('admin', `/inventory/stock?location_id=${kitchens[loc].id}`)).data.find((r) => r.item_id === items[code].id) || {}).stock ?? 0;

// ============================================================ A. USER ADMINISTRATION
const email = `ui.tester.${TAG}@kitchen.com`;
await as('admin', 'create a user in the UI', async (page) => {
  await goto(page, '/admin');
  await page.click('[data-testid="tab-a-users"]');
  await page.click('[data-testid="new-user-btn"]');
  await page.fill('[data-testid="user-name"]', 'UI Tester');
  await page.fill('[data-testid="user-email"]', email);
  await page.fill('[data-testid="user-password"]', 'Tester@12345');
  await pick(page, 'user-role', /Chef/i);
  await page.click('[data-testid="user-save-btn"]');
  check(await toast(page, /user/i), 'toast: user created');
  await page.waitForSelector(`text=${email}`, { timeout: 8000 }).then(() => check(true, 'new user appears in the users table'), () => check(false, 'new user appears in the users table'));
});
{
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await loginPage(ctx, email, 'Tester@12345');
  await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 }).catch(() => {});
  const role = await page.locator('[data-testid="current-user-role"]').first().innerText().catch(() => '');
  check(/chef/i.test(role), `new user can log in and is a ${role.trim()}`);
  await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
  check(new URL(page.url()).pathname === '/', 'new chef user is kept out of /masters');
  await ctx.close();
}
await as('admin', 'deactivate the user', async (page) => {
  await goto(page, '/admin');
  await page.click('[data-testid="tab-a-users"]');
  await page.click(`[data-testid="edit-user-${email}"]`);
  await page.click('[data-testid="user-active"]');
  await page.click('[data-testid="user-save-btn"]');
  check(await toast(page, /updated|saved|user/i), 'toast: user updated');
});
{
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await loginPage(ctx, email, 'Tester@12345');
  const blocked = await page.waitForSelector('[data-testid="login-error"]', { timeout: 8000 }).then(() => true, () => false);
  check(blocked && new URL(page.url()).pathname === '/login', 'deactivated user cannot log in');
  await ctx.close();
}
await as('admin', 'delete the user (no history: removed permanently)', async (page) => {
  await goto(page, '/admin');
  await page.click('[data-testid="tab-a-users"]');
  await page.click(`[data-testid="delete-user-${email}"]`);
  await page.locator('[role="alertdialog"] button').last().click();
  await page.waitForTimeout(800);
  const us = (await api('admin', '/users')).data.find((u) => u.email === email);
  check(!us || us.active === false, `user with history is removed or archived-inactive (${us ? 'kept inactive' : 'removed'})`);
});

// ============================================================ B. REJECT / PARTIAL APPROVAL
async function newReceipt(page, qtyCode, term, qty) {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-new"]');
  await pick(page, 'receipt-supplier', 'Test Supplier');
  await page.fill('[data-testid="receipt-invoice-no"]', `INV-X-${Date.now().toString().slice(-7)}`);
  await page.setInputFiles('[data-testid="receipt-attachment"]', { name: 'inv.png', mimeType: 'image/png', buffer: png });
  await pickItem(page, 'receipt-item-0', qtyCode, term);
  await page.fill('[data-testid="receipt-ordered_qty-0"]', String(qty));
  await page.fill('[data-testid="receipt-received_qty-0"]', String(qty));
  await page.click('[data-testid="receipt-submit-btn"]');
  return toast(page, /receipt created/i);
}
const storeOnion0 = await stockOf('STORE', 'ITM-ONION');
await as('store_keeper', 'create a receipt to reject', async (page) => check(await newReceipt(page, 'ITM-ONION', 'Onion', 3), 'toast: receipt created'));
let pend = (await api('procurement_manager', '/procurement/receipts?status=pending')).data;
await as('procurement_manager', 'reject the receipt', async (page) => {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-pending"]');
  await page.click(`[data-testid="review-${pend[0].receipt_no}"]`);
  await page.waitForSelector('[data-testid="reject-btn"]');
  const remarks = page.locator('[data-testid="approval-remarks"]');
  if (await remarks.count()) await remarks.fill('wrong goods');
  await page.click('[data-testid="reject-btn"]');
  check(await toast(page, /reject/i), 'toast: receipt rejected');
});
check((await stockOf('STORE', 'ITM-ONION')) === storeOnion0, 'rejected receipt did NOT add stock');
check((await api('admin', '/procurement/receipts?status=rejected')).data.length >= 1, 'receipt is listed as rejected');

await as('store_keeper', 'create a receipt for partial approval', async (page) => check(await newReceipt(page, 'ITM-ONION', 'Onion', 10), 'toast: receipt created'));
pend = (await api('procurement_manager', '/procurement/receipts?status=pending')).data;
await as('procurement_manager', 'approve only 6 of 10 KG', async (page) => {
  await goto(page, '/procurement');
  await page.click('[data-testid="tab-pr-pending"]');
  await page.click(`[data-testid="review-${pend[0].receipt_no}"]`);
  await page.waitForSelector('[data-testid="approve-qty-0"]');
  await page.fill('[data-testid="approve-qty-0"]', '6');
  await page.click('[data-testid="approve-partial-btn"]');
  check(await toast(page, /approved/i), 'toast: partial approval done');
});
check((await stockOf('STORE', 'ITM-ONION')) === storeOnion0 + 6000, `partial approval added exactly 6 KG (6000 GM): ${storeOnion0} -> ${await stockOf('STORE', 'ITM-ONION')}`);

// ============================================================ C. REJECT AN INTENT
const normalBefore = await stockOf('NORMK', 'ITM-CHICKEN');
await as('chef', 'raise an intent that will be rejected', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-intents"]');
  await pick(page, 'intent-type', /Normal Kitchen/);
  await pickItem(page, 'intent-item-0', 'ITM-CHICKEN', 'Chicken');
  await page.fill('[data-testid="intent-qty-0"]', '500');
  await page.click('[data-testid="intent-submit-btn"]');
  check(await toast(page, /intent/i), 'toast: intent raised');
});
const pi = (await api('store_keeper', '/kitchen/intents?status=pending')).data;
await as('store_keeper', 'reject the intent', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-issues"]');
  await page.click(`[data-testid="reject-intent-${pi[0].intent_no}"]`);
  check(await toast(page, /reject/i), 'toast: intent rejected');
});
check((await stockOf('NORMK', 'ITM-CHICKEN')) === normalBefore, 'rejected intent moved no stock');
check((await api('store_keeper', '/kitchen/intents?status=pending')).data.length === 0, 'no intents left pending');

// ============================================================ D. RECIPES CREATED IN THE UI (chef)
await as('chef', 'create sub-recipe and recipe in the UI', async (page) => {
  await goto(page, '/recipes');
  await page.click('[data-testid="tab-r-subrecipes"]');
  await page.click('[data-testid="new-subrecipe-btn"]');
  await page.fill('[data-testid="sub-name"]', `UI Sauce ${TAG}`);
  await page.fill('[data-testid="sub-code"]', `SR-UI-${TAG}`);
  await pick(page, 'sub-output', /Gravy Base/);
  await page.fill('[data-testid="sub-yield"]', '5');
  await page.click('[data-testid="sub-add-line"]');
  await pick(page, 'sub-line-item-0', /Onion/);
  await page.fill('[data-testid="sub-line-qty-0"]', '3');
  await page.click('[data-testid="sub-save-btn"]');
  check(await toast(page, /sub-recipe created/i), 'toast: sub-recipe created (yield calculated)');
  await page.waitForTimeout(500);
  await page.click('[data-testid="tab-r-recipes"]');
  await page.click('[data-testid="new-recipe-btn"]');
  await page.fill('[data-testid="recipe-name"]', `UI Dish ${TAG}`);
  await page.fill('[data-testid="recipe-code"]', `RCP-UI-${TAG}`);
  await pick(page, 'recipe-brand', 'Test Brand');
  await page.fill('[data-testid="recipe-price"]', '150');
  await page.click('[data-testid="recipe-add-line"]');
  await pick(page, 'recipe-line-ing-0', /Chicken/);
  await page.fill('[data-testid="recipe-line-qty-0"]', '120');
  await page.click('[data-testid="recipe-save-btn"]');
  check(await toast(page, /recipe (created|saved)|created/i), 'toast: recipe created');
});
const recs = (await api('chef', '/recipes')).data;
check(recs.some((r) => r.code === `RCP-UI-${TAG}`), 'UI-created recipe exists in the backend');

// ============================================================ E. BULK UPLOAD DIALOG (admin)
await as('admin', 'bulk upload dialog, template and validate', async (page) => {
  await goto(page, '/masters');
  await page.click('[data-testid="tab-m-items"]');
  await page.click('[data-testid="bulk-item-btn"]');
  await page.waitForSelector('[data-testid="bulk-dialog-item"]');
  const dl = page.waitForEvent('download', { timeout: 10000 });
  await page.click('[data-testid="bulk-template-item"]');
  const file = await (await dl).path();
  check(!!file, 'item template downloads');
  await page.setInputFiles('[data-testid="bulk-file-item"]', { name: 'items.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(file) });
  await page.waitForSelector('[data-testid="bulk-preview-item"], [data-testid="bulk-error-report-item"]', { timeout: 15000 }).then(
    async () => check(true, 'uploaded file is validated and a preview/error report is shown'),
    () => check(false, 'bulk validation preview/error report appears'));
  await page.screenshot({ path: `${OUT}/bulk-dialog.png` });
});

// ============================================================ F. EVERY REPORT TYPE (management)
await as('management', 'run every report in the UI', async (page) => {
  await goto(page, '/reports');
  await page.click('[data-testid="report-select"]');
  const names = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  await page.keyboard.press('Escape');
  check(names.length >= 8, `reports menu offers ${names.length} reports`);
  for (const n of names) {
    const errs = [];
    const h = (r) => { if (r.url().includes('/api/') && r.status() >= 400) errs.push(`${r.status()} ${new URL(r.url()).pathname}`); };
    page.on('response', h);
    await pick(page, 'report-select', n);
    const loc = page.locator('[data-testid="report-location"]');
    if (await loc.count()) { await loc.click(); await page.getByRole('option').first().click().catch(() => {}); }
    await page.click('[data-testid="report-run-btn"]');
    await page.waitForTimeout(900);
    page.off('response', h);
    const hasTable = (await page.locator('[data-testid="report-table"]').count()) > 0;
    check(errs.length === 0 && hasTable, `report "${n}" runs${errs.length ? ' | ' + errs.join(',') : ''}${hasTable ? '' : ' | no table'}`);
  }
});

// ============================================================ G. REOPEN A CLOSED DAY (admin)
await as('admin', 'reopen the closed day', async (page) => {
  await goto(page, '/kitchen');
  await page.click('[data-testid="tab-k-closing"]');
  const btn = page.locator(`[data-testid="reopen-${TODAY}"]`);
  if (!(await btn.count())) { check(false, 'reopen button present (needs an approved closing today)'); return; }
  const reason = page.locator(`[data-testid="reopen-reason-${TODAY}"]`);
  if (await reason.count()) await reason.fill('flow test reopen');
  await btn.click();
  check(await toast(page, /reopened/i), 'toast: day reopened (audit logged)');
});
const audit = (await api('admin', '/audit-logs')).data;
check(audit.some((a) => /reopen/i.test(a.action)), 'reopen is in the audit trail');

await browser.close();
const f = log.filter((l) => l.startsWith('FAIL'));
console.log(`\n==== ${log.length - f.length} passed, ${f.length} failed`);
f.forEach((x) => console.log('  ' + x));
process.exit(f.length ? 1 : 0);
