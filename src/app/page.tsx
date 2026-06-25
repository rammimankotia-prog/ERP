'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export default function Dashboard() {
  const { theme } = useTheme();
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [stats, setStats] = useState({
    revenue: '₹ 0',
    active: '0',
    occupancy: '0%',
    tours: '0'
  });

  useEffect(() => {
    const saved = localStorage.getItem('godwin_quotations');
    if (saved) {
      const allQuotes = JSON.parse(saved);
      // Take last 5 for dashboard
      setRecentQuotes(allQuotes.slice(0, 5));
      
      // Calculate basic stats
      const totalRev = allQuotes.reduce((acc: number, q: any) => acc + (q.pricing?.grandTotal || 0), 0);
      setStats({
        revenue: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalRev),
        active: allQuotes.filter((q: any) => q.status === 'HOLD' || q.status === 'SENT').length.toString(),
        occupancy: '82%', // Keeping mock for now as inventory is separate
        tours: '12' // Keeping mock for now
      });
    }
  }, []);

  return (
    <main className="main-content">
        <header className="header">
          <div>
            <h1 style={{ color: theme === 'light' ? '#0f172a' : '#f8fafc' }}>Executive Dashboard</h1>
            <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Welcome back, Admin. Here's a real-time look at your operations.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/quotations/new">
              <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}>+ New Quotation</button>
            </Link>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <StatCard theme={theme} title="Total Pipeline" value={stats.revenue} change="+12.5%" icon="💰" />
          <StatCard theme={theme} title="Active Quotes" value={stats.active} change="+4 today" icon="📝" />
          <StatCard theme={theme} title="Room Occupancy" value={stats.occupancy} icon="🏨" change="-3%" />
          <StatCard theme={theme} title="Tour Bookings" value={stats.tours} icon="🗺️" change="+2" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <section className="card" style={{ background: theme === 'light' ? '#fff' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Recent Quotations</h3>
              <Link href="/quotations" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>View All →</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                  <th style={{ padding: '1rem 0', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Guest / Agent</th>
                  <th style={{ padding: '1rem 0', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Property</th>
                  <th style={{ padding: '1rem 0', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Status</th>
                  <th style={{ padding: '1rem 0', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.length > 0 ? (
                  recentQuotes.map((q) => (
                    <tr key={q.id} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                      <td style={{ padding: '1rem 0', fontSize: '0.875rem', fontWeight: 600, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
                        {q.guest?.firstName} {q.guest?.lastName}
                      </td>
                      <td style={{ padding: '1rem 0', fontSize: '0.875rem', color: theme === 'light' ? '#475569' : '#cbd5e1' }}>{q.hotel}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span className={`badge ${q.statusClass || 'badge-silver'}`} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem' }}>{q.status}</span>
                      </td>
                      <td style={{ padding: '1rem 0', fontSize: '0.875rem', fontWeight: 700, color: theme === 'light' ? '#0f172a' : '#f8fafc', textAlign: 'right' }}>
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(q.pricing?.grandTotal || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No quotations found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card" style={{ background: theme === 'light' ? '#fff' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
            <h3 style={{ marginBottom: '1.5rem', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Notifications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <NotificationItem theme={theme} text="Quote #1024 auto-released (Cut-off reached)" time="2h ago" />
              <NotificationItem theme={theme} text="New B2B registration: Global Tours" time="5h ago" />
              <NotificationItem theme={theme} text="Payment received: ₹15,000 for #1012" time="Yesterday" />
            </div>
          </section>
        </div>
      </main>
  );
}

function StatCard({ title, value, change, icon, theme }: { title: string; value: string; change: string; icon: string; theme: string }) {
  return (
    <div className="card" style={{ background: theme === 'light' ? '#fff' : '#1e293b', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <span style={{ color: change.startsWith('+') ? 'var(--success)' : 'var(--error)', fontSize: '0.875rem', fontWeight: 600 }}>{change}</span>
      </div>
      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{title}</p>
      <h2 style={{ marginTop: '0.25rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>{value}</h2>
    </div>
  );
}

function TableRow({ name, property, status, amount, statusClass }: any) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '1rem 0', fontSize: '0.875rem', fontWeight: 500 }}>{name}</td>
      <td style={{ padding: '1rem 0', fontSize: '0.875rem' }}>{property}</td>
      <td style={{ padding: '1rem 0' }}>
        <span className={`badge ${statusClass}`}>{status}</span>
      </td>
      <td style={{ padding: '1rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{amount}</td>
    </tr>
  );
}

function NotificationItem({ text, time, theme }: { text: string; time: string; theme: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <p style={{ fontSize: '0.875rem', color: theme === 'light' ? '#1e293b' : '#cbd5e1' }}>{text}</p>
      <span style={{ fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{time}</span>
    </div>
  );
}
