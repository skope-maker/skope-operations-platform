import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ['/', '/sales', '/procurement', '/inventory', '/kitchen', '/recipes', '/rd', '/wastage', '/masters', '/reports', '/rista', '/admin'];
const results = [];
let failed = false;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${page.url()}] ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => pageErrors.push(`[${page.url()}] ${String(e).slice(0, 200)}`));
page.on('response', (r) => {
  const u = r.url();
  if (u.startsWith(BASE) && r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, '')}`);
});

// 1) unauthenticated -> redirected to /login, page title/branding correct
await page.goto(BASE + '/sales', { waitUntil: 'networkidle' });
const title = await page.title();
const onLogin = page.url().endsWith('/login') && (await page.locator('[data-testid="login-page"]').count()) === 1;
results.push(['unauth redirect to /login', onLogin]);
results.push([`document title = "${title}"`, title === 'Skope Operations Platform']);
await page.screenshot({ path: `${OUT}/01-login.png` });

// 2) bad password shows error
await page.fill('[data-testid="login-email"]', process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com');
await page.fill('[data-testid="login-password"]', 'wrong-password');
await page.click('[data-testid="login-submit-btn"]');
await page.waitForSelector('[data-testid="login-error"]', { timeout: 10000 }).then(
  () => results.push(['bad password shows error', true]),
  () => results.push(['bad password shows error', false]),
);

// 3) good login -> dashboard
await page.fill('[data-testid="login-password"]', process.env.E2E_ADMIN_PASSWORD || 'admin123');
await page.click('[data-testid="login-submit-btn"]');
await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 }).then(
  () => results.push(['admin login lands in app shell', true]),
  () => results.push(['admin login lands in app shell', false]),
);
const token = await page.evaluate(() => localStorage.getItem('kitchen_token'));
results.push(['token stored in localStorage', !!token]);

// 4) every route renders without blank page / error boundary
for (const route of ROUTES) {
  const before = pageErrors.length;
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const bodyText = (await page.locator('body').innerText()).trim();
  const ok = bodyText.length > 20 && pageErrors.length === before && !page.url().endsWith('/login');
  results.push([`route ${route} renders (${bodyText.length} chars)`, ok]);
  await page.screenshot({ path: `${OUT}/route${route === '/' ? '-dashboard' : route.replace(/\//g, '-')}.png`, fullPage: false });
}

// 5) client-side navigation through the sidebar
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
for (const nav of ['nav-inventory', 'nav-reports', 'nav-masters']) {
  const el = page.locator(`[data-testid="${nav}"]`);
  if (await el.count()) {
    await el.first().click();
    await page.waitForTimeout(500);
    results.push([`sidebar ${nav} navigates (${new URL(page.url()).pathname})`, !page.url().endsWith('/login')]);
  } else {
    results.push([`sidebar ${nav} present`, false]);
  }
}

// 6) deep-link refresh keeps session (SPA fallback + auth restore)
await page.goto(BASE + '/inventory', { waitUntil: 'networkidle' });
results.push(['deep-link /inventory after reload stays authenticated', new URL(page.url()).pathname === '/inventory']);

// 7) logout returns to /login and clears token
await page.click('[data-testid="logout-btn"]');
await page.waitForURL('**/login', { timeout: 10000 }).then(
  () => results.push(['logout redirects to /login', true]),
  () => results.push(['logout redirects to /login', false]),
);
results.push(['token cleared after logout', (await page.evaluate(() => localStorage.getItem('kitchen_token'))) === null]);

await browser.close();

for (const [name, ok] of results) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed = true; }
console.log('\npage errors:', pageErrors.length); pageErrors.forEach((e) => console.log('  ', e));
console.log('console errors:', consoleErrors.length); [...new Set(consoleErrors)].slice(0, 15).forEach((e) => console.log('  ', e));
console.log('4xx/5xx responses:', badResponses.length); [...new Set(badResponses)].slice(0, 15).forEach((e) => console.log('  ', e));
process.exit(failed || pageErrors.length ? 1 : 0);
