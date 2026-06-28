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

  console.log("Navigating to /analyze...");
  await page.goto('http://localhost:3000/analyze');
  await page.waitForTimeout(3000);
  
  // Click "Load Sample Game"
  console.log("Clicking Load Sample Game...");
  await page.click('#btn-sample-pgn');
  await page.waitForTimeout(1000);

  // Wait for button to become enabled
  console.log("Waiting for Engine to be Ready...");
  await page.waitForFunction(() => {
    const btn = document.querySelector('#btn-full-analysis');
    return btn && !btn.disabled;
  }, { timeout: 15000 });
  
  console.log("Engine Ready! Clicking Full Game Analysis...");
  await page.click('#btn-full-analysis');

  let complete = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const btnText = await page.textContent('#btn-full-analysis');
    console.log(`[${i}s] btn-text: ${btnText.trim().substring(0, 30)}...`);
    if (btnText.includes('Complete')) {
      complete = true;
      break;
    }
  }
  
  if (complete) {
    const moves = await page.evaluate(() => {
      const els = document.querySelectorAll('.move-cell');
      return Array.from(els).map(el => el.className).slice(0, 10);
    });
    console.log("First 10 move classes:", moves);
  } else {
    console.log("Analysis did not complete.");
  }

  await browser.close();
})();
