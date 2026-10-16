import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const TAG = Date.now().toString().slice(-6);
const results = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('[data-testid="login-email"]', process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com');
await page.fill('[data-testid="login-password"]', process.env.E2E_ADMIN_PASSWORD || 'admin123');
await page.click('[data-testid="login-submit-btn"]');
await page.waitForSelector('[data-testid="current-user-name"]');

// --- Masters: create a brand through the dialog
await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
await page.click('[data-testid="new-brand-btn"]');
await page.waitForSelector('[data-testid="master-form"]');
await page.fill('[data-testid="brand-name"]', `UI Brand ${TAG}`);
await page.fill('[data-testid="brand-code"]', `UI${TAG}`);
await page.click('[data-testid="master-save-btn"]');
await page.waitForSelector(`text=UI Brand ${TAG}`, { timeout: 10000 }).then(
  () => results.push(['create brand via UI dialog -> appears in table', true]),
  () => results.push(['create brand via UI dialog -> appears in table', false]),
);
await page.screenshot({ path: `${OUT}/masters-after-create.png` });

// --- Radix tabs: switch to Units tab and see seeded units
await page.click('[data-testid="tab-m-units"]');
await page.waitForSelector('text=Kilogram', { timeout: 10000 }).then(
  () => results.push(['tabs switch -> Units list shows seeded unit', true]),
  () => results.push(['tabs switch -> Units list shows seeded unit', false]),
);

// --- Persistence: verify through the API with the browser's own token
const found = await page.evaluate(async (tag) => {
  const token = localStorage.getItem('kitchen_token');
  const r = await fetch('/api/brands', { headers: { Authorization: `Bearer ${token}` } });
  const list = await r.json();
  return list.some((b) => b.name === `UI Brand ${tag}`);
}, TAG);
results.push(['brand persisted in backend (read via same-origin /api proxy)', found]);

// --- Delete it again through UI (ConfirmDialog = Radix AlertDialog)
await page.click('[data-testid="tab-m-brands"]');
const row = page.locator('tr', { hasText: `UI Brand ${TAG}` });
await row.locator('[data-testid^="delete-"]').first().click();
await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 }).then(
  () => results.push(['confirm dialog opens (Radix AlertDialog)', true]),
  () => results.push(['confirm dialog opens (Radix AlertDialog)', false]),
);
const confirmBtn = page.locator('[role="alertdialog"] button').last();
await confirmBtn.click();
await page.waitForSelector(`text=UI Brand ${TAG}`, { state: 'detached', timeout: 10000 }).then(
  () => results.push(['delete brand via UI confirm -> removed from table', true]),
  () => results.push(['delete brand via UI confirm -> removed from table', false]),
);

// --- File upload through the real UI endpoint used by Procurement attachments
const uploaded = await page.evaluate(async () => {
  const token = localStorage.getItem('kitchen_token');
  const fd = new FormData();
  fd.append('file', new Blob(['ui-upload'], { type: 'text/plain' }), 'ui.txt');
  const up = await fetch('/api/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  const j = await up.json();
  const dl = await fetch(`/api/files/${j.path}?auth=${encodeURIComponent(token)}`);
  return { status: up.status, back: await dl.text() };
});
results.push(['browser file upload + authenticated download round-trip', uploaded.status === 200 && uploaded.back === 'ui-upload']);

await browser.close();
let failed = false;
for (const [n, ok] of results) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) failed = true; }
console.log('page errors:', pageErrors.length); pageErrors.forEach((e) => console.log('  ', e));
process.exit(failed || pageErrors.length ? 1 : 0);
