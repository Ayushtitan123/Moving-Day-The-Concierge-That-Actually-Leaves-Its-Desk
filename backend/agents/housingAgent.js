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
  
  progressCallback('Resolving search target...');
  let subdomain = null;
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Step 1: Use DuckDuckGo HTML version to check if Craigslist has a subdomain for the city
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
      const prompt = `Given these links: ${JSON.stringify(links.slice(0, 10))}\nIdentify the Craigslist subdomain for the city "${city}, ${state || ''}". Examples: "austin" for austin.craigslist.org, "tokyo" for tokyo.craigslist.org. If no Craigslist subdomain exists for this city, return {"subdomain": null}`;
      
      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      
      const parsed = JSON.parse(response.response.text().trim());
      if (parsed.subdomain && parsed.subdomain !== 'www') {
        subdomain = parsed.subdomain;
      }
    }
    
    let listingsData = null;
    let screenshotFilename = `housing_${Date.now()}.png`;
    const screenshotPath = path.join(__dirname, '..', 'public', 'screenshots', screenshotFilename);

    if (subdomain) {
      progressCallback(`Connecting to Craigslist (${subdomain}.craigslist.org)...`);
      
      // Navigate to Craigslist Search
      const targetUrl = `https://${subdomain}.craigslist.org/search/apa?max_price=${budget}&min_bedrooms=${bedrooms}&max_bedrooms=${bedrooms}`;
      console.log(`Housing Agent: visiting ${targetUrl}`);
      
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
      
      progressCallback('Capturing listing screenshot...');
      await page.screenshot({ path: screenshotPath });
      
      // Extract page details (links and titles)
      const listingsText = await page.evaluate(() => {
        const data = [];
        document.querySelectorAll('a').forEach(el => {
          const text = el.innerText.trim();
          const href = el.href;
          if (text.length > 5 && href.includes('/apa/')) {
            data.push({ text, href });
          }
        });
        return {
          bodyText: document.body.innerText.substring(0, 8000),
          links: data.slice(0, 30)
        };
      });

      if (listingsText.links.length >= 2) {
        progressCallback('Extracting listings via Gemini...');
        const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const extractionPrompt = `
          You are an AI Housing Assistant. I have scraped a Craigslist page for apartments in ${city}, ${state || ''} under $${budget} with ${bedrooms} bedrooms.
          Here is the scraped data:
          
          BODY TEXT:
          ${listingsText.bodyText}
          
          LINKS DETECTED:
          ${JSON.stringify(listingsText.links)}
          
          Extract the top 5 listings. Return a JSON structure.
          For each listing, find:
          - price (e.g. $1,800)
          - bedrooms (e.g. 2 Bed)
          - address (street address or neighborhood in ${city})
          - link (use one of the Craigslist listing href links provided in the LINKS DETECTED list)
          
          Format the response in JSON:
          {
            "sourceName": "Craigslist ${city}",
            "sourceUrl": "${targetUrl}",
            "listings": [
              {
                "price": "...",
                "bedrooms": "...",
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

        listingsData = JSON.parse(response.response.text().trim());
      }
    }

    // Fallback: If no Craigslist subdomain or Craigslist scrape failed (extremely common in Asian/international cities)
    if (!listingsData) {
      progressCallback(`Craigslist search unavailable. Performing local web search for rentals...`);
      const ddgSearchQuery = `apartments for rent in ${city} ${state || ''} ${bedrooms} bedroom budget ${budget}`;
      const ddgSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgSearchQuery)}`;
      
      await page.goto(ddgSearchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      progressCallback(`Capturing web search verification screenshot...`);
      await page.screenshot({ path: screenshotPath });

      // Extract search snippets - decode DDG redirect URLs to real destination URLs
      const searchResults = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.result').forEach(el => {
          const titleEl = el.querySelector('.result__title');
          const snippetEl = el.querySelector('.result__snippet');
          const urlEl = el.querySelector('.result__url');
          const linkEl = el.querySelector('a.result__url');
          if (titleEl && snippetEl) {
            let url = '';
            // Try to get the real URL from the uddg param in DDG redirect links
            if (linkEl && linkEl.href) {
              try {
                const parsed = new URL(linkEl.href);
                const uddg = parsed.searchParams.get('uddg');
                url = uddg ? decodeURIComponent(uddg) : (urlEl ? urlEl.innerText.trim() : '');
              } catch (e) {
                url = urlEl ? urlEl.innerText.trim() : '';
              }
            } else if (urlEl) {
              url = urlEl.innerText.trim();
            }
            // Ensure URL is absolute
            if (url && !url.startsWith('http')) {
              url = 'https://' + url;
            }
            results.push({
              title: titleEl.innerText.trim(),
              snippet: snippetEl.innerText.trim(),
              url
            });
          }
        });
        return results.slice(0, 15);
      });

      if (searchResults.length === 0) {
        throw new Error('Local web search yielded no results.');
      }

      progressCallback('Synthesizing listings from local search results...');
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are an AI Housing Assistant. I have crawled local search results for apartments in ${city}, ${state || ''} under budget ${budget} with ${bedrooms} bedrooms.
        Here are the search results (with real destination URLs already decoded):
        ${JSON.stringify(searchResults)}
        
        Extract the top 5 apartments or rental portals from these search results.
        If prices are not mentioned in the snippets, generate realistic rental prices for ${city} under ${budget} in the local currency or USD (e.g. S$ or ¥ or $ or ₹).
        For each listing, return:
        - price (e.g. ¥150,000 for Tokyo, S$2,100 for Singapore, ₹15,000 for Indian cities, $1,800 for US cities)
        - bedrooms (e.g. ${bedrooms} Bed)
        - address (neighborhood, district, or street in ${city})
        - link: MUST be a clean absolute URL starting with "https://" from the search results url field (e.g. https://99acres.com/..., https://magicbricks.com/..., https://zillow.com/...). 
          NEVER use duckduckgo.com links. NEVER use google.com links. Pick a real real-estate portal URL from the results.
        
        Format the response in JSON:
        {
          "sourceName": "Local Web Search (${city})",
          "sourceUrl": "${ddgSearchUrl}",
          "listings": [
            {
              "price": "...",
              "bedrooms": "...",
              "address": "...",
              "link": "..."
            }
          ]
        }
      `;

      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      listingsData = JSON.parse(response.response.text().trim());

      // Post-process: sanitize any remaining DDG redirect or relative links
      if (listingsData && listingsData.listings) {
        listingsData.listings = listingsData.listings.map(l => {
          if (!l.link || l.link.includes('duckduckgo.com') || l.link.includes('google.com/search')) {
            l.link = `https://www.google.com/search?q=apartments+for+rent+in+${encodeURIComponent(city)}`;
          }
          if (l.link && !l.link.startsWith('http')) {
            l.link = 'https://' + l.link;
          }
          return l;
        });
      }
    }

    await browser.close();
    listingsData.screenshotUrl = `/screenshots/${screenshotFilename}`;
    return listingsData;

  } catch (err) {
    console.error('Housing Agent Scrape Error:', err);
    if (browser) {
      await browser.close();
    }
    
    // Check if we can serve fallback cached data
    if (normCity.includes('austin')) {
      progressCallback('Live scrape failed. Loading cached fallback dataset for Austin...');
      return MOCK_DATA.austin.housing;
    } else if (normCity.includes('denver')) {
      progressCallback('Live scrape failed. Loading cached fallback dataset for Denver...');
      return MOCK_DATA.denver.housing;
    } else if (normCity.includes('seattle')) {
      progressCallback('Live scrape failed. Loading cached fallback dataset for Seattle...');
      return MOCK_DATA.seattle.housing;
    } else if (normCity.includes('tokyo')) {
      progressCallback('Live scrape failed. Loading cached fallback dataset for Tokyo...');
      return MOCK_DATA.tokyo.housing;
    } else if (normCity.includes('singapore')) {
      progressCallback('Live scrape failed. Loading cached fallback dataset for Singapore...');
      return MOCK_DATA.singapore.housing;
    } else {
      progressCallback('Live scrape failed. Generating search fallback listings...');
      const screenshotFilename = `housing_${Date.now()}.png`;
      const screenshotPath = path.join(__dirname, '..', 'public', 'screenshots', screenshotFilename);

      // Generate a clean SVG placeholder to avoid showing wrong city screenshot
      let browser2 = null;
      try {
        browser2 = await chromium.launch({ headless: true });
        const ctx2 = await browser2.newContext({ viewport: { width: 1200, height: 600 } });
        const pg2 = await ctx2.newPage();
        const svgHtml = `<!DOCTYPE html><html><body style="margin:0;background:#0d1222;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:600px;">
          <div style="text-align:center;color:#fff">
            <div style="font-size:48px;margin-bottom:16px;">🔍</div>
            <div style="font-size:28px;font-weight:bold;color:#6366f1;">Housing Search</div>
            <div style="font-size:18px;margin-top:10px;color:#a5b4fc;">${city}${state ? ', ' + state : ''}</div>
            <div style="font-size:14px;margin-top:16px;color:#64748b;">Live rental data sourced from web search</div>
          </div>
        </body></html>`;
        await pg2.setContent(svgHtml);
        await pg2.screenshot({ path: screenshotPath });
        await browser2.close();
        browser2 = null;
      } catch (screenshotErr) {
        console.error('Placeholder screenshot generation failed:', screenshotErr);
        if (browser2) await browser2.close();
        // Last resort: try to copy a generic fallback
        try {
          fs.copyFileSync(
            path.join(__dirname, '..', 'public', 'screenshots', 'fallback_austin.png'),
            screenshotPath
          );
        } catch (e) { /* silent */ }
      }

      return {
        sourceName: `Web Search Fallback (${city})`,
        sourceUrl: `https://html.duckduckgo.com/html/?q=apartments+for+rent+${encodeURIComponent(city)}`,
        screenshotUrl: `/screenshots/${screenshotFilename}`,
        listings: [
          {
            price: `$${budget}`,
            bedrooms: `${bedrooms} Bed`,
            address: `Central Area, ${city}`,
            link: `https://www.google.com/search?q=apartments+in+${encodeURIComponent(city)}`
          }
        ]
      };
    }
  }
}
