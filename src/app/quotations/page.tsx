'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

export default function QuotationsPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [hotelFilter, setHotelFilter] = useState('All Hotels');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [dateRange, setDateRange] = useState('All Time');
  const [isLoading, setIsLoading] = useState(true);
  const [showMailSettings, setShowMailSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mailSettings, setMailSettings] = useState({
    smtp: { host: '', port: '465', user: '', pass: '', fromName: '' },
    pop: { host: '', port: '995', user: '', pass: '' }
  });

  useEffect(() => {
    const savedMail = localStorage.getItem('godwin_mail_settings');
    if (savedMail) {
      setMailSettings(JSON.parse(savedMail));
    }
  }, []);

  const saveMailSettings = () => {
    localStorage.setItem('godwin_mail_settings', JSON.stringify(mailSettings));
    setShowMailSettings(false);
    alert('Mail Settings Saved Successfully!');
  };

  useEffect(() => {
    const loadQuotes = () => {
      const saved = localStorage.getItem('godwin_quotations');
      let quotesData = [];
      if (saved) {
        quotesData = JSON.parse(saved);
      } else {
        quotesData = [
          { id: '1025', guest: { firstName: 'Anita', lastName: 'Sharma', guestType: 'General' }, hotel: 'Hotel Grand Godwin', stay: { checkIn: '2026-05-12', checkOut: '2026-05-15' }, status: 'DRAFT', statusClass: 'badge-silver', pricing: { grandTotal: 15400 } },
          { id: '1024', guest: { firstName: 'Global', lastName: 'Travels', guestType: 'Travel Agent' }, hotel: 'Godwin Deluxe', stay: { checkIn: '2026-06-05', checkOut: '2026-06-10' }, status: 'HOLD', statusClass: 'badge-gold', pricing: { grandTotal: 42000 } },
          { id: '1023', guest: { firstName: 'Royal', lastName: 'Tours', guestType: 'Corporate' }, hotel: 'Hotel Grand Godwin', stay: { checkIn: '2026-04-20', checkOut: '2026-04-22' }, status: 'ACCEPTED', statusClass: 'badge-platinum', pricing: { grandTotal: 18900 } }
        ];
        localStorage.setItem('godwin_quotations', JSON.stringify(quotesData));
      }

      // Check for expirations
      const now = new Date();
      let changed = false;
      const updatedQuotes = quotesData.map((q: any) => {
        if (q.status === 'HOLD' && q.cutoffDate && q.cutoffTime) {
          const cutoff = new Date(`${q.cutoffDate}T${q.cutoffTime}`);
          if (now > cutoff) {
            changed = true;
            return { ...q, status: 'RELEASED', statusClass: 'badge-silver' };
          }
        }
        return q;
      });

      if (changed) {
        localStorage.setItem('godwin_quotations', JSON.stringify(updatedQuotes));
        setQuotes(updatedQuotes);
      } else {
        setQuotes(quotesData);
      }
      setIsLoading(false);
    };

    loadQuotes();
    window.addEventListener('storage', loadQuotes);
    return () => window.removeEventListener('storage', loadQuotes);
  }, []);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const fullName = `${q.guest?.firstName || ''} ${q.guest?.lastName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) || q.id.toString().includes(search);
      const matchesStatus = statusFilter === 'All Statuses' || q.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesHotel = hotelFilter === 'All Hotels' || q.hotel === hotelFilter;
      const matchesType = typeFilter === 'All Types' || (q.guest?.guestType || 'General') === typeFilter;
      
      // Date range filter
      let matchesDate = true;
      const qDate = new Date(q.createdAt);
      const now = new Date();
      
      if (dateRange === 'Today') {
        matchesDate = qDate.toDateString() === now.toDateString();
      } else if (dateRange === 'Last 7 Days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        matchesDate = qDate >= sevenDaysAgo;
      } else if (dateRange === 'Last 30 Days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        matchesDate = qDate >= thirtyDaysAgo;
      }

      return matchesSearch && matchesStatus && matchesHotel && matchesType && matchesDate;
    });
  }, [quotes, search, statusFilter, hotelFilter, typeFilter, dateRange]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All Statuses');
    setHotelFilter('All Hotels');
    setTypeFilter('All Types');
    setDateRange('All Time');
  };

  const formatDateRange = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 'N/A';
    try {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`;
    } catch (e) { return 'Invalid Dates'; }
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      const updated = quotes.filter(q => String(q.id) !== String(deleteConfirm));
      setQuotes(updated);
      localStorage.setItem('godwin_quotations', JSON.stringify(updated));
      setDeleteConfirm(null);
      alert('✅ Quotation deleted successfully.');
    }
  };

  const handleRowClick = (id: string) => {
    router.push(`/quotations/${id}`);
  };

  if (isLoading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Initializing Dashboard...</div>;

  return (
    <main className="main-content">
      <header className="header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', letterSpacing: '-0.04em' }}>Executive Overview</h1>
          <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>Welcome back, Admin. Here's what's happening today.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ background: theme === 'light' ? '#fff' : '#1e293b', padding: '0.5rem 1rem', borderRadius: '12px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1.2rem' }}>📅</span>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.9rem', color: theme === 'light' ? '#1e293b' : '#f1f5f9', cursor: 'pointer', outline: 'none' }}
            >
              <option>All Time</option>
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>Today</option>
            </select>
          </div>
          <button 
            onClick={() => setShowMailSettings(true)}
            className="btn btn-outline" 
            style={{ padding: '0.875rem', borderRadius: '12px', background: theme === 'light' ? '#fff' : '#1e293b', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Mail Server Settings"
          >
            ⚙️
          </button>
          <Link href="/quotations/new" className="btn btn-primary" style={{ padding: '0.875rem 1.75rem', fontWeight: 700, borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)' }}>
            + Create New Quote
          </Link>
        </div>
      </header>

      <div className="card" style={{ padding: '0', overflow: 'hidden', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)', borderRadius: '16px', background: theme === 'light' ? '#fff' : '#0f172a' }}>
        <div style={{ padding: '1.5rem', borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by ID or Guest Name..." 
              className="btn btn-outline" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text', padding: '1rem 3rem 1rem 1.25rem', fontSize: '0.95rem', backgroundColor: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', borderRadius: '12px' }} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}
              >
                ×
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Hotel Property</label>
              <select 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', backgroundColor: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', borderRadius: '10px' }}
                value={hotelFilter}
                onChange={(e) => setHotelFilter(e.target.value)}
              >
                <option>All Hotels</option>
                <option>Hotel Grand Godwin</option>
                <option>Godwin Deluxe</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Quotation Type</label>
              <select 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', backgroundColor: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', borderRadius: '10px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option>All Types</option>
                <option>General</option>
                <option>Travel Agent</option>
                <option>Corporate</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Status</label>
              <select 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', backgroundColor: theme === 'light' ? '#fff' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f1f5f9', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', borderRadius: '10px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All Statuses</option>
                <option>Draft</option>
                <option>Hold</option>
                <option>Accepted</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}># ID</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}>Guest / Agent</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}>Property</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}>Dates</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}>Status</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155' }}>Quotation Total</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#94a3b8', letterSpacing: '0.1em', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #334155', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.length > 0 ? (
                filteredQuotes.map((q) => (
                  <tr 
                    key={q.id} 
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }} 
                    className="table-row-hover"
                  >
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem', fontSize: '0.9rem', color: theme === 'light' ? '#64748b' : '#94a3b8', fontWeight: 600 }}>#{q.id}</td>
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
                        {q.guest?.firstName} {q.guest?.lastName}
                        {q.guest?.companyName && (
                          <span style={{ fontSize: '0.7rem', background: theme === 'light' ? '#f1f5f9' : '#334155', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', color: theme === 'light' ? '#475569' : '#cbd5e1', fontWeight: 600 }}>
                            {q.guest.companyName}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: q.guest?.guestType === 'General' ? (theme === 'light' ? '#94a3b8' : '#64748b') : '#2563eb', marginTop: '4px', fontWeight: 600 }}>
                        {q.guest?.guestType === 'Travel Agent' ? '🌐 TRAVEL AGENT' : 
                         q.guest?.guestType === 'Corporate' ? '🏢 CORPORATE' : '👤 B2C GUEST'}
                      </div>
                    </td>
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem', fontSize: '0.9rem', color: theme === 'light' ? '#334155' : '#cbd5e1', fontWeight: 600 }}>{q.hotel}</td>
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem', fontSize: '0.9rem', color: theme === 'light' ? '#334155' : '#cbd5e1', fontWeight: 500 }}>{formatDateRange(q.stay?.checkIn, q.stay?.checkOut)}</td>
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem' }}>
                      <span className={`badge ${q.statusClass || 'badge-silver'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 900, borderRadius: '20px', letterSpacing: '0.02em' }}>{q.status}</span>
                      {q.status === 'HOLD' && q.cutoffDate && (
                        <div style={{ fontSize: '0.65rem', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>
                          Cutoff: {q.cutoffDate} {q.cutoffTime}
                        </div>
                      )}
                    </td>
                    <td onClick={() => handleRowClick(q.id)} style={{ padding: '1.5rem', fontSize: '1.1rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc' }}>{formatCurrency(q.pricing?.grandTotal || 0)}</td>
                    <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-action view-btn"
                          style={{ padding: '0.6rem', background: '#eff6ff', color: '#2563eb', borderRadius: '10px', border: '1px solid #dbeafe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); handleRowClick(q.id); }}
                          title="View Full Details"
                        >
                          👁️
                        </button>
                        <button 
                          className="btn-action delete-btn"
                          style={{ padding: '0.6rem', background: '#fff1f2', color: '#e11d48', borderRadius: '10px', border: '1px solid #fecdd3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(q.id); }}
                          title="Delete Quotation"
                        >
                          🗑️
                        </button>
                        <button 
                          className="btn-action more-btn"
                          style={{ padding: '0.6rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#475569' : '#cbd5e1', borderRadius: '10px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); alert('Advanced: Duplicate, Send to Email, or Mark as Accepted for #' + q.id); }}
                        >
                          ⋮
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '8rem 2rem', textAlign: 'center', background: theme === 'light' ? '#fff' : '#0f172a' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📑</div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>
                      {quotes.length === 0 ? "No quotations created yet" : "No matching quotations found"}
                    </div>
                    <p style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '1rem' }}>
                      {quotes.length === 0 ? "Create your first quote to see it here." : "Try adjusting your search or clearing filters."}
                    </p>
                    {(search || statusFilter !== 'All Statuses' || hotelFilter !== 'All Hotels' || typeFilter !== 'All Types' || dateRange !== 'All Time') && (
                      <button onClick={clearFilters} className="btn btn-outline" style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem' }}>
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mail Settings Modal */}
      {showMailSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', padding: '2.5rem', borderRadius: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>Mail Server Configuration</h2>
                <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.9rem' }}>Configure SMTP/POP for sending and receiving quotes.</p>
              </div>
              <button onClick={() => setShowMailSettings(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>×</button>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📤</span> SMTP Settings (Sending)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>SMTP HOST</label>
                  <input type="text" value={mailSettings.smtp.host} onChange={(e) => setMailSettings({...mailSettings, smtp: {...mailSettings.smtp, host: e.target.value}})} placeholder="e.g. smtp.gmail.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>PORT</label>
                  <input type="text" value={mailSettings.smtp.port} onChange={(e) => setMailSettings({...mailSettings, smtp: {...mailSettings.smtp, port: e.target.value}})} placeholder="465 or 587" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>USER / EMAIL</label>
                <input type="text" value={mailSettings.smtp.user} onChange={(e) => setMailSettings({...mailSettings, smtp: {...mailSettings.smtp, user: e.target.value}})} placeholder="your-email@example.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>PASSWORD</label>
                  <input type="password" value={mailSettings.smtp.pass} onChange={(e) => setMailSettings({...mailSettings, smtp: {...mailSettings.smtp, pass: e.target.value}})} placeholder="App Password" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>FROM NAME</label>
                  <input type="text" value={mailSettings.smtp.fromName} onChange={(e) => setMailSettings({...mailSettings, smtp: {...mailSettings.smtp, fromName: e.target.value}})} placeholder="Godwin Reservations" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📥</span> POP Settings (Receiving)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>POP HOST</label>
                  <input type="text" value={mailSettings.pop.host} onChange={(e) => setMailSettings({...mailSettings, pop: {...mailSettings.pop, host: e.target.value}})} placeholder="pop.gmail.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>PORT</label>
                  <input type="text" value={mailSettings.pop.port} onChange={(e) => setMailSettings({...mailSettings, pop: {...mailSettings.pop, port: e.target.value}})} placeholder="995" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>USER</label>
                  <input type="text" value={mailSettings.pop.user} onChange={(e) => setMailSettings({...mailSettings, pop: {...mailSettings.pop, user: e.target.value}})} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>PASSWORD</label>
                  <input type="password" value={mailSettings.pop.pass} onChange={(e) => setMailSettings({...mailSettings, pop: {...mailSettings.pop, pass: e.target.value}})} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={saveMailSettings} className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontWeight: 700, borderRadius: '12px' }}>Save Configuration</button>
              <button onClick={() => setShowMailSettings(false)} className="btn btn-outline" style={{ flex: 1, padding: '1rem', fontWeight: 700, borderRadius: '12px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: '#fff', padding: '2.5rem', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>Are you sure?</h2>
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>You are about to delete quotation <strong style={{ color: '#1e293b' }}>#{deleteConfirm}</strong>. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={confirmDelete} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '1rem', background: '#ef4444', border: 'none', fontWeight: 700, borderRadius: '12px' }}
              >
                Yes, Delete
              </button>
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '1rem', fontWeight: 700, borderRadius: '12px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .table-row-hover:hover {
          background-color: ${theme === 'light' ? '#f1f5f9' : '#1e293b'} !important;
          transform: translateY(-1px);
        }
        .btn-action {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          width: 38px;
          height: 38px;
        }
        .btn-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          filter: brightness(0.95);
        }
        .btn-action:active {
          transform: translateY(0) scale(0.95);
        }
        .btn-action span {
          pointer-events: none;
        }
        .view-btn:hover { border-color: #3b82f6; color: #1d4ed8; }
        .delete-btn:hover { border-color: #f43f5e; color: #be123c; }
      `}</style>
    </main>
  );
}
