'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const GeofenceMap = dynamic(() => import('@/components/GeofenceMap'), { ssr: false });

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


  // Geofence Config (Default 20m in-premises, enabled for all users)
  const [geofence, setGeofence] = useState({ enabled: true, lat: 28.6448, lng: 77.2140, radius: 20 });
  const [geofenceStatus, setGeofenceStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Load Global Config (Keys, Slabs)
    fetch('/api/settings/global')
      .then(res => res.json())
      .then(data => {
        if (data.geminiKey) setGeminiKey(data.geminiKey);

        if (data.model) {
          if (['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.5-flash-8b'].includes(data.model)) {
            setModel(data.model);
          } else {
            setModel('custom');
            setCustomModel(data.model);
          }
        }
        if (data.geminiKey) setIsKeyActive(true);
        if (data.geofence) {
          setGeofence({
            enabled: data.geofence.enabled !== undefined ? data.geofence.enabled : true,
            lat: data.geofence.lat || 28.6448,
            lng: data.geofence.lng || 77.2140,
            radius: typeof data.geofence.radius === 'number' ? data.geofence.radius : 20
          });
        }
      })
      .catch(err => console.error('Failed to load global config', err));


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



  const saveGeofence = async () => {
    setGeofenceStatus('saving');
    try {
      const res = await fetch('/api/settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geofence })
      });
      if (res.ok) {
        setGeofenceStatus('success');
        setTimeout(() => setGeofenceStatus('idle'), 3000);
      } else {
        setGeofenceStatus('error');
      }
    } catch {
      setGeofenceStatus('error');
    }
  };



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
        
        {/* Location & Geofencing (Primary - Top Section) */}
        <section className="card" style={{ gridColumn: '1 / -1', background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '2px solid #10b981' : '2px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '52px', height: '52px', background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>📍</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc' }}>Location &amp; Geofencing</h3>
                  <span style={{ 
                    padding: '0.3rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 800,
                    background: geofence.enabled ? '#ecfdf5' : '#f1f5f9',
                    color: geofence.enabled ? '#059669' : '#64748b',
                    border: geofence.enabled ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                  }}>
                    {geofence.enabled ? '● GEOFENCE ENFORCED' : '○ DISABLED'}
                  </span>
                  <span style={{ 
                    padding: '0.3rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe'
                  }}>
                    🎯 20M IN-PREMISES DEFAULT
                  </span>
                  <span style={{ 
                    padding: '0.3rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 800,
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a'
                  }}>
                    👥 ALL EMPLOYEES (EXISTING &amp; NEW)
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                  Strict 20-meter on-premises perimeter for hotel staff attendance &amp; kiosk punch. Device GPS must be ON.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: geofence.enabled ? '#059669' : '#94a3b8' }}>
                {geofence.enabled ? 'Active (All Users)' : 'Disabled'}
              </span>
              <div 
                onClick={() => setGeofence({ ...geofence, enabled: !geofence.enabled })}
                style={{ 
                  width: '52px', 
                  height: '28px', 
                  background: geofence.enabled ? '#10b981' : '#cbd5e1', 
                  borderRadius: '14px', 
                  position: 'relative', 
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ 
                  width: '22px', 
                  height: '22px', 
                  background: 'white', 
                  borderRadius: '50%', 
                  position: 'absolute', 
                  top: '3px',
                  left: geofence.enabled ? '27px' : '3px',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                }} />
              </div>
            </div>
          </div>

          {/* GPS Requirement Notice */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            background: theme === 'light' ? '#fffbeb' : 'rgba(245, 158, 11, 0.1)', 
            border: '1px solid #fde68a', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '12px', 
            marginBottom: '1.5rem' 
          }}>
            <span style={{ fontSize: '1.25rem' }}>🛰️</span>
            <span style={{ fontSize: '0.85rem', color: theme === 'light' ? '#92400e' : '#fcd34d', fontWeight: 600, lineHeight: 1.4 }}>
              <strong>Automatic Device GPS Prompt:</strong> If a user’s phone GPS / Location is turned OFF or permission is not granted, the system automatically asks them: <em>&quot;Please turn ON GPS / Location on your device to punch within 20m of hotel premises.&quot;</em>
            </span>
          </div>

          {/* Property Presets */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Quick Presets:</span>
            <button
              type="button"
              onClick={() => setGeofence({ ...geofence, lat: 28.6448, lng: 77.2140, radius: 20 })}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: geofence.lat === 28.6448 && geofence.lng === 77.2140 ? '#10b981' : theme === 'light' ? '#f8fafc' : '#1e293b',
                color: geofence.lat === 28.6448 && geofence.lng === 77.2140 ? 'white' : theme === 'light' ? '#1e293b' : '#f1f5f9',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🏨 Hotel Grand Godwin (20m)
            </button>
            <button
              type="button"
              onClick={() => setGeofence({ ...geofence, lat: 28.6445, lng: 77.2142, radius: 20 })}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: geofence.lat === 28.6445 && geofence.lng === 77.2142 ? '#10b981' : theme === 'light' ? '#f8fafc' : '#1e293b',
                color: geofence.lat === 28.6445 && geofence.lng === 77.2142 ? 'white' : theme === 'light' ? '#1e293b' : '#f1f5f9',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🏨 Hotel Godwin Deluxe (20m)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Radius:</span>
              {[20, 30, 50].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setGeofence({ ...geofence, radius: r })}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: geofence.radius === r ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: geofence.radius === r ? '#ecfdf5' : 'transparent',
                    color: geofence.radius === r ? '#059669' : '#64748b',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {r}m{r === 20 ? ' (Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <GeofenceMap 
              lat={geofence.lat} 
              lng={geofence.lng} 
              radius={geofence.radius} 
              onChange={(lat, lng) => setGeofence({ ...geofence, lat, lng })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Latitude</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                value={geofence.lat} 
                onChange={(e) => setGeofence({ ...geofence, lat: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} 
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Longitude</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                value={geofence.lng} 
                onChange={(e) => setGeofence({ ...geofence, lng: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} 
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Radius (Meters) - Default 20m</label>
              <input 
                type="number" 
                className="form-input" 
                value={geofence.radius} 
                onChange={(e) => setGeofence({ ...geofence, radius: parseInt(e.target.value) || 20 })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #10b981', background: theme === 'light' ? '#fcfcfc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f1f5f9', fontWeight: 700 }} 
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={saveGeofence}
            disabled={geofenceStatus === 'saving'}
            style={{ 
              width: '100%', 
              padding: '1rem', 
              fontWeight: 800, 
              borderRadius: '12px',
              background: geofenceStatus === 'success' ? '#16a34a' : 'var(--primary)',
              color: 'white',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              cursor: 'pointer'
            }}
          >
            {geofenceStatus === 'saving' ? 'Saving 20m Geofence...' : 
             geofenceStatus === 'success' ? '✓ Geofence Settings Saved Successfully (Active for All Users)' : 
             'Save Geofence Settings (Enforce 20m for All Users)'}
          </button>
        </section>

        {/* User Management & Security Portal Card */}
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: theme === 'light' ? '#fffbeb' : 'rgba(245, 158, 11, 0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>👥</div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Access &amp; Security</h3>
              </div>
              <div style={{ 
                padding: '0.4rem 0.8rem', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: 800,
                background: '#f0fdf4',
                color: '#16a34a',
                border: '1px solid #bcf0da'
              }}>
                👑 PROTECTED
              </div>
            </div>

            <p style={{ fontSize: '0.95rem', color: theme === 'light' ? '#64748b' : '#94a3b8', marginBottom: '2rem', lineHeight: '1.6' }}>
              Manage executive accounts, role permissions, and staff login credentials. Control who has access to Hotel Grand Godwin &amp; Hotel Godwin Deluxe ERP terminals.
            </p>

            <div style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b', padding: '1.25rem', borderRadius: '14px', marginBottom: '2rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : 'white' }}>Primary Root Administrator</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Username: <strong style={{ color: '#f59e0b', fontFamily: 'monospace' }}>Godwinhotels</strong> | Recovery: <strong style={{ color: '#3b82f6' }}>mail@godwinhotels.com</strong>
              </p>
            </div>
          </div>

          <Link
            href="/users"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '1rem',
              boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.3)',
              transition: 'transform 0.2s'
            }}
          >
            <span>🚀</span> Launch User Management Portal ➔
          </Link>
        </section>

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



      </div>
    </main>
  );
}


const settingsInputStyle = (theme: string) => ({ width: '100%', padding: '1rem', borderRadius: '16px', border: theme === 'light' ? '2px solid #e2e8f0' : '2px solid #1e293b', fontSize: '1rem', fontWeight: 600, background: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', outline: 'none' });

