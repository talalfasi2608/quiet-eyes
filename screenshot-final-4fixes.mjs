import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.resolve('screenshots-4fixes');
const BASE = 'http://localhost:5173';
const SUPABASE_URL = 'https://mvywtnjptbpxvmoldrxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12eXd0bmpwdGJweHZtb2xkcnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ0MzQsImV4cCI6MjA4Njk4MDQzNH0.KgR1EEqMPokaDcaWnMVFBv2a9nvFkKMO2WaOWEznlwI';

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function run() {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: 'screenshot-test@quieteyes.co', password: 'Test123456' }),
  });
  const session = await authRes.json();
  console.log('Authenticated as:', session.user?.email);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Inject session then load dashboard
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Navigate to dashboard and wait for it to fully load
  console.log('Loading dashboard...');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Wait until the loading screen disappears (sidebar appears)
  try {
    await page.waitForSelector('aside', { timeout: 15000 });
    console.log('Dashboard loaded!');
  } catch {
    console.log('Dashboard loading slow, waiting more...');
    await page.waitForTimeout(10000);
  }
  await page.waitForTimeout(3000);

  // Helper: navigate via sidebar link
  const navTo = async (text, waitMs = 5000) => {
    const link = page.locator(`aside a:has-text("${text}")`);
    if (await link.count() > 0) {
      await link.first().click();
      await page.waitForTimeout(waitMs);
      return true;
    }
    return false;
  };

  // ═══════════════════════════════════════════════════════════════
  // 1. Focus page - Daily Plan
  // ═══════════════════════════════════════════════════════════════
  console.log('\n1. Focus page - Daily Plan...');
  const focusNav = await navTo('מיקוד', 6000);
  if (!focusNav) {
    console.log('   Sidebar nav failed, trying direct URL');
    await page.goto(`${BASE}/dashboard/focus`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(8000);
  }

  console.log(`   URL: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-focus-top.png`, fullPage: false });

  // Click "תכנית יומית" tab
  const dailyTab = page.locator('button:has-text("תכנית יומית")');
  if (await dailyTab.count() > 0) {
    await dailyTab.click();
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-focus-daily-plan.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-focus-daily-plan-scroll.png`, fullPage: false });

  // Click "הזדמנויות" tab
  const oppTab = page.locator('button:has-text("הזדמנויות")');
  if (await oppTab.count() > 0) {
    await oppTab.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-focus-opportunities.png`, fullPage: false });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Settings - Save test
  // ═══════════════════════════════════════════════════════════════
  console.log('\n2. Settings page...');
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);

  const saveBtn = page.locator('button:has-text("שמור")');
  if (await saveBtn.count() > 0) {
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-settings-before.png`, fullPage: false });
    await saveBtn.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-settings-after-save.png`, fullPage: false });
    console.log('   ✓ Save button clicked');
  } else {
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-settings.png`, fullPage: false });
    console.log('   No save button found');
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Horizon (אופק) - Trends
  // ═══════════════════════════════════════════════════════════════
  console.log('\n3. Horizon page...');
  if (!await navTo('אופק', 5000)) {
    await page.goto(`${BASE}/dashboard/horizon`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  }
  // Wait for trends to load (AI-powered, can take 30s+)
  console.log('   Waiting for trends...');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(5000);
    const loading = await page.locator('text=סורק מגמות').isVisible().catch(() => false);
    if (!loading) { console.log(`   Loaded after ${(i+1)*5}s`); break; }
    if (i % 2 === 1) console.log(`   Still scanning... ${(i+1)*5}s`);
  }
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3-horizon-top.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3-horizon-bottom.png`, fullPage: false });

  // ═══════════════════════════════════════════════════════════════
  // 4. Reflection (השתקפות) - Reviews
  // ═══════════════════════════════════════════════════════════════
  console.log('\n4. Reflection page...');
  if (!await navTo('השתקפות', 5000)) {
    await page.goto(`${BASE}/dashboard/reflection`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  }
  // Wait for review analysis (Tavily + Claude, can take 60s+)
  console.log('   Waiting for analysis...');
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(5000);
    const loading = await page.locator('text=מנתח ביקורות').isVisible().catch(() => false);
    if (!loading) { console.log(`   Done after ${(i+1)*5}s`); break; }
    if (i % 3 === 2) console.log(`   Still analyzing... ${(i+1)*5}s`);
  }
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/4-reflection-top.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/4-reflection-bottom.png`, fullPage: false });

  // ═══════════════════════════════════════════════════════════════
  // 5. Console errors
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('CONSOLE ERRORS');
  console.log('═══════════════════════════════════════');
  if (consoleErrors.length === 0) {
    console.log('✓ ZERO console errors!');
  } else {
    console.log(`Total: ${consoleErrors.length}`);
    const unique = [...new Set(consoleErrors)];
    unique.forEach((e, i) => console.log(`[${i + 1}] ${e.substring(0, 250)}`));
  }
  console.log('═══════════════════════════════════════');

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
