import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.resolve('screenshots-audit');
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

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // ═══════════════════════════════════════════════════════════════
  // 1. Lead Sniper + Modal (Fix 1)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n1. Lead Sniper Feed + Modal...');
  await page.goto(`${BASE}/dashboard/sniper`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix1-leads.png`, fullPage: false });

  const viewButtons = page.locator('button:has-text("צפה")');
  const count = await viewButtons.count();
  if (count > 0) {
    await viewButtons.first().click();
    await page.waitForTimeout(1500);
    const modal = page.locator('.fixed.inset-0.z-50');
    if (await modal.isVisible().catch(() => false)) {
      console.log('   ✓ Modal opened!');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix1-modal.png`, fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Focus page - Daily Plan tab (Fix 3)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n2. Focus page - Daily Plan...');
  await page.goto(`${BASE}/dashboard/focus`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix3-focus-top.png`, fullPage: false });

  // Click "תכנית יומית" tab if not already active, then scroll down
  const dailyTab = page.locator('button:has-text("תכנית יומית")');
  if (await dailyTab.count() > 0) {
    await dailyTab.click();
    await page.waitForTimeout(3000);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix3-daily-plan.png`, fullPage: false });

  // Click "הזדמנויות" tab
  const oppTab = page.locator('button:has-text("הזדמנויות")');
  if (await oppTab.count() > 0) {
    await oppTab.click();
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix3-opportunities.png`, fullPage: false });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Landscape - Competitor Cards (Fix 4)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n3. Landscape - Competitor Cards...');
  await page.goto(`${BASE}/dashboard/landscape`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);
  // Scroll to competitor cards section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix4-landscape.png`, fullPage: false });

  // ═══════════════════════════════════════════════════════════════
  // 4. Intelligence page (Fix 2 buttons)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n4. Market Intelligence...');
  await page.goto(`${BASE}/dashboard/intelligence`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fix2-intelligence.png`, fullPage: false });

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
