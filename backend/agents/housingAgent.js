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

/**
 * Sanitize a listing link. Ensures:
 * - Link is an absolute https:// URL
 * - Removes DuckDuckGo redirect wrappers (decodes the real destination URL)
 * - Falls back to a Google search for the city if nothing valid
 */
function sanitizeLink(link, city) {
  if (!link || typeof link !== 'string') {
    return `https://www.google.com/search?q=apartments+for+rent+in+${encodeURIComponent(city)}`;
  }

  // Try to decode DDG redirect links
  if (link.includes('duckduckgo.com')) {
    try {
      const parsed = new URL(link);
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) {
        link = decodeURIComponent(uddg);
      } else {
        // Can't recover a real link from DDG — use Google fallback
        return `https://www.google.com/search?q=apartments+for+rent+in+${encodeURIComponent(city)}`;
      }
    } catch (_) {
      return `https://www.google.com/search?q=apartments+for+rent+in+${encodeURIComponent(city)}`;
    }
  }

  // Ensure scheme is present
  if (!link.startsWith('http://') && !link.startsWith('https://')) {
    link = 'https://' + link;
  }

  // Validate the URL is parseable
  try {
    new URL(link);
    return link;
  } catch (_) {
    return `https://www.google.com/search?q=apartments+for+rent+in+${encodeURIComponent(city)}`;
  }
}

/**
 * Sanitize all listing links in a listingsData object
 */
function sanitizeAllLinks(listingsData, city) {
  if (listingsData && Array.isArray(listingsData.listings)) {
    listingsData.listings = listingsData.listings.map(l => ({
      ...l,
      link: sanitizeLink(l.link, city)
    }));
  }
  return listingsData;
}

/**
 * Navigate with retry logic for flaky DuckDuckGo connections
 */
async function gotoWithRetry(page, url, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`Navigation attempt ${attempt + 1} failed for ${url}. Retrying...`);
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Generate a city-labeled placeholder screenshot using Playwright
 */
async function generatePlaceholderScreenshot(screenshotPath, city, state) {
  let browser2 = null;
  try {
    browser2 = await chromium.launch({ headless: true });
    const ctx2 = await browser2.newContext({ viewport: { width: 1200, height: 600 } });
    const pg2 = await ctx2.newPage();
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#0d1222;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:600px;">
      <div style="text-align:center;color:#fff">
        <div style="font-size:48px;margin-bottom:16px;">🔍</div>
        <div style="font-size:28px;font-weight:bold;color:#6366f1;">Housing Search</div>
        <div style="font-size:18px;margin-top:10px;color:#a5b4fc;">${city}${state ? ', ' + state : ''}</div>
        <div style="font-size:14px;margin-top:16px;color:#64748b;">Live rental data sourced from web search</div>
      </div>
    </body></html>`;
    await pg2.setContent(html);
    await pg2.screenshot({ path: screenshotPath });
    await browser2.close();
    browser2 = null;
    return true;
  } catch (err) {
    console.error('Placeholder screenshot generation failed:', err.message);
    if (browser2) {
      try { await browser2.close(); } catch (_) { /* ignore */ }
    }
    return false;
  }
}

export async function runHousingAgent(city, state, budget, bedrooms, progressCallback) {
  const normCity = city.trim().toLowerCase();

  progressCallback('Resolving search target...');
  let subdomain = null;
  let browser = null;

  const screenshotFilename = `housing_${Date.now()}.png`;
  const screenshotPath = path.join(__dirname, '..', 'public', 'screenshots', screenshotFilename);

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Step 1: Check if Craigslist has a subdomain for the city via DuckDuckGo
    const searchQuery = `site:craigslist.org ${city} apartments for rent`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Extract & decode DDG result links to find real craigslist URLs
    const links = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a.result__url').forEach(el => {
        try {
          const parsed = new URL(el.href);
          const uddg = parsed.searchParams.get('uddg');
          results.push(uddg ? decodeURIComponent(uddg) : el.innerText.trim());
        } catch (_) {
          results.push(el.innerText.trim());
        }
      });
      return results;
    });

    if (links.length > 0) {
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

    // ─── PATH A: Craigslist ───────────────────────────────────────────────────
    if (subdomain) {
      progressCallback(`Connecting to Craigslist (${subdomain}.craigslist.org)...`);

      const targetUrl = `https://${subdomain}.craigslist.org/search/apa?max_price=${budget}&min_bedrooms=${bedrooms}&max_bedrooms=${bedrooms}`;
      console.log(`Housing Agent: visiting ${targetUrl}`);

      await gotoWithRetry(page, targetUrl, { waitUntil: 'networkidle', timeout: 25000 });

      progressCallback('Capturing listing screenshot...');
      await page.screenshot({ path: screenshotPath });

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
          
          LINKS DETECTED (these are real, absolute Craigslist hrefs):
          ${JSON.stringify(listingsText.links)}
          
          Extract the top 5 listings. Return a JSON structure.
          For each listing, find:
          - price (e.g. $1,800)
          - bedrooms (e.g. 2 Bed)
          - address (street address or neighborhood in ${city})
          - link: MUST be one of the href values from LINKS DETECTED. It must start with "https://". Do NOT invent or modify the URL.
          
          Format the response in JSON:
          {
            "sourceName": "Craigslist ${city}",
            "sourceUrl": "${targetUrl}",
            "listings": [
              { "price": "...", "bedrooms": "...", "address": "...", "link": "..." }
            ]
          }
        `;

        const response = await geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        listingsData = JSON.parse(response.response.text().trim());
        listingsData = sanitizeAllLinks(listingsData, city);
      }
    }

    // ─── PATH B: DuckDuckGo Web Search Fallback ───────────────────────────────
    if (!listingsData) {
      progressCallback(`Craigslist unavailable. Searching web for rentals in ${city}...`);
      const ddgSearchQuery = `apartments for rent in ${city} ${state || ''} ${bedrooms} bedroom`;
      const ddgSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgSearchQuery)}`;

      await gotoWithRetry(page, ddgSearchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      progressCallback('Capturing web search verification screenshot...');
      await page.screenshot({ path: screenshotPath });

      // Extract search results - decode DDG redirect URLs to real destination URLs
      const searchResults = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.result').forEach(el => {
          const titleEl = el.querySelector('.result__title');
          const snippetEl = el.querySelector('.result__snippet');
          const linkEl = el.querySelector('a.result__url');
          const urlTextEl = el.querySelector('.result__url');

          if (titleEl && snippetEl) {
            let url = '';
            if (linkEl && linkEl.href) {
              try {
                const parsed = new URL(linkEl.href);
                const uddg = parsed.searchParams.get('uddg');
                url = uddg ? decodeURIComponent(uddg) : (urlTextEl ? urlTextEl.innerText.trim() : '');
              } catch (_) {
                url = urlTextEl ? urlTextEl.innerText.trim() : '';
              }
            } else if (urlTextEl) {
              url = urlTextEl.innerText.trim();
            }

            if (url && !url.startsWith('http')) url = 'https://' + url;

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
        throw new Error('Web search returned no results.');
      }

      progressCallback('Synthesizing listings from search results...');
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are an AI Housing Assistant. I have searched the web for apartments in ${city}, ${state || ''} within a budget of ${budget} with ${bedrooms} bedrooms.
        Here are search results with REAL destination URLs already decoded:
        ${JSON.stringify(searchResults)}
        
        Extract the top 5 rental listings or real estate portals for ${city}.
        Use realistic local prices (₹ for India, ¥ for Japan, S$ for Singapore, £ for UK, $ for US/generic).
        
        For each listing:
        - price: realistic rent for ${city} (e.g. ₹15,000 for Patna India, ₹45,000 for Mumbai India, $1,800 for Austin TX)
        - bedrooms: "${bedrooms} Bed"
        - address: a real neighborhood, district, or area name within ${city}
        - link: Copy EXACTLY one of the "url" values from the search results above.
          Rules: must start with "https://", must NOT be a duckduckgo.com link, must NOT be a google.com link.
          If no valid link exists in results, use a known real-estate site for ${city}'s country (e.g. https://www.99acres.com for India, https://www.rightmove.co.uk for UK).
        
        Return JSON only:
        {
          "sourceName": "Web Search (${city})",
          "sourceUrl": "${ddgSearchUrl}",
          "listings": [
            { "price": "...", "bedrooms": "...", "address": "...", "link": "..." }
          ]
        }
      `;

      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      listingsData = JSON.parse(response.response.text().trim());
      listingsData = sanitizeAllLinks(listingsData, city);
    }

    await browser.close();
    listingsData.screenshotUrl = `/screenshots/${screenshotFilename}`;
    return listingsData;

  } catch (err) {
    console.error('Housing Agent Scrape Error:', err.message);
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }

    // ─── PATH C: Cached Demo Data for Known Cities ────────────────────────────
    if (normCity.includes('austin')) {
      progressCallback('Live scrape failed. Loading cached dataset for Austin...');
      return MOCK_DATA.austin.housing;
    } else if (normCity.includes('denver')) {
      progressCallback('Live scrape failed. Loading cached dataset for Denver...');
      return MOCK_DATA.denver.housing;
    } else if (normCity.includes('seattle')) {
      progressCallback('Live scrape failed. Loading cached dataset for Seattle...');
      return MOCK_DATA.seattle.housing;
    } else if (normCity.includes('tokyo')) {
      progressCallback('Live scrape failed. Loading cached dataset for Tokyo...');
      return MOCK_DATA.tokyo.housing;
    } else if (normCity.includes('singapore')) {
      progressCallback('Live scrape failed. Loading cached dataset for Singapore...');
      return MOCK_DATA.singapore.housing;
    }

    // ─── PATH D: Full Error Fallback ──────────────────────────────────────────
    progressCallback('Live scrape failed. Generating fallback listings...');

    const errorScreenshotFilename = `housing_${Date.now()}.png`;
    const errorScreenshotPath = path.join(__dirname, '..', 'public', 'screenshots', errorScreenshotFilename);
    await generatePlaceholderScreenshot(errorScreenshotPath, city, state);

    // Build fallback links using known portals per region
    const getPortalLink = (city) => {
      const c = city.toLowerCase();
      if (/india|mumbai|delhi|bengaluru|bangalore|patna|chennai|kolkata|hyderabad|pune|jaipur|ahmedabad/.test(c)) {
        return `https://www.99acres.com/search/property/buy/${encodeURIComponent(city.toLowerCase())}`;
      } else if (/japan|tokyo|osaka|kyoto/.test(c)) {
        return `https://www.suumo.jp/`;
      } else if (/singapore/.test(c)) {
        return `https://www.propertyguru.com.sg/`;
      } else if (/uk|london|manchester|birmingham|leeds/.test(c)) {
        return `https://www.rightmove.co.uk/`;
      } else if (/australia|sydney|melbourne|brisbane/.test(c)) {
        return `https://www.domain.com.au/`;
      } else if (/canada|toronto|vancouver|montreal/.test(c)) {
        return `https://www.realtor.ca/`;
      } else if (/germany|berlin|munich|hamburg/.test(c)) {
        return `https://www.immobilienscout24.de/`;
      } else if (/france|paris|lyon|marseille/.test(c)) {
        return `https://www.seloger.com/`;
      } else {
        return `https://www.zillow.com/homes/for_rent/${encodeURIComponent(city)}_rb/`;
      }
    };

    const portalLink = getPortalLink(city);

    return {
      sourceName: `Web Search Fallback (${city})`,
      sourceUrl: `https://html.duckduckgo.com/html/?q=apartments+for+rent+${encodeURIComponent(city)}`,
      screenshotUrl: `/screenshots/${errorScreenshotFilename}`,
      listings: [
        {
          price: normCity.includes('india') || /mumbai|delhi|patna|chennai|kolkata|bangalore|hyderabad|pune/.test(normCity) ? '₹15,000' : '$1,500',
          bedrooms: `${bedrooms} Bed`,
          address: `Central Area, ${city}`,
          link: sanitizeLink(portalLink, city)
        }
      ]
    };
  }
}
