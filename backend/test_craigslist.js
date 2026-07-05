import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from 'process';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const targetUrl = `https://austin.craigslist.org/search/apa?max_price=2000&min_bedrooms=1&max_bedrooms=1`;
  console.log(`Housing Agent: visiting ${targetUrl}`);
  
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
  
  const listingsText = await page.evaluate(() => {
    const data = [];
    let id = 0;
    document.querySelectorAll('a').forEach(el => {
      const text = el.innerText.trim();
      const href = el.href; // browser resolves this to absolute
      if (text.length > 5 && href.includes('/apa/')) {
        data.push({ id: id++, text, href });
      }
    });
    return {
      bodyText: document.body.innerText.substring(0, 8000),
      links: data.slice(0, 30)
    };
  });

  console.log("=== RAW SCRAPED LINKS ===");
  listingsText.links.forEach(l => console.log(`ID: ${l.id} | ${l.href}`));

  const extractionPrompt = `
    You are an AI Housing Assistant. I have scraped a Craigslist page for apartments in Austin, TX under $2000 with 1 bedrooms.
    Here is the scraped data:
    
    BODY TEXT:
    ${listingsText.bodyText}
    
    LINKS DETECTED (these are real, absolute Craigslist hrefs):
    ${JSON.stringify(listingsText.links.map(l => l.href))}
    
    Extract the top 5 listings. Return a JSON structure.
    For each listing, find:
    - price (e.g. $1,800)
    - bedrooms (e.g. 2 Bed)
    - address (street address or neighborhood in Austin)
    - link: MUST be one of the href values from LINKS DETECTED. It must start with "https://". Do NOT invent or modify the URL.
    
    Format the response in JSON:
    {
      "sourceName": "Craigslist Austin",
      "sourceUrl": "${targetUrl}",
      "listings": [
        { "price": "...", "bedrooms": "...", "address": "...", "link": "..." }
      ]
    }
  `;

  console.log("\n=== SENDING TO GEMINI ===");
  const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const response = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });

  const parsed = JSON.parse(response.response.text().trim());
  console.log("\n=== GEMINI OUTPUT ===");
  parsed.listings.forEach(l => console.log(l.link));

  await browser.close();
}

test().catch(console.error);
