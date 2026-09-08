import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Check #root HTML
    const html = await page.evaluate(() => document.getElementById('root').innerHTML);
    console.log('Root HTML length:', html.length);
    if (html.includes('app-loading-fallback')) {
       console.log('Fallback is still present!');
    } else {
       console.log('App mounted successfully.');
    }
  } catch (e) {
    console.error('Goto error:', e);
  }

  await browser.close();
})();
