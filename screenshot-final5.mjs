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
  // 1. Lead Sniper Feed — correct route is /dashboard/sniper
  // ═══════════════════════════════════════════════════════════════
  console.log('\n1. Lead Sniper Feed...');
  await page.goto(`${BASE}/dashboard/sniper`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(6000);
  console.log(`   URL: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/6-leads-cards.png`, fullPage: false });

  // Find "צפה" buttons
  const viewButtons = page.locator('button:has-text("צפה")');
  const count = await viewButtons.count();
  console.log(`   Found ${count} "צפה" buttons`);

  // ═══════════════════════════════════════════════════════════════
  // 2. Click "צפה" to open lead modal
  // ═══════════════════════════════════════════════════════════════
  console.log('\n2. Opening lead modal...');
  if (count > 0) {
    const btn = viewButtons.first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await btn.click();
    await page.waitForTimeout(1500);

    console.log(`   URL after click: ${page.url()}`);

    // Check for modal
    const modal = page.locator('.fixed.inset-0.z-50');
    const modalVisible = await modal.isVisible().catch(() => false);
    console.log(`   Modal visible: ${modalVisible}`);

    if (modalVisible) {
      console.log('   ✓ Modal opened!');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-lead-modal.png`, fullPage: false });

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // Try other buttons
      for (let i = 1; i < count; i++) {
        console.log(`   Trying button ${i}...`);
        await viewButtons.nth(i).scrollIntoViewIfNeeded().catch(() => {});
        await viewButtons.nth(i).click();
        await page.waitForTimeout(1000);

        const mv = await modal.isVisible().catch(() => false);
        if (mv) {
          console.log(`   ✓ Modal opened from button ${i}!`);
          await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-lead-modal.png`, fullPage: false });
          break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Market Intelligence
  // ═══════════════════════════════════════════════════════════════
  console.log('\n3. Market Intelligence...');
  await page.goto(`${BASE}/dashboard/intelligence`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/8-market-intelligence.png`, fullPage: false });
  console.log('   ✓ Screenshot taken');

  // ═══════════════════════════════════════════════════════════════
  // 4. Console errors
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
