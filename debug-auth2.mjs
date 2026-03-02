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

  // Intercept requests to check Authorization header
  page.on('request', request => {
    const url = request.url();
    if (url.includes('localhost:8015')) {
      const authHeader = request.headers()['authorization'];
      const path = url.replace('http://localhost:8015', '');
      if (!authHeader) {
        console.log(`  NO AUTH: ${request.method()} ${path}`);
      }
    }
  });

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Check localStorage from the page
  const storedKeys = await page.evaluate(() => {
    return Object.keys(localStorage).filter(k => k.includes('sb-'));
  });
  console.log('localStorage keys:', storedKeys);

  // Navigate to dashboard
  console.log('\n--- /dashboard ---');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Check if localStorage still has the token
  const afterKeys = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || '{}');
      return { key, hasToken: !!val.access_token, tokenStart: val.access_token?.substring(0, 20) };
    }
    return { key: null };
  });
  console.log('After dashboard load, localStorage:', afterKeys);

  console.log('\n--- /dashboard/focus ---');
  await page.goto(`${BASE}/dashboard/focus`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
