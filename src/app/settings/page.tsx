'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

const pulseStyle = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.98); }
    100% { opacity: 1; transform: scale(1); }
  }
  .pulse-animation {
    animation: pulse 1.5s infinite ease-in-out;
  }
`;

export default function SettingsPage() {
  const { theme } = useTheme();
  const [geminiKey, setGeminiKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isKeyActive, setIsKeyActive] = useState(false);
  const [detailedError, setDetailedError] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [slabs, setSlabs] = useState({ silver: 5, gold: 10, platinum: 15 });
  const [fleetHistory, setFleetHistory] = useState<any[]>([]);
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    assignment: 'All',
    searchQuery: '',
    tourManager: 'All',
    viewMode: 'Daily' // Daily, Monthly, Yearly
  });

  const [botName, setBotName] = useState('Godwin AI');
  const [greetingMessage, setGreetingMessage] = useState('Hello! I am your Godwin ERP Assistant. How can I help you today?');
  const [qaList, setQaList] = useState<{question: string, answer: string}[]>([]);
  const [leadGenEnabled, setLeadGenEnabled] = useState(true);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [excelExists, setExcelExists] = useState(false);
  const [aiUpdateStatus, setAiUpdateStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Load Global Config (Keys, Slabs)
    fetch('/api/settings/global')
      .then(res => res.json())
      .then(data => {
        if (data.geminiKey) setGeminiKey(data.geminiKey);
        if (data.slabs) setSlabs(data.slabs);
        if (data.model) {
          if (['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.5-flash-8b'].includes(data.model)) {
            setModel(data.model);
          } else {
            setModel('custom');
            setCustomModel(data.model);
          }
        }
        if (data.geminiKey) setIsKeyActive(true);
      })
      .catch(err => console.error('Failed to load global config', err));

    const savedSlips = localStorage.getItem('GODWIN_DUTY_SLIPS');
    if (savedSlips) setFleetHistory(JSON.parse(savedSlips));

    // Load AI Brand Settings
    fetch('/api/settings/ai')
      .then(res => res.json())
      .then(data => {
        if (data.botName) setBotName(data.botName);
        if (data.greetingMessage) setGreetingMessage(data.greetingMessage);
        if (data.qaList) {
          setQaList(data.qaList.map((q: any) => ({
            question: q.question || '',
            answer: q.answer || ''
          })));
        }
        if (data.leadGenEnabled !== undefined) setLeadGenEnabled(data.leadGenEnabled);
        if (data.excelExists !== undefined) setExcelExists(data.excelExists);
      })
      .catch(err => console.error('Failed to load AI settings', err));
  }, []);

  const saveAIConfig = async () => {
    setStatus('saving');
    setDetailedError('');
    const finalModel = model === 'custom' ? customModel : model;
    try {
      localStorage.setItem('GEMINI_API_KEY', geminiKey);
      localStorage.setItem('GEMINI_MODEL', finalModel);
      
      // Save to server
      await fetch('/api/settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey, model: finalModel })
      });

      if (geminiKey) {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: 'Hello', 
            history: [], 
            apiKey: geminiKey,
            model: finalModel
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setStatus('success');
          setIsKeyActive(true);
        } else {
          setStatus('error');
          setIsKeyActive(false);
          const errorMsg = data.details || data.response || data.error || 'Connection rejected by API';
          setDetailedError(`${errorMsg} (Status: ${response.status})`);
        }
      } else {
        setStatus('success');
        setIsKeyActive(false);
      }
    } catch (e) {
      setStatus('error');
      setIsKeyActive(false);
      setDetailedError('Network error or server unavailable');
    }
    
    if (status === 'success') {
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const scanModels = async () => {
    console.log('Starting model scan with key:', geminiKey ? 'KEY_PRESENT' : 'MISSING');
    if (!geminiKey) {
      alert('🔑 Please paste your Gemini API Key first so I can scan for available models.');
      return;
    }
    
    setIsScanning(true);
    setDetailedError('');
    try {
      const res = await fetch(`/api/settings/models?key=${geminiKey}`);
      const data = await res.json();
      
      console.log('Scan response:', res.status, data);
      
      if (res.ok && data.models) {
        setAvailableModels(data.models);
        alert(`✨ Success! I found ${data.models.length} models your key can use.\n\nYou can now select them from the list below.`);
        if (data.models.length > 0 && !data.models.includes(model)) {
          setDetailedError(`Your key is verified! ${data.models.length} models discovered. Tap a model name below to switch.`);
        }
      } else {
        const errorMsg = data.error || 'The API key provided seems invalid or has no model access.';
        setDetailedError(`❌ Scan Failed: ${errorMsg}`);
        alert(`❌ Scan Failed: ${errorMsg}`);
      }
    } catch (e) {
      setDetailedError('📡 Connection Error: Could not reach the discovery service.');
      alert('📡 Connection Error: Could not reach the discovery service.');
    } finally {
      setIsScanning(false);
    }
  };

  const saveAIBranding = async () => {
    setAiUpdateStatus('saving');
    try {
      const formData = new FormData();
      formData.append('botName', botName);
      formData.append('greetingMessage', greetingMessage);
      formData.append('leadGenEnabled', leadGenEnabled.toString());
      formData.append('qaList', JSON.stringify(qaList));
      if (knowledgeFile) {
        formData.append('file', knowledgeFile);
      }

      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setAiUpdateStatus('success');
        setKnowledgeFile(null);
        setExcelExists(true); // Update state
        setTimeout(() => setAiUpdateStatus('idle'), 3000);
      } else {
        setAiUpdateStatus('error');
      }
    } catch (e) {
      setAiUpdateStatus('error');
    }
  };

  const addQA = () => {
    setQaList([...qaList, { question: '', answer: '' }]);
  };

  const removeQA = (index: number) => {
    const newList = [...qaList];
    newList.splice(index, 1);
    setQaList(newList);
  };

  const updateQA = (index: number, field: 'question' | 'answer', value: string) => {
    const newList = [...qaList];
    newList[index][field] = value;
    setQaList(newList);
  };

  const moveQA = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === qaList.length - 1) return;
    
    const newList = [...qaList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setQaList(newList);
  };

  const deleteExcel = async () => {
    if (!confirm('🗑️ Are you sure you want to delete the Excel knowledge base? This cannot be undone.')) return;
    
    try {
      setAiUpdateStatus('saving');
      const res = await fetch('/api/settings/ai', { method: 'DELETE' });
      if (res.ok) {
        setExcelExists(false);
        setAiUpdateStatus('idle');
        alert('✅ Excel knowledge base deleted successfully.');
      } else {
        setAiUpdateStatus('error');
      }
    } catch (e) {
      setAiUpdateStatus('error');
      alert('❌ Failed to delete file.');
    }
  };

  const downloadExcel = () => {
    const link = document.createElement('a');
    link.href = '/api/settings/ai/download';
    link.setAttribute('download', 'godwin_knowledge_base.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveSlabs = async () => {
    try {
      localStorage.setItem('GODWIN_SLABS', JSON.stringify(slabs));
      await fetch('/api/settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slabs })
      });
      alert('✅ Global Pricing Slabs Updated Successfully!');
    } catch (error) {
      alert('❌ Failed to update slabs on server.');
    }
  };

  const exportCSV = () => {
    if (filteredHistory.length === 0) return alert('No data to export');
    
    const headers = ['Date', 'Vehicle', 'Assignment', 'Manager', 'Driver', 'Property', 'Parking Revenue', 'Parking Paid'];
    const rows = filteredHistory.map(s => [
      s.dateTime.split(',')[0],
      s.vehicleNo,
      s.assignment,
      s.tourManager || 'N/A',
      s.driverName,
      s.hotelProperty,
      s.parkingCollected === 'Yes' ? s.parkingAmount : 0,
      s.parkingPaidToDriver === 'Yes' ? s.parkingAmount : 0
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fleet_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Report Calculation Logic
  const filteredHistory = fleetHistory.filter(s => {
    const slipDate = new Date(s.dateTime.split(',')[0].split('/').reverse().join('-')); // Rough parse
    const start = reportFilters.startDate ? new Date(reportFilters.startDate) : null;
    const end = reportFilters.endDate ? new Date(reportFilters.endDate) : null;
    
    const matchesDate = (!start || slipDate >= start) && (!end || slipDate <= end);
    const matchesAssignment = reportFilters.assignment === 'All' || s.assignment === reportFilters.assignment;
    const matchesSearch = !reportFilters.searchQuery || 
      s.driverName.toLowerCase().includes(reportFilters.searchQuery.toLowerCase()) ||
      s.vehicleNo.toLowerCase().includes(reportFilters.searchQuery.toLowerCase()) ||
      s.guestName.toLowerCase().includes(reportFilters.searchQuery.toLowerCase());
    
    const matchesManager = reportFilters.tourManager === 'All' || s.tourManager === reportFilters.tourManager;

    return matchesDate && matchesAssignment && matchesSearch && matchesManager;
  });

  const tourManagers = Array.from(new Set(fleetHistory.map(s => s.tourManager).filter(Boolean)));

  const totalRevenueCollected = filteredHistory.reduce((acc, s) => acc + (s.parkingCollected === 'Yes' ? s.parkingAmount : 0), 0);
  const totalPaidOut = filteredHistory.reduce((acc, s) => acc + (s.parkingPaidToDriver === 'Yes' ? s.parkingAmount : 0), 0);
  
  const totalPackageRevenue = filteredHistory.reduce((acc, s) => acc + (s.packagePrice || 0), 0);
  const totalPackageCost = filteredHistory.reduce((acc, s) => acc + (s.packageCost || 0), 0);
  const operationalProfit = totalPackageRevenue - totalPackageCost;

  const ownCarDuties = filteredHistory.filter(s => s.assignment === 'Own Car').length;
  const outsourceDuties = filteredHistory.filter(s => s.assignment === 'Car Outsource').length;

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f8fafc' : '#020617', minHeight: '100vh', padding: '2rem', transition: 'background 0.3s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: pulseStyle }} />
      <header className="header" style={{ marginBottom: '3rem', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', paddingBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', letterSpacing: '-0.025em' }}>Global Settings</h1>
          <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>Control your ERP core logic, AI intelligence, and property global variables.</p>
        </div>
      </header>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '3rem' }}>
        
        {/* AI Assistant Config */}
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: theme === 'light' ? '#eff6ff' : 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🤖</div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>AI Intelligence</h3>
            </div>
            <div style={{ 
              padding: '0.4rem 0.8rem', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: 800,
              background: isKeyActive ? '#f0fdf4' : '#fff1f2',
              color: isKeyActive ? '#16a34a' : '#e11d48',
              border: isKeyActive ? '1px solid #bcf0da' : '1px solid #fecaca'
            }}>
              {isKeyActive ? '● ASSISTANT ACTIVE' : '○ DISCONNECTED'}
            </div>
          </div>

          <p style={{ fontSize: '0.95rem', color: theme === 'light' ? '#64748b' : '#94a3b8', marginBottom: '2rem', lineHeight: '1.6' }}>
            The Godwin AI Assistant requires a valid Google Gemini API Key. Once configured, the chatbot will have access to your property context and pricing rules.
          </p>
          
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              AI Intelligence Model
            </label>
            <select 
              className="form-input" 
              value={model || 'gemini-1.5-flash'}
              onChange={(e) => setModel(e.target.value)}
              style={{ 
                ...settingsInputStyle(theme),
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23${theme === 'light' ? '64748b' : '94a3b8'}' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'calc(100% - 1rem) center',
                backgroundSize: '1.25rem',
                paddingRight: '3rem'
              }}
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard)</option>
              <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash (8B - Highest Compatibility)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Most Intelligent)</option>
              <option value="gemini-pro">Gemini 1.0 Pro (Legacy)</option>
              <option value="custom">-- Manual Model Override --</option>
            </select>

            {model === 'custom' && (
              <input 
                type="text"
                className="form-input"
                placeholder="Enter model name (e.g. gemini-1.5-flash-latest)"
                value={customModel || ''}
                onChange={(e) => setCustomModel(e.target.value)}
                style={{ 
                  ...settingsInputStyle(theme),
                  border: '2px solid var(--primary)',
                  marginTop: '1rem',
                  fontSize: '0.9rem'
                }}
              />
            )}
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
              * Choose 'Gemini 1.0 Pro' if you experience 404 connection errors with newer models.
            </p>
            
            {availableModels.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: '12px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.5rem' }}>MODELS DETECTED FOR YOUR KEY:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {availableModels.slice(0, 10).map(m => (
                    <button 
                      key={m} 
                      onClick={() => { setModel('custom'); setCustomModel(m); }}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: theme === 'light' ? 'white' : '#0f172a', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: theme === 'light' ? '#0f172a' : '#f8fafc' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={scanModels} 
              disabled={isScanning}
              className={isScanning ? 'pulse-animation' : ''}
              style={{ 
                marginTop: '1.5rem', 
                background: isScanning ? (theme === 'light' ? '#f1f5f9' : '#1e293b') : (theme === 'light' ? '#fff' : '#0f172a'), 
                border: isScanning ? '2px solid #3b82f6' : '2px dashed #cbd5e1', 
                color: isScanning ? '#3b82f6' : '#64748b', 
                fontSize: '0.85rem', 
                fontWeight: 700,
                padding: '1rem', 
                borderRadius: '12px', 
                cursor: isScanning ? 'wait' : 'pointer',
                width: '100%',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              {isScanning ? (
                <>⏳ SCANNING GOOGLE SERVERS...</>
              ) : (
                <>🔍 SCAN FOR WORKING MODELS</>
              )}
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Gemini API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showKey ? "text" : "password"} 
                className="form-input" 
                style={{ 
                  ...settingsInputStyle(theme),
                  paddingRight: '4rem',
                  transition: 'border-color 0.2s'
                }} 
                placeholder="Paste your API key here..."
                value={geminiKey || ''}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                style={{ 
                  position: 'absolute', 
                  right: '1.25rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.4rem',
                  opacity: 0.5
                }}
              >
                {showKey ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
          
          <button 
            className="btn btn-primary" 
            onClick={saveAIConfig}
            disabled={status === 'saving'}
            style={{ 
              width: '100%', 
              padding: '1.25rem', 
              fontWeight: 800, 
              fontSize: '1rem',
              borderRadius: '16px',
              background: status === 'success' ? '#16a34a' : status === 'error' ? '#dc2626' : 'var(--primary)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              color: 'white'
            }}
          >
            {status === 'saving' ? 'Verifying Connection...' : 
             status === 'success' ? '✓ Configuration Saved' : 
             status === 'error' ? '⚠ Connection Failed' : 
             'Verify & Activate Assistant'}
          </button>

          {status === 'error' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem', marginTop: '1.5rem' }}>
              <p style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                ⚠ Connection Failed
              </p>
              <p style={{ color: '#991b1b', fontSize: '0.75rem', lineHeight: '1.4' }}>
                {detailedError}
              </p>
            </div>
          )}
        </section>

        {/* AI Personality & Knowledge Base */}
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', background: theme === 'light' ? '#fdf2f8' : 'rgba(219, 39, 119, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎯</div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Personality & Knowledge</h3>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Assistant Bot Name
            </label>
            <input 
              type="text" 
              className="form-input" 
              style={settingsInputStyle(theme)}
              placeholder="e.g. Godwin AI Assistant"
              value={botName || ''}
              onChange={(e) => setBotName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Default Greeting Message
            </label>
            <textarea 
              className="form-input" 
              style={{ ...settingsInputStyle(theme), minHeight: '100px', resize: 'vertical' }}
              placeholder="The first message the user sees..."
              value={greetingMessage || ''}
              onChange={(e) => setGreetingMessage(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Knowledge Base (Excel Upload)
            </label>
            <div 
              style={{ 
                border: '2px dashed #cbd5e1', 
                borderRadius: '16px', 
                padding: '1.5rem', 
                textAlign: 'center',
                backgroundColor: knowledgeFile ? '#f0fdf4' : (theme === 'light' ? '#f8fafc' : '#1e293b'),
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => document.getElementById('excel-upload')?.click()}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{knowledgeFile ? '📄' : '📁'}</div>
              <p style={{ fontSize: '0.85rem', color: theme === 'light' ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                {knowledgeFile ? knowledgeFile.name : 'Click to upload Q&A Excel file'}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>Supports .xlsx format only</p>
              <input 
                id="excel-upload"
                type="file" 
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
              />
            </div>
            
            {excelExists && !knowledgeFile && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={downloadExcel}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', background: theme === 'light' ? '#f8fafc' : '#1e293b', border: '1px solid #e2e8f0', color: theme === 'light' ? '#475569' : '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  📥 Download Current File
                </button>
                <button 
                  onClick={deleteExcel}
                  style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: '#fff1f2', border: '1px solid #fecaca', color: '#e11d48', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>

          {/* Manual Q&A List */}
          <div style={{ marginTop: '2rem', borderTop: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b', paddingTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Manual Q&A Database</h4>
              <button 
                onClick={addQA}
                style={{ padding: '0.4rem 1rem', borderRadius: '8px', background: theme === 'light' ? '#eff6ff' : 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #bfdbfe', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                + Add New Pair
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {qaList.map((item, idx) => (
                <div key={idx} style={{ padding: '1.25rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', position: 'absolute', right: '0.75rem', top: '0.75rem' }}>
                    <button onClick={() => moveQA(idx, 'up')} style={reorderBtnStyle(theme)}>↑</button>
                    <button onClick={() => moveQA(idx, 'down')} style={reorderBtnStyle(theme)}>↓</button>
                    <button onClick={() => removeQA(idx)} style={{ ...reorderBtnStyle(theme), color: '#ef4444', background: '#fef2f2' }}>✕</button>
                  </div>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Question {idx + 1}</label>
                    <input 
                      type="text" 
                      value={item.question || ''} 
                      onChange={(e) => updateQA(idx, 'question', e.target.value)}
                      placeholder="What should the user ask?"
                      style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 700, padding: '0.2rem 0', outline: 'none', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>AI Response</label>
                    <textarea 
                      value={item.answer || ''} 
                      onChange={(e) => updateQA(idx, 'answer', e.target.value)}
                      placeholder="What should the AI reply?"
                      style={{ width: '100%', background: 'none', border: 'none', fontSize: '0.85rem', fontWeight: 500, padding: '0.2rem 0', outline: 'none', minHeight: '60px', resize: 'vertical', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}
                    />
                  </div>
                </div>
              ))}
              {qaList.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '2rem' }}>
                  No manual Q&A pairs added. Add one or upload an Excel file.
                </p>
              )}
            </div>
          </div>

          {/* Lead Gen Toggle */}
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: theme === 'light' ? '#f0f9ff' : 'rgba(14, 165, 233, 0.1)', borderRadius: '16px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme === 'light' ? '#0369a1' : '#bae6fd' }}>AI Lead Generation</h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: theme === 'light' ? '#0e7490' : '#7dd3fc' }}>Auto-collect Name, Email, Mobile and Booking dates during chat.</p>
            </div>
            <div 
              onClick={() => setLeadGenEnabled(!leadGenEnabled)}
              style={{ 
                width: '50px', 
                height: '26px', 
                background: leadGenEnabled ? '#0ea5e9' : '#cbd5e1', 
                borderRadius: '13px', 
                position: 'relative', 
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ 
                width: '20px', 
                height: '20px', 
                background: 'white', 
                borderRadius: '50%', 
                position: 'absolute', 
                top: '3px',
                left: leadGenEnabled ? '27px' : '3px',
                transition: 'all 0.3s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }} />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={saveAIBranding}
            disabled={aiUpdateStatus === 'saving'}
            style={{ 
              marginTop: '2rem',
              width: '100%', 
              padding: '1rem', 
              fontWeight: 800, 
              borderRadius: '12px',
              background: aiUpdateStatus === 'success' ? '#16a34a' : 'var(--primary)',
              color: 'white'
            }}
          >
            {aiUpdateStatus === 'saving' ? 'Updating AI...' : 
             aiUpdateStatus === 'success' ? '✓ AI Settings Updated' : 
             'Save Personality & Knowledge'}
          </button>
        </section>

        {/* Agent Slab Config */}
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', background: theme === 'light' ? '#fef3c7' : 'rgba(234, 179, 8, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📊</div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Agent Slab Pricing</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: theme === 'light' ? '#475569' : '#94a3b8' }}>Silver Tier Discount (%)</label>
              <input 
                type="number" 
                className="form-input" 
                value={slabs.silver} 
                onChange={(e) => setSlabs({ ...slabs, silver: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} 
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: theme === 'light' ? '#475569' : '#94a3b8' }}>Gold Tier Discount (%)</label>
              <input 
                type="number" 
                className="form-input" 
                value={slabs.gold} 
                onChange={(e) => setSlabs({ ...slabs, gold: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} 
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: theme === 'light' ? '#475569' : '#94a3b8' }}>Platinum Tier Discount (%)</label>
              <input 
                type="number" 
                className="form-input" 
                value={slabs.platinum} 
                onChange={(e) => setSlabs({ ...slabs, platinum: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} 
              />
            </div>
            <button 
              className="btn btn-primary" 
              onClick={saveSlabs}
              style={{ marginTop: '1rem', padding: '1rem', fontWeight: 700, borderRadius: '12px', color: 'white' }}
            >
              Update Global Slabs
            </button>
          </div>
        </section>

        {/* Reports Card */}
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: theme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🚐</div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Fleet Performance Reports</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={exportCSV} style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'none', border: '1px solid #cbd5e1', cursor: 'pointer', color: theme === 'light' ? '#475569' : '#cbd5e1' }}>📊 Export CSV</button>
              <button className="btn btn-outline" onClick={() => window.print()} style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'none', border: '1px solid #cbd5e1', cursor: 'pointer', color: theme === 'light' ? '#475569' : '#cbd5e1' }}>🖨️ Print View</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2.5rem', padding: '1.5rem', background: theme === 'light' ? '#f8fafc' : '#020617', borderRadius: '1.5rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
            <div className="form-group">
              <label style={reportLabelStyle(theme)}>Start Date</label>
              <input type="date" className="form-input" value={reportFilters.startDate} onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})} style={reportInputStyle(theme)} />
            </div>
            <div className="form-group">
              <label style={reportLabelStyle(theme)}>End Date</label>
              <input type="date" className="form-input" value={reportFilters.endDate} onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})} style={reportInputStyle(theme)} />
            </div>
            <div className="form-group">
              <label style={reportLabelStyle(theme)}>Vehicle Type</label>
              <select className="form-input" value={reportFilters.assignment} onChange={(e) => setReportFilters({...reportFilters, assignment: e.target.value})} style={reportInputStyle(theme)}>
                <option value="All">All Assignments</option>
                <option value="Own Car">Own Fleet Only</option>
                <option value="Car Outsource">Outsourced Only</option>
              </select>
            </div>
            <div className="form-group">
              <label style={reportLabelStyle(theme)}>Search Driver / Car / Guest</label>
              <input type="text" className="form-input" placeholder="Type name or number..." value={reportFilters.searchQuery} onChange={(e) => setReportFilters({...reportFilters, searchQuery: e.target.value})} style={reportInputStyle(theme)} />
            </div>
            <div className="form-group">
              <label style={reportLabelStyle(theme)}>Tour Manager</label>
              <select className="form-input" value={reportFilters.tourManager} onChange={(e) => setReportFilters({...reportFilters, tourManager: e.target.value})} style={reportInputStyle(theme)}>
                <option value="All">All Managers</option>
                {tourManagers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <MetricCard label="Package Revenue" value={`₹${totalPackageRevenue.toLocaleString()}`} icon="🎒" color="#3b82f6" theme={theme} />
            <MetricCard label="Operational Profit" value={`₹${operationalProfit.toLocaleString()}`} icon="📈" color="#10b981" theme={theme} />
            <MetricCard label="Total Duties" value={filteredHistory.length} icon="📋" color="#8b5cf6" theme={theme} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <MetricCard label="Own Fleet Duties" value={ownCarDuties} icon="🚗" color="#64748b" theme={theme} />
            <MetricCard label="Outsourced Duties" value={outsourceDuties} icon="🤝" color="#64748b" theme={theme} />
            <MetricCard label="Parking Collected" value={`₹${totalRevenueCollected}`} icon="💰" color="#64748b" theme={theme} />
            <MetricCard label="Parking Paid Out" value={`₹${totalPaidOut}`} icon="💸" color="#64748b" theme={theme} />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid', borderBottomColor: theme === 'light' ? '#e2e8f0' : '#1e293b', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Vehicle</th>
                  <th style={{ padding: '1rem' }}>Manager</th>
                  <th style={{ padding: '1rem' }}>Driver</th>
                  <th style={{ padding: '1rem' }}>Property</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Parking Rev.</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Parking Paid</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', borderBottomColor: theme === 'light' ? '#f1f5f9' : '#1e293b' }}>
                    <td style={{ padding: '1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{s.dateTime.split(',')[0]}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{s.vehicleNo}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.assignment}</div>
                    </td>
                    <td style={{ padding: '1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{s.tourManager || 'N/A'}</td>
                    <td style={{ padding: '1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{s.driverName}</td>
                    <td style={{ padding: '1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{s.hotelProperty}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '10px', 
                        fontSize: '0.7rem', 
                        fontWeight: 700,
                        background: s.assignment === 'Own Car' ? (theme === 'light' ? '#eff6ff' : '#075985') : (theme === 'light' ? '#f5f3ff' : '#5b21b6'),
                        color: s.assignment === 'Own Car' ? '#3b82f6' : '#8b5cf6'
                      }}>
                        {s.assignment}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{s.parkingCollected === 'Yes' ? `+₹${s.parkingAmount}` : '-'}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{s.parkingPaidToDriver === 'Yes' ? `-₹${s.parkingAmount}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}

function MetricCard({ label, value, icon, color, theme }: any) {
  return (
    <div style={{ padding: '1.5rem', background: theme === 'light' ? '#fff' : '#0f172a', borderRadius: '1.25rem', border: `1px solid ${color}20`, boxShadow: `0 4px 6px -1px ${color}10` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: color }}>{value}</div>
    </div>
  );
}

const reportLabelStyle = (theme: string) => ({ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' });
const reportInputStyle = (theme: string) => ({ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9' });
const settingsInputStyle = (theme: string) => ({ width: '100%', padding: '1rem', borderRadius: '16px', border: theme === 'light' ? '2px solid #e2e8f0' : '2px solid #1e293b', fontSize: '1rem', fontWeight: 600, background: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', outline: 'none' });
const reorderBtnStyle = (theme: string) => ({ padding: '0.3rem 0.6rem', borderRadius: '6px', background: theme === 'light' ? 'white' : '#1e293b', border: '1px solid #e2e8f0', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700, color: theme === 'light' ? '#64748b' : '#cbd5e1' });
