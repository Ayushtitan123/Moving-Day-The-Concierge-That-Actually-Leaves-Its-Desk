import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Activity,
  FileText,
  Phone,
  Globe,
  Calendar,
  DollarSign,
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
  X,
  Zap,
  Car,
  ArrowRight,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Floating Particle Background ─────────────────────────────── */
function Particles() {
  const particles = Array.from({ length: 55 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    delay: Math.random() * 6,
    duration: Math.random() * 8 + 6,
  }));
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0], y: [0, -30, -60] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Animated Aurora Glow ──────────────────────────────────────── */
function AuroraGlow() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="aurora-blob-1" />
      <div className="aurora-blob-2" />
      <div className="aurora-blob-3" />
    </div>
  );
}

/* ─── Agent Status Badge ────────────────────────────────────────── */
function AgentStatusBadge({ status, color = 'indigo' }) {
  const colors = {
    teal: { ping: 'bg-teal-400', text: 'text-teal-400', done: 'bg-teal-500/10 text-teal-400 border-teal-500/20', err: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    amber: { ping: 'bg-amber-400', text: 'text-amber-400', done: 'bg-amber-500/10 text-amber-400 border-amber-500/20', err: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    rose: { ping: 'bg-rose-400', text: 'text-rose-400', done: 'bg-rose-500/10 text-rose-400 border-rose-500/20', err: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  };
  const c = colors[color] || colors.teal;

  if (status === 'idle') return <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Standby</span>;
  if (status === 'searching' || status === 'scraping' || status === 'parsing') {
    return (
      <span className={`flex items-center space-x-1.5 text-[10px] font-semibold uppercase tracking-wider ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.ping} animate-ping`} />
        <span>Live</span>
      </span>
    );
  }
  if (status === 'complete') return <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full uppercase tracking-wider ${c.done}`}>Done</span>;
  if (status === 'error') return <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full uppercase tracking-wider ${c.err}`}>Blocked</span>;
  return null;
}

/* ─── Input Field ───────────────────────────────────────────────── */
function InputField({ id, label, icon: Icon, iconColor = 'text-slate-400', accentColor, optional, children, ...rest }) {
  const focusRing = accentColor || 'focus:border-indigo-500 focus:ring-indigo-500/30';
  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor={id} className="text-[11px] text-slate-400 font-semibold tracking-wide flex items-center gap-1.5 uppercase">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        {label}
        {optional && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 font-medium normal-case tracking-normal">optional</span>}
      </label>
      {children ? children : (
        <input
          id={id}
          {...rest}
          className={`input-field ${focusRing} ${rest.className || ''}`}
        />
      )}
    </div>
  );
}

/* ─── US States & Abbreviations Map ────────────────────────────── */
const STATE_MAP = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

const US_STATES_LIST = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

/* ─── Main App ──────────────────────────────────────────────────── */
export default function App() {
  const [currentCity, setCurrentCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [budget, setBudget] = useState('');
  const [bedrooms, setBedrooms] = useState('1');

  // Autocomplete & Form validation states
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState('');
  const [formError, setFormError] = useState('');

  const [searchStatus, setSearchStatus] = useState('idle');
  const [demoMode, setDemoMode] = useState(false);
  const [logs, setLogs] = useState([]);

  const [agents, setAgents] = useState({
    housing: { status: 'idle', message: '', data: null },
    utilities: { status: 'idle', message: '', data: null },
    dmv: { status: 'idle', message: '', data: null },
  });

  const [completedDocs, setCompletedDocs] = useState({});
  const [activeScreenshot, setActiveScreenshot] = useState(null);

  const socketRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then(r => r.json())
      .then(d => { if (d.demoMode) setDemoMode(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message, type = 'info') => {
    const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setLogs(prev => [...prev, { id: logId, text: message, type, time: new Date().toLocaleTimeString() }]);
  };

  const autocompleteRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (val) => {
    if (!val || val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setIsFetchingSuggestions(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=us&addressdetails=1&featuretype=settlement&limit=5`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'MovingDayApp'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = data.map(item => {
          const stateCodePart = item.address['ISO3166-2-lvl4'];
          let stateCode = stateCodePart && stateCodePart.startsWith('US-') ? stateCodePart.substring(3).toUpperCase() : '';
          
          if (!stateCode && item.address.state) {
            const stateName = item.address.state.toLowerCase();
            stateCode = STATE_MAP[stateName] || '';
          }
          
          return {
            label: item.display_name,
            city: item.address.city || item.address.town || item.address.village || item.address.hamlet || item.name,
            state: stateCode
          };
        }).filter(item => item.city && item.state);
        
        const seen = new Set();
        const unique = [];
        for (const item of parsed) {
          const key = `${item.city.toLowerCase()}-${item.state.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        setSuggestions(unique);
      }
    } catch (err) {
      console.error('Error fetching autocomplete suggestions:', err);
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  useEffect(() => {
    if (!destinationCity || destinationCity === selectedFromAutocomplete) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchSuggestions(destinationCity);
    }, 300);
    return () => clearTimeout(timer);
  }, [destinationCity]);

  const handleSelectAutocomplete = (item) => {
    setSelectedFromAutocomplete(item.city);
    setDestinationCity(item.city);
    setDestinationState(item.state);
    setSuggestions([]);
    setShowSuggestions(false);
    setFormError('');
  };

  const handleStartSearch = (e) => {
    e.preventDefault();
    if (!destinationCity) return;

    // Check if selected state is in the valid US States list
    const isUSState = US_STATES_LIST.some(st => st.code === destinationState.toUpperCase());
    if (!isUSState) {
      setFormError('Destination must be within the United States. Please select a valid US state.');
      return;
    }
    setFormError('');

    setSearchStatus('searching');
    setLogs([]);
    setCompletedDocs({});
    setAgents({
      housing: { status: 'searching', message: 'Queueing agent...', data: null },
      utilities: { status: 'searching', message: 'Queueing agent...', data: null },
      dmv: { status: 'searching', message: 'Queueing agent...', data: null },
    });

    addLog(`Initiating relocation research for ${destinationCity}${destinationState ? `, ${destinationState}` : ''}...`, 'status');

    if (socketRef.current) socketRef.current.close();

    const ws = new WebSocket('ws://localhost:3001');
    socketRef.current = ws;

    ws.onopen = () => {
      addLog('Secure connection established with orchestrator server.', 'system');
      ws.send(JSON.stringify({
        type: 'startSearch',
        data: {
          currentCity, destinationCity, destinationState, moveDate,
          budget: parseInt(budget.toString().replace(/[^0-9]/g, '')) || 0,
          bedrooms: parseInt(bedrooms),
        },
      }));
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      const { type, agent, status, message, data, state } = parsed;

      if (type === 'stateResolved') {
        setDestinationState(state);
        addLog(`[SYSTEM] Auto-resolved destination state: ${state}`, 'system');
        return;
      }
      if (type === 'progress') {
        setAgents(prev => ({ ...prev, [agent]: { ...prev[agent], status, message: message || prev[agent].message } }));
        addLog(`[${agent.toUpperCase()}] ${message}`, 'info');
      }
      if (type === 'result') {
        setAgents(prev => ({ ...prev, [agent]: { ...prev[agent], status: 'complete', message: 'Research complete!', data } }));
        addLog(`[${agent.toUpperCase()}] Results successfully retrieved!`, 'success');
      }
      if (type === 'error') {
        setAgents(prev => ({ ...prev, [agent]: { ...prev[agent], status: 'error', message: message || 'Failed.' } }));
        addLog(`[${agent.toUpperCase()}] Error: ${message}`, 'error');
      }
    };

    ws.onerror = () => {
      addLog('WebSocket connection error.', 'error');
      setSearchStatus('error');
    };
  };

  const isSearchComplete =
    (agents.housing.status === 'complete' || agents.housing.status === 'error') &&
    (agents.utilities.status === 'complete' || agents.utilities.status === 'error') &&
    (agents.dmv.status === 'complete' || agents.dmv.status === 'error');

  useEffect(() => {
    if (searchStatus === 'searching' && isSearchComplete) {
      setSearchStatus('complete');
      addLog('All research agents have completed their tasks.', 'system');
    }
  }, [isSearchComplete, searchStatus]);

  const toggleDoc = (i) => setCompletedDocs(prev => ({ ...prev, [i]: !prev[i] }));

  const exportMarkdown = () => {
    const housingText = agents.housing.data
      ? agents.housing.data.listings.map((l, i) => `${i + 1}. **${l.price} - ${l.bedrooms}**\n   Address: ${l.address}\n   Link: ${l.link}`).join('\n')
      : 'No listings retrieved.';
    const utilitiesText = agents.utilities.data
      ? agents.utilities.data.providers.map(p => `- **${p.type}**: ${p.name}\n  Phone: ${p.phone}\n  Website: ${p.website}`).join('\n')
      : 'No utility providers retrieved.';
    const dmvText = agents.dmv.data
      ? `### Required Documents\n${agents.dmv.data.documents.map(d => `- [ ] ${d}`).join('\n')}\n\n### Steps\n${agents.dmv.data.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : 'No DMV details retrieved.';

    const md = `# Moving Day Relocation Brief — ${destinationCity}, ${destinationState}
Generated: ${new Date().toLocaleDateString()} | Move Date: ${moveDate}
Budget: $${budget}/mo | Bedrooms: ${bedrooms}

## 1. HOUSING (${agents.housing.data?.sourceName || 'Pending'})
${housingText}

## 2. UTILITIES (${agents.utilities.data?.sourceName || 'Pending'})
${utilitiesText}

## 3. DMV & LICENSING (${agents.dmv.data?.sourceName || 'Pending'})
${dmvText}

---
Created by Moving Day Relocation Concierge.`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `Moving_Day_Brief_${destinationCity}_${destinationState}.md`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isSearching = searchStatus === 'searching';

  return (
    <div className="relative min-h-screen flex flex-col bg-[#050812] text-white selection:bg-indigo-500/40 selection:text-white overflow-x-hidden">
      <AuroraGlow />
      <Particles />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="no-print relative z-30 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl sticky top-0 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none flex items-center gap-2">
              Moving Day
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 tracking-wide">
                AI Concierge
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Three agents. Three searches. Real results.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {demoMode && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Demo Mode
            </div>
          )}
          <span className="text-xs text-slate-600 font-mono">v2.0</span>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="relative z-10 text-center pt-16 pb-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 tracking-wide">
            <Star className="h-3.5 w-3.5 fill-indigo-400 text-indigo-400" />
            AI-Powered Relocation Research
          </div>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4">
            Your Move.{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Researched.
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Three AI agents fan out in parallel — finding housing, utilities, and DMV steps — so you don't have to.
          </p>
        </motion.div>
      </section>

      {/* ── Main Layout ────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 pb-16 flex flex-col gap-8">

        {/* Form + Log Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* ── Intake Form Card ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="lg:col-span-3 premium-card no-print"
          >
            {/* Card header */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20">
                <Sparkles className="h-4.5 w-4.5 text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Plan Your Move</h3>
                <p className="text-[11px] text-slate-500">Tell our agents where you're headed</p>
              </div>
            </div>

            <form onSubmit={handleStartSearch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField id="currentCity" label="Current City" icon={MapPin} iconColor="text-slate-500">
                <input
                  id="currentCity"
                  type="text"
                  placeholder="e.g. New York"
                  value={currentCity}
                  onChange={e => setCurrentCity(e.target.value)}
                  className="input-field focus:border-slate-500 focus:ring-slate-500/20"
                />
              </InputField>

              <div ref={autocompleteRef} className="relative flex flex-col space-y-1.5">
                <InputField id="destinationCity" label="Destination City" icon={MapPin} iconColor="text-indigo-400">
                  <input
                    id="destinationCity"
                    type="text"
                    required
                    placeholder="e.g. Austin"
                    value={destinationCity}
                    onChange={e => {
                      setDestinationCity(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="input-field focus:border-indigo-500 focus:ring-indigo-500/20 border-indigo-500/20"
                    autoComplete="off"
                  />
                </InputField>
                {showSuggestions && (suggestions.length > 0 || isFetchingSuggestions) && (
                  <div className="absolute top-[68px] left-0 w-full bg-[#0d1222]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                    {isFetchingSuggestions && suggestions.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                        <span>Searching US locations...</span>
                      </div>
                    ) : (
                      suggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectAutocomplete(item)}
                          className="px-4 py-2.5 hover:bg-indigo-500/20 cursor-pointer transition-colors text-xs text-left text-slate-200"
                        >
                          <span className="font-bold text-white">{item.city}</span>, {item.state}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <InputField id="destinationState" label="State Code" icon={Globe} iconColor="text-violet-400">
                <select
                  id="destinationState"
                  required
                  value={destinationState}
                  onChange={e => {
                    setDestinationState(e.target.value);
                    setFormError('');
                  }}
                  className="input-field focus:border-violet-500 focus:ring-violet-500/20"
                >
                  <option value="">Select State...</option>
                  {US_STATES_LIST.map(st => (
                    <option key={st.code} value={st.code}>{st.name} ({st.code})</option>
                  ))}
                </select>
              </InputField>

              <InputField id="moveDate" label="Move Date" icon={Calendar} iconColor="text-sky-400">
                <input
                  id="moveDate"
                  type="date"
                  value={moveDate}
                  onChange={e => setMoveDate(e.target.value)}
                  className="input-field focus:border-sky-500 focus:ring-sky-500/20"
                />
              </InputField>

              <InputField id="rentBudget" label="Max Rent Budget ($)" icon={DollarSign} iconColor="text-emerald-400">
                <input
                  id="rentBudget"
                  type="text"
                  placeholder="e.g. 2000"
                  value={budget}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '' || /^\d+$/.test(v)) setBudget(v);
                  }}
                  className="input-field focus:border-emerald-500 focus:ring-emerald-500/20 border-emerald-500/10"
                />
              </InputField>

              <InputField id="bedrooms" label="Bedrooms Needed" icon={Home} iconColor="text-slate-400">
                <select
                  id="bedrooms"
                  value={bedrooms}
                  onChange={e => setBedrooms(e.target.value)}
                  className="input-field focus:border-indigo-500 focus:ring-indigo-500/20"
                >
                  <option value="1">1 Bedroom</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                </select>
              </InputField>

              {formError && (
                <div className="col-span-full text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="col-span-full pt-2">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full relative overflow-hidden group bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-size-200 text-white rounded-2xl py-4 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="relative flex items-center gap-2">
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Agents Researching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Launch Research Agents
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>
          </motion.div>

          {/* ── Agent Status + Live Log ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="lg:col-span-2 flex flex-col gap-4"
          >
            {/* Agent mini-cards */}
            {[
              { key: 'housing', label: 'Housing Agent', sub: 'Craigslist / Web Search', icon: Home, color: 'teal', gradient: 'from-teal-500/10 to-cyan-500/10', border: 'border-teal-500/20 hover:border-teal-400/40', iconBg: 'bg-teal-500/10', iconColor: 'text-teal-400' },
              { key: 'utilities', label: 'Utilities Agent', sub: 'Power · Water · Internet', icon: Zap, color: 'amber', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-500/20 hover:border-amber-400/40', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400' },
              { key: 'dmv', label: 'DMV Agent', sub: 'License & Registration', icon: Car, color: 'rose', gradient: 'from-rose-500/10 to-pink-500/10', border: 'border-rose-500/20 hover:border-rose-400/40', iconBg: 'bg-rose-500/10', iconColor: 'text-rose-400' },
            ].map(({ key, label, sub, icon: Icon, color, gradient, border, iconBg, iconColor }) => (
              <div key={key} className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${gradient} border ${border} transition-all duration-300`}>
                <div className={`p-2.5 rounded-xl ${iconBg} border border-white/5`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {agents[key].status !== 'idle' ? agents[key].message : sub}
                  </p>
                </div>
                <AgentStatusBadge status={agents[key].status} color={color} />
              </div>
            ))}

            {/* Live log terminal */}
            <div className="premium-card flex flex-col min-h-[160px] max-h-[220px]">
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Live Agent Feed</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-slate-500 font-mono">WS</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10px] leading-relaxed pr-1 scrollbar-thin">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">Awaiting research initiation...</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-slate-600 shrink-0">[{log.time}]</span>
                      <span className={
                        log.type === 'success' ? 'text-emerald-400 font-semibold' :
                        log.type === 'error' ? 'text-rose-400' :
                        log.type === 'system' ? 'text-indigo-400' : 'text-slate-400'
                      }>{log.text}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Action Bar ───────────────────────────────────────────── */}
        <AnimatePresence>
          {searchStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="no-print flex items-center justify-between bg-slate-900/50 border border-white/[0.07] px-6 py-4 rounded-2xl backdrop-blur-md"
            >
              <div className="text-sm text-slate-400 flex items-center gap-2">
                {isSearching ? (
                  <><Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> Agents are actively researching your move...</>
                ) : (
                  <><Check className="h-4 w-4 text-emerald-400" /> <span className="text-emerald-400 font-semibold">Research complete — your brief is ready.</span></>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportMarkdown} disabled={isSearching} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-white/[0.07]">
                  <Download className="h-3.5 w-3.5" /> Export Brief
                </button>
                <button onClick={() => window.print()} disabled={isSearching} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
                  <Printer className="h-3.5 w-3.5" /> Print PDF
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* HOUSING CARD */}
          <AgentCard
            title="Housing Listings"
            subtitle="Craigslist · Web Search"
            icon={Home}
            iconColor="text-teal-400"
            iconBg="bg-teal-500/10"
            borderAccent="hover:border-teal-500/30"
            topBar="from-teal-500/10 to-cyan-500/5"
            status={agents.housing.status}
            statusColor="teal"
            spinnerColor="text-teal-400"
            pingColor="border-teal-500/20"
            errorMessage={agents.housing.message}
          >
            {agents.housing.status === 'complete' && agents.housing.data && (
              <div className="space-y-5">
                <h4 className="section-label">Top Verified Listings</h4>
                <div className="space-y-2">
                  {agents.housing.data.listings.slice(0, 5).map((l, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="p-3 bg-slate-950/50 rounded-xl border border-white/[0.06] hover:border-teal-500/20 transition-all flex justify-between items-start group">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-emerald-400">{l.price}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md font-semibold">{l.bedrooms}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{l.address}</p>
                      </div>
                      <a href={l.link} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 bg-slate-800/80 hover:bg-teal-600 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </motion.div>
                  ))}
                </div>
                <div>
                  <h4 className="section-label mb-2">Verification Screenshot</h4>
                  <div className="relative group rounded-xl overflow-hidden border border-white/[0.06] cursor-zoom-in">
                    <img src={`http://localhost:3001${agents.housing.data.screenshotUrl}`} alt="Screenshot" className="w-full h-32 object-cover object-top transition-transform duration-500 group-hover:scale-105 housing-screenshot-img" />
                    <div onClick={() => setActiveScreenshot(`http://localhost:3001${agents.housing.data.screenshotUrl}`)}
                      className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 bg-slate-900 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
                        <Maximize2 className="h-3 w-3" /> Expand
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AgentCard>

          {/* UTILITIES CARD */}
          <AgentCard
            title="Utilities & Services"
            subtitle="Power · Water · Internet"
            icon={Activity}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
            borderAccent="hover:border-amber-500/30"
            topBar="from-amber-500/10 to-orange-500/5"
            status={agents.utilities.status}
            statusColor="amber"
            spinnerColor="text-amber-400"
            pingColor="border-amber-500/20"
            errorMessage={agents.utilities.message}
          >
            {agents.utilities.status === 'complete' && agents.utilities.data && (
              <div className="space-y-4">
                <h4 className="section-label">Provider Directory</h4>
                <div className="overflow-hidden border border-white/[0.06] rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-950/50 text-slate-500 border-b border-white/[0.06]">
                        <th className="p-3 text-left font-semibold tracking-wide">Service</th>
                        <th className="p-3 text-left font-semibold tracking-wide">Provider</th>
                        <th className="p-3 text-left font-semibold tracking-wide">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.utilities.data.providers.map((p, i) => (
                        <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-semibold text-slate-300">{p.type}</td>
                          <td className="p-3 text-slate-400">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5"><Phone className="h-2.5 w-2.5" />{p.phone || 'N/A'}</div>
                          </td>
                          <td className="p-3">
                            {p.website && p.website !== 'N/A' && (
                              <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors">
                                <Globe className="h-3 w-3" /><span>Setup</span>
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
          </AgentCard>

          {/* DMV CARD */}
          <AgentCard
            title="DMV & Licensing"
            subtitle="Documents & Process"
            icon={FileText}
            iconColor="text-rose-400"
            iconBg="bg-rose-500/10"
            borderAccent="hover:border-rose-500/30"
            topBar="from-rose-500/10 to-pink-500/5"
            status={agents.dmv.status}
            statusColor="rose"
            spinnerColor="text-rose-400"
            pingColor="border-rose-500/20"
            errorMessage={agents.dmv.message}
          >
            {agents.dmv.status === 'complete' && agents.dmv.data && (
              <div className="space-y-5">
                <div>
                  <h4 className="section-label mb-2.5 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-rose-400" /> Required Documents
                  </h4>
                  <div className="space-y-1.5">
                    {agents.dmv.data.documents.map((doc, i) => (
                      <div key={i} onClick={() => toggleDoc(i)}
                        className="flex items-start gap-2.5 p-2 bg-slate-950/30 rounded-lg border border-white/[0.05] hover:border-rose-500/20 transition-all cursor-pointer select-none group">
                        <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${completedDocs[i] ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 group-hover:border-white/40'}`}>
                          {completedDocs[i] && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className={`text-[11px] leading-tight transition-colors ${completedDocs[i] ? 'line-through text-slate-600' : 'text-slate-300'}`}>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="section-label mb-2.5">Step-by-Step Process</h4>
                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/[0.05]">
                    {agents.dmv.data.steps.map((step, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-3 pl-1">
                        <div className="h-6 w-6 rounded-full bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0 z-10">{i + 1}</div>
                        <p className="text-[11px] text-slate-300 leading-relaxed pt-0.5">{step}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </AgentCard>
        </div>
      </main>

      {/* ── Screenshot Lightbox ──────────────────────────────────────── */}
      <AnimatePresence>
        {activeScreenshot && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setActiveScreenshot(null)}>
            <button className="absolute top-6 right-6 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/10"
              onClick={() => setActiveScreenshot(null)}>
              <X className="h-5 w-5" />
            </button>
            <motion.img initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}
              src={activeScreenshot} alt="Screenshot" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="no-print relative z-10 border-t border-white/[0.05] bg-black/20 backdrop-blur-md py-6 px-6 text-center">
        <p className="text-xs text-slate-600">Moving Day © 2026 · Built with React, Tailwind CSS, Playwright &amp; Google Gemini AI</p>
      </footer>
    </div>
  );
}

/* ─── Reusable Agent Result Card ────────────────────────────────── */
function AgentCard({ title, subtitle, icon: Icon, iconColor, iconBg, borderAccent, topBar, status, statusColor, spinnerColor, pingColor, errorMessage, children }) {
  const isActive = status === 'searching' || status === 'scraping' || status === 'parsing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`premium-card flex flex-col overflow-hidden border-white/[0.07] ${borderAccent} transition-all duration-300`}
    >
      {/* Top gradient bar */}
      <div className={`h-0.5 bg-gradient-to-r ${topBar} w-full mb-0 -mt-5 -mx-5 mb-5`} style={{ width: 'calc(100% + 2.5rem)' }} />

      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBg} border border-white/[0.06]`}>
            <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm leading-none">{title}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <AgentStatusBadge status={status} color={statusColor} />
      </div>

      {/* Body */}
      <div className="flex-1">
        {status === 'idle' && (
          <div className="py-14 flex flex-col items-center justify-center text-center text-slate-600">
            <Icon className={`h-10 w-10 mb-3 opacity-20`} />
            <p className="text-sm">Submit the form to activate this agent.</p>
          </div>
        )}

        {isActive && (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <div className="relative mb-4 flex items-center justify-center">
              <Loader2 className={`h-8 w-8 animate-spin ${spinnerColor}`} />
              <div className={`absolute h-8 w-8 animate-ping border ${pingColor} rounded-full`} />
            </div>
            <p className="text-sm text-slate-300 font-semibold">Agent Active</p>
            <p className="text-[11px] text-slate-500 mt-1 italic max-w-xs">{status}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-12 text-center px-4">
            <div className="inline-flex p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-300 font-semibold mb-2">Agent Search Interrupted</p>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMessage || 'The search process encountered an error.'}</p>
          </div>
        )}

        {status === 'complete' && children}
      </div>
    </motion.div>
  );
}
