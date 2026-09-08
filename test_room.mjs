import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Get current active mode or text
  console.log('Main text before click:', (await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).slice(0, 300));

  const privateRoomBtn = await page.$('button[id*="private_room"], [data-mode="private_room"], button:has-text("Private Room"), button:has-text("Private")');
  console.log('Button details:', await privateRoomBtn.evaluate(el => el.outerHTML));
  await privateRoomBtn.click();
  await page.waitForTimeout(2000);

  console.log('Main text after click:', (await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).slice(0, 500));

  await browser.close();
})();
