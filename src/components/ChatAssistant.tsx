'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export default function ChatAssistant() {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    botName: 'Godwin AI',
    greetingMessage: 'Hello! I am your Godwin ERP Assistant. How can I help you today?'
  });
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load initial messages once settings are fetched
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/ai');
        const data = await res.json();
        if (data.botName) {
          setAiSettings(data);
          setMessages([{ role: 'assistant', text: data.greetingMessage }]);
        } else {
          setMessages([{ role: 'assistant', text: aiSettings.greetingMessage }]);
        }
      } catch (e) {
        setMessages([{ role: 'assistant', text: aiSettings.greetingMessage }]);
      }
    };
    fetchSettings();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (!savedKey) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'AI Assistant is currently offline. Please add your Gemini API Key in the Settings page to activate me.' }]);
      return;
    }

    const savedModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-1.5-flash';

    const userMsg = { role: 'user', text: input };
    setMessages([...messages, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          history: messages,
          apiKey: savedKey,
          model: savedModel
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: data.response,
        source: data.source 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error. Please check your API key in Settings.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="no-print" style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 1000 }}>
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '1.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          className="chat-trigger"
        >
          🤖
        </button>
      ) : (
        <div className="card" style={{ 
          width: '380px', 
          height: '550px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '0', 
          overflow: 'hidden',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)',
          backgroundColor: theme === 'light' ? '#fff' : '#0f172a'
        }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)', 
            color: 'white', 
            padding: '1.25rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🤖</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{aiSettings.botName}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px', fontWeight: 600 }}>• Online | Excel & Web Search</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>×</button>
          </div>
          
          <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: theme === 'light' ? '#f8fafc' : '#020617' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? 'var(--primary)' : (theme === 'light' ? 'white' : '#1e293b'),
                color: msg.role === 'user' ? 'white' : (theme === 'light' ? '#1e293b' : '#f1f5f9'),
                padding: '0.85rem 1rem',
                borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                maxWidth: '85%',
                fontSize: '0.9rem',
                fontWeight: 500,
                boxShadow: msg.role === 'user' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                lineHeight: 1.5
              }}>
                {msg.text}
                {/* Source Indicator */}
                {(msg as any).source && (
                  <div style={{ fontSize: '0.65rem', marginTop: '6px', color: '#64748b', fontWeight: 700, fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Source: {(msg as any).source === 'local_excel' ? '📁 Hotel Database' : '🌐 Web Search'}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', background: theme === 'light' ? '#e2e8f0' : '#1e293b', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: theme === 'light' ? '#475569' : '#94a3b8' }}>
                Searching database...
              </div>
            )}
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: theme === 'light' ? '#fff' : '#0f172a', borderTop: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              <button className="suggestion-btn" onClick={() => setInput('What is the check-in time?')}>🕒 Check-in Time</button>
              <button className="suggestion-btn" onClick={() => setInput('Airport pickup charges?')}>🚖 Pickup Fee</button>
              <button className="suggestion-btn" onClick={() => setInput('Weather in New Delhi')}>🌤️ Weather</button>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', position: 'relative' }}>
              <input 
                type="text" 
                className="chat-input" 
                style={{ flex: 1, background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}
                placeholder="Ask something..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .chat-trigger:hover {
          transform: scale(1.1) rotate(5deg);
        }
        .chat-input {
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .chat-input:focus {
          border-color: var(--primary);
          background: #fff;
        }
        .suggestion-btn {
          white-space: nowrap;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 0.4rem 0.8rem;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }
        .suggestion-btn:hover {
          background: #e2e8f0;
          color: var(--primary);
        }
      `}</style>
    </div>
  );
}
