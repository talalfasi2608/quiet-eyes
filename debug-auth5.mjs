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
  const originalToken = session.access_token;
  console.log('Original token starts:', originalToken?.substring(0, 40));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Log what token is being sent with each request
  page.on('request', request => {
    const url = request.url();
    if (url.includes('localhost:8015')) {
      const auth = request.headers()['authorization'] || '';
      const token = auth.replace('Bearer ', '');
      const path = url.replace('http://localhost:8015', '');
      const tokenMatch = token === originalToken ? 'ORIGINAL' : token ? 'DIFFERENT' : 'NONE';
      console.log(`  >> ${request.method()} ${path} [token: ${tokenMatch}${token ? ', starts: ' + token.substring(0, 20) : ''}]`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('localhost:8015')) {
      const path = url.replace('http://localhost:8015', '');
      if (status >= 400) {
        console.log(`  << ${status}: ${path}`);
      }
    }
  });

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Page 1: dashboard
  console.log('\n=== /dashboard ===');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Check localStorage token after page 1
  const token1 = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || '{}');
      return val.access_token?.substring(0, 40);
    }
    return null;
  });
  console.log('Token after page 1:', token1);

  // Page 2: leads
  console.log('\n=== /dashboard/leads ===');
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Check localStorage token after page 2
  const token2 = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || '{}');
      return val.access_token?.substring(0, 40);
    }
    return null;
  });
  console.log('Token after page 2:', token2);

  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
