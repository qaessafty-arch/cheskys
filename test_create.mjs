import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Open sidebar if needed or click hamburger
  const hamburger = await page.$('#header-hamburger-toggle');
  if (hamburger) {
    await hamburger.click();
    await page.waitForTimeout(500);
  }

  // Click Private Room in sidebar
  const sidebarItem = await page.$('button:has-text("Private Room")');
  console.log('Sidebar item found:', Boolean(sidebarItem));
  if (sidebarItem) {
    await sidebarItem.click();
    await page.waitForTimeout(1000);
  }

  console.log('Text on page now:', (await page.evaluate(() => document.body.innerText)).slice(0, 300));

  // Click Create Room
  const createBtn = await page.$('button:has-text("Create Room"), button:has-text("Setup Waiting Room")');
  console.log('Create btn found:', Boolean(createBtn));
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Click Create Arena
    const createArenaBtn = await page.$('button:has-text("Create Arena")');
    console.log('Create Arena button found:', Boolean(createArenaBtn));
    if (createArenaBtn) {
      await createArenaBtn.click();
      await page.waitForTimeout(3000);
      console.log('Modal error or text:', (await page.evaluate(() => document.body.innerText)).slice(0, 500));
    }
  }

  await browser.close();
})();
