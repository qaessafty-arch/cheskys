import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Inject mock user to trigger logged-in state
    await page.evaluate(() => {
      localStorage.setItem('chess_guest_session', JSON.stringify({
        uid: 'test_guest_1',
        displayName: 'Guest Player',
        createdAt: Date.now()
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    console.log('Page reloaded with mock user and data');
    
  } catch (e) {
    console.error('Goto error:', e);
  }

  await browser.close();
})();
