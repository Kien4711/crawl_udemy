const BASE_URL = "https://www.udemy.com/topic/nodejs/"
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: false }); // Run in headful mode
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    await page.setDefaultTimeout(60000);

  
    try {
      await page.goto(BASE_URL, { waitUntil: 'load' });
      console.log('Successfully navigated to Udemy homepage');
  
    } catch (error) {
      console.error('Error:', error);
  
    } 
  })();