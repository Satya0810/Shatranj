import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`);
  });

  await page.goto('http://localhost:3000/play/computer');
  await page.waitForTimeout(1000);
  
  await page.click('button:has-text("Start Game")');
  await page.waitForTimeout(1000);

  // Click e2
  const e2Square = await page.locator('[data-square="e2"]');
  if (await e2Square.count() > 0) {
    const box = await e2Square.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    // Get all highlighted squares
    const highlighted = await page.evaluate(() => {
      const squares = document.querySelectorAll('[data-square]');
      const hl = [];
      squares.forEach(s => {
        const bg = s.style.background || s.style.backgroundColor;
        if (bg && bg.includes('rgba')) {
          hl.push({ square: s.getAttribute('data-square'), bg });
        }
      });
      return hl;
    });

    console.log("Highlighted squares after clicking e2:", highlighted);
  }
  
  await browser.close();
})();
