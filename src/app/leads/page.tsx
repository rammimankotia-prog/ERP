'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export default function AILeadsPage() {
  const { theme } = useTheme();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (e) {
      console.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f8fafc' : '#020617', minHeight: '100vh', padding: '2rem' }}>
      <header className="header" style={{ marginBottom: '3rem', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', paddingBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : 'white', letterSpacing: '-0.025em' }}>AI Captured Leads</h1>
          <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>View and manage potential bookings collected by the AI Assistant.</p>
        </div>
        <button onClick={fetchLeads} className="btn btn-outline">🔄 Refresh Leads</button>
      </header>

      <div className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Loading leads...</p>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎣</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : 'white' }}>No Leads Yet</h3>
            <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', maxWidth: '400px', margin: '0.5rem auto' }}>Once the AI Assistant collects contact information from users, they will appear here automatically.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #1e293b', color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1.25rem' }}>Timestamp</th>
                  <th style={{ padding: '1.25rem' }}>Customer Info</th>
                  <th style={{ padding: '1.25rem' }}>Booking Dates</th>
                  <th style={{ padding: '1.25rem' }}>Status</th>
                  <th style={{ padding: '1.25rem' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: theme === 'light' ? '1px solid #f8fafc' : '1px solid #1e293b', verticalAlign: 'top' }}>
                    <td style={{ padding: '1.25rem', fontSize: '0.85rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{lead.timestamp}</td>
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ fontWeight: 800, color: theme === 'light' ? '#1e293b' : 'white', fontSize: '1rem' }}>{lead.name || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>{lead.email}</div>
                      <div style={{ fontSize: '0.85rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{lead.mobile}</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      {lead.checkIn && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#f0fdf4', color: '#16a34a', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>IN</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{lead.checkIn}</span>
                        </div>
                      )}
                      {lead.checkOut && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#fff1f2', color: '#e11d48', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>OUT</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{lead.checkOut}</span>
                        </div>
                      )}
                      {!lead.checkIn && !lead.checkOut && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Not specified</span>}
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: theme === 'light' ? '#f0f9ff' : 'rgba(3, 105, 161, 0.1)', color: '#0369a1', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #bae6fd' }}>
                        NEW LEAD
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem', fontSize: '0.85rem', color: theme === 'light' ? '#64748b' : '#94a3b8', maxWidth: '300px' }}>
                      {lead.notes || 'No extra notes provided.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
