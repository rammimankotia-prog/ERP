'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

export default function FXTerminalPage() {
  const { theme } = useTheme();
  const [amount, setAmount] = useState<number>(1000);
  const [margin, setMargin] = useState<number>(2.00);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('INR');
  const [marketRate, setMarketRate] = useState<number>(83.50);
  const [lastUpdate, setLastUpdate] = useState<string>('Live Rates via Finance Feed');

  // Realistic mock rates
  const rates: Record<string, number> = {
    'USD_INR': 83.50,
    'EUR_INR': 90.12,
    'GBP_INR': 105.45,
    'USD_EUR': 0.92,
    'EUR_USD': 1.08,
  };

  const [transactionMode, setTransactionMode] = useState<'buy' | 'sell'>('sell');
  const [history, setHistory] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState('All');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [isFetching, setIsFetching] = useState(false);

  const fetchLiveRate = async () => {
    setIsFetching(true);
    try {
      // Calling our internal server-side API to bypass CORS and network restrictions
      const res = await fetch(`/api/fx?from=${fromCurrency}&to=${toCurrency}`);
      const data = await res.json();
      
      if (data && data.rate) {
        setMarketRate(data.rate);
        setLastUpdate(`Market Live (${data.source}): ${new Date().toLocaleTimeString()}`);
      } else {
        alert("Real-time data for this pair is temporarily unavailable.");
      }
    } catch (e) {
      alert("Terminal Error: Could not reach the finance server. Please try again in a moment.");
    } finally {
      setIsFetching(false);
    }
  };

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('fx_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      const sanitized = parsed.map((tx: any) => ({
        ...tx,
        id: tx.id || 'FX-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      }));
      setHistory(sanitized);
    }
    setIsLoaded(true);
  }, []);

  // Final sync fallback
  useEffect(() => {
    if (isLoaded && history.length === 0) {
      localStorage.setItem('fx_history', JSON.stringify([]));
    }
  }, [history, isLoaded]);

  const handleSave = () => {
    const rate = transactionMode === 'sell' ? sellRate : buyRate;
    const newTx = {
      id: 'FX-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: new Date().toISOString(),
      istTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      mode: transactionMode,
      from: fromCurrency,
      to: toCurrency,
      marketRate,
      margin,
      appliedRate: rate,
      amount: amount,
      total: rate * amount
    };
    
    setHistory(prev => {
      const updated = [newTx, ...prev];
      localStorage.setItem('fx_history', JSON.stringify(updated));
      return updated;
    });
    
    // Trigger print
    if (typeof window !== 'undefined' && window.confirm(`Transaction ${newTx.id} saved. Would you like to print the receipt slip?`)) {
      window.print();
    }
  };

  const handleDelete = (id: string) => {
    if (typeof window === 'undefined') return;
    
    // Removing window.confirm to avoid browser blocking issues
    // Using immediate deletion for testing/functional recovery
    setHistory(prev => {
      const updated = prev.filter(tx => tx.id !== id);
      localStorage.setItem('fx_history', JSON.stringify(updated));
      return updated;
    });
  };

  const filteredHistory = history.filter(tx => {
    const matchCurrency = currencyFilter === 'All' || tx.from === currencyFilter || tx.to === currencyFilter;
    
    let matchDate = dateFilter === 'All';
    if (!matchDate) {
      const [year, month, day] = dateFilter.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      matchDate = tx.istTime.includes(formattedDate);
    }
    
    return matchCurrency && matchDate;
  });

  useEffect(() => {
    const pair = `${fromCurrency}_${toCurrency}`;
    if (rates[pair]) {
      setMarketRate(rates[pair]);
    } else if (fromCurrency === toCurrency) {
      setMarketRate(1);
    } else {
      setMarketRate(83.50); 
    }
    setLastUpdate(new Date().toLocaleTimeString());
  }, [fromCurrency, toCurrency]);

  const sellRate = marketRate + margin;
  const buyRate = marketRate - margin;

  const formatCurrency = (val: number, cur: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f1f5f9' : '#020617', minHeight: '100vh', padding: '2.5rem', transition: 'background 0.3s ease' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* FX Pro Terminal Card */}
        <div style={{ 
          background: theme === 'light' ? 'white' : '#0f172a', 
          borderRadius: '24px', 
          overflow: 'hidden', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
          border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
          marginBottom: '3rem'
        }}>
          
          {/* Terminal Header */}
          <div style={{ 
            background: '#0f172a', 
            padding: '2rem', 
            color: 'white', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <Link href="/finance" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }} title="Back to Ledger">⬅️</Link>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' }}></div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>FX PRO TERMINAL</h1>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Front-Office Conversion Tool • Session Active</p>
                </div>
              </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: theme === 'light' ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Market Status</div>
              <div style={{ fontSize: '0.875rem', color: theme === 'light' ? '#cbd5e1' : '#94a3b8', marginTop: '0.1rem' }}>IST: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div className="grid-responsive" style={{ padding: '3rem', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem' }}>
            
            {/* Left: Input Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #1e293b', paddingBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: theme === 'light' ? '#1e293b' : '#f1f5f9', margin: 0 }}>Transaction Settings</h2>
                
                {/* Mode Toggle Switch */}
                <div style={{ display: 'flex', background: theme === 'light' ? '#f1f5f9' : '#1e293b', padding: '0.25rem', borderRadius: '12px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
                  <button 
                    type="button"
                    onClick={() => setTransactionMode('sell')}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '10px', 
                      fontSize: '0.75rem', 
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: transactionMode === 'sell' ? (theme === 'light' ? '#fff' : '#0f172a') : 'transparent',
                      color: transactionMode === 'sell' ? '#2563eb' : '#64748b',
                      boxShadow: transactionMode === 'sell' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    CUSTOMER BUYS
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTransactionMode('buy')}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '10px', 
                      fontSize: '0.75rem', 
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: transactionMode === 'buy' ? (theme === 'light' ? '#fff' : '#0f172a') : 'transparent',
                      color: transactionMode === 'buy' ? '#e11d48' : '#64748b',
                      boxShadow: transactionMode === 'buy' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    CUSTOMER SELLS
                  </button>
                </div>
              </div>

              {/* Margin Input */}
              <div style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b', padding: '1.5rem', borderRadius: '16px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Operational Margin (SPREAD)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input 
                      type="number" 
                      value={margin}
                      onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                      step="0.10"
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        paddingLeft: '2.5rem',
                        fontSize: '1.25rem', 
                        fontWeight: 700, 
                        border: theme === 'light' ? '2px solid #cbd5e1' : '2px solid #475569', 
                        background: theme === 'light' ? '#fff' : '#0f172a',
                        color: theme === 'light' ? '#1e293b' : '#f1f5f9',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    />
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: theme === 'light' ? '#94a3b8' : '#64748b' }}>₹</span>
                  </div>
                  <div style={{ width: '40px', height: '40px', background: theme === 'light' ? '#dbeafe' : '#2563eb', color: theme === 'light' ? '#2563eb' : '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>±</div>
                </div>
                <p style={{ fontSize: '0.7rem', color: theme === 'light' ? '#94a3b8' : '#64748b', marginTop: '0.75rem' }}>* Applied to Interbank Market Rate for retail pricing.</p>
              </div>

              {/* Currencies */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle(theme)}>From Currency</label>
                  <select 
                    value={fromCurrency} 
                    onChange={(e) => setFromCurrency(e.target.value)}
                    style={selectStyle(theme)}
                  >
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                    <option value="GBP">🇬🇧 GBP - British Pound</option>
                    <option value="INR">🇮🇳 INR - Indian Rupee</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle(theme)}>To Currency</label>
                  <select 
                    value={toCurrency} 
                    onChange={(e) => setToCurrency(e.target.value)}
                    style={selectStyle(theme)}
                  >
                    <option value="INR">🇮🇳 INR - Indian Rupee</option>
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle(theme)}>Transaction Amount</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    style={{ 
                      width: '100%', 
                      padding: '1.25rem', 
                      fontSize: '1.75rem', 
                      fontWeight: 800, 
                      color: theme === 'light' ? '#0f172a' : '#f8fafc',
                      background: theme === 'light' ? '#fff' : '#0f172a',
                      border: theme === 'light' ? '2px solid #e2e8f0' : '2px solid #1e293b', 
                      borderRadius: '16px',
                      boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)',
                      outline: 'none'
                    }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    right: '1.25rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: theme === 'light' ? '#475569' : '#cbd5e1'
                  }}>
                    {fromCurrency}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Output/Calculation Card */}
            <div style={{ 
              background: theme === 'light' ? '#f8fafc' : '#1e293b', 
              borderRadius: '24px', 
              padding: '2.5rem', 
              border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interbank Market Rate</div>
                  <button 
                    type="button"
                    onClick={fetchLiveRate} 
                    disabled={isFetching}
                    style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 800, 
                      color: '#2563eb', 
                      background: '#dbeafe', 
                      border: 'none', 
                      padding: '0.25rem 0.6rem', 
                      borderRadius: '6px', 
                      cursor: 'pointer' 
                    }}
                  >
                    {isFetching ? '⚡ FETCHING...' : '🔄 FETCH LIVE'}
                  </button>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f8fafc', fontFamily: 'monospace' }}>
                  1 {fromCurrency} = {marketRate.toFixed(4)} {toCurrency}
                </div>
                <div style={{ fontSize: '0.65rem', color: theme === 'light' ? '#94a3b8' : '#64748b', marginTop: '0.25rem' }}>
                  Source: {lastUpdate}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Selling Rate (Customer Buys) */}
                <div style={{ 
                  background: theme === 'light' ? 'white' : '#0f172a', 
                  padding: '1.5rem', 
                  borderRadius: '16px', 
                  borderLeft: '6px solid #10b981',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  opacity: transactionMode === 'sell' ? 1 : 0.4,
                  transform: transactionMode === 'sell' ? 'scale(1)' : 'scale(0.98)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer Buys (Our Sell Rate)</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>
                    {formatCurrency(sellRate, toCurrency)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: '0.5rem', fontWeight: 500 }}>
                    Total: <span style={{ color: theme === 'light' ? '#0f172a' : '#fff', fontWeight: 700 }}>{formatCurrency(sellRate * amount, toCurrency)}</span>
                  </div>
                </div>

                {/* Buying Rate (Customer Sells) */}
                <div style={{ 
                  background: theme === 'light' ? 'white' : '#0f172a', 
                  padding: '1.5rem', 
                  borderRadius: '16px', 
                  borderLeft: '6px solid #ef4444',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  opacity: transactionMode === 'buy' ? 1 : 0.4,
                  transform: transactionMode === 'buy' ? 'scale(1)' : 'scale(0.98)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer Sells (Our Buy Rate)</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>
                    {formatCurrency(buyRate, toCurrency)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: '0.5rem', fontWeight: 500 }}>
                    Total: <span style={{ color: theme === 'light' ? '#0f172a' : '#fff', fontWeight: 700 }}>{formatCurrency(buyRate * amount, toCurrency)}</span>
                  </div>
                </div>

              </div>

              <button 
                type="button"
                onClick={handleSave}
                style={{ 
                  marginTop: '2.5rem', 
                  padding: '1rem', 
                  background: transactionMode === 'sell' ? '#059669' : '#dc2626', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                💾 Save & Print {transactionMode === 'sell' ? 'Sale' : 'Purchase'} Slip
              </button>
            </div>

          </div>
        </div>

        {/* Transaction History Section */}
        <section className="card glass" style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2rem', borderRadius: '24px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #1e293b', paddingBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9', margin: 0 }}>Transaction History</h2>
              <p style={{ fontSize: '0.875rem', color: theme === 'light' ? '#64748b' : '#94a3b8', marginTop: '0.25rem' }}>Audit log of all front-office FX conversions.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select 
                style={filterStyle(theme)} 
                value={currencyFilter} 
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                <option value="All">All Currencies</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
              <input 
                type="date" 
                style={filterStyle(theme)} 
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '2px solid #f1f5f9' : '2px solid #1e293b', fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '1rem 0' }}>Ref ID & Time (IST)</th>
                  <th style={{ padding: '1rem 0' }}>Type</th>
                  <th style={{ padding: '1rem 0' }}>Conversion</th>
                  <th style={{ padding: '1rem 0', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '1rem 0', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length > 0 ? filteredHistory.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                    <td style={{ padding: '1.25rem 0' }}>
                      <div style={{ fontWeight: 700, color: theme === 'light' ? '#1e293b' : '#f8fafc', fontSize: '0.85rem' }}>{tx.id}</div>
                      <div style={{ fontSize: '0.75rem', color: theme === 'light' ? '#94a3b8' : '#64748b', marginTop: '0.2rem' }}>{tx.istTime}</div>
                    </td>
                    <td style={{ padding: '1.25rem 0' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 900, 
                        padding: '0.25rem 0.6rem', 
                        borderRadius: '6px',
                        background: tx.mode === 'sell' ? '#f0fdf4' : '#fff1f2',
                        color: tx.mode === 'sell' ? '#059669' : '#e11d48',
                        textTransform: 'uppercase'
                      }}>
                        {tx.mode === 'sell' ? 'SALE' : 'PURCHASE'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 0' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>1 {tx.from} = {tx.appliedRate.toFixed(2)} {tx.to}</div>
                      <div style={{ fontSize: '0.7rem', color: theme === 'light' ? '#94a3b8' : '#64748b' }}>Market: {tx.marketRate.toFixed(2)} | Margin: {tx.margin.toFixed(2)}</div>
                    </td>
                    <td style={{ padding: '1.25rem 0', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}>{formatCurrency(tx.total, tx.to)}</div>
                      <div style={{ fontSize: '0.7rem', color: theme === 'light' ? '#94a3b8' : '#64748b' }}>Qty: {tx.amount} {tx.from}</div>
                    </td>
                    <td style={{ padding: '1.25rem 0', textAlign: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => handleDelete(tx.id)}
                        style={{ 
                          background: '#fee2e2', 
                          border: '1px solid #ef4444', 
                          cursor: 'pointer', 
                          color: '#ef4444', 
                          fontSize: '0.7rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontWeight: 800,
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textTransform: 'uppercase',
                          margin: '0 auto'
                        }}
                        className="btn-delete-hover"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                      No transactions recorded for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Legal Disclaimer */}
        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: theme === 'light' ? '#94a3b8' : '#64748b', lineHeight: '1.6' }}>
          * Rates provided are for front-office estimation. Actual transaction rates may vary based on market volatility. <br />
          This terminal implements a fixed spread model for operational stability.
        </p>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            .main-content { background: white !important; padding: 0 !important; }
            .header, .sidebar, .btn, .filter-section, nav, aside { display: none !important; }
            .card { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
            .grid-responsive { grid-template-columns: 1fr !important; gap: 1rem !important; padding: 1rem !important; }
            .terminal-header { background: black !important; color: white !important; }
            h1, h2, h3 { color: black !important; }
            body { -webkit-print-color-adjust: exact; }
          }
          .btn-delete-hover:hover {
            background-color: #fee2e2 !important;
            transform: scale(1.1);
          }
          .btn-delete-hover:active {
            transform: scale(0.9);
          }
        `}</style>

      </div>
    </main>
  );
}

const labelStyle = (theme: string) => ({
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: theme === 'light' ? '#475569' : '#94a3b8',
  marginBottom: '0.5rem'
});

const selectStyle = (theme: string) => ({
  width: '100%',
  padding: '1rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: theme === 'light' ? '#1e293b' : '#f1f5f9',
  background: theme === 'light' ? 'white' : '#0f172a',
  border: theme === 'light' ? '2px solid #e2e8f0' : '2px solid #1e293b',
  borderRadius: '12px',
  outline: 'none',
  cursor: 'pointer'
});

const filterStyle = (theme: string) => ({
  padding: '0.5rem 1rem',
  borderRadius: '10px',
  border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: theme === 'light' ? '#475569' : '#cbd5e1',
  background: theme === 'light' ? '#fff' : '#0f172a',
  outline: 'none'
});
