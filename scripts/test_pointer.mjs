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
    const pointerEvents = await page.evaluate(() => {
      const e2 = document.querySelector('[data-square="e2"]');
      return getComputedStyle(e2).pointerEvents;
    });
    
    console.log("Pointer events on e2:", pointerEvents);
    
    // what about the piece itself?
    const piece = await page.evaluate(() => {
      const p = document.querySelector('[data-piece="wP"]');
      return p ? getComputedStyle(p).pointerEvents : 'no piece';
    });
    console.log("Pointer events on white pawn:", piece);
  }
  
  await browser.close();
})();
