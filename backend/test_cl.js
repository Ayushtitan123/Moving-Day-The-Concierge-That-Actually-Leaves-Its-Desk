import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const targetUrl = `https://austin.craigslist.org/search/apa?max_price=2000&min_bedrooms=1&max_bedrooms=1`;
  console.log(`Housing Agent: visiting ${targetUrl}`);
  
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
  await page.screenshot({ path: 'cl_test.png' });
  
  const html = await page.content();
  console.log("Page length:", html.length);

  await browser.close();
}

test().catch(console.error);
