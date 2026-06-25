'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';

export default function ItineraryPage() {
  const { theme } = useTheme();
  const [days, setDays] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('GODWIN_ITINERARY');
    if (saved) {
      setDays(JSON.parse(saved));
    } else {
      setDays([
        { id: 1, title: 'Arrival & Delhi Sightseeing', morning: 'Arrival at Delhi Airport. Transfer to Hotel.', afternoon: 'Visit Qutub Minar and Lotus Temple.', evening: 'Rickshaw ride in Old Delhi / Chandni Chowk.', stay: 'Hotel Grand Godwin', inclusions: ['Airport Transfer', 'Dinner'] },
        { id: 2, title: 'Delhi to Agra', morning: 'Breakfast at Hotel. Drive to Agra (3-4 hours).', afternoon: 'Visit Taj Mahal at sunset.', evening: 'Agra Fort exploration.', stay: 'Agra Hotel (Mock)', inclusions: ['Breakfast', 'Agra Fort Entry'] }
      ]);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('GODWIN_ITINERARY', JSON.stringify(days));
    }
  }, [days, isLoaded]);

  const updateDayField = (id: number, field: string, value: any) => {
    setDays(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addDay = () => {
    const nextId = days.length + 1;
    setDays([...days, { id: nextId, title: `Day ${nextId} Plan`, morning: '', afternoon: '', evening: '', stay: '', inclusions: [] }]);
  };

  const removeDay = (id: number) => {
    setDays(days.filter(d => d.id !== id).map((d, i) => ({ ...d, id: i + 1 })));
  };

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <h1>Itinerary Builder</h1>
          <p>Create detailed day-by-day plans for your tour packages.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => alert('Template Saved!')}>Save as Template</button>
          <button className="btn btn-primary" onClick={addDay}>+ Add Day</button>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {days.map((day) => (
          <div key={day.id} className="card" style={{ marginBottom: '2rem', position: 'relative', background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ width: '40px', height: '40px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{day.id}</div>
                  <input 
                   className="form-input" 
                   value={day.title} 
                   onChange={(e) => updateDayField(day.id, 'title', e.target.value)}
                   style={{ border: 'none', background: 'none', fontSize: '1.25rem', fontWeight: 700, padding: 0, width: '100%', color: theme === 'light' ? '#1e293b' : 'white' }}
                  />
              </div>
              <button onClick={() => removeDay(day.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete Day</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Morning Activities</label>
                  <textarea 
                    className="form-input" 
                    rows={2} 
                    value={day.morning} 
                    onChange={(e) => updateDayField(day.id, 'morning', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Afternoon Activities</label>
                  <textarea 
                    className="form-input" 
                    rows={2} 
                    value={day.afternoon} 
                    onChange={(e) => updateDayField(day.id, 'afternoon', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Evening Activities</label>
                  <textarea 
                    className="form-input" 
                    rows={2} 
                    value={day.evening} 
                    onChange={(e) => updateDayField(day.id, 'evening', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Overnight Stay</label>
                  <input 
                    className="form-input" 
                    value={day.stay} 
                    onChange={(e) => updateDayField(day.id, 'stay', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Day-Specific Inclusions</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {['Breakfast', 'Lunch', 'Dinner', 'Entry Tickets', 'Guide', 'Parking'].map(inc => (
                      <span 
                        key={inc} 
                        className={`badge ${day.inclusions.includes(inc) ? 'badge-platinum' : 'badge-gold'}`} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const current = day.inclusions || [];
                          const updated = current.includes(inc) 
                            ? current.filter((i: string) => i !== inc)
                            : [...current, inc];
                          updateDayField(day.id, 'inclusions', updated);
                        }}
                      >
                        {inc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '3rem', border: theme === 'light' ? '2px dashed #e2e8f0' : '2px dashed #334155', borderRadius: 'var(--radius-md)', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
           <button className="btn btn-primary" onClick={addDay}>+ Add Another Day</button>
        </div>
      </div>

      <style jsx>{`
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: ${theme === 'light' ? '#64748b' : '#94a3b8'};
        }
        .form-input {
          padding: 0.75rem;
          border-radius: var(--radius-sm);
          border: 1px solid ${theme === 'light' ? '#e2e8f0' : '#334155'};
          background: ${theme === 'light' ? '#f8fafc' : '#1e293b'};
          color: ${theme === 'light' ? '#1e293b' : 'white'};
          font-size: 0.875rem;
          width: 100%;
        }
        textarea.form-input {
          resize: vertical;
        }
      `}</style>
    </main>
  );
}
