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

  // Track navigation
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`   [NAV] Navigated to: ${frame.url()}`);
    }
  });

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      console.log(`   [CONSOLE ERROR] ${msg.text().substring(0, 200)}`);
    }
  });

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Navigate to leads
  console.log('\n1. Navigating to leads...');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(6000);

  console.log(`   URL before click: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-before-click.png`, fullPage: false });

  // Use page.evaluate to find the "צפה" button and log what happens
  const buttonInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const viewButtons = buttons.filter(b => b.textContent?.includes('צפה'));

    return viewButtons.map((btn, i) => {
      const rect = btn.getBoundingClientRect();
      const parentClasses = [];
      let parent = btn.parentElement;
      for (let j = 0; j < 5 && parent; j++) {
        parentClasses.push({
          tag: parent.tagName,
          className: parent.className?.substring(0, 100),
          id: parent.id,
          hasOnClick: !!parent.onclick,
          isLink: parent.tagName === 'A' ? parent.href : null,
        });
        parent = parent.parentElement;
      }
      return {
        index: i,
        text: btn.textContent?.trim(),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        visible: rect.width > 0 && rect.height > 0,
        parents: parentClasses,
      };
    });
  });

  console.log('\n   Button analysis:');
  buttonInfo.forEach(info => {
    console.log(`   [${info.index}] "${info.text}" visible=${info.visible} pos=(${Math.round(info.rect.top)},${Math.round(info.rect.left)})`);
    info.parents.forEach((p, j) => {
      const link = p.isLink ? ` href="${p.isLink}"` : '';
      console.log(`     ${'  '.repeat(j)}↑ <${p.tag}> class="${p.className}"${link}`);
    });
  });

  // Try clicking via page.evaluate (bypasses Playwright event routing)
  console.log('\n   Clicking first "צפה" via evaluate...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const viewBtn = buttons.find(b => b.textContent?.includes('צפה'));
    if (viewBtn) {
      viewBtn.click();
      console.log('Button clicked via JS');
    } else {
      console.log('No button found');
    }
  });

  await page.waitForTimeout(2000);
  console.log(`   URL after JS click: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-after-jsclick.png`, fullPage: false });

  // Check modal
  const modal = page.locator('.fixed.inset-0.z-50');
  const modalVisible = await modal.isVisible().catch(() => false);
  console.log(`   Modal visible: ${modalVisible}`);

  // Check LeadDetailModal specifically
  const modalContent = await page.evaluate(() => {
    // Check for any fixed overlay
    const fixedEls = document.querySelectorAll('[class*="fixed"]');
    const overlays = Array.from(fixedEls).filter(el =>
      el.classList.contains('inset-0') ||
      el.getAttribute('class')?.includes('inset-0')
    );
    return overlays.map(el => ({
      className: el.className.substring(0, 200),
      innerHTML: el.innerHTML.substring(0, 300),
    }));
  });

  console.log(`   Fixed inset-0 elements: ${modalContent.length}`);
  modalContent.forEach((el, i) => {
    console.log(`   [${i}] class="${el.className}"`);
    console.log(`        html="${el.innerHTML.substring(0, 200)}"`);
  });

  // Also try: check if React state was actually updated
  const reactState = await page.evaluate(() => {
    // Try to find the LeadSniperFeed component's state
    const root = document.getElementById('root');
    if (!root) return 'no root';
    // Check if modalLead is rendered
    const modalElements = document.querySelectorAll('[class*="z-50"]');
    return `Found ${modalElements.length} z-50 elements`;
  });
  console.log(`   React state check: ${reactState}`);

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
