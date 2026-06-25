'use client';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { formatCurrency } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';

export default function AgentDashboard() {
  const { theme } = useTheme();
  const agentInfo = {
    name: 'Travel Guru India',
    tier: 'Platinum',
    discount: 15,
    totalBookings: 124,
    pendingPayments: 45000,
    creditLimit: 200000
  };

  const recentQuotes = [
    { id: 'Q1001', guest: 'John Smith', property: 'Grand Godwin', date: '2026-04-18', status: 'Hold', amount: 12500 },
    { id: 'Q1002', guest: 'Sarah Connor', property: 'Godwin Deluxe', date: '2026-04-15', status: 'Accepted', amount: 8400 },
    { id: 'Q1003', guest: 'Bruce Wayne', property: 'Grand Godwin', date: '2026-04-12', status: 'Draft', amount: 15000 },
  ];

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <h1>Agent Portal: {agentInfo.name}</h1>
          <p>Welcome back! You are currently on the <span className="badge badge-platinum">{agentInfo.tier} Tier</span> (15% Slab).</p>
        </div>
        <Link href="/quotations">
          <button className="btn btn-primary">+ Create New Request</button>
        </Link>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <p style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Total Bookings</p>
          <h2 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>{agentInfo.totalBookings}</h2>
        </div>
        <div className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <p style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Pending Payments</p>
          <h2 style={{ color: '#ef4444' }}>{formatCurrency(agentInfo.pendingPayments)}</h2>
        </div>
        <div className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <p style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Available Credit</p>
          <h2 style={{ color: '#10b981' }}>{formatCurrency(agentInfo.creditLimit - agentInfo.pendingPayments)}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>Your Recent Quotations</h3>
          <div style={{ marginTop: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                  <th style={{ padding: '1rem 0' }}>Quote ID</th>
                  <th style={{ padding: '1rem 0' }}>Guest</th>
                  <th style={{ padding: '1rem 0' }}>Status</th>
                  <th style={{ padding: '1rem 0' }}>Amount (B2B)</th>
                  <th style={{ padding: '1rem 0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map(q => (
                  <tr key={q.id} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                    <td style={{ padding: '1rem 0', fontWeight: 600, color: theme === 'light' ? '#1e293b' : 'white' }}>{q.id}</td>
                    <td style={{ padding: '1rem 0', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{q.guest}</td>
                    <td style={{ padding: '1rem 0' }}>
                      <span className={`badge ${q.status === 'Accepted' ? 'badge-platinum' : 'badge-gold'}`}>{q.status}</span>
                    </td>
                    <td style={{ padding: '1rem 0', fontWeight: 700, color: theme === 'light' ? '#1e293b' : 'white' }}>{formatCurrency(q.amount)}</td>
                    <td style={{ padding: '1rem 0' }}>
                      <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>View PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ color: theme === 'light' ? '#1e293b' : 'white' }}>Slab Benefits</h3>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
              <p style={{ fontWeight: 600, color: 'var(--primary)' }}>Platinum Status (Current)</p>
              <ul style={{ fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.25rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                <li>15% Flat Discount on B2C</li>
                <li>Priority 24/7 Support</li>
                <li>Free Early Check-in (Subject to availability)</li>
              </ul>
            </div>
            <p style={{ fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
              Maintain 50+ monthly bookings to keep your Platinum status.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
