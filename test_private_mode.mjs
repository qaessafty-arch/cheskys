import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Open sidebar
  const hamburger = await page.$('#header-hamburger-toggle');
  await hamburger.click();
  await page.waitForTimeout(500);

  const btn = await page.$('#sidebar-nav-private_room');
  console.log('sidebar-nav-private_room found:', Boolean(btn));
  if (btn) {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  console.log('Main area text:', (await page.evaluate(() => document.querySelector('main')?.innerText || '')).slice(0, 400));

  await browser.close();
})();
