'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

const calculateDynamicTotal = (q: any) => {
  if (q.docType === 'RATE_SHEET') return 'Contract';
  
  let total = q.financials?.grandTotal || q.totalAmount || q.pricing?.grandTotal || q.amount || 0;
  
  // Fallback to calculating from raw room data if total is 0 but we have rooms
  if (!total && q.rooms && Array.isArray(q.rooms)) {
    let calcTotal = 0;
    const nights = q.stay?.nights;
    const effectiveNights = (!nights || nights === 0) ? 1 : nights;
    
    q.rooms.forEach((r: any) => {
       calcTotal += (Number(r.tariff) || 0) * (Number(r.count) || 1) * effectiveNights;
       if (r.extraBed?.status === 'Charged') calcTotal += (Number(r.extraBed.rate) || 0) * (Number(r.extraBed.count) || 0) * (Number(r.count) || 1) * effectiveNights;
       if (r.extraChild?.status === 'Charged') calcTotal += (Number(r.extraChild.rate) || 0) * (Number(r.extraChild.count) || 0) * (Number(r.count) || 1) * effectiveNights;
    });
    
    if (calcTotal > 0) {
      const discount = q.discountPercent || 0;
      total = calcTotal - (calcTotal * discount / 100);
    }
  }
  
  return total || 0;
};

export default function Dashboard() {
  const { theme } = useTheme();
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState({
    revenue: '₹ 0',
    revenueChange: '0%',
    active: '0',
    activeChange: '+0 today',
    occupancy: '0%',
    occupancyChange: '0%',
    tours: '0',
    toursChange: '+0'
  });

  useEffect(() => {
    let activeQuotesCount = '0';
    let activeQuotesChangeStr = '+0 today';
    let revenueVal = '₹ 0';
    let revenueChangeStr = '0%';
    let occupancyPercent = '0%';
    let occupancyChangeStr = '0%';

    const saved = localStorage.getItem('godwin_quotations');
    if (saved) {
      const allQuotes = JSON.parse(saved);
      // Take last 5 for dashboard
      setRecentQuotes(allQuotes.slice(0, 5));
      
      // Calculate basic stats
      const totalRev = allQuotes.reduce((acc: number, q: any) => {
        const val = calculateDynamicTotal(q);
        return acc + (typeof val === 'number' ? val : 0);
      }, 0);
      
      revenueVal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalRev);
      activeQuotesCount = allQuotes.filter((q: any) => q.status === 'HOLD' || q.status === 'SENT').length.toString();

      // Calculate Revenue Change (Last 30 vs Prev 30)
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);

      let revLast30 = 0;
      let revPrev30 = 0;

      allQuotes.forEach((q: any) => {
        const val = typeof calculateDynamicTotal(q) === 'number' ? calculateDynamicTotal(q) : 0;
        const qDate = new Date(q.createdAt || now);
        if (qDate >= thirtyDaysAgo) {
          revLast30 += val;
        } else if (qDate >= sixtyDaysAgo && qDate < thirtyDaysAgo) {
          revPrev30 += val;
        }
      });

      if (revPrev30 > 0) {
        const pct = ((revLast30 - revPrev30) / revPrev30) * 100;
        revenueChangeStr = pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
      } else {
        revenueChangeStr = revLast30 > 0 ? '+100%' : '0%';
      }

      // Calculate Active Quotes Change
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      let activeAddedToday = 0;
      allQuotes.forEach((q: any) => {
        if (q.status === 'HOLD' || q.status === 'SENT') {
           const qDate = new Date(q.createdAt || now);
           if (qDate >= todayStart) {
             activeAddedToday++;
           }
        }
      });
      activeQuotesChangeStr = `+${activeAddedToday} today`;

      // Calculate real occupancy for today vs yesterday
      let totalRoomsBookedToday = 0;
      let totalRoomsBookedYesterday = 0;
      
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      allQuotes.forEach((q: any) => {
        if (q.status === 'ACCEPTED' || q.status === 'CONFIRMED') {
          if (q.stay?.checkIn && q.stay?.checkOut) {
            const checkIn = new Date(q.stay.checkIn);
            const checkOut = new Date(q.stay.checkOut);
            checkIn.setHours(0, 0, 0, 0);
            checkOut.setHours(0, 0, 0, 0);
            
            let roomsCount = 1;
            if (q.rooms && Array.isArray(q.rooms)) {
               roomsCount = q.rooms.reduce((acc: number, r: any) => acc + (Number(r.count) || 1), 0);
            }

            if (todayStart >= checkIn && todayStart < checkOut) {
              totalRoomsBookedToday += roomsCount;
            }
            if (yesterdayStart >= checkIn && yesterdayStart < checkOut) {
              totalRoomsBookedYesterday += roomsCount;
            }
          }
        }
      });

      const totalInventory = 70; // Grand Godwin: 34, Godwin Deluxe: 36
      const occupancyCalcToday = totalInventory > 0 ? Math.round((totalRoomsBookedToday / totalInventory) * 100) : 0;
      const occupancyCalcYesterday = totalInventory > 0 ? Math.round((totalRoomsBookedYesterday / totalInventory) * 100) : 0;
      
      occupancyPercent = `${occupancyCalcToday}%`;
      const occDiff = occupancyCalcToday - occupancyCalcYesterday;
      occupancyChangeStr = occDiff >= 0 ? `+${occDiff}%` : `${occDiff}%`;
    }

    setStats(prev => ({
      ...prev,
      revenue: revenueVal,
      revenueChange: revenueChangeStr,
      active: activeQuotesCount,
      activeChange: activeQuotesChangeStr,
      occupancy: occupancyPercent,
      occupancyChange: occupancyChangeStr,
    }));

    // Fetch actual tours
    fetch('/api/operations')
      .then(res => res.json())
      .then(tours => {
        if (Array.isArray(tours)) {
          const todayStart = new Date();
          todayStart.setHours(0,0,0,0);
          let toursAddedToday = 0;
          tours.forEach((t: any) => {
            const tDate = new Date(t.createdAt || t.startDate || new Date());
            if (tDate >= todayStart) toursAddedToday++;
          });

          setStats(prev => ({ 
            ...prev, 
            tours: tours.length.toString(),
            toursChange: `+${toursAddedToday}`
          }));
        }
      })
      .catch(err => console.error('Failed to fetch tours', err));
  }, []);

  return (
    <main className="main-content">
        <header className="header">
          <div>
            <h1 style={{ color: theme === 'light' ? '#0f172a' : '#f8fafc' }}>Executive Dashboard</h1>
            <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Welcome back, Admin. Here's a real-time look at your operations.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/quotations/new">
              <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}>+ New Quotation</button>
            </Link>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <StatCard theme={theme} title="Total Pipeline" value={stats.revenue} change={stats.revenueChange} icon="💰" />
          <StatCard theme={theme} title="Active Quotes" value={stats.active} change={stats.activeChange} icon="📝" />
          <StatCard theme={theme} title="Room Occupancy" value={stats.occupancy} change={stats.occupancyChange} icon="🏨" />
          <StatCard theme={theme} title="Tour Bookings" value={stats.tours} change={stats.toursChange} icon="🗺️" />
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
                      <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                          color: theme === 'light' ? '#0f172a' : '#f8fafc',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '9999px',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#334155'}`
                        }}>
                          {q.docType === 'RATE_SHEET' ? 'Contract' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(calculateDynamicTotal(q))}
                        </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>Notifications</h3>
              {notifications.length > 0 && (
                <button 
                  onClick={() => setNotifications([])}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Clear All
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.length > 0 ? (
                notifications.map(n => (
                  <NotificationItem key={n.id} theme={theme} text={n.text} time={n.time} />
                ))
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No new notifications</div>
              )}
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
