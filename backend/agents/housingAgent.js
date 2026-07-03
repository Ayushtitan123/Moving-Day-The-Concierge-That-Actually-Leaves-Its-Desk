import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { MOCK_DATA } from '../data/cachedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function runHousingAgent(city, state, budget, bedrooms, progressCallback) {
  const normCity = city.trim().toLowerCase();
  
  progressCallback('Resolving Craigslist subdomain...');
  let subdomain = 'www';
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Step 1: Use DuckDuckGo HTML version to find Craigslist subdomain for the city
    const searchQuery = `site:craigslist.org ${city} apartments for rent`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Extract the search result links
    const links = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a.result__url').forEach(el => {
        results.push(el.href);
      });
      return results;
    });

    if (links.length > 0) {
      // Find subdomain using Gemini
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Given these links: ${JSON.stringify(links.slice(0, 10))}\nIdentify the Craigslist subdomain for the city "${city}, ${state}". Examples: "austin" for austin.craigslist.org, "seattle" for seattle.craigslist.org, "sfbay" for sfbay.craigslist.org. Return a JSON object: {"subdomain": "subdomain_string"}`;
      
      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      
      const parsed = JSON.parse(response.response.text().trim());
      if (parsed.subdomain && parsed.subdomain !== 'www') {
        subdomain = parsed.subdomain;
      }
    }
    
    if (subdomain === 'www') {
      // Fallback subdomain heuristic if search didn't yield clear subdomain
      subdomain = city.toLowerCase().replace(/[^a-z]/g, '');
    }

    progressCallback(`Connecting to Craigslist (${subdomain}.craigslist.org)...`);
    
    // Step 2: Navigate to Craigslist Search
    const targetUrl = `https://${subdomain}.craigslist.org/search/apa?max_price=${budget}&min_bedrooms=${bedrooms}&max_bedrooms=${bedrooms}`;
    console.log(`Housing Agent: visiting ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
    
    // Take screenshot and save
    progressCallback('Capturing listing screenshot...');
    const filename = `housing_${Date.now()}.png`;
    const screenshotPath = path.join(__dirname, '..', 'public', 'screenshots', filename);
    await page.screenshot({ path: screenshotPath });
    
    // Extract page details (links and titles)
    const listingsText = await page.evaluate(() => {
      // Return lists of link text and hrefs
      const data = [];
      document.querySelectorAll('a').forEach(el => {
        const text = el.innerText.trim();
        const href = el.href;
        if (text.length > 5 && href.includes('/apa/')) {
          data.push({ text, href });
        }
      });
      // Also get body text snippet
      return {
        bodyText: document.body.innerText.substring(0, 8000),
        links: data.slice(0, 30)
      };
    });

    await browser.close();
    browser = null;

    // If we didn't extract any links or body text is tiny, trigger fallback
    if (listingsText.links.length === 0 && listingsText.bodyText.length < 500) {
      throw new Error('Craigslist search yielded no listings (possible bot detection or empty results).');
    }

    progressCallback('Extracting listings via Gemini...');
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const extractionPrompt = `
      You are an AI Housing Assistant. I have scraped a Craigslist page for apartments in ${city}, ${state} under $${budget} with ${bedrooms} bedrooms.
      Here is the scraped data:
      
      BODY TEXT:
      ${listingsText.bodyText}
      
      LINKS DETECTED:
      ${JSON.stringify(listingsText.links)}
      
      Extract the top 5 listings from this data.
      For each listing, find:
      - price (e.g. $1,800)
      - bedrooms (e.g. 2 Bed or 2 BR)
      - address (the street address, neighborhood, or city/state if details are thin)
      - link (use one of the Craigslist listing href links provided in the LINKS DETECTED list. Make sure it is a valid full Craigslist listing URL, e.g. https://${subdomain}.craigslist.org/apa/d/...)
      
      Format the response in JSON:
      {
        "sourceName": "Craigslist ${city}",
        "sourceUrl": "${targetUrl}",
        "listings": [
          {
            "price": "$X,XXX",
            "bedrooms": "X Bed",
            "address": "...",
            "link": "..."
          }
        ]
      }
    `;

    const response = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(response.response.text().trim());
    result.screenshotUrl = `/screenshots/${filename}`;
    return result;

  } catch (err) {
    console.error('Housing Agent Live Scraping Error:', err);
    if (browser) {
      await browser.close();
    }
    
    // Check if we can serve fallback cached data
    if (normCity.includes('austin')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Austin...');
      return MOCK_DATA.austin.housing;
    } else if (normCity.includes('denver')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Denver...');
      return MOCK_DATA.denver.housing;
    } else if (normCity.includes('seattle')) {
      progressCallback('Live scrape failed or blocked. Loading cached fallback dataset for Seattle...');
      return MOCK_DATA.seattle.housing;
    } else {
      progressCallback('Live scrape failed. Generating generic search fallback listings...');
      // Return a basic fallback response so the app doesn't break
      return {
        sourceName: `DuckDuckGo Search (${city})`,
        sourceUrl: `https://html.duckduckgo.com/html/?q=apartments+for+rent+${encodeURIComponent(city)}`,
        screenshotUrl: '/screenshots/fallback_austin.png',
        listings: [
          {
            price: `$${budget}`,
            bedrooms: `${bedrooms} Bed`,
            address: `Central Area, ${city}, ${state || 'US'}`,
            link: `https://www.craigslist.org`
          }
        ]
      };
    }
  }
}
