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
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '1rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-md)', marginTop: '1.5rem', color: '#64748b' }}>
            No revenue data generated yet.
          </div>
        </section>

        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>Top Performing Agents</h3>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: 'var(--radius-sm)', color: '#64748b', minHeight: '150px' }}>
              No agent data available for this period.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
