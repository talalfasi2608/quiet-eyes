import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('screenshots-audit');
const BASE = 'http://localhost:5173';
const SUPABASE_URL = 'https://mvywtnjptbpxvmoldrxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12eXd0bmpwdGJweHZtb2xkcnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ0MzQsImV4cCI6MjA4Njk4MDQzNH0.KgR1EEqMPokaDcaWnMVFBv2a9nvFkKMO2WaOWEznlwI';

async function run() {
  // Authenticate
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

  // Collect ALL console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // ═══════════════════════════════════════════════════════════════
  // 1. Lead Sniper — click "צפה" to open modal
  // ═══════════════════════════════════════════════════════════════
  console.log('\n1. Navigating to Lead Sniper...');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/6-leads-page.png`, fullPage: false });

  // Check if there are leads with a "צפה" button
  const viewButtons = page.locator('button:has-text("צפה")');
  const viewCount = await viewButtons.count();
  console.log(`   Found ${viewCount} "צפה" buttons`);

  if (viewCount > 0) {
    // Click the first "צפה" button
    await viewButtons.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-lead-modal.png`, fullPage: false });
    console.log('   Modal screenshot taken');

    // Close modal by clicking backdrop
    const backdrop = page.locator('.fixed.inset-0.z-50');
    if (await backdrop.count() > 0) {
      // Click the X button inside the modal
      const closeBtn = page.locator('.fixed.inset-0.z-50 button:has(svg)').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  } else {
    console.log('   No leads found — checking if empty state is showing...');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-leads-empty.png`, fullPage: false });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Market Intelligence page
  // ═══════════════════════════════════════════════════════════════
  console.log('\n2. Navigating to Market Intelligence...');
  await page.goto(`${BASE}/dashboard/intelligence`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/8-market-intelligence.png`, fullPage: false });
  console.log('   Screenshot taken');

  // ═══════════════════════════════════════════════════════════════
  // 3. Console errors summary
  // ═══════════════════════════════════════════════════════════════
  console.log('\n3. Console Errors Summary:');
  if (consoleErrors.length === 0) {
    console.log('   ✓ ZERO console errors!');
  } else {
    const authErrors = consoleErrors.filter(e => e.includes('401') || e.includes('403'));
    const otherErrors = consoleErrors.filter(e => !e.includes('401') && !e.includes('403'));
    console.log(`   Total: ${consoleErrors.length} errors`);
    console.log(`   Auth (401/403): ${authErrors.length}`);
    console.log(`   Other: ${otherErrors.length}`);

    // Print each unique error
    const unique = [...new Set(consoleErrors)];
    unique.forEach((e, i) => {
      console.log(`   [${i + 1}] ${e.substring(0, 200)}`);
    });
  }

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
