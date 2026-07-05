import WebSocket from 'ws';

const cases = [
  { city: 'Chicago', state: 'IL', desc: 'US Major Metro (Central)' },
  { city: 'Boise', state: 'ID', desc: 'US Mid-size (Mountain/Pacific)' },
  { city: 'Bozeman', state: 'MT', desc: 'US Small City (Mountain)' },
  { city: 'Seattle', state: 'WA', desc: 'US Coast (West)' },
  { city: 'Philadelphia', state: 'PA', desc: 'US Coast (East)' },
  { city: 'Toronto', state: 'Canada', desc: 'Non-US Major' },
  { city: 'Mumbai', state: 'India', desc: 'Non-US No Craigslist' },
  { city: 'Asdfghjkl', state: '', desc: 'Invalid City' }
];

async function runTestCase(testCase) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3001');
    const logs = [];
    const results = {};
    const errors = {};
    let isFinished = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'startSearch',
        data: {
          destinationCity: testCase.city,
          destinationState: testCase.state,
          budget: 2000,
          bedrooms: 1
        }
      }));
    });

    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg);
      logs.push(parsed);

      if (parsed.type === 'result') {
        results[parsed.agent] = parsed.data;
      } else if (parsed.type === 'error') {
        errors[parsed.agent] = parsed.message;
      }

      // Check if finished
      const hasThreeResults = Object.keys(results).length === 3;
      const hasThreeErrors = Object.keys(errors).length === 3;

      if ((hasThreeResults || hasThreeErrors) && !isFinished) {
        isFinished = true;
        ws.close();
        resolve({ testCase, results, errors, logs, passed: true });
      }
    });

    ws.on('close', () => {
      if (!isFinished) {
        isFinished = true;
        resolve({ testCase, results, errors, logs, passed: false, reason: 'Connection closed prematurely' });
      }
    });

    ws.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        resolve({ testCase, results, errors, logs, passed: false, reason: `WS error: ${err.message}` });
      }
    });

    // Timeout after 60s
    setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        ws.close();
        resolve({ testCase, results, errors, logs, passed: false, reason: 'Timeout after 60s' });
      }
    }, 60000);
  });
}

async function main() {
  console.log('Starting comprehensive Relocation Concierge test matrix...\n');
  const runResults = [];

  for (const c of cases) {
    console.log(`Testing: ${c.city}, ${c.state || 'N/A'} (${c.desc})...`);
    const res = await runTestCase(c);
    runResults.push(res);
    console.log(`Completed ${c.city}.\n`);
  }

  console.log('==================================================================');
  console.log('                    TEST MATRIX RESULTS                          ');
  console.log('==================================================================\n');

  // Verify results and build output table
  const tableRows = [];
  const usCitiesData = {};

  for (const r of runResults) {
    const { testCase, results, errors, logs, passed, reason } = r;
    const locName = `${testCase.city}, ${testCase.state || 'N/A'}`;
    const isUS = ['IL', 'ID', 'MT', 'WA', 'PA'].includes(testCase.state) || ['Chicago', 'Boise', 'Bozeman', 'Seattle', 'Philadelphia'].includes(testCase.city);

    let actualBehavior = '';
    let isPassed = false;

    if (!passed) {
      actualBehavior = `Failed: ${reason}`;
    } else if (isUS) {
      // US location checks
      const hasThreeResults = Object.keys(results).length === 3;
      if (hasThreeResults) {
        actualBehavior = 'All 3 agents completed successfully';
        isPassed = true;
        usCitiesData[testCase.city] = results;
      } else {
        actualBehavior = `Incomplete results. Got ${Object.keys(results).length} results, ${Object.keys(errors).length} errors`;
      }
    } else {
      // Non-US location checks
      const hasThreeErrors = Object.keys(errors).length === 3;
      const expectedErrMsg = 'We currently only support relocations within the United States. Please enter a valid US city.';
      const hasCorrectErrorMsgs = Object.values(errors).every(msg => msg === expectedErrMsg);

      // Verify that NO scraping agents were run (no 'progress' messages of status 'scraping' or 'parsing')
      const scrapedOrParsed = logs.some(log => log.type === 'progress' && (log.status === 'scraping' || log.status === 'parsing'));

      if (hasThreeErrors && hasCorrectErrorMsgs && !scrapedOrParsed) {
        actualBehavior = 'Gracefully rejected. Bypassed scraping agents.';
        isPassed = true;
      } else if (scrapedOrParsed) {
        actualBehavior = 'Scraping agents were run against invalid input (expected bypass)';
      } else {
        actualBehavior = `Did not reject with correct error messages. Errors: ${JSON.stringify(errors)}`;
      }
    }

    tableRows.push({
      location: locName,
      expected: isUS ? 'Work end-to-end' : 'Fail gracefully (US-only warning, bypass scrapers)',
      actual: actualBehavior,
      status: isPassed ? 'PASSED ✅' : 'FAILED ❌'
    });
  }

  // Verify US Cities have distinct results
  console.log('Verifying distinctness of US city results...');
  const usCities = Object.keys(usCitiesData);
  let distinctVerificationPassed = true;
  const distinctDetails = [];

  for (let i = 0; i < usCities.length; i++) {
    for (let j = i + 1; j < usCities.length; j++) {
      const cityA = usCities[i];
      const cityB = usCities[j];
      const resA = usCitiesData[cityA];
      const resB = usCitiesData[cityB];

      // Compare housing sources/listings
      const housingSourceA = resA.housing?.sourceName;
      const housingSourceB = resB.housing?.sourceName;
      if (housingSourceA === housingSourceB && housingSourceA) {
        distinctVerificationPassed = false;
        distinctDetails.push(`Housing sources duplicate for ${cityA} and ${cityB}: ${housingSourceA}`);
      }

      // Compare DMV sources
      const dmvSourceA = resA.dmv?.sourceName;
      const dmvSourceB = resB.dmv?.sourceName;
      if (dmvSourceA === dmvSourceB && dmvSourceA) {
        distinctVerificationPassed = false;
        distinctDetails.push(`DMV sources duplicate for ${cityA} and ${cityB}: ${dmvSourceA}`);
      }
    }
  }

  if (distinctVerificationPassed && usCities.length > 0) {
    console.log('✅ Distinctness check PASSED. All US cities returned unique, distinct results.');
  } else if (usCities.length > 0) {
    console.log('❌ Distinctness check FAILED:');
    distinctDetails.forEach(detail => console.log(`  - ${detail}`));
  }

  // Print results table
  console.log('\n| Location Tested | Expected Behavior | Actual Behavior | Pass/Fail |');
  console.log('|---|---|---|---|');
  tableRows.forEach(row => {
    console.log(`| ${row.location} | ${row.expected} | ${row.actual} | ${row.status} |`);
  });
  console.log('\n');

  if (tableRows.some(row => row.status.includes('FAILED')) || !distinctVerificationPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(console.error);
