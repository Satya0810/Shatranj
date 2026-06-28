import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:3000/analyze');
  console.log('Page loaded');
  
  await page.waitForTimeout(2000);
  
  const importTextarea = await page.$('#pgn-textarea');
  if (importTextarea) {
    console.log('On Import Screen');
    await importTextarea.fill('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');
    await page.click('button:has-text("Import")');
    console.log('Imported PGN');
    await page.waitForTimeout(1000);
  }
  
  const analyzeBtn = await page.$('button:has-text("Full Game Analysis")');
  if (analyzeBtn) {
    console.log('Clicking Full Game Analysis');
    await analyzeBtn.click();
    
    for(let i=0; i<7; i++) {
      await page.waitForTimeout(5000);
      const isDone = await page.$('#analysis-summary');
      if (isDone) {
        console.log('Analysis finished successfully!');
        break;
      }
      console.log('Waiting... ' + (i*5+5) + 's');
    }
  } else {
    console.log('Analyze button not found');
  }
  
  await browser.close();
})();
