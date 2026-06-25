'use client';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';

export default function ReportsPage() {
  const { theme } = useTheme();
  return (
    <main className="main-content">
      <header className="header">
        <div>
          <h1>Business Reports</h1>
          <p>Analyze revenue, occupancy, and agent performance.</p>
        </div>
        <button className="btn btn-primary">⬇️ Export All (Excel)</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>Revenue by Property</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '2rem', padding: '1rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-md)', marginTop: '1.5rem' }}>
            <div style={{ flex: 1, height: '80%', background: 'linear-gradient(to top, var(--primary), #60a5fa)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Grand Godwin</span>
            </div>
            <div style={{ flex: 1, height: '60%', background: 'linear-gradient(to top, #6366f1, #a5b4fc)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Godwin Deluxe</span>
            </div>
          </div>
        </section>

        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>Top Performing Agents</h3>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-sm)', color: theme === 'light' ? '#1e293b' : 'white' }}>
              <span>1. Travel Guru India</span>
              <span style={{ fontWeight: 600 }}>₹ 1,25,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-sm)', color: theme === 'light' ? '#1e293b' : 'white' }}>
              <span>2. Elite Travels</span>
              <span style={{ fontWeight: 600 }}>₹ 88,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-sm)', color: theme === 'light' ? '#1e293b' : 'white' }}>
              <span>3. Global Tours</span>
              <span style={{ fontWeight: 600 }}>₹ 42,000</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
