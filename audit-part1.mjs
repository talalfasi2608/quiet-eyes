import { chromium } from 'playwright';

const results = [];

function log(status, part, num, description, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : status === 'FAIL' ? '\u274C' : '\u26A0\uFE0F';
  const line = `${icon} ${status} - [Part ${part} #${num}] ${description}${detail ? ' -- ' + detail : ''}`;
  results.push(line);
  console.log(line);
}

async function testPart1(page) {
  console.log('\n========== PART 1: LANDING PAGE ==========\n');

  // 1. Page loads with Hebrew content
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    const bodyText = await page.textContent('body');
    const hasHebrew = /[\u0590-\u05FF]/.test(bodyText);
    if (hasHebrew) {
      log('PASS', 1, 1, 'Page loads with Hebrew content');
    } else {
      log('FAIL', 1, 1, 'Page loads with Hebrew content', 'No Hebrew characters found on page');
    }
  } catch (e) {
    log('FAIL', 1, 1, 'Page loads with Hebrew content', e.message);
  }

  // 2. Logo visible
  try {
    const logo = await page.locator('img[src*="logo"]').first();
    const isVisible = await logo.isVisible({ timeout: 3000 });
    if (isVisible) {
      log('PASS', 1, 2, 'Logo visible');
    } else {
      log('FAIL', 1, 2, 'Logo visible', 'Logo img element found but not visible');
    }
  } catch (e) {
    log('FAIL', 1, 2, 'Logo visible', e.message);
  }

  // 3. Hero section visible with animated elements
  try {
    // Hero has the h1 with "הרשת יודעת הכל"
    const heroH1 = page.locator('h1');
    const heroVisible = await heroH1.first().isVisible({ timeout: 3000 });
    // Check for animated star/particle elements
    const stars = await page.locator('.landing-star').count();
    const particles = await page.locator('.landing-particle').count();
    if (heroVisible && (stars > 0 || particles > 0)) {
      log('PASS', 1, 3, 'Hero section visible with animated elements', `stars=${stars}, particles=${particles}`);
    } else if (heroVisible) {
      log('PARTIAL', 1, 3, 'Hero section visible with animated elements', 'Hero visible but no animated elements detected');
    } else {
      log('FAIL', 1, 3, 'Hero section visible with animated elements', 'Hero h1 not visible');
    }
  } catch (e) {
    log('FAIL', 1, 3, 'Hero section visible with animated elements', e.message);
  }

  // 4. CTA button exists ("התחל" or "התחל חינם")
  try {
    const ctaFree = page.locator('button', { hasText: 'התחל חינם' });
    const ctaStart = page.locator('button', { hasText: 'התחל' });
    const cta14 = page.locator('button', { hasText: 'התחל 14 יום חינם' });
    const ctaFreeCount = await ctaFree.count();
    const ctaStartCount = await ctaStart.count();
    const cta14Count = await cta14.count();
    if (ctaFreeCount > 0 || cta14Count > 0) {
      log('PASS', 1, 4, 'CTA button exists', `"התחל חינם" buttons: ${ctaFreeCount}, "התחל 14 יום חינם" buttons: ${cta14Count}`);
    } else if (ctaStartCount > 0) {
      log('PASS', 1, 4, 'CTA button exists', `"התחל" buttons found: ${ctaStartCount}`);
    } else {
      log('FAIL', 1, 4, 'CTA button exists', 'No CTA button with "התחל" text found');
    }
  } catch (e) {
    log('FAIL', 1, 4, 'CTA button exists', e.message);
  }

  // 5. "התחברות" or login link exists
  try {
    const loginBtn = page.locator('button', { hasText: 'התחברות' });
    const count = await loginBtn.count();
    if (count > 0) {
      log('PASS', 1, 5, '"התחברות" login link exists', `Found ${count} element(s)`);
    } else {
      log('FAIL', 1, 5, '"התחברות" login link exists', 'No element with "התחברות" text found');
    }
  } catch (e) {
    log('FAIL', 1, 5, '"התחברות" login link exists', e.message);
  }

  // 6. Pricing section exists (scroll down)
  try {
    const pricingSection = page.locator('#pricing');
    const exists = await pricingSection.count();
    if (exists > 0) {
      await pricingSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const pricingText = await pricingSection.textContent();
      const hasPricingContent = pricingText.includes('מחירים') || pricingText.includes('תוכניות');
      if (hasPricingContent) {
        log('PASS', 1, 6, 'Pricing section exists');
      } else {
        log('PARTIAL', 1, 6, 'Pricing section exists', 'Section #pricing found but no pricing text detected');
      }
    } else {
      // Try finding by text
      const pricingByText = page.locator('text=תוכניות ומחירים');
      const textCount = await pricingByText.count();
      if (textCount > 0) {
        log('PASS', 1, 6, 'Pricing section exists', 'Found by text content');
      } else {
        log('FAIL', 1, 6, 'Pricing section exists', 'No #pricing section or pricing text found');
      }
    }
  } catch (e) {
    log('FAIL', 1, 6, 'Pricing section exists', e.message);
  }

  // 7. FAQ section exists
  try {
    const faqHeading = page.locator('text=שאלות נפוצות');
    const count = await faqHeading.count();
    if (count > 0) {
      log('PASS', 1, 7, 'FAQ section exists');
    } else {
      log('FAIL', 1, 7, 'FAQ section exists', 'No "שאלות נפוצות" text found');
    }
  } catch (e) {
    log('FAIL', 1, 7, 'FAQ section exists', e.message);
  }

  // 8. Footer exists
  try {
    const footer = page.locator('footer');
    const count = await footer.count();
    if (count > 0) {
      const footerText = await footer.textContent();
      const hasContent = footerText.includes('Quieteyes') || footerText.includes('תנאי שימוש');
      if (hasContent) {
        log('PASS', 1, 8, 'Footer exists');
      } else {
        log('PARTIAL', 1, 8, 'Footer exists', 'Footer tag found but missing expected content');
      }
    } else {
      log('FAIL', 1, 8, 'Footer exists', 'No <footer> element found');
    }
  } catch (e) {
    log('FAIL', 1, 8, 'Footer exists', e.message);
  }

  // 9. Navigation links exist
  try {
    const navLinks = [];
    const howItWorks = await page.locator('button', { hasText: 'איך זה עובד' }).count();
    const pricing = await page.locator('button', { hasText: 'מחירים' }).count();
    const login = await page.locator('button', { hasText: 'התחברות' }).count();
    if (howItWorks > 0) navLinks.push('איך זה עובד');
    if (pricing > 0) navLinks.push('מחירים');
    if (login > 0) navLinks.push('התחברות');
    if (navLinks.length >= 2) {
      log('PASS', 1, 9, 'Navigation links exist', `Found: ${navLinks.join(', ')}`);
    } else if (navLinks.length > 0) {
      log('PARTIAL', 1, 9, 'Navigation links exist', `Only found: ${navLinks.join(', ')}`);
    } else {
      log('FAIL', 1, 9, 'Navigation links exist', 'No nav links found');
    }
  } catch (e) {
    log('FAIL', 1, 9, 'Navigation links exist', e.message);
  }
}

async function testPart2(page) {
  console.log('\n========== PART 2: AUTH FLOW ==========\n');

  // 1. Login page loads
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    const url = page.url();
    const bodyText = await page.textContent('body');
    if (url.includes('/login') && bodyText.length > 0) {
      log('PASS', 2, 1, 'Login page loads');
    } else {
      log('FAIL', 2, 1, 'Login page loads', `URL: ${url}`);
    }
  } catch (e) {
    log('FAIL', 2, 1, 'Login page loads', e.message);
  }

  // 2. Email input field exists
  try {
    const emailInput = page.locator('input#email, input[type="email"]');
    const count = await emailInput.count();
    if (count > 0) {
      const isVisible = await emailInput.first().isVisible();
      if (isVisible) {
        log('PASS', 2, 2, 'Email input field exists');
      } else {
        log('FAIL', 2, 2, 'Email input field exists', 'Input found but not visible');
      }
    } else {
      log('FAIL', 2, 2, 'Email input field exists', 'No email input found');
    }
  } catch (e) {
    log('FAIL', 2, 2, 'Email input field exists', e.message);
  }

  // 3. Password input field exists
  try {
    const pwInput = page.locator('input#password, input[type="password"]');
    const count = await pwInput.count();
    if (count > 0) {
      const isVisible = await pwInput.first().isVisible();
      if (isVisible) {
        log('PASS', 2, 3, 'Password input field exists');
      } else {
        log('FAIL', 2, 3, 'Password input field exists', 'Input found but not visible');
      }
    } else {
      log('FAIL', 2, 3, 'Password input field exists', 'No password input found');
    }
  } catch (e) {
    log('FAIL', 2, 3, 'Password input field exists', e.message);
  }

  // 4. Submit button exists
  try {
    const submitBtn = page.locator('button[type="submit"]');
    const count = await submitBtn.count();
    if (count > 0) {
      const isVisible = await submitBtn.first().isVisible();
      const text = await submitBtn.first().textContent();
      if (isVisible) {
        log('PASS', 2, 4, 'Submit button exists', `Text: "${text.trim()}"`);
      } else {
        log('FAIL', 2, 4, 'Submit button exists', 'Submit button found but not visible');
      }
    } else {
      log('FAIL', 2, 4, 'Submit button exists', 'No submit button found');
    }
  } catch (e) {
    log('FAIL', 2, 4, 'Submit button exists', e.message);
  }

  // 5. Hebrew text/labels present
  try {
    const labels = page.locator('label');
    const labelCount = await labels.count();
    let hebrewLabelCount = 0;
    for (let i = 0; i < labelCount; i++) {
      const text = await labels.nth(i).textContent();
      if (/[\u0590-\u05FF]/.test(text)) hebrewLabelCount++;
    }
    if (hebrewLabelCount > 0) {
      log('PASS', 2, 5, 'Hebrew text/labels present', `Found ${hebrewLabelCount} Hebrew labels`);
    } else {
      log('FAIL', 2, 5, 'Hebrew text/labels present', 'No Hebrew labels found');
    }
  } catch (e) {
    log('FAIL', 2, 5, 'Hebrew text/labels present', e.message);
  }

  // 6. Error shown for empty submit
  try {
    // The form uses HTML5 required attribute, so empty submit won't go through.
    // Check if submit with empty fields triggers browser validation or custom error.
    const emailInput = page.locator('input#email');
    const pwInput = page.locator('input#password');

    // Clear fields first
    await emailInput.fill('');
    await pwInput.fill('');

    // Try to submit
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Check for HTML5 validation - the required attribute prevents submission
    // The inputs have 'required' attribute, so browser will show validation popup
    const emailRequired = await emailInput.getAttribute('required');
    const pwRequired = await pwInput.getAttribute('required');

    // Also check if custom error appeared
    const errorDiv = page.locator('text=שגיאה');
    const errorCount = await errorDiv.count();

    if (emailRequired !== null || pwRequired !== null) {
      log('PASS', 2, 6, 'Error shown for empty submit', 'HTML5 required validation prevents empty submit (inputs have required attribute)');
    } else if (errorCount > 0) {
      log('PASS', 2, 6, 'Error shown for empty submit', 'Custom error message shown');
    } else {
      log('PARTIAL', 2, 6, 'Error shown for empty submit', 'No visible error message, but form may use browser validation');
    }
  } catch (e) {
    log('FAIL', 2, 6, 'Error shown for empty submit', e.message);
  }

  // 7. "שכחתי סיסמה" or forgot password link exists
  try {
    const forgotPw = page.locator('text=שכחתי סיסמה');
    const forgotPwAlt = page.locator('text=שכחת סיסמה');
    const forgotCount = await forgotPw.count();
    const forgotAltCount = await forgotPwAlt.count();
    if (forgotCount > 0 || forgotAltCount > 0) {
      log('PASS', 2, 7, '"שכחתי סיסמה" forgot password link exists');
    } else {
      // The AuthPage.tsx doesn't have a forgot password link
      log('FAIL', 2, 7, '"שכחתי סיסמה" forgot password link exists', 'No forgot password link found in the auth page');
    }
  } catch (e) {
    log('FAIL', 2, 7, '"שכחתי סיסמה" forgot password link exists', e.message);
  }
}

// Main execution
(async () => {
  console.log('='.repeat(60));
  console.log('  QUIETEYES AUDIT - Parts 1-3');
  console.log('  Date: ' + new Date().toISOString());
  console.log('='.repeat(60));

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'he-IL',
    });
    const page = await context.newPage();

    await testPart1(page);
    await testPart2(page);

    await browser.close();
  } catch (e) {
    console.error('Browser launch error:', e.message);
    if (browser) await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  const pass = results.filter(r => r.includes('\u2705')).length;
  const fail = results.filter(r => r.includes('\u274C')).length;
  const partial = results.filter(r => r.includes('\u26A0\uFE0F')).length;
  console.log(`  PASS: ${pass}  |  FAIL: ${fail}  |  PARTIAL: ${partial}  |  TOTAL: ${results.length}`);
  console.log('='.repeat(60));
})();
