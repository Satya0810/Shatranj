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

  await page.goto('http://localhost:3000/analyze');
  await page.waitForTimeout(2000);
  
  // Click "Load Sample Game"
  await page.click('#btn-sample-pgn');
  await page.waitForTimeout(2000);

  // Click "Full Game Analysis"
  console.log("Clicking Full Game Analysis...");
  await page.click('#btn-full-analysis');

  // Wait up to 30 seconds for analysis to finish
  let progress = 0;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const btnText = await page.textContent('#btn-full-analysis');
    console.log(`Button text at ${i}s: ${btnText.trim()}`);
    if (btnText.includes('Complete')) {
      console.log("Analysis completed successfully!");
      break;
    }
  }

  // Get classifications
  const moves = await page.evaluate(() => {
    const els = document.querySelectorAll('.move-cell');
    return Array.from(els).map(el => ({
      text: el.innerText,
      className: el.className
    }));
  });
  console.log("Move classifications:", moves.slice(0, 10));

  await browser.close();
})();
