import { chromium } from 'playwright';

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
  console.log('Auth OK, token starts:', session.access_token?.substring(0, 30));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Track ALL requests to localhost:8015 with auth header info
  page.on('request', request => {
    const url = request.url();
    if (url.includes('localhost:8015')) {
      const authHeader = request.headers()['authorization'];
      const path = url.replace('http://localhost:8015', '');
      if (!authHeader) {
        console.log(`  !! NO AUTH HEADER: ${request.method()} ${path}`);
      }
    }
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('localhost:8015') && (status === 401 || status === 403)) {
      console.log(`  !! ${status} RESPONSE: ${response.request().method()} ${url.replace('http://localhost:8015', '')}`);
    }
  });

  // Inject session into localStorage
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Check localStorage
  const storedToken = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || '{}');
      return { key, hasAccessToken: !!val.access_token, tokenStart: val.access_token?.substring(0, 20) };
    }
    return null;
  });
  console.log('localStorage after inject:', storedToken);

  // Navigate to dashboard/leads (which has errors)
  console.log('\n--- Navigating to /dashboard/leads ---');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Check localStorage state AFTER page load
  const afterToken = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.includes('sb-'));
    const result = {};
    for (const k of keys) {
      try {
        const val = JSON.parse(localStorage.getItem(k) || '{}');
        result[k] = { hasAccessToken: !!val.access_token, tokenStart: val.access_token?.substring(0, 20) };
      } catch {
        result[k] = 'parse_error';
      }
    }
    return result;
  });
  console.log('\nlocalStorage after page load:', JSON.stringify(afterToken, null, 2));

  // Check console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
