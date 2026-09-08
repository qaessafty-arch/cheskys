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

  // Check if sidebar element exists and is visible
  const isVisible = await page.isVisible('#sidebar-nav-private_room');
  console.log('Is #sidebar-nav-private_room visible?', isVisible);

  // Click via evaluate
  await page.evaluate(() => {
    const el = document.getElementById('sidebar-nav-private_room');
    if (el) {
      console.log('Found el, innerHTML:', el.innerHTML);
      el.click();
    } else {
      console.log('Element not found in evaluate!');
    }
  });

  await page.waitForTimeout(1500);
  console.log('Main HTML:', (await page.evaluate(() => document.querySelector('main')?.innerHTML || '')).slice(0, 400));
  console.log('Main text:', (await page.evaluate(() => document.querySelector('main')?.innerText || '')).slice(0, 400));

  await browser.close();
})();
