import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Activity, 
  FileText, 
  Phone, 
  Globe, 
  Calendar, 
  DollarSign, 
  User, 
  Download, 
  Printer, 
  ExternalLink, 
  Check, 
  Loader2, 
  AlertTriangle, 
  MapPin, 
  Sparkles, 
  Info,
  Maximize2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [currentCity, setCurrentCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [budget, setBudget] = useState('');
  const [bedrooms, setBedrooms] = useState('1');
  
  // App connection and search states
  const [searchStatus, setSearchStatus] = useState('idle'); // idle | searching | complete | error
  const [demoMode, setDemoMode] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // States for individual agents
  const [agents, setAgents] = useState({
    housing: { status: 'idle', message: '', data: null },
    utilities: { status: 'idle', message: '', data: null },
    dmv: { status: 'idle', message: '', data: null }
  });

  // Checklist state for DMV documents
  const [completedDocs, setCompletedDocs] = useState({});

  // Lightbox modal state
  const [activeScreenshot, setActiveScreenshot] = useState(null);

  const socketRef = useRef(null);
  const logsEndRef = useRef(null);

  // Check backend health and mode
  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then(res => res.json())
      .then(data => {
        if (data.demoMode) {
          setDemoMode(true);
        }
      })
      .catch(err => console.log('Could not connect to health endpoint, using default socket states.'));
  }, []);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message, type = 'info') => {
    const logId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setLogs(prev => [...prev, { id: logId, text: message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleStartSearch = (e) => {
    e.preventDefault();
    if (!destinationCity || !destinationState) return;

    setSearchStatus('searching');
    setLogs([]);
    setCompletedDocs({});
    setAgents({
      housing: { status: 'searching', message: 'Queueing agent...', data: null },
      utilities: { status: 'searching', message: 'Queueing agent...', data: null },
      dmv: { status: 'searching', message: 'Queueing agent...', data: null }
    });

    addLog(`Initiating relocation concierge assistant for ${destinationCity}, ${destinationState}...`, 'status');

    // Close existing socket if open
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Connect to backend WebSocket
    const ws = new WebSocket('ws://localhost:3001');
    socketRef.current = ws;

    ws.onopen = () => {
      addLog('Secure connection established with orchestrator server.', 'system');
      ws.send(JSON.stringify({
        type: 'startSearch',
        data: {
          currentCity,
          destinationCity,
          destinationState,
          moveDate,
          budget: parseInt(budget),
          bedrooms: parseInt(bedrooms)
        }
      }));
    };

    ws.onmessage = (event) => {
      const { type, agent, status, message, data } = JSON.parse(event.data);

      if (type === 'progress') {
        setAgents(prev => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status,
            message: message || prev[agent].message
          }
        }));
        addLog(`[${agent.toUpperCase()}] ${message}`, 'info');
      }

      if (type === 'result') {
        setAgents(prev => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status: 'complete',
            message: 'Research complete!',
            data
          }
        }));
        addLog(`[${agent.toUpperCase()}] Successfully parsed and resolved results!`, 'success');
      }

      if (type === 'error') {
        setAgents(prev => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status: 'error',
            message: message || 'Failed to gather details.'
          }
        }));
        addLog(`[${agent.toUpperCase()}] Error: ${message}`, 'error');
      }
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      addLog('WebSocket connection encountered an error.', 'error');
      setSearchStatus('error');
    };

  };

  // Check if all agents completed
  const isSearchComplete = 
    (agents.housing.status === 'complete' || agents.housing.status === 'error') &&
    (agents.utilities.status === 'complete' || agents.utilities.status === 'error') &&
    (agents.dmv.status === 'complete' || agents.dmv.status === 'error');

  // Automatically transition searchStatus to complete when all agents finish
  useEffect(() => {
    if (searchStatus === 'searching' && isSearchComplete) {
      setSearchStatus('complete');
      addLog('All research agents have completed their tasks.', 'system');
    }
  }, [isSearchComplete, searchStatus]);

  // Toggle DMV checklist
  const toggleDoc = (docIndex) => {
    setCompletedDocs(prev => ({
      ...prev,
      [docIndex]: !prev[docIndex]
    }));
  };

  // Export to Markdown
  const exportMarkdown = () => {
    const housingText = agents.housing.data 
      ? agents.housing.data.listings.map((l, i) => `${i+1}. **${l.price} - ${l.bedrooms}**\n   Address: ${l.address}\n   Link: ${l.link}`).join('\n')
      : 'No listings retrieved.';

    const utilitiesText = agents.utilities.data
      ? agents.utilities.data.providers.map(p => `- **${p.type}**: ${p.name}\n  Phone: ${p.phone}\n  Website: ${p.website}`).join('\n')
      : 'No utility providers retrieved.';

    const dmvText = agents.dmv.data
      ? `### Required Documents Checklist\n${agents.dmv.data.documents.map(d => `- [ ] ${d}`).join('\n')}\n\n### Transfer Steps\n${agents.dmv.data.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}`
      : 'No DMV details retrieved.';

    const mdContent = `# Moving Day Relocation Brief - ${destinationCity}, ${destinationState}
Generated on: ${new Date().toLocaleDateString()}
Target Move Date: ${moveDate}
Monthly Budget: $${budget} | Bedrooms: ${bedrooms}

==================================================

## 1. HOUSING SUMMARY (${agents.housing.data?.sourceName || 'Pending'})
Source URL: ${agents.housing.data?.sourceUrl || 'N/A'}

${housingText}

==================================================

## 2. UTILITIES & LOCAL SERVICES (${agents.utilities.data?.sourceName || 'Pending'})
Source URL: ${agents.utilities.data?.sourceUrl || 'N/A'}

${utilitiesText}

==================================================

## 3. DMV & VEHICLE REGISTRATION (${agents.dmv.data?.sourceName || 'Pending'})
Source URL: ${agents.dmv.data?.sourceUrl || 'N/A'}

${dmvText}

==================================================
Safe travels on your Moving Day!
Brief created by Moving Day Relocation Concierge.
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Moving_Day_Brief_${destinationCity}_${destinationState}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="no-print border-b border-white/5 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <Home className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center">
              Moving Day 
              <span className="ml-2.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Relocation Assistant
              </span>
            </h1>
            <p className="text-xs text-slate-400">Live AI search engine and concierge dashboard</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {demoMode && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Demo Mode Active</span>
            </div>
          )}
          <span className="text-xs text-slate-500">v1.0.0</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col space-y-8">
        
        {/* Intake Section */}
        <section className="no-print glass-panel rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-stretch lg:space-x-8 space-y-6 lg:space-y-0">
          
          {/* Intake Form */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center">
                <Sparkles className="h-5 w-5 text-indigo-400 mr-2" />
                Plan Your Move
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Tell us where you are headed, and our three browser agents will research housing, utilities, and DMV steps in parallel.
              </p>
            </div>
            
            <form onSubmit={handleStartSearch} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <MapPin className="h-3.5 w-3.5 text-slate-500 mr-1.5" /> Current City
                </label>
                <input
                  type="text"
                  placeholder="e.g. New York"
                  value={currentCity}
                  onChange={(e) => setCurrentCity(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <MapPin className="h-3.5 w-3.5 text-indigo-400 mr-1.5" /> Destination City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <Globe className="h-3.5 w-3.5 text-indigo-400 mr-1.5" /> Destination State Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  placeholder="e.g. TX"
                  value={destinationState}
                  onChange={(e) => setDestinationState(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <Calendar className="h-3.5 w-3.5 text-slate-500 mr-1.5" /> Approximate Move Date
                </label>
                <input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> Max Rent Budget ($)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center">
                  <Home className="h-3.5 w-3.5 text-slate-500 mr-1.5" /> Bedrooms Needed
                </label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                >
                  <option value="1">1 Bedroom</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                </select>
              </div>

              <div className="col-span-full pt-2">
                <button
                  type="submit"
                  disabled={searchStatus === 'searching'}
                  className="w-full btn-glow bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl py-3.5 font-bold hover:shadow-indigo-500/20 hover:opacity-95 transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchStatus === 'searching' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Agents Researching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Start Relocation Research</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Terminal / Live Console Log */}
          <div className="w-full lg:w-96 flex flex-col glass-panel bg-slate-950/80 rounded-xl border border-white/5 p-4 h-72 lg:h-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-ping" />
                Live Agent Streams
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">WebSocket</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic h-full flex items-center justify-center text-center">
                  Waiting for search initiation...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-slate-300">
                    <span className="text-slate-500 text-[10px] mr-1.5">[{log.time}]</span>
                    <span className={
                      log.type === 'success' ? 'text-emerald-400 font-semibold' :
                      log.type === 'error' ? 'text-rose-400' :
                      log.type === 'system' ? 'text-indigo-400' : 'text-slate-300'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </section>

        {/* Action Bar (Export/Print) */}
        {searchStatus !== 'idle' && (
          <div className="no-print flex items-center justify-between bg-slate-900/40 border border-white/5 px-6 py-4 rounded-xl">
            <div className="text-sm text-slate-400">
              {searchStatus === 'searching' ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400 mr-2" />
                  Agents are actively crawling. Summary will unlock shortly...
                </span>
              ) : (
                <span className="flex items-center text-emerald-400 font-medium">
                  <Check className="h-4 w-4 mr-2" />
                  Research completed. Summary dossier ready.
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={exportMarkdown}
                disabled={searchStatus === 'searching'}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1.5 border border-white/5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Markdown</span>
              </button>

              <button
                onClick={() => window.print()}
                disabled={searchStatus === 'searching'}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-lg shadow-indigo-600/10"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print PDF Summary</span>
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* CARD 1: HOUSING AGENT */}
          <div className="glass-panel rounded-2xl flex flex-col justify-between overflow-hidden">
            <div>
              {/* Header */}
              <div className="bg-slate-950/40 px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Housing Listings</h3>
                    <p className="text-[10px] text-slate-400">Craigslist Real-time Scrape</p>
                  </div>
                </div>
                {renderCardStatus(agents.housing.status)}
              </div>

              {/* Body */}
              <div className="p-6">
                {agents.housing.status === 'idle' && (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                    <Home className="h-10 w-10 text-slate-600 mb-3" />
                    <p className="text-sm">Submit intake form to trigger Housing Agent.</p>
                  </div>
                )}

                {agents.housing.status === 'searching' || agents.housing.status === 'scraping' || agents.housing.status === 'parsing' ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-4 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                      <div className="absolute inset-0 h-8 w-8 animate-ping border border-indigo-500/20 rounded-full" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Housing Agent Active</p>
                    <p className="text-xs text-slate-500 mt-1 italic">{agents.housing.message}</p>
                  </div>
                ) : null}

                {agents.housing.status === 'error' && (
                  <div className="py-10 text-center">
                    <div className="inline-flex p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 mb-3">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-slate-300 font-semibold">Agent Search Interrupted</p>
                    <p className="text-xs text-rose-400 mt-1">{agents.housing.message}</p>
                  </div>
                )}

                {agents.housing.status === 'complete' && agents.housing.data && (
                  <div className="space-y-6">
                    {/* Listings */}
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top 5 Verified Listings</h4>
                      <div className="space-y-2.5">
                        {agents.housing.data.listings.slice(0, 5).map((list, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx} 
                            className="p-3 bg-slate-950/40 rounded-xl border border-white/5 hover:border-indigo-500/20 transition-all flex justify-between items-start group"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="text-xs font-bold text-emerald-400 mr-2">{list.price}</span>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-semibold">{list.bedrooms}</span>
                              <p className="text-xs text-slate-300 mt-1 truncate">{list.address}</p>
                            </div>
                            <a 
                              href={list.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="p-1.5 bg-slate-800/80 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Screenshot Proof */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verification Screenshot</h4>
                      <div className="relative group rounded-xl overflow-hidden border border-white/5 cursor-zoom-in">
                        <img 
                          src={`http://localhost:3001${agents.housing.data.screenshotUrl}`} 
                          alt="Search proof screenshot" 
                          className="w-full h-32 object-cover object-top transition-transform duration-500 group-hover:scale-105 housing-screenshot-img"
                        />
                        <div 
                          onClick={() => setActiveScreenshot(`http://localhost:3001${agents.housing.data.screenshotUrl}`)}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <span className="px-3 py-1.5 bg-slate-900 rounded-lg text-xs font-bold text-white flex items-center border border-white/10">
                            <Maximize2 className="h-3 w-3 mr-1.5" /> Zoom Screenshot
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Citation */}
            {agents.housing.status === 'complete' && agents.housing.data && (
              <div className="bg-slate-950/20 px-6 py-4 border-t border-white/5 text-[10px] text-slate-500 flex justify-between items-center">
                <span>Citation: Craigslist / Search Engines</span>
                <a 
                  href={agents.housing.data.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-indigo-400 hover:underline flex items-center"
                >
                  Source Link <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </a>
              </div>
            )}
          </div>

          {/* CARD 2: UTILITIES AGENT */}
          <div className="glass-panel rounded-2xl flex flex-col justify-between overflow-hidden">
            <div>
              {/* Header */}
              <div className="bg-slate-950/40 px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Utilities & Services</h3>
                    <p className="text-[10px] text-slate-400">Internet, Power, Water Setup</p>
                  </div>
                </div>
                {renderCardStatus(agents.utilities.status)}
              </div>

              {/* Body */}
              <div className="p-6">
                {agents.utilities.status === 'idle' && (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                    <Activity className="h-10 w-10 text-slate-600 mb-3" />
                    <p className="text-sm">Submit intake form to trigger Utilities Agent.</p>
                  </div>
                )}

                {agents.utilities.status === 'searching' || agents.utilities.status === 'scraping' || agents.utilities.status === 'parsing' ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-4 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                      <div className="absolute inset-0 h-8 w-8 animate-ping border border-cyan-500/20 rounded-full" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Utilities Agent Active</p>
                    <p className="text-xs text-slate-500 mt-1 italic">{agents.utilities.message}</p>
                  </div>
                ) : null}

                {agents.utilities.status === 'error' && (
                  <div className="py-10 text-center">
                    <div className="inline-flex p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 mb-3">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-slate-300 font-semibold">Agent Search Interrupted</p>
                    <p className="text-xs text-rose-400 mt-1">{agents.utilities.message}</p>
                  </div>
                )}

                {agents.utilities.status === 'complete' && agents.utilities.data && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Utility Providers Directory</h4>
                    <div className="overflow-hidden border border-white/5 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/40 text-slate-400 border-b border-white/5">
                            <th className="p-3">Service</th>
                            <th className="p-3">Provider</th>
                            <th className="p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.utilities.data.providers.map((p, idx) => (
                            <motion.tr 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: idx * 0.1 }}
                              key={idx} 
                              className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <td className="p-3 font-semibold text-slate-300">{p.type}</td>
                              <td className="p-3 text-slate-400">
                                <div>{p.name}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center">
                                  <Phone className="h-2.5 w-2.5 mr-1" /> {p.phone || 'N/A'}
                                </div>
                              </td>
                              <td className="p-3">
                                {p.website && p.website !== 'N/A' && (
                                  <a 
                                    href={p.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center text-cyan-400 hover:underline hover:text-cyan-300"
                                  >
                                    <Globe className="h-3 w-3 mr-1" />
                                    <span>Setup</span>
                                  </a>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Citation */}
            {agents.utilities.status === 'complete' && agents.utilities.data && (
              <div className="bg-slate-950/20 px-6 py-4 border-t border-white/5 text-[10px] text-slate-500 flex justify-between items-center">
                <span>Citation: DuckDuckGo Local Registries</span>
                <a 
                  href={agents.utilities.data.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-cyan-400 hover:underline flex items-center"
                >
                  Source Link <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </a>
              </div>
            )}
          </div>

          {/* CARD 3: DMV AGENT */}
          <div className="glass-panel rounded-2xl flex flex-col justify-between overflow-hidden">
            <div>
              {/* Header */}
              <div className="bg-slate-950/40 px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">DMV & Licensing</h3>
                    <p className="text-[10px] text-slate-400">Documents & Transition Flow</p>
                  </div>
                </div>
                {renderCardStatus(agents.dmv.status)}
              </div>

              {/* Body */}
              <div className="p-6">
                {agents.dmv.status === 'idle' && (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                    <FileText className="h-10 w-10 text-slate-600 mb-3" />
                    <p className="text-sm">Submit intake form to trigger DMV Agent.</p>
                  </div>
                )}

                {agents.dmv.status === 'searching' || agents.dmv.status === 'scraping' || agents.dmv.status === 'parsing' ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-4 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                      <div className="absolute inset-0 h-8 w-8 animate-ping border border-emerald-500/20 rounded-full" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">DMV Agent Active</p>
                    <p className="text-xs text-slate-500 mt-1 italic">{agents.dmv.message}</p>
                  </div>
                ) : null}

                {agents.dmv.status === 'error' && (
                  <div className="py-10 text-center">
                    <div className="inline-flex p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 mb-3">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-slate-300 font-semibold">Agent Search Interrupted</p>
                    <p className="text-xs text-rose-400 mt-1">{agents.dmv.message}</p>
                  </div>
                )}

                {agents.dmv.status === 'complete' && agents.dmv.data && (
                  <div className="space-y-5">
                    {/* Required Documents Checklist */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                        <Info className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                        Required Documents
                      </h4>
                      <div className="space-y-2">
                        {agents.dmv.data.documents.map((doc, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => toggleDoc(idx)}
                            className="flex items-start space-x-2.5 p-2 bg-slate-950/20 rounded-lg border border-white/5 hover:border-emerald-500/20 transition-all cursor-pointer select-none group"
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-all ${
                              completedDocs[idx] 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'border-white/20 group-hover:border-white/40'
                            }`}>
                              {completedDocs[idx] && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span className={`text-[11px] leading-tight transition-colors ${
                              completedDocs[idx] ? 'line-through text-slate-500' : 'text-slate-300'
                            }`}>
                              {doc}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step-by-Step Transition Guide */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Step-by-Step Process</h4>
                      <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                        {agents.dmv.data.steps.map((step, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx} 
                            className="flex items-start space-x-3 text-[11px] leading-relaxed relative pl-1.5"
                          >
                            <div className="h-6 w-6 rounded-full bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0 z-10">
                              {idx + 1}
                            </div>
                            <p className="text-slate-300 pt-0.5">{step}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Citation */}
            {agents.dmv.status === 'complete' && agents.dmv.data && (
              <div className="bg-slate-950/20 px-6 py-4 border-t border-white/5 text-[10px] text-slate-500 flex justify-between items-center">
                <span>Citation: State Government Portal</span>
                <a 
                  href={agents.dmv.data.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-emerald-400 hover:underline flex items-center"
                >
                  Source Link <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </a>
              </div>
            )}
          </div>

        </section>

      </main>

      {/* Screenshot Lightbox Modal */}
      <AnimatePresence>
        {activeScreenshot && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setActiveScreenshot(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/10"
              onClick={() => setActiveScreenshot(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={activeScreenshot} 
              alt="Search screenshot detailed view" 
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/10"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="no-print mt-12 border-t border-white/5 bg-slate-950/40 py-6 px-6 text-center text-xs text-slate-500">
        <p>Moving Day © 2026. Made with React, Tailwind CSS, Playwright, and Google Gemini.</p>
        <p className="text-[10px] text-slate-600 mt-1">This application uses active browser scraping and AI processing for demo purposes.</p>
      </footer>
    </div>
  );
}

// Helper: Status label renderer
function renderCardStatus(status) {
  switch (status) {
    case 'idle':
      return <span className="text-[10px] font-medium text-slate-500 uppercase">Idle</span>;
    case 'searching':
    case 'scraping':
      return (
        <span className="flex items-center space-x-1 text-[10px] font-medium text-indigo-400 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping mr-1" />
          Scraping
        </span>
      );
    case 'parsing':
      return (
        <span className="flex items-center space-x-1 text-[10px] font-medium text-amber-400 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse mr-1" />
          Structuring
        </span>
      );
    case 'complete':
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full uppercase">
          Done
        </span>
      );
    case 'error':
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full uppercase">
          Blocked
        </span>
      );
    default:
      return null;
  }
}
