import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MOCK_DATA } from '../data/cachedData.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function scrapeDDGSnippets(page, query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  return await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.result').forEach(el => {
      const titleEl = el.querySelector('.result__title');
      const snippetEl = el.querySelector('.result__snippet');
      const urlEl = el.querySelector('.result__url');
      if (titleEl && snippetEl) {
        results.push({
          title: titleEl.innerText.trim(),
          snippet: snippetEl.innerText.trim(),
          url: urlEl ? urlEl.href : ''
        });
      }
    });
    return results;
  });
}

export async function runUtilitiesAgent(city, state, progressCallback) {
  const normCity = city.trim().toLowerCase();
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Scrape Electric
    progressCallback('Searching for local electricity providers...');
    const electricData = await scrapeDDGSnippets(page, `electricity providers in ${city} ${state}`);
    
    // Scrape Water
    progressCallback('Searching for water & wastewater utilities...');
    const waterData = await scrapeDDGSnippets(page, `water utility department in ${city} ${state}`);
    
    // Scrape Internet
    progressCallback('Searching for local high-speed internet providers...');
    const internetData = await scrapeDDGSnippets(page, `internet providers in ${city} ${state} zip code`);
    
    await browser.close();
    browser = null;

    progressCallback('Synthesizing utility options via Gemini...');
    const combinedData = {
      electricity: electricData.slice(0, 5),
      water: waterData.slice(0, 5),
      internet: internetData.slice(0, 5)
    };

    const geminiModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `
      You are an AI relocation assistant. I have scraped search results for utility providers in ${city}, ${state}.
      Here are the search results:
      
      ELECTRICITY PROVIDERS SEARCH RESULTS:
      ${JSON.stringify(combinedData.electricity)}
      
      WATER UTILITIES SEARCH RESULTS:
      ${JSON.stringify(combinedData.water)}
      
      INTERNET PROVIDERS SEARCH RESULTS:
      ${JSON.stringify(combinedData.internet)}
      
      Extract the primary providers for Electricity, Water & Wastewater, and Internet in ${city}, ${state}.
      For each provider, find:
      - type: "Electricity", "Water & Wastewater", "Gas", or "Internet"
      - name: Company/department name
      - phone: Customer service phone number (if mentioned, otherwise guess or look for a common one, or leave as "Contact via website")
      - website: The main customer portal/setup URL
      
      Format the response in JSON:
      {
        "sourceName": "DuckDuckGo Local Utilities Search",
        "sourceUrl": "https://html.duckduckgo.com",
        "providers": [
          {
            "type": "Electricity",
            "name": "...",
            "phone": "...",
            "website": "..."
          }
        ]
      }
    `;

    const response = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    return JSON.parse(response.response.text().trim());

  } catch (err) {
    console.error('Utilities Agent Scrape Error:', err);
    if (browser) {
      await browser.close();
    }
    
    // Fallback to mock data if available
    if (normCity.includes('austin')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Austin...');
      return MOCK_DATA.austin.utilities;
    } else if (normCity.includes('denver')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Denver...');
      return MOCK_DATA.denver.utilities;
    } else if (normCity.includes('seattle')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Seattle...');
      return MOCK_DATA.seattle.utilities;
    } else {
      progressCallback('Live scrape failed. Generating generic utility fallback data...');
      return {
        sourceName: "Utility Search Fallback",
        sourceUrl: "https://html.duckduckgo.com",
        providers: [
          {
            type: "Electricity",
            name: `${city} Power & Light`,
            phone: "Contact via website",
            website: `https://www.google.com/search?q=electricity+providers+${encodeURIComponent(city)}`
          },
          {
            type: "Water & Wastewater",
            name: `${city} Water Department`,
            phone: "Contact via website",
            website: `https://www.google.com/search?q=water+utility+${encodeURIComponent(city)}`
          },
          {
            type: "Internet",
            name: "Broadband / Fiber Options",
            phone: "Contact via website",
            website: `https://www.google.com/search?q=internet+providers+${encodeURIComponent(city)}`
          }
        ]
      };
    }
  }
}
