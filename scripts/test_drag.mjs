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

  // Drag e2 to e4
  const e2Square = await page.locator('[data-square="e2"]');
  const e4Square = await page.locator('[data-square="e4"]');
  
  if (await e2Square.count() > 0 && await e4Square.count() > 0) {
    // Click e2
    await e2Square.click();
    await page.waitForTimeout(100);
    
    // Click e4
    await e4Square.click();
    await page.waitForTimeout(500);

    // Verify pieces
    const emptyE2 = await page.locator('[data-square="e2"] [data-piece]').count() === 0;
    const pawnOnE4 = await page.locator('[data-square="e4"] [data-piece="wP"]').count() > 0;
    
    console.log("Click move successful?", emptyE2 && pawnOnE4);
    if (!emptyE2 || !pawnOnE4) {
      console.log("Empty e2:", emptyE2);
      console.log("Pawn on e4:", pawnOnE4);
    }
  }
  
  await browser.close();
})();
