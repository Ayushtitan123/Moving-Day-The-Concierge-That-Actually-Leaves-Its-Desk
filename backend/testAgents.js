import { runHousingAgent } from './agents/housingAgent.js';
import { runUtilitiesAgent } from './agents/utilitiesAgent.js';
import { runDmvAgent } from './agents/dmvAgent.js';
import dotenv from 'dotenv';

// Load env
dotenv.config();

async function test() {
  const city = 'Singapore';
  const state = 'Singapore';
  const budget = 3000;
  const bedrooms = 2;

  console.log('==================================================');
  console.log(`RUNNING CLI AGENT TEST FOR: ${city}, ${state}`);
  console.log('==================================================\n');

  const logProgress = (agentName) => (msg) => {
    console.log(`[PROGRESS - ${agentName}]: ${msg}`);
  };

  try {
    console.log('--- 1. Testing Utilities Agent ---');
    const utilitiesData = await runUtilitiesAgent(city, state, logProgress('Utilities'));
    console.log('Utilities Result:\n', JSON.stringify(utilitiesData, null, 2));
    console.log('\n----------------------------------\n');

    console.log('--- 2. Testing DMV Agent ---');
    const dmvData = await runDmvAgent(state, logProgress('DMV'));
    console.log('DMV Result:\n', JSON.stringify(dmvData, null, 2));
    console.log('\n----------------------------------\n');

    console.log('--- 3. Testing Housing Agent ---');
    const housingData = await runHousingAgent(city, state, budget, bedrooms, logProgress('Housing'));
    console.log('Housing Result:\n', JSON.stringify(housingData, null, 2));
    console.log('\n----------------------------------\n');

    console.log('All CLI Agent Tests Passed Successfully.');
  } catch (err) {
    console.error('CLI Agent Test failed with error:', err);
  }
}

test();
