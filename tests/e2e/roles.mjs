import { chromium } from 'playwright';

const BASE = process.argv[2];
const VIEW = process.argv[3] === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };

// Single source of truth copied from frontend/src/components/Layout.jsx (SECTIONS)
const ALL = ['admin', 'procurement_manager', 'store_keeper', 'store_manager', 'chef', 'management'];
const SECTIONS = [
  ['dashboard', '/', ALL],
  ['sales', '/sales', ['admin', 'chef', 'store_manager', 'management']],
  ['procurement', '/procurement', ['admin', 'procurement_manager', 'store_keeper', 'management']],
  ['inventory', '/inventory', ['admin', 'store_keeper', 'store_manager', 'chef', 'management']],
  ['kitchen', '/kitchen', ALL],
  ['recipes', '/recipes', ['admin', 'chef', 'management']],
  ['r-d', '/rd', ['admin', 'chef', 'management']],
  ['wastage', '/wastage', ['admin', 'chef', 'store_manager', 'management']],
  ['masters', '/masters', ['admin']],
  ['reports', '/reports', ['admin', 'procurement_manager', 'store_manager', 'management']],
  ['rista-sales', '/rista', ['admin', 'management']],
  ['administration', '/admin', ['admin']],
];
const USERS = {
  admin: [process.env.E2E_ADMIN_EMAIL || 'chennakeshavaediga@gmail.com', process.env.E2E_ADMIN_PASSWORD || 'admin123'],
  procurement_manager: ['procurement@kitchen.com', 'demo123'],
  store_keeper: ['keeper@kitchen.com', 'demo123'],
  store_manager: ['manager@kitchen.com', 'demo123'],
  chef: ['chef@kitchen.com', 'demo123'],
  management: ['management@kitchen.com', 'demo123'],
};

const browser = await chromium.launch();
let failures = 0;
const note = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const findings = [];

for (const [role, [email, pw]] of Object.entries(USERS)) {
  console.log(`\n=== ${role}`);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: VIEW.width < 800, isMobile: VIEW.width < 800 });
  const page = await ctx.newPage();
  const pageErrors = [];
  const api4xx = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400 && !r.url().includes('/auth/login')) api4xx.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', pw);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForSelector('[data-testid="current-user-name"]', { timeout: 15000 }).catch(() => {});
  const shown = await page.locator('[data-testid="current-user-role"]').first().innerText().catch(() => '');
  note(shown.toLowerCase().replace(/ /g, '_') === role, `login as ${role} shows role label "${shown}"`);

  // open the drawer on phones so nav links become visible
  if (VIEW.width < 800) await page.click('[data-testid="open-menu-btn"]');
  const visibleNav = [];
  for (const [id] of SECTIONS) {
    if (await page.locator(`[data-testid="nav-${id}"]:visible`).count()) visibleNav.push(id);
  }
  const expected = SECTIONS.filter(([, , roles]) => roles.includes(role)).map(([id]) => id);
  note(JSON.stringify(visibleNav) === JSON.stringify(expected), `nav sections for ${role}: [${visibleNav.join(', ')}]${JSON.stringify(visibleNav) === JSON.stringify(expected) ? '' : ' expected [' + expected.join(', ') + ']'}`);
  if (VIEW.width < 800) await page.click('[data-testid="close-menu-btn"]');

  for (const [id, path, roles] of SECTIONS) {
    const allowed = roles.includes(role);
    api4xx.length = 0; const errBefore = pageErrors.length;
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const landed = new URL(page.url()).pathname;
    const bodyLen = (await page.locator('main').innerText().catch(() => '')).trim().length;
    if (allowed) {
      note(landed === path && bodyLen > 15 && pageErrors.length === errBefore && api4xx.length === 0,
        `${role} -> ${path} renders with no errors${api4xx.length ? ' | API: ' + [...new Set(api4xx)].join(', ') : ''}`);
    } else {
      // not in the nav: record exactly what a hand-typed URL does
      const blocked = landed !== path;
      findings.push(`${role} typed ${path}: ${blocked ? 'redirected to ' + landed : 'page opened'}${api4xx.length ? ', API ' + [...new Set(api4xx)].join(' / ') : ''}`);
      note(landed === '/', `${role} typing forbidden ${path} is redirected home (landed ${landed}${api4xx.length ? ', API ' + [...new Set(api4xx)].join(' / ') : ''})`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${failures} failing check(s)`);
console.log('\nforbidden-URL behaviour:'); findings.forEach((f) => console.log('  ' + f));
process.exit(failures ? 1 : 0);
