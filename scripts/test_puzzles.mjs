import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`BROWSER ERROR: ${err.message}`);
  });

  await page.goto('http://localhost:3000/puzzles');
  await page.waitForTimeout(3000);
  
  await browser.close();
})();
