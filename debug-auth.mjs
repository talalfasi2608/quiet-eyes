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
  console.log('Authenticated as:', session.user?.email);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const page = await context.newPage();

  // Track ALL failed API requests
  const failedRequests = [];
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('localhost:8015') && (status === 401 || status === 403)) {
      failedRequests.push({ url: url.replace('http://localhost:8015', ''), status, method: response.request().method() });
    }
  });

  // Inject session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: 'sb-mvywtnjptbpxvmoldrxe-auth-token', value: JSON.stringify(session) });

  // Visit each page and collect errors
  const pages = [
    '/dashboard',
    '/dashboard/focus',
    '/dashboard/leads',
    '/dashboard/intelligence',
    '/dashboard/horizon',
    '/dashboard/landscape',
    '/dashboard/settings',
    '/dashboard/reports',
    '/dashboard/staff',
    '/dashboard/vault',
    '/dashboard/knowledge-base',
  ];

  for (const p of pages) {
    failedRequests.length = 0;
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    if (failedRequests.length > 0) {
      console.log(`\n${p}:`);
      failedRequests.forEach(r => console.log(`  ${r.status} ${r.method} ${r.url}`));
    }
  }

  console.log('\nDone.');
  await browser.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
