// Rista Sales screen: an admin loads the three Rista downloads (sales, cancelled orders, menu) and everyone allowed
// reads the report, filters it, downloads it, sees cancellations and looks up menu prices.
// Uses small made-up files for a branch "E2E Kitchen" in January 2030, so the numbers do not depend on other data.
// Loading the menu file replaces the whole stored Rista menu: use a throwaway database.
//   node rista.mjs <app address> <screenshot folder> [desktop|phone]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2];
const OUT = process.argv[3] || './out';
const VIEW = process.argv[4] === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
fs.mkdirSync(OUT, { recursive: true });
const USERS = {
  admin: [process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com', process.env.E2E_ADMIN_PASSWORD || 'admin123'],
  management: ['management@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
  chef: ['chef@kitchen.com', process.env.E2E_DEMO_PASSWORD || 'demo123'],
};

// ---- made-up Rista files (same columns as the real downloads; customer columns included to prove they are dropped)
const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
const SALES_H = ['Branch Name', 'Branch Code', 'Business Brand', 'Business Date', 'Invoice Date', 'Invoice Number', 'Order Source',
  'Source Order Number', 'Invoice Type', 'Sale Status', 'SKU', 'Type', 'Item Name', 'Sale Item Qty', 'Unit Rate', 'Gross Amount',
  'Discounts', 'Net Amount', 'Taxes', 'Tax Collected by Aggregator', 'Direct Charge', 'Indirect Charge', 'Channel', 'Account Name',
  'Customer Name', 'Customer Phone'];
const sale = (day, inv, src, sku, name, qty, gross, disc, channel, brand, account) =>
  ['E2E Kitchen', 'E2E', brand, day, `${day} 13:00:00`, inv, src, `S${inv}`, 'Sale', 'Closed', sku, 'Item', name, qty, gross / qty,
    gross, -disc, gross - disc, 0, 0, 0, 0, channel, account, 'Hidden Customer', '9000000000'];
const SALES = [SALES_H,
  sale('2030-01-01', 'E1', 'zomato', 'E2E-APPAM', 'E2E Appam', 2, 200, 20, 'Zomato(E2E Brand)', 'E2E Brand', 'E2E Brand'),
  sale('2030-01-01', 'E2', 'swiggy', 'E2E-ROLL', 'E2E Roll', 1, 150, 0, 'Swiggy(E2E Brand)', 'E2E Brand', 'E2E Other'),
  sale('2030-01-02', 'E3', 'swiggy', 'E2E-ROLL', 'E2E Roll', 3, 450, 50, 'Swiggy(E2E Other)', 'E2E Other', 'E2E Other')];
// net 180 + 150 + 400 = 730 over 3 orders; by brand ordered from: E2E Brand 330, E2E Other 400; by dish owner: 180 / 550
const CANCELLED = [['Branch Name', 'Branch Code', 'Business Brand', 'Business Date', 'Invoice Number', 'Order Source',
  'Order/Invoice Date', 'Status', 'Fulfillment Status', 'Channel', 'Time to Cancel', 'Cancel/Void Date', 'Cancel/Void By',
  'Reason For Cancel/Void', 'Gross Amount', 'Discounts', 'Net Amount', 'Taxes', 'Total', 'Customer Name'],
['E2E Kitchen', 'E2E', 'E2E Brand', '2030-01-01', 'E9', 'zomato', '2030-01-01 20:00:00', 'Voided', 'Accepted', 'Zomato(E2E Brand)',
  '4.0', '2030-01-01 20:04:00', 'SYSTEM', 'Cancelled by zomato. reject', 300, -30, 270, 0, 270, 'Hidden Customer']];
const MENU = [['SKU', 'CATEGORY', 'ITEM NAME', 'STATUS', 'ACCOUNT', 'MEASURING UNIT', 'PRICE INCLUDES TAX',
  'Price-E2E Kitchen:Zomato(E2E Brand)', 'Price-E2E Kitchen:Offline - E2E', 'DESCRIPTION'],
['E2E-APPAM', 'Breakfast', 'E2E Appam', 'Active', 'E2E Brand', 'ea', 'No', 120, 99, 'Soft and fluffy'],
['E2E-ROLL', 'Rolls', 'E2E Roll', 'Active', 'E2E Other', 'ea', 'No', 150, '', '']];
const FILE = {};
for (const [kind, rows] of Object.entries({ sales: SALES, cancelled: CANCELLED, menu: MENU })) {
  FILE[kind] = path.resolve(OUT, `e2e-rista-${kind}.csv`);
  fs.writeFileSync(FILE[kind], csv(rows));
}

const log = [];
const check = (ok, msg) => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); console.log(log.at(-1)); };
const browser = await chromium.launch();
async function as(role, name, fn) {
  console.log(`\n--- [${role}] ${name}`);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: VIEW.width < 800, isMobile: VIEW.width < 800, acceptDownloads: true });
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
    await page.screenshot({ path: `${OUT}/FAIL-rista-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  }
  check(errs.length === 0, `${name}: no page errors${errs.length ? ' ' + errs[0] : ''}`);
  await ctx.close();
}
const goto = async (page, p) => { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); };
const pick = async (page, testid, text) => { await page.click(`[data-testid="${testid}"]`); await page.getByRole('option', { name: text, exact: true }).first().click(); };
const text = (page, testid) => page.textContent(`[data-testid="${testid}"]`);
const waitText = (page, testid, s) => page.waitForFunction(([t, v]) => document.querySelector(`[data-testid="${t}"]`)?.textContent.includes(v), [testid, s], { timeout: 10000 }).then(() => true, () => false);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

async function e2eFilters(page) {
  await page.fill('[data-testid="rista-from"]', '2030-01-01');
  await page.fill('[data-testid="rista-to"]', '2030-01-02');
  await pick(page, 'rista-branch', 'E2E Kitchen');
}

await as('admin', 'load the three Rista files', async (page) => {
  await goto(page, '/rista');
  await page.click('[data-testid="tab-rista-files"]');
  for (const kind of ['sales', 'cancelled', 'menu']) {
    await page.setInputFiles(`[data-testid="rista-file-${kind}"]`, FILE[kind]);
    await page.click(`[data-testid="rista-send-${kind}"]`);
    await page.waitForSelector(`[data-testid="rista-result-${kind}"]`, { timeout: 30000 });
  }
  check((await text(page, 'rista-result-sales')).includes('3 orders') && (await text(page, 'rista-result-sales')).includes('730'), 'Sales file: 3 orders, net 730 reported after loading');
  check((await text(page, 'rista-result-cancelled')).includes('270'), 'Cancelled file: value 270 reported');
  check((await text(page, 'rista-result-menu')).includes('2 active dishes'), 'Menu file: 2 active dishes reported');
  check(await waitText(page, 'rista-imports', 'e2e-rista-sales.csv'), 'Files loaded list shows the sales file');
  check(await noOverflow(page), 'Upload tab fits the screen width');
});

await as('admin', 'refuse the wrong file', async (page) => {
  await goto(page, '/rista');
  await page.click('[data-testid="tab-rista-files"]');
  await page.setInputFiles('[data-testid="rista-file-sales"]', FILE.menu);
  await page.click('[data-testid="rista-send-sales"]');
  const toast = await page.locator('[data-sonner-toast]', { hasText: /not the Rista/ }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  check(toast, 'Loading the menu file as sales is refused with a clear message');
});

await as('admin', 'sales report and filters', async (page) => {
  await goto(page, '/rista');
  await e2eFilters(page);
  check(await waitText(page, 'rista-kpi-net', '730'), 'Net sales for E2E Kitchen, 1 to 2 Jan 2030: ₹730');
  check((await text(page, 'rista-kpi-orders')).includes('3'), 'Orders: 3');
  check(await waitText(page, 'rista-by-source', 'Swiggy'), 'By source table names Swiggy');
  await pick(page, 'rista-brand', 'E2E Other');
  check(await waitText(page, 'rista-kpi-net', '400'), 'Brand ordered from = E2E Other: ₹400');
  await pick(page, 'rista-brand-field', 'Dish owner');
  check(await waitText(page, 'rista-kpi-net', '730'), 'Switching the brand meaning clears the brand filter (back to ₹730)');
  await pick(page, 'rista-brand', 'E2E Other');
  check(await waitText(page, 'rista-kpi-net', '550'), 'Brand that owns the dish = E2E Other: ₹550');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('[data-testid="rista-download-xlsx"]')]);
  check(dl.suggestedFilename().endsWith('.xlsx'), `Download lines (Excel) gives ${dl.suggestedFilename()}`);
  const file = path.resolve(OUT, 'e2e-rista-download.xlsx');
  await dl.saveAs(file);
  check(fs.statSync(file).size > 1000, 'Downloaded Excel file is not empty');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('[data-testid="rista-download-csv"]')]);
  const body = fs.readFileSync(await dl2.path(), 'utf8');
  check(body.includes('E2E Roll') && !body.includes('E2E Appam'), 'CSV download follows the filters (only E2E Other dishes)');
  check(!body.includes('Hidden Customer') && !body.includes('9000000000'), 'CSV download has no customer name or phone');
  check(await noOverflow(page), 'Report fits the screen width');
});

await as('admin', 'cancelled orders', async (page) => {
  await goto(page, '/rista');
  await page.click('[data-testid="tab-rista-cancelled"]');
  await e2eFilters(page);
  check(await waitText(page, 'rista-kpi-cancelled', '1'), 'Cancelled orders for E2E Kitchen: 1');
  check((await text(page, 'rista-kpi-cancelled-value')).includes('270'), 'Cancelled value: ₹270');
  check((await text(page, 'rista-kpi-by-platform')).includes('1'), 'Cancelled by the platform: 1');
  check(await waitText(page, 'rista-cancelled-table', 'Cancelled by zomato'), 'The reason is listed');
  check(!(await text(page, 'rista-cancelled-table')).includes('Hidden Customer'), 'No customer name shown');
});

await as('admin', 'menu and prices', async (page) => {
  await goto(page, '/rista');
  await page.click('[data-testid="tab-rista-menu"]');
  await page.fill('[data-testid="rista-menu-search"]', 'E2E-APPAM');
  check(await waitText(page, 'rista-menu-table', 'E2E Appam'), 'Menu search by SKU finds the dish');
  check((await text(page, 'rista-menu-table')).includes('₹99 to ₹120'), 'Menu shows the price range across channels');
  await page.click('[data-testid="rista-prices-E2E-APPAM"]');
  check(await waitText(page, 'rista-prices-dialog', 'Zomato(E2E Brand)'), 'Prices dialog lists each channel');
  check((await text(page, 'rista-prices-dialog')).includes('Soft and fluffy'), 'Prices dialog shows the description');
  await page.keyboard.press('Escape');
  check(await waitText(page, 'rista-check-no-recipe', 'without a recipe'), 'Recipe check is shown');
});

await as('management', 'read-only access', async (page) => {
  await goto(page, '/rista');
  check(await page.locator('[data-testid="nav-rista-sales"]').count() > 0 || VIEW.width < 800, 'Rista Sales is in the menu');
  await e2eFilters(page);
  check(await waitText(page, 'rista-kpi-net', '730'), 'Management sees the report (₹730)');
  await page.click('[data-testid="tab-rista-files"]');
  check((await page.locator('[data-testid="rista-upload-sales"]').count()) === 0, 'Management has no upload buttons');
  check(await waitText(page, 'rista-imports', 'e2e-rista-sales.csv'), 'Management can see which files are loaded');
});

await as('chef', 'no access', async (page) => {
  await goto(page, '/rista');
  check(new URL(page.url()).pathname === '/', 'Chef opening /rista is sent to the dashboard');
  check((await page.locator('[data-testid="nav-rista-sales"]').count()) === 0, 'Chef has no Rista Sales menu entry');
});

await browser.close();
const f = log.filter((l) => l.startsWith('FAIL'));
console.log(`\n==== ${log.length - f.length} passed, ${f.length} failed`);
f.forEach((x) => console.log('  ' + x));
process.exit(f.length ? 1 : 0);
