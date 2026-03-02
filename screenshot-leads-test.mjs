import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.resolve('screenshots-leads');
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

  // Collect console errors/warnings
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[ERROR]', msg.text().substring(0, 200));
  });

  // Load and inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Navigate to dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  try {
    await page.waitForSelector('aside', { timeout: 15000 });
    console.log('Dashboard loaded!');
  } catch {
    console.log('Dashboard loading slow...');
    await page.waitForTimeout(10000);
  }
  await page.waitForTimeout(3000);

  // Navigate to Lead Sniper Feed via sidebar
  console.log('\n=== Lead Sniper Feed ===');
  const leadNav = page.locator('aside a:has-text("צלף הזדמנויות")');
  if (await leadNav.count() > 0) {
    await leadNav.first().click();
    await page.waitForTimeout(6000);
  } else {
    await page.goto(`${BASE}/dashboard/sniper`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(6000);
  }

  console.log(`URL: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1-leads-empty-state.png`, fullPage: false });

  // Check if "התחל משימה" (trigger mission) button exists
  const missionBtn = page.locator('button:has-text("התחל משימה")');
  if (await missionBtn.count() > 0) {
    console.log('Mission button found, clicking...');
    await missionBtn.click();
    // Wait for the mission to complete (can take 30-60s)
    console.log('Waiting for mission...');
    await page.waitForTimeout(45000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/2-leads-after-scan.png`, fullPage: false });

    // Check if any leads appeared
    const leadCards = page.locator('.glass-card').filter({ hasText: 'רלוונטיות' });
    const cardCount = await leadCards.count();
    console.log(`Lead cards found: ${cardCount}`);
  }

  // Also try the empty state trigger button
  const firstMissionBtn = page.locator('button:has-text("הפעל משימה ראשונה")');
  if (await firstMissionBtn.count() > 0) {
    console.log('"First mission" button visible - empty state works correctly');
  }

  // Final screenshot
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3-leads-final.png`, fullPage: false });

  console.log('\nDone! Screenshots saved to screenshots-leads/');
  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
