'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

export default function FinancePage() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  
  const [transactions, setTransactions] = useState([
    { id: 't1', date: '2026-04-18', entity: 'Travel Guru (Agent)', type: 'CREDIT', amount: 45000, status: 'PAID' },
    { id: 't2', date: '2026-04-17', entity: 'Private Tour Delhi (Supplier)', type: 'DEBIT', amount: 12000, status: 'PENDING' },
    { id: 't3', date: '2026-04-16', entity: 'John Doe (Guest)', type: 'CREDIT', amount: 12500, status: 'PAID' },
    { id: 't4', date: '2026-04-15', entity: 'Clean Express (Supplier)', type: 'DEBIT', amount: 5000, status: 'PAID' },
    { id: 't5', date: '2026-04-14', entity: 'Agoda Bookings', type: 'CREDIT', amount: 85000, status: 'PAID' },
    { id: 't6', date: '2026-04-13', entity: 'Shell Fuel Station', type: 'DEBIT', amount: 4500, status: 'PAID' },
  ]);

  const stats = useMemo(() => {
    const credit = transactions.filter(t => t.type === 'CREDIT').reduce((acc, t) => acc + t.amount, 0);
    const debit = transactions.filter(t => t.type === 'DEBIT').reduce((acc, t) => acc + t.amount, 0);
    return { credit, debit, balance: credit - debit };
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.entity.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <main className="main-content animate-in">
      <header className="header" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: '0.5rem', background: 'linear-gradient(to right, var(--primary), #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Financial Ledger
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Manage receivables, supplier payables, and cash flow.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/finance/fx" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: 'var(--bg-card)', padding: '0.75rem 1.5rem', borderRadius: '12px' }}>
             <span style={{ fontSize: '1.2rem' }}>💱</span> FX Terminal
          </Link>
          <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }} onClick={() => setIsAddPaymentOpen(true)}>
            + New Payment Entry
          </button>
        </div>
      </header>

      {/* --- QUICK STATS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <StatCard 
          label="Total Receivables" 
          amount={stats.credit} 
          icon="📈" 
          color="var(--success)" 
          bg="rgba(16, 185, 129, 0.05)"
        />
        <StatCard 
          label="Total Payables" 
          amount={stats.debit} 
          icon="📉" 
          color="var(--error)" 
          bg="rgba(239, 68, 68, 0.05)"
        />
        <StatCard 
          label="Net Balance" 
          amount={stats.balance} 
          icon="⚖️" 
          color="var(--primary)" 
          bg="rgba(37, 99, 235, 0.05)"
        />
      </div>

      {/* --- TRANSACTIONS SECTION --- */}
      <section className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Transaction History</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
            <div style={{ position: 'relative', maxWidth: '300px', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
              <input 
                type="text" 
                placeholder="Search entities..." 
                className="input-premium" 
                style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.9rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="input-premium" 
              style={{ width: '140px', height: '42px', fontSize: '0.9rem' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="CREDIT">Credits</option>
              <option value="DEBIT">Debits</option>
            </select>
            <button className="btn btn-outline" style={{ height: '42px', padding: '0 1rem' }}>
              📥 Export
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead style={{ background: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '1.25rem 2rem' }}>Reference</th>
                <th>Entity / Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => (
                <tr key={t.id} style={{ transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem 2rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>#{t.id.toUpperCase()}</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>{t.date}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t.entity}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment via Bank Transfer</div>
                  </td>
                  <td>
                    <span className="badge" style={{ 
                      background: t.type === 'CREDIT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: t.type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
                      border: t.type === 'CREDIT' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                      fontWeight: 800,
                      letterSpacing: '0.5px'
                    }}>
                      {t.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
                      ₹{t.amount.toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'PAID' ? 'badge-platinum' : 'badge-gold'}`} style={{ width: '80px', textAlign: 'center' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '2rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn-action" title="View Voucher">📄</button>
                      <button className="btn-action" title="Edit Entry">✏️</button>
                      <button className="btn-action btn-delete" title="Void Entry">🚫</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                    <div style={{ fontWeight: 600 }}>No transactions found matching your criteria.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- ADD PAYMENT MODAL --- */}
      {isAddPaymentOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPaymentOpen(false)}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>➕ New Payment Entry</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label-premium">Entity Name / Description</label>
                <input type="text" className="input-premium" placeholder="e.g. Travel Agent or Supplier" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label-premium">Amount (₹)</label>
                  <input type="number" className="input-premium" placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label-premium">Type</label>
                  <select className="input-premium">
                    <option value="CREDIT">Credit (Income)</option>
                    <option value="DEBIT">Debit (Expense)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label-premium">Payment Method</label>
                <select className="input-premium">
                  <option>Bank Transfer / NEFT</option>
                  <option>UPI / GPay</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsAddPaymentOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { setIsAddPaymentOpen(false); alert("Feature coming soon: Entry recorded (Simulated)"); }}>Save Entry</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .StatCard {
          transition: transform 0.2s ease;
        }
        .StatCard:hover {
          transform: translateY(-5px);
        }
      `}</style>
    </main>
  );
}

function StatCard({ label, amount, icon, color, bg }: any) {
  return (
    <div className="card StatCard" style={{ padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: color }}>₹{amount.toLocaleString()}</h2>
      </div>
      <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '4rem', opacity: 0.03, pointerEvents: 'none' }}>{icon}</div>
    </div>
  );
}
