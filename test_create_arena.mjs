import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Open sidebar & click private room
  const hamburger = await page.$('#header-hamburger-toggle');
  await hamburger.click();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.getElementById('sidebar-nav-private_room')?.click();
  });
  await page.waitForTimeout(1000);

  // Click "Create Room" button in Private Room view
  const createBtn = await page.$('button:has-text("Create Room")');
  console.log('Create Room button found:', Boolean(createBtn));
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Click "Create Arena" inside modal
    const createArenaBtn = await page.$('button:has-text("Create Arena")');
    console.log('Create Arena button found:', Boolean(createArenaBtn));
    if (createArenaBtn) {
      await createArenaBtn.click();
      await page.waitForTimeout(4000);

      // Check text of body or error message
      const modalText = await page.evaluate(() => document.body.innerText);
      console.log('Text after create click:', modalText.slice(0, 500));
    }
  }

  await browser.close();
})();
