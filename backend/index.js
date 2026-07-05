import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Serve screenshots statically
app.use('/screenshots', express.static(path.join(__dirname, 'public', 'screenshots')));

// Root route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', demoMode: process.env.DEMO_MODE === 'true' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Import agents and cached data
import { getDefaultMockData } from './data/cachedData.js';
import { runHousingAgent } from './agents/housingAgent.js';
import { runUtilitiesAgent } from './agents/utilitiesAgent.js';
import { runDmvAgent } from './agents/dmvAgent.js';

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

// Helper: Validate and auto-resolve state code using Gemini
async function validateAndResolveLocation(city, state) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not defined. Cannot validate location.");
    return state || "UNKNOWN";
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `You are a strict geography verification assistant. The user entered Destination City: "${city}", State/Region: "${state || ''}".
Determine if this location represents a valid, real city located strictly within the 50 United States or DC.
If it is a valid US city, return ONLY its 2-letter uppercase US state code (e.g., TX, CO, WA).
If it is outside the US, or if it is a nonsense/invalid name, return exactly the string "NON_US". Do not return anything else.`;
    const response = await model.generateContent(prompt);
    let result = response.response.text().trim().toUpperCase();
    
    // Strict enforcement: if Gemini returned a 2-letter code that isn't a US state (like ON for Ontario), force NON_US
    if (result !== 'NON_US' && !US_STATES.has(result)) {
      result = 'NON_US';
    }
    
    return result;
  } catch (err) {
    console.error("Auto-resolve state error:", err);
    return "UNKNOWN";
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected to Moving Day WebSocket');

  ws.on('message', async (message) => {
    try {
      const { type, data } = JSON.parse(message);
      if (type === 'startSearch') {
        const { currentCity, destinationCity, destinationState, moveDate, budget, bedrooms } = data;
        
        let resolvedState = destinationState ? destinationState.trim().toUpperCase() : '';
        
        console.log(`Validating location scope for: ${destinationCity}, ${resolvedState}`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'progress', 
            agent: 'dmv', 
            status: 'searching', 
            message: `Verifying service coverage for "${destinationCity}"...` 
          }));
        }
        
        resolvedState = await validateAndResolveLocation(destinationCity, resolvedState);
        
        if (resolvedState === 'NON_US') {
          console.log(`Location "${destinationCity}" is outside US or invalid. Bypassing agents.`);
          if (ws.readyState === ws.OPEN) {
            const errMsg = 'We currently only support relocations within the United States. Please enter a valid US city.';
            ['housing', 'utilities', 'dmv'].forEach(a => {
              ws.send(JSON.stringify({ type: 'error', agent: a, message: errMsg }));
            });
          }
          return; // Early exit
        } else if (resolvedState && resolvedState !== 'UNKNOWN') {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'stateResolved', state: resolvedState }));
          }
        }
        
        console.log(`Starting research for: ${destinationCity}, ${resolvedState} (Budget: ${budget}, Beds: ${bedrooms})`);
        
        const isDemoMode = process.env.DEMO_MODE === 'true';
        
        if (isDemoMode) {
          console.log('Running in DEMO_MODE. Simulating research...');
          await runDemoSimulation(ws, destinationCity, resolvedState);
        } else {
          console.log('Running in LIVE mode. Launching browser agents...');
          runLiveResearch(ws, destinationCity, resolvedState, budget, bedrooms);
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to process request.' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Helper: Stream simulated responses in demo mode
async function runDemoSimulation(ws, city, state) {
  const sendProgress = (agent, status, message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'progress', agent, status, message }));
    }
  };

  const sendResult = (agent, data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'result', agent, data }));
    }
  };

  const sendError = (agent, message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'progress', agent, status: 'error', message }));
    }
  };

  // Get demo mock data
  const mock = getDefaultMockData(city, state);

  // Run DMV Agent Simulation (Fastest)
  const runDmvSim = async () => {
    sendProgress('dmv', 'searching', 'Locating official DMV portal for state...');
    await delay(1200);
    sendProgress('dmv', 'scraping', 'Reading state driver licensing transfer guidelines...');
    await delay(1500);
    sendProgress('dmv', 'parsing', 'Summarizing documents and residency requirements...');
    await delay(1000);
    sendResult('dmv', mock.dmv);
  };

  // Run Utilities Agent Simulation
  const runUtilitiesSim = async () => {
    sendProgress('utilities', 'searching', 'Searching local service registry for providers...');
    await delay(1800);
    sendProgress('utilities', 'scraping', 'Extracting contact info for electricity, water, and internet...');
    await delay(1500);
    sendProgress('utilities', 'parsing', 'Formatting provider customer service details...');
    await delay(800);
    sendResult('utilities', mock.utilities);
  };

  // Run Housing Agent Simulation (Slowest/Most Complex)
  const runHousingSim = async () => {
    sendProgress('housing', 'searching', 'Connecting to rental database...');
    await delay(1000);
    sendProgress('housing', 'scraping', 'Scanning active rental listings page...');
    await delay(2000);
    sendProgress('housing', 'parsing', 'Capturing verification screenshot and sorting listings...');
    await delay(1500);
    sendResult('housing', mock.housing);
  };

  // Run all three simulations in parallel
  Promise.all([runHousingSim(), runUtilitiesSim(), runDmvSim()]).catch(err => {
    console.error('Demo simulation error:', err);
  });
}

// Helper: Run live scraping research with Playwright & Gemini
function runLiveResearch(ws, city, state, budget, bedrooms) {
  const sendProgress = (agent, status, message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'progress', agent, status, message }));
    }
  };

  const sendResult = (agent, data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'result', agent, data }));
    }
  };

  // 1. DMV Agent
  const dmvPromise = async () => {
    try {
      sendProgress('dmv', 'searching', `Connecting to official ${state} DMV site...`);
      const data = await runDmvAgent(state, (msg) => sendProgress('dmv', 'scraping', msg));
      sendProgress('dmv', 'parsing', 'Structuring registration steps using Gemini...');
      sendResult('dmv', data);
    } catch (err) {
      console.error('DMV Agent error:', err);
      sendProgress('dmv', 'error', `Failed: ${err.message}`);
    }
  };

  // 2. Utilities Agent
  const utilitiesPromise = async () => {
    try {
      sendProgress('utilities', 'searching', `Searching utility companies in ${city}, ${state}...`);
      const data = await runUtilitiesAgent(city, state, (msg) => sendProgress('utilities', 'scraping', msg));
      sendProgress('utilities', 'parsing', 'Parsing provider directory using Gemini...');
      sendResult('utilities', data);
    } catch (err) {
      console.error('Utilities Agent error:', err);
      sendProgress('utilities', 'error', `Failed: ${err.message}`);
    }
  };

  // 3. Housing Agent
  const housingPromise = async () => {
    try {
      sendProgress('housing', 'searching', `Opening Craigslist search for ${city}...`);
      const data = await runHousingAgent(city, state, budget, bedrooms, (msg) => sendProgress('housing', 'scraping', msg));
      sendProgress('housing', 'parsing', 'Processing listings and details...');
      sendResult('housing', data);
    } catch (err) {
      console.error('Housing Agent error:', err);
      sendProgress('housing', 'error', `Failed: ${err.message}`);
    }
  };

  // Execute in parallel
  Promise.all([housingPromise(), utilitiesPromise(), dmvPromise()]).then(() => {
    console.log('All agents complete.');
  }).catch((err) => {
    console.error('Parallel agent execution error:', err);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
