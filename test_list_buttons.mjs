import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Open sidebar & click private room
  const hamburger = await page.$('#header-hamburger-toggle');
  await hamburger.click();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.getElementById('sidebar-nav-private_room')?.click();
  });
  await page.waitForTimeout(1000);

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('main button')).map(b => ({
      text: b.innerText.trim(),
      className: b.className
    }));
  });
  console.log('Buttons inside main:', buttons);

  await browser.close();
})();
