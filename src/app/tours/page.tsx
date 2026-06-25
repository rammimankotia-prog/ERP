'use client';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

export default function ToursPage() {
  const { theme } = useTheme();
  const tourPackages = [
    { id: 't1', name: 'Delhi City Tour', duration: '1 Day', price: 2500, category: 'City Sightseeing' },
    { id: 't2', name: 'Golden Triangle', duration: '4 Days', price: 24999, category: 'Heritage' },
    { id: 't3', name: 'Agra Day Trip', duration: '1 Day', price: 5500, category: 'Landmark' },
  ];

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <h1>Tour Packages</h1>
          <p>Manage standard tour offerings for "Private Tour Delhi".</p>
        </div>
        <Link href="/itinerary">
          <button className="btn btn-primary">+ Create New Package</button>
        </Link>
      </header>

      <div className="card" style={{ padding: '0', background: theme === 'light' ? 'white' : '#0f172a', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
              <th style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Package Name</th>
              <th style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Duration</th>
              <th style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Category</th>
              <th style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Base Price (B2C)</th>
              <th style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tourPackages.map(pkg => (
              <tr key={pkg.id} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                <td style={{ padding: '1rem', fontWeight: 600, color: theme === 'light' ? '#1e293b' : 'white' }}>{pkg.name}</td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>{pkg.duration}</td>
                <td style={{ padding: '1rem' }}>
                   <span className="badge badge-silver">{pkg.category}</span>
                </td>
                <td style={{ padding: '1rem', fontWeight: 600, color: theme === 'light' ? '#1e293b' : 'white' }}>₹ {pkg.price}</td>
                <td style={{ padding: '1rem' }}>
                  <Link href="/itinerary">
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Edit Itinerary</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
