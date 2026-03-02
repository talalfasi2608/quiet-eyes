const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── Landing page full ──
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    document.querySelectorAll('.reveal-child').forEach(el => el.classList.add('visible'));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/tal89/AppData/Local/Temp/landing-full.png', fullPage: true });
  console.log('Landing full page screenshot saved');

  // ── Dashboard (authenticated) ──
  // Inject test user session
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  // Fill login form
  await page.fill('input[type="email"]', 'screenshot-test@quieteyes.co');
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/tal89/AppData/Local/Temp/dashboard-final.png' });
  console.log('Dashboard screenshot saved');

  await browser.close();
})().catch(e => console.error(e));
