import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('response', response => {
    if (response.status() === 404) {
      console.log('404 URL:', response.url());
    }
  });

  try {
    await page.goto('https://qaessafty-arch.github.io/cheskys/', { waitUntil: 'networkidle' });
  } catch (e) {}

  await browser.close();
})();
