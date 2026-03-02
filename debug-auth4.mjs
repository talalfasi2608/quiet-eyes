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
  console.log('Auth OK');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Log ALL console messages from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[apiFetch]') || text.includes('401') || text.includes('403')) {
      console.log(`  CONSOLE: ${text}`);
    }
  });

  // Track failed API responses
  page.on('request', request => {
    const url = request.url();
    if (url.includes('localhost:8015')) {
      const auth = request.headers()['authorization'];
      const path = url.replace('http://localhost:8015', '');
      if (!auth) {
        console.log(`  >> NO AUTH: ${request.method()} ${path}`);
      }
    }
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('localhost:8015') && (status === 401 || status === 403)) {
      console.log(`  << ${status}: ${url.replace('http://localhost:8015', '')}`);
    }
  });

  // Step 1: Go to base, inject session, then use SDK setSession
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Also try to set session via SDK
  const sdkResult = await page.evaluate(async (sessionData) => {
    // @ts-ignore
    if (window.__SUPABASE_CLIENT__) {
      try {
        await window.__SUPABASE_CLIENT__.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });
        return 'SDK setSession OK';
      } catch (e) {
        return 'SDK setSession failed: ' + e.message;
      }
    }
    return 'No global Supabase client found';
  }, session);
  console.log('SDK setSession:', sdkResult);

  // Test: navigate to dashboard
  console.log('\n--- /dashboard ---');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);

  console.log('\n--- /dashboard/leads ---');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
