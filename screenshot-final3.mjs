import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('screenshots-audit');
const BASE = 'http://localhost:5173';
const SUPABASE_URL = 'https://mvywtnjptbpxvmoldrxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12eXd0bmpwdGJweHZtb2xkcnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ0MzQsImV4cCI6MjA4Njk4MDQzNH0.KgR1EEqMPokaDcaWnMVFBv2a9nvFkKMO2WaOWEznlwI';

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
  // 1. Lead Sniper — show cards + open modal
  // ═══════════════════════════════════════════════════════════════
  console.log('\n1. Lead Sniper Feed...');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  // Scroll to lead cards
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/6-leads-cards.png`, fullPage: false });

  // Click the 2nd "צפה" button (forum lead, null URL → opens modal)
  const viewButtons = page.locator('button:has-text("צפה")');
  const count = await viewButtons.count();
  console.log(`   Found ${count} "צפה" buttons`);

  if (count >= 2) {
    await viewButtons.nth(1).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-lead-modal.png`, fullPage: false });
    console.log('   ✓ Modal screenshot taken');

    // Close modal by clicking the backdrop (top-left corner outside modal)
    await page.mouse.click(50, 50);
    await page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Market Intelligence
  // ═══════════════════════════════════════════════════════════════
  console.log('\n2. Market Intelligence...');
  await page.goto(`${BASE}/dashboard/intelligence`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/8-market-intelligence.png`, fullPage: false });
  console.log('   ✓ Screenshot taken');

  // ═══════════════════════════════════════════════════════════════
  // 3. Console errors
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('CONSOLE ERRORS REPORT');
  console.log('═══════════════════════════════════════');
  if (consoleErrors.length === 0) {
    console.log('✓ ZERO red console errors detected!');
  } else {
    const authErrors = consoleErrors.filter(e => e.includes('401') || e.includes('403'));
    const nanErrors = consoleErrors.filter(e => e.includes('NaN'));
    const otherErrors = consoleErrors.filter(e => !e.includes('401') && !e.includes('403') && !e.includes('NaN'));

    console.log(`Total: ${consoleErrors.length}`);
    console.log(`  Auth errors (401/403): ${authErrors.length}`);
    console.log(`  NaN warnings: ${nanErrors.length}`);
    console.log(`  Other errors: ${otherErrors.length}`);

    if (authErrors.length > 0) {
      console.log('\nAuth errors:');
      [...new Set(authErrors)].forEach(e => console.log(`  ✗ ${e.substring(0, 200)}`));
    }
    if (nanErrors.length > 0) {
      console.log('\nNaN warnings:');
      [...new Set(nanErrors)].forEach(e => console.log(`  ⚠ ${e.substring(0, 200)}`));
    }
    if (otherErrors.length > 0) {
      console.log('\nOther errors:');
      [...new Set(otherErrors)].forEach(e => console.log(`  ? ${e.substring(0, 200)}`));
    }
  }
  console.log('═══════════════════════════════════════');

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
