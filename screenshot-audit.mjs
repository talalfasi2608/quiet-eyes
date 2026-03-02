import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('screenshots-audit');
const BASE = 'http://localhost:5173';

const SUPABASE_URL = 'https://mvywtnjptbpxvmoldrxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12eXd0bmpwdGJweHZtb2xkcnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ0MzQsImV4cCI6MjA4Njk4MDQzNH0.KgR1EEqMPokaDcaWnMVFBv2a9nvFkKMO2WaOWEznlwI';

async function run() {
  // Step 0: Authenticate via Supabase REST API to get session token
  console.log('0. Authenticating via Supabase API...');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: 'screenshot-test@quieteyes.co',
      password: 'Test123456',
    }),
  });

  if (!authRes.ok) {
    const errBody = await authRes.text();
    console.error('Auth failed:', authRes.status, errBody);
    process.exit(1);
  }

  const session = await authRes.json();
  console.log('   Authenticated as:', session.user?.email);

  // Build the localStorage value that Supabase JS client expects
  const storageKey = 'sb-mvywtnjptbpxvmoldrxe-auth-token';
  const storageValue = JSON.stringify(session);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'he-IL',
  });

  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Step 1: Navigate to the app and inject the session into localStorage
  console.log('1. Injecting session into localStorage...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: storageKey, value: storageValue });

  // Now navigate to dashboard — the auth guard should find the token
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Verify we're on the dashboard
  const currentUrl = page.url();
  console.log('   Current URL:', currentUrl);
  if (currentUrl.includes('/auth') || currentUrl === `${BASE}/`) {
    console.error('Login failed — redirected to:', currentUrl);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-login-failed.png`, fullPage: false });
    await browser.close();
    process.exit(1);
  }

  // Screenshot 1: Dashboard/Cockpit
  console.log('2. Screenshot: Dashboard');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-dashboard.png`, fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-dashboard-scrolled.png`, fullPage: false });

  // Screenshot 2: Focus page
  console.log('3. Screenshot: Focus');
  await page.goto(`${BASE}/dashboard/focus`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-focus.png`, fullPage: false });
  // Click on Opportunities tab
  const tabBtns = page.locator('button:has-text("הזדמנויות")');
  if (await tabBtns.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tabBtns.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-focus-tab2.png`, fullPage: false });
  }

  // Screenshot 3: Lead Sniper Feed
  console.log('4. Screenshot: Lead Sniper');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3-leads.png`, fullPage: false });

  // Try clicking approve button on a lead card
  const approveBtn = page.locator('button:has-text("ליד טוב")').first();
  if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/3-leads-clicked.png`, fullPage: false });
  }

  // Screenshot 4: Settings (try to save)
  console.log('5. Screenshot: Settings');
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/4-settings.png`, fullPage: false });

  // Click save button
  const saveBtn = page.locator('button:has-text("שמור שינויים")');
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/4-settings-saved.png`, fullPage: false });
  }

  // Screenshot 5: Reports page
  console.log('6. Screenshot: Reports');
  await page.goto(`${BASE}/dashboard/reports`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/5-reports.png`, fullPage: false });

  // Print console errors summary
  if (consoleErrors.length > 0) {
    console.log('\n--- Console Errors ---');
    const authErrors = consoleErrors.filter(e => e.includes('401') || e.includes('403'));
    console.log(`Total errors: ${consoleErrors.length}, Auth errors (401/403): ${authErrors.length}`);
    authErrors.slice(0, 5).forEach(e => console.log('  ', e.substring(0, 120)));
  } else {
    console.log('\n✓ No console errors detected!');
  }

  console.log('\nDone! All screenshots saved to screenshots-audit/');
  await browser.close();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
