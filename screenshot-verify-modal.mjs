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

  // Navigate to leads
  console.log('\n1. Navigating to Lead Sniper Feed...');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(6000);

  // Debug: dump all button text on the page
  const allBtns = await page.locator('button').allTextContents();
  console.log('   All buttons on page:', allBtns.filter(t => t.trim()).join(' | '));

  // Screenshot the page
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/verify-1-leads-page.png`, fullPage: false });

  // Debug: dump the HTML of the first lead card
  const firstCard = page.locator('.glass-card').first();
  const cardHtml = await firstCard.innerHTML().catch(() => 'NO CARD');
  console.log('\n   First card HTML (first 500 chars):', cardHtml.substring(0, 500));

  // Find "צפה" buttons specifically inside the lead cards area
  const viewButtons = page.locator('button:has-text("צפה")');
  const count = await viewButtons.count();
  console.log(`\n   Found ${count} "צפה" buttons`);

  for (let i = 0; i < Math.min(count, 3); i++) {
    const btn = viewButtons.nth(i);
    const btnText = await btn.textContent();
    const isVisible = await btn.isVisible();
    console.log(`   Button ${i}: text="${btnText?.trim()}", visible=${isVisible}`);
  }

  // Try clicking the first visible "צפה" button
  if (count > 0) {
    const btn = viewButtons.first();
    console.log('\n   Clicking first "צפה" button...');

    // Scroll into view first
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    await btn.click({ force: true });
    console.log('   Clicked!');

    await page.waitForTimeout(2000);

    // Screenshot immediately
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/verify-2-after-click.png`, fullPage: false });

    // Check for modal
    const modal = page.locator('.fixed.inset-0.z-50');
    const modalCount = await modal.count();
    const modalVisible = modalCount > 0 ? await modal.first().isVisible() : false;
    console.log(`   Modal: count=${modalCount}, visible=${modalVisible}`);

    // Also check for any overlay/dialog
    const anyFixed = page.locator('[class*="fixed"][class*="inset-0"]');
    const fixedCount = await anyFixed.count();
    console.log(`   Fixed overlays: count=${fixedCount}`);

    // Dump all fixed elements
    for (let i = 0; i < fixedCount; i++) {
      const cls = await anyFixed.nth(i).getAttribute('class');
      console.log(`     Fixed[${i}]: ${cls}`);
    }

    if (modalVisible) {
      console.log('   ✓ MODAL IS OPEN!');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/7-lead-modal.png`, fullPage: false });
    } else {
      console.log('   ✗ Modal NOT visible');
      // Check if page URL changed (external navigation)
      console.log(`   Current URL: ${page.url()}`);
    }
  }

  // Market Intelligence
  console.log('\n2. Market Intelligence...');
  await page.goto(`${BASE}/dashboard/intelligence`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/8-market-intelligence.png`, fullPage: false });
  console.log('   ✓ Screenshot taken');

  // Console errors
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
