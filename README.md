# Moving Day — Relocation Concierge Assistant

**Moving Day** is a single-session demo web application designed to help users moving to a new city by performing real-time web research across three specialized agents and consolidating their findings into a single, beautifully designed dashboard.

The application leverages **Playwright** for headless browser automation, **Google Gemini (gemini-2.5-flash)** for intelligent unstructured text parsing, and **WebSockets** for streaming live updates from backend agents directly to the React + Tailwind frontend in real time.

---

## Agent Architecture

1. **Housing Agent (Craigslist / Search Engines)**
   - Resolves the target city's Craigslist subdomain dynamically by querying DuckDuckGo.
   - Navigates directly to the Craigslist rental board, applying filters for maximum budget and exact bedroom count.
   - Captures a viewport screenshot of the search results as proof of verification.
   - Extracts raw page links and text, using Gemini to isolate the top 5 valid listings (comprising prices, bedrooms, addresses, and Craigslist listing URLs).
   - *Fallback:* If Craigslist blocks the request or fails, the agent automatically falls back to cached rental data for Austin, Denver, or Seattle.

2. **Utilities & Services Agent (DuckDuckGo / Local Directories)**
   - Performs parallel searches on DuckDuckGo (HTML-lite endpoint to avoid bot-verification blockers) to look up regional internet, electric, and water service providers.
   - Passes search snippets and links to Gemini, which structures the details into a directory including provider names, customer service phone numbers, and setup websites.

3. **DMV & Local Admin Agent (Official State DMV Lookup Table)**
   - Uses a pre-defined static lookup table mapping all 50 states to their official DMV landing pages (eliminating search errors).
   - Navigates directly to the state's official `.gov` licensing page, extracting the raw text instructions.
   - Uses Gemini to construct an interactive resident driver's license transfer guide and checklist of required documents.

---

## Key Features

- **Parallel Streaming:** Three agents execute in parallel on the Node.js/Express backend. Their logs and structured results are streamed via WebSockets, updating each dashboard card (Housing, Utilities, DMV) independently as soon as that agent completes.
- **DEMO_MODE Accompanying Flag:** To guarantee reliable video recordings, presentations, or offline tests, the app includes a `DEMO_MODE` environment flag. When active, it bypasses browser scraping and rate-limits, simulating agent crawling and streaming high-quality cached results for Austin, Denver, and Seattle.
- **Interactive Checklist:** The DMV card populates with a clickable checklist of required documents, allowing users to tick off items as they prepare.
- **Export Dossier:** Allows users to export their compiled relocation briefcase as a Markdown file (`.md`) or trigger a print dialog customized with print CSS styles to print/save the dashboard as a clean PDF document.

---

## Getting Started

### Prerequisites
- Node.js (version 18+ or 22+ recommended)
- A system-level `GEMINI_API_KEY` env variable (already set in this environment).

### Installation (One-Time Setup)

To automatically install all dependencies in the root, frontend, and backend packages, and download Playwright's headless Chromium binaries, run:

```bash
npm run setup
```

---

## Running the Application

### 1. Run in Demo Mode (Recommended for testing/recording)
This mode bypasses live browser scraping and instantly streams pre-cached data with artificial delays to showcase parallel execution:

```bash
npm run start:demo
```
Access the application at `http://localhost:5173`. *Note: Test with Austin, Denver, or Seattle for full data.*

### 2. Run in Live Mode
This mode launches Playwright browsers to search Craigslist, DuckDuckGo, and official DMV pages in real-time, calling Gemini to structure results:

```bash
npm run start
```
Access the application at `http://localhost:5173`.

---

## Developer Command-Line Testing

To verify the Playwright scraping scripts and Gemini API connections directly from your command line without starting the web servers, run:

```bash
npm run test --prefix backend
```
This runs the isolated `testAgents.js` harness and outputs structured JSON results for Austin, TX.
