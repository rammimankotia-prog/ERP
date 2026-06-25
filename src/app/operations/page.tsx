'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';

export default function OperationsPage() {
  const { theme } = useTheme();
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mocking the user for demonstration (Ajay)
  const currentUser = {
    id: 'ajay-123',
    name: 'Ajay (Tour Manager)',
    role: 'TOUR_MANAGER'
  };

  useEffect(() => {
    fetch('/api/operations')
      .then(res => res.json())
      .then(data => {
        setTours(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#22c55e';
      case 'QUESTIONED': return '#ef4444';
      case 'SUBMITTED': return '#3b82f6';
      default: return '#64748b';
    }
  };

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🏃</span> Tour Operations
          </h1>
          <p>Manage active tours and track day-by-day expenses.</p>
        </div>
        <div style={{ padding: '0.5rem 1rem', background: theme === 'light' ? '#f1f5f9' : '#1e293b', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 600 }}>
          Logged in as: <span style={{ color: '#3b82f6' }}>{currentUser.name}</span>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <p>Loading tours...</p>
        ) : tours.length === 0 ? (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
             <p style={{ fontSize: '1.2rem', opacity: 0.5 }}>No active tours found.</p>
             <p style={{ fontSize: '0.9rem', opacity: 0.5 }}>Active tours appear here once a quotation is accepted.</p>
          </div>
        ) : (
          tours.map(tour => (
            <div key={tour.id} className="card card-hover" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{tour.tourPackage?.name || 'Custom Tour'}</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Ref: {tour.quotation.quoteNumber}</p>
                </div>
                <span className="badge" style={{ backgroundColor: getStatusColor(tour.expense?.status), color: 'white' }}>
                  {tour.expense?.status || 'PENDING'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ padding: '0.5rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: '8px', flex: 1 }}>
                  <p style={{ margin: 0, opacity: 0.6 }}>Start Date</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{new Date(tour.startDate).toLocaleDateString()}</p>
                </div>
                <div style={{ padding: '0.5rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: '8px', flex: 1 }}>
                  <p style={{ margin: 0, opacity: 0.6 }}>End Date</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{new Date(tour.endDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Guest: {tour.quotation.guestName}</p>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                <Link href={`/operations/${tour.id}/expenses`} style={{ flex: 1 }}>
                  <button className="btn btn-primary" style={{ width: '100%', padding: '0.6rem' }}>
                    Log Expenses
                  </button>
                </Link>
                {currentUser.role === 'ADMIN' && (
                  <Link href={`/operations/${tour.id}/review`} style={{ flex: 1 }}>
                    <button className="btn btn-outline" style={{ width: '100%', padding: '0.6rem' }}>
                      Review
                    </button>
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </main>
  );
}
