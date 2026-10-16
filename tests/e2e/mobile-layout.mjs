import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
const W = Number(process.argv[4] || 375);
const H = Number(process.argv[5] || 812);
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ['/', '/sales', '/procurement', '/inventory', '/kitchen', '/recipes', '/rd', '/wastage', '/masters', '/reports', '/admin'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();

// login screen first
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${OUT}/login.png`, fullPage: true });
const loginMetrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
console.log(`LOGIN overflow=${loginMetrics.overflow}`);

await page.fill('[data-testid="login-email"]', process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com');
await page.fill('[data-testid="login-password"]', process.env.E2E_ADMIN_PASSWORD || 'admin123');
await page.click('[data-testid="login-submit-btn"]');
await page.waitForSelector('[data-testid="current-user-name"]');

const audit = () => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === 'auto' || o === 'scroll' || o === 'hidden') && p.scrollWidth > p.clientWidth - 1) return true;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && r.right <= vw + 1) continue;
    if (r.right > vw + 1 && !inScroller(el)) {
      offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} w=${Math.round(r.width)} right=${Math.round(r.right)} "${(el.innerText || '').slice(0, 30).replace(/\n/g, ' ')}"`);
    }
  }
  const small = [];
  for (const el of document.querySelectorAll('button, a, [role="tab"], [role="combobox"], input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 36 || r.width < 36) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.innerText || el.getAttribute('aria-label') || el.placeholder || '').slice(0, 24).replace(/\n/g, ' ')}"`);
  }
  const smallFont = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (parseFloat(getComputedStyle(el).fontSize) < 16) smallFont.push(`${el.tagName.toLowerCase()} ${getComputedStyle(el).fontSize}`);
  }
  return {
    overflow: document.documentElement.scrollWidth - vw,
    offenders: [...new Set(offenders)].slice(0, 8),
    smallTargets: small.length, smallSample: [...new Set(small)].slice(0, 5),
    smallFontInputs: smallFont.length,
  };
});

let bad = 0;
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const m = await audit();
  const name = route === '/' ? 'dashboard' : route.slice(1);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const flag = m.overflow > 0 ? 'OVERFLOW' : 'ok';
  if (m.overflow > 0) bad++;
  console.log(`${flag.padEnd(8)} ${route.padEnd(13)} overflow=${m.overflow}px smallTargets=${m.smallTargets} smallFontInputs=${m.smallFontInputs}`);
  m.offenders.forEach((o) => console.log('           ! ' + o));
  m.smallSample.slice(0, 3).forEach((o) => console.log('           . ' + o));
}

// drawer
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.click('[data-testid="open-menu-btn"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/drawer.png` });
await page.click('[data-testid="nav-inventory"]:visible');
await page.waitForTimeout(500);
console.log('drawer navigates to', new URL(page.url()).pathname, '| drawer closed:', (await page.locator('[data-testid="close-menu-btn"]').count()) === 0);

// dialogs
const dialogs = [
  ['/masters', 'new-brand-btn', 'dlg-masters-brand'],
  ['/masters', 'new-item-btn', 'dlg-masters-item'],
  ['/procurement', null, 'dlg-procurement'],
  ['/sales', null, 'dlg-sales'],
  ['/wastage', null, 'dlg-wastage'],
];
for (const [route, tid, name] of dialogs) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  if (name === 'dlg-masters-item') { await page.click('[data-testid="tab-m-items"]'); await page.waitForTimeout(300); }
  let btn;
  if (tid) btn = page.locator(`[data-testid="${tid}"]`);
  else btn = page.locator('main button:has-text("New"), main button:has-text("Record"), main button:has-text("Add")').first();
  if (!(await btn.count())) { console.log('no dialog trigger on', route); continue; }
  await btn.first().click();
  await page.waitForTimeout(500);
  const d = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), vw, fits: r.left >= -1 && r.right <= vw + 1, scrollOverflowX: dlg.scrollWidth - dlg.clientWidth };
  });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`DIALOG ${route} ${name}: ${JSON.stringify(d)}`);
  if (d && (!d.fits || d.scrollOverflowX > 0)) bad++;
  await page.keyboard.press('Escape');
}
await browser.close();
console.log(bad ? `\n${bad} issue(s) found` : '\nno overflow issues');
