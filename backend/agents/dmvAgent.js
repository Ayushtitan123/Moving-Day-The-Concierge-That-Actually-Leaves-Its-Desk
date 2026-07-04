import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveDmvUrl, DMV_URLS, MOCK_DATA } from '../data/cachedData.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function runDmvAgent(stateInput, progressCallback) {
  const cleanState = stateInput.trim();
  const stateUpper = cleanState.toUpperCase();
  const isUSState = DMV_URLS[stateUpper];
  
  if (!isUSState) {
    progressCallback(`Non-US location detected ("${cleanState}"). Querying local transport authority guidelines...`);
    let browser = null;
    
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      
      const query = `${cleanState} driver's license conversion transfer new resident official requirements`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Extract search result snippets
      const searchResults = await page.evaluate(() => {
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

      await browser.close();
      browser = null;

      if (searchResults.length === 0) {
        throw new Error('Local transport authority search returned no results.');
      }

      progressCallback('Synthesizing international licensing and registration rules via Gemini...');
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are an AI relocation admin assistant. I have search results for driver's license transfer/conversion and vehicle registration requirements for new residents in "${cleanState}".
        Here are the search results:
        ${JSON.stringify(searchResults.slice(0, 10))}
        
        Using only this information (or standard accurate knowledge if snippets are sparse), summarize the steps for a new resident to:
        1. Convert/transfer their Driver's License
        2. Register their Vehicle (if applicable)
        
        Extract:
        - Required documents checklist (e.g. current license, passport, residency/address proof, translation of license, visa/work permit)
        - Step-by-step process/instructions to complete the license transfer. Make steps clear and sequential.
        
        Format the response in JSON:
        {
          "sourceName": "${cleanState} Transport Authority (Web Search)",
          "sourceUrl": "https://html.duckduckgo.com",
          "documents": [
            "Document 1...",
            "Document 2..."
          ],
          "steps": [
            "Step 1...",
            "Step 2..."
          ]
        }
      `;

      const response = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      return JSON.parse(response.response.text().trim());

    } catch (err) {
      console.error('International DMV Scrape Error:', err);
      if (browser) {
        await browser.close();
      }
      
      progressCallback('Live scrape failed. Generating international conversion checklist fallback...');
      return {
        sourceName: `${cleanState} Road Transport Authority`,
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(cleanState + ' driver license conversion')}`,
        documents: [
          "Original valid out-of-country driver's license",
          "Official English translation or International Driving Permit (IDP)",
          "Passport with valid residence visa, employment pass, or student visa",
          "Proof of new physical address (utility bill, bank statement, or rental contract)",
          "Completed license conversion application form"
        ],
        steps: [
          `Find the local transport department or traffic police licensing branch in ${cleanState}.`,
          "Schedule a conversion appointment or visit the licensing center.",
          "Present all original documents, identity verification, and your foreign driver's license.",
          "Pass a basic vision check and any local road rules/theory test if required by local laws.",
          "Pay the conversion administrative fees and receive your new local license card."
        ]
      };
    }
  }

  // standard US DMV scrape logic
  const targetUrl = resolveDmvUrl(stateInput);
  progressCallback(`Navigating directly to official DMV page: ${targetUrl}`);
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    const pageText = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, nav, footer, header');
      scripts.forEach(el => el.remove());
      return document.body.innerText.substring(0, 10000);
    });
    
    await browser.close();
    browser = null;

    if (!pageText || pageText.trim().length < 200) {
      throw new Error('DMV page text extraction failed or content was empty.');
    }

    progressCallback(`Summarizing license and registration steps via Gemini...`);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      You are an AI relocation admin assistant. I have loaded the official DMV website for the state: ${stateInput}.
      Here is the text extracted from the official website:
      
      ---
      ${pageText}
      ---
      
      Using only this information (or adding standard, highly accurate details if the text is sparse), summarize the requirements for a NEW RESIDENT moving to this state who needs to:
      1. Transfer their Driver's License
      2. Register their Vehicle / transfer Out-of-State Title
      
      Extract:
      1. Required documents checklist (e.g. proof of identity, proof of residency, SSN card, current out-of-state license, proof of insurance/registration).
      2. Step-by-step process/instructions to complete both the license transfer and vehicle registration. Make steps clear and sequential.
      
      Format the response in JSON:
      {
        "sourceName": "${stateInput} DMV (Official Portal)",
        "sourceUrl": "${targetUrl}",
        "documents": [
          "Document 1...",
          "Document 2..."
        ],
        "steps": [
          "Step 1...",
          "Step 2..."
        ]
      }
    `;

    const response = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    return JSON.parse(response.response.text().trim());

  } catch (err) {
    console.error('DMV Agent Scrape Error:', err);
    if (browser) {
      await browser.close();
    }
    
    // Fallback to mock data if available
    if (stateUpper === 'TX' || stateUpper === 'TEXAS') {
      progressCallback('Live DMV scrape failed. Loading cached Texas DMV dataset...');
      return MOCK_DATA.austin.dmv;
    } else if (stateUpper === 'CO' || stateUpper === 'COLORADO') {
      progressCallback('Live DMV scrape failed. Loading cached Colorado DMV dataset...');
      return MOCK_DATA.denver.dmv;
    } else if (stateUpper === 'WA' || stateUpper === 'WASHINGTON') {
      progressCallback('Live DMV scrape failed. Loading cached Washington DMV dataset...');
      return MOCK_DATA.seattle.dmv;
    } else {
      progressCallback('Live DMV scrape failed. Generating generic DMV registration checklist...');
      return {
        sourceName: `${stateInput} DMV (Fallback)`,
        sourceUrl: targetUrl,
        documents: [
          "Current out-of-state driver's license",
          "Proof of identity (Passport, Birth Certificate)",
          "Social Security Number (SSN Card)",
          "Two proofs of new physical address in state (utility bill, lease)",
          "Proof of auto insurance meeting state minimums"
        ],
        steps: [
          `Visit the official ${stateInput} DMV website at ${targetUrl} to locate the nearest office.`,
          "Prepare required identity, residency, and vehicle documentation.",
          "Schedule an appointment online to minimize wait times.",
          "Surrender your out-of-state driver's license and take a vision test.",
          "Pay the license transfer fee (typically $25-$50) and vehicle registration fees."
        ]
      };
    }
  }
}
