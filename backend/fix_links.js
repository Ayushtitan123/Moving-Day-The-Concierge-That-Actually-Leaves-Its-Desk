import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, 'data', 'cachedData.js');

let content = fs.readFileSync(file, 'utf8');

// Replace Zillow, Apartments.com, Trulia, Hotpads with Craigslist
content = content.replace(/https:\/\/www\.zillow\.com\/[^\/]+\/rentals\//g, 'https://austin.craigslist.org/search/apa?query=');
content = content.replace(/https:\/\/www\.apartments\.com\/[^\/]+\//g, 'https://austin.craigslist.org/search/apa?query=');
content = content.replace(/https:\/\/www\.trulia\.com\/for_rent\/[^\/]+\//g, 'https://austin.craigslist.org/search/apa?query=');
content = content.replace(/https:\/\/hotpads\.com\/[^\/]+\/apartments-for-rent/g, 'https://austin.craigslist.org/search/apa?query=');

// Fix Denver specifically
content = content.replace(/austin\.craigslist\.org\/search\/apa\?query=denver-co/g, 'denver.craigslist.org/search/apa?query=denver');
content = content.replace(/austin\.craigslist\.org\/search\/apa\?query=Denver,CO/g, 'denver.craigslist.org/search/apa?query=denver');

// Fix Seattle specifically
content = content.replace(/austin\.craigslist\.org\/search\/apa\?query=seattle-wa/g, 'seattle.craigslist.org/search/apa?query=seattle');
content = content.replace(/austin\.craigslist\.org\/search\/apa\?query=Seattle,WA/g, 'seattle.craigslist.org/search/apa?query=seattle');

fs.writeFileSync(file, content);
console.log('Fixed US real estate portal links in cachedData.js');
