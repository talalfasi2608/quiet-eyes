const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = 'C:/Users/tal89/AppData/Local/Temp';
const RESULTS_PATH = path.join(SCREENSHOT_DIR, 'audit-results.json');

const CREDENTIALS = {
  email: 'screenshot-test@quieteyes.co',
  password: 'TestPass123!',
};

// Pages to audit before login
const PRE_LOGIN_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
];

// Pages to audit after login
const DASHBOARD_PAGES = [
  { name: 'dashboard-cockpit', path: '/dashboard' },
  { name: 'dashboard-focus', path: '/dashboard/focus' },
  { name: 'dashboard-landscape', path: '/dashboard/landscape' },
  { name: 'dashboard-intelligence', path: '/dashboard/intelligence' },
  { name: 'dashboard-sniper', path: '/dashboard/sniper' },
  { name: 'dashboard-horizon', path: '/dashboard/horizon' },
  { name: 'dashboard-reflection', path: '/dashboard/reflection' },
  { name: 'dashboard-knowledge', path: '/dashboard/knowledge' },
  { name: 'dashboard-vault', path: '/dashboard/vault' },
  { name: 'dashboard-reports', path: '/dashboard/reports' },
  { name: 'dashboard-staff', path: '/dashboard/staff' },
  { name: 'dashboard-billing', path: '/dashboard/billing' },
  { name: 'dashboard-settings', path: '/dashboard/settings' },
];

async function auditPage(page, pageName, pageUrl, consoleLog) {
  const result = {
    pageName,
    url: pageUrl,
    consoleErrors: [],
    consoleWarnings: [],
    hasVisibleErrors: false,
    stuckLoading: false,
    visibleErrorTexts: [],
    screenshotPath: path.join(SCREENSHOT_DIR, `audit-${pageName}.png`),
    navigationOk: true,
    finalUrl: '',
  };

  // Clear previous console entries for this page
  const pageErrors = [];
  const pageWarnings = [];

  const onConsole = (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      pageErrors.push(text);
    } else if (type === 'warning') {
      pageWarnings.push(text);
    }
  };

  page.on('console', onConsole);

  try {
    // Navigate
    console.log(`  Navigating to ${pageUrl} ...`);
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (response && response.status() >= 400) {
      result.consoleErrors.push(`HTTP ${response.status()} response`);
    }
  } catch (err) {
    result.navigationOk = false;
    result.consoleErrors.push(`Navigation error: ${err.message}`);
  }

  // Wait 3 seconds for data to load
  await page.waitForTimeout(3000);

  result.finalUrl = page.url();

  // Check for stuck loading spinners (wait up to 5 more seconds)
  try {
    const spinnerSelectors = [
      '.animate-spin',
      '[class*="spinner"]',
      '[class*="loading"]',
      '[role="progressbar"]',
      '.loader',
      '[data-loading="true"]',
    ];

    let hasSpinner = false;
    for (const sel of spinnerSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        // Visible check
        for (let i = 0; i < count; i++) {
          const visible = await page.locator(sel).nth(i).isVisible().catch(() => false);
          if (visible) {
            hasSpinner = true;
            break;
          }
        }
      }
      if (hasSpinner) break;
    }

    if (hasSpinner) {
      // Wait 5 more seconds and recheck
      console.log(`    Spinner detected, waiting 5 more seconds...`);
      await page.waitForTimeout(5000);

      let stillSpinning = false;
      for (const sel of spinnerSelectors) {
        const count = await page.locator(sel).count();
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const visible = await page.locator(sel).nth(i).isVisible().catch(() => false);
            if (visible) {
              stillSpinning = true;
              break;
            }
          }
        }
        if (stillSpinning) break;
      }
      result.stuckLoading = stillSpinning;
    }
  } catch (err) {
    // Ignore spinner check errors
  }

  // Check for visible error text on the page
  try {
    const errorIndicators = await page.evaluate(() => {
      const errors = [];
      // Look for elements with error-like text
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.children.length > 0) continue; // only leaf nodes
        const text = (el.textContent || '').trim();
        if (!text || text.length > 300) continue;
        const lower = text.toLowerCase();
        // Match common error patterns
        if (
          (lower.includes('error') && !lower.includes('console')) ||
          lower.includes('something went wrong') ||
          lower.includes('failed to') ||
          lower.includes('not found') ||
          lower.includes('unexpected') ||
          lower.includes('could not load') ||
          lower.includes('unable to')
        ) {
          // Check if it's actually visible
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          ) {
            errors.push(text.substring(0, 200));
          }
        }
      }
      return [...new Set(errors)];
    });

    if (errorIndicators.length > 0) {
      result.hasVisibleErrors = true;
      result.visibleErrorTexts = errorIndicators;
    }
  } catch (err) {
    // Ignore evaluation errors
  }

  // Take screenshot
  try {
    await page.screenshot({ path: result.screenshotPath, fullPage: false });
    console.log(`    Screenshot saved: ${result.screenshotPath}`);
  } catch (err) {
    result.consoleErrors.push(`Screenshot error: ${err.message}`);
  }

  // Collect console entries
  result.consoleErrors.push(...pageErrors);
  result.consoleWarnings.push(...pageWarnings);

  // Remove listener
  page.removeListener('console', onConsole);

  return result;
}

(async () => {
  console.log('=== Quiet Eyes Comprehensive Audit ===\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  const allResults = [];

  // ── Phase 1: Pre-login pages ──
  console.log('Phase 1: Pre-login pages\n');
  for (const pg of PRE_LOGIN_PAGES) {
    console.log(`[${pg.name}]`);
    const result = await auditPage(page, pg.name, `${BASE_URL}${pg.path}`, []);
    allResults.push(result);
    console.log(`    Errors: ${result.consoleErrors.length}, Warnings: ${result.consoleWarnings.length}, Visible errors: ${result.hasVisibleErrors}\n`);
  }

  // ── Phase 2: Login ──
  console.log('Phase 2: Logging in...\n');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', CREDENTIALS.email);
    await page.fill('input[type="password"]', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    console.log(`  Post-login URL: ${currentUrl}`);
    if (currentUrl.includes('/dashboard')) {
      console.log('  Login successful!\n');
    } else {
      console.log('  WARNING: May not have logged in successfully. Continuing anyway.\n');
    }
  } catch (err) {
    console.error(`  Login failed: ${err.message}\n`);
  }

  // ── Phase 3: Dashboard pages ──
  console.log('Phase 3: Dashboard pages\n');
  for (const pg of DASHBOARD_PAGES) {
    console.log(`[${pg.name}]`);
    const result = await auditPage(page, pg.name, `${BASE_URL}${pg.path}`, []);
    allResults.push(result);
    console.log(`    Errors: ${result.consoleErrors.length}, Warnings: ${result.consoleWarnings.length}, Visible errors: ${result.hasVisibleErrors}, Stuck loading: ${result.stuckLoading}\n`);
  }

  // ── Write results ──
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\nResults written to: ${RESULTS_PATH}`);

  // ── Summary ──
  console.log('\n=== AUDIT SUMMARY ===\n');
  let totalErrors = 0;
  let totalWarnings = 0;
  let pagesWithVisibleErrors = 0;
  let pagesStuckLoading = 0;

  for (const r of allResults) {
    totalErrors += r.consoleErrors.length;
    totalWarnings += r.consoleWarnings.length;
    if (r.hasVisibleErrors) pagesWithVisibleErrors++;
    if (r.stuckLoading) pagesStuckLoading++;

    const status = [];
    if (r.consoleErrors.length > 0) status.push(`${r.consoleErrors.length} errors`);
    if (r.consoleWarnings.length > 0) status.push(`${r.consoleWarnings.length} warnings`);
    if (r.hasVisibleErrors) status.push('VISIBLE ERRORS');
    if (r.stuckLoading) status.push('STUCK LOADING');
    if (!r.navigationOk) status.push('NAV FAILED');

    const statusStr = status.length > 0 ? status.join(', ') : 'OK';
    console.log(`  ${r.pageName.padEnd(28)} ${statusStr}`);
    if (r.finalUrl !== r.url) {
      console.log(`    -> Redirected to: ${r.finalUrl}`);
    }
    if (r.visibleErrorTexts && r.visibleErrorTexts.length > 0) {
      for (const t of r.visibleErrorTexts) {
        console.log(`    [visible] ${t}`);
      }
    }
    if (r.consoleErrors.length > 0) {
      for (const e of r.consoleErrors) {
        const short = e.length > 150 ? e.substring(0, 150) + '...' : e;
        console.log(`    [console error] ${short}`);
      }
    }
  }

  console.log(`\n  TOTALS: ${allResults.length} pages audited`);
  console.log(`    Console errors:      ${totalErrors}`);
  console.log(`    Console warnings:    ${totalWarnings}`);
  console.log(`    Visible error pages: ${pagesWithVisibleErrors}`);
  console.log(`    Stuck loading pages: ${pagesStuckLoading}`);

  await browser.close();
  console.log('\nAudit complete.');
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
