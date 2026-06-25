'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type TabType = 'dashboard' | 'profiles' | 'reports';

export default function ReputationPage() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    fromEmail: 'notifications@godwinhotels.com',
    fromName: 'Godwin Reputation AI',
    recipientEmail: 'gm@godwinhotels.com',
    alertThreshold: 2
  });
  const [modalPlatform, setModalPlatform] = useState('Booking.com');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profRes, settRes] = await Promise.all([
        fetch(`/api/reputation?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/reputation?type=settings&t=${Date.now()}`, { cache: 'no-store' })
      ]);
      const profData = await profRes.json();
      const settData = await settRes.json();
      setProfiles(Array.isArray(profData) ? profData : []);
      if (settData && Object.keys(settData).length > 0) setSettings(settData);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (newSettings: any) => {
    try {
      const res = await fetch('/api/reputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_settings', settings: newSettings })
      });
      if (res.ok) {
        alert('✅ Email Configuration Saved!');
        setSettings(newSettings);
      }
    } catch (e) {
      alert('❌ Failed to save settings');
    }
  };

  const handleSync = async (profileId: string) => {
    console.log("Starting sync for profile:", profileId);
    setSyncing(profileId);
    try {
      const res = await fetch('/api/reputation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      
      const result = await res.json();
      console.log("Sync API Response:", result);

      if (res.ok) {
        alert(`✅ Sync successful! Added ${result.mentionsAdded || 0} reviews.`);
        await fetchData(); // Force refresh data
      } else {
        alert('❌ Sync Error: ' + (result.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error("Sync Exception:", e);
      alert('❌ Connection failed: ' + e.message);
    } finally {
      setSyncing(null);
    }
  };

  const [isAdding, setIsAdding] = useState(false);

  const handleAddProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Add Profile form submitted");
    const form = e.currentTarget;
    const formData = new FormData(form);
    let url = formData.get('url') as string;
    let platform = formData.get('platform') as string;
    const customPlatform = formData.get('customPlatform') as string;

    if (platform === 'Other (Custom Source)' && customPlatform) {
      platform = customPlatform;
    }

    console.log("Captured Data:", { platform, url });

    if (!url) {
      alert("Please enter a URL");
      return;
    }

    // Auto-fix URL if protocol is missing
    if (url && !url.startsWith('http')) {
      url = `https://${url}`;
    }

    const payload = {
      hotelId: 'godwin-group',
      platform,
      url
    };

    setIsAdding(true);
    try {
      console.log("Sending POST request to /api/reputation...");
      const res = await fetch('/api/reputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      
      if (res.ok) {
        const newProfile = await res.json();
        console.log("Profile added successfully:", newProfile);
        alert('✅ Profile added successfully!');
        setShowAddModal(false);
        setProfiles(prev => [...prev, newProfile]);
        fetchData();
      } else {
        const err = await res.json();
        console.error("API Error:", err);
        alert('❌ Error: ' + (err.error || 'Failed to add profile'));
      }
    } catch (e: any) {
      console.error("Fetch Exception:", e);
      alert('❌ Connection failed: ' + e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let platform = formData.get('platform') as string;
    const customPlatform = formData.get('customPlatform') as string;
    let url = formData.get('url') as string;

    if (platform === 'Other (Custom Source)' && customPlatform) {
      platform = customPlatform;
    }

    if (url && !url.startsWith('http')) {
      url = `https://${url}`;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/reputation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingProfile.id, platform, url })
      });
      if (res.ok) {
        alert('✅ Source Updated Successfully!');
        setEditingProfile(null);
        fetchData();
      } else {
        const err = await res.json();
        alert('❌ Error: ' + (err.error || 'Failed to update source'));
      }
    } catch (e: any) {
      alert('❌ Connection failed: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    console.log("handleDeleteProfile called for ID:", profileId);
    
    try {
      const res = await fetch('/api/reputation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      console.log("DELETE API status:", res.status);
      if (res.ok) {
        setProfiles(prev => prev.filter(p => p.id !== profileId));
        alert('🗑️ Profile removed.');
      }
    } catch (e) {
      console.error("Delete fetch error:", e);
      alert('❌ Failed to remove profile.');
    }
  };

  const generatePDFReport = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Weekly_Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Aggregate real insights and inject platform names
  const allMentions = profiles.flatMap(p => 
    (p.mentions || []).map((m: any) => ({ ...m, platform: p.platform }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const positiveMentions = allMentions.filter(m => m.sentiment === 'POSITIVE');
  const negativeMentions = allMentions.filter(m => m.sentiment === 'NEGATIVE');
  
  const getTopThemes = (mentions: any[]) => {
    const counts: Record<string, number> = {};
    mentions.flatMap(m => m.themes || []).forEach(t => counts[t] = (counts[t] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 3);
  };

  const realStrengths = getTopThemes(positiveMentions);
  const realWeaknesses = getTopThemes(negativeMentions);
  const avgRating = allMentions.length > 0 
    ? (allMentions.reduce((acc, m) => {
        const score = m.platformScale === 10 ? (m.rating / 2) : m.rating;
        return acc + (score || 0);
      }, 0) / allMentions.length).toFixed(1)
    : "0.0";

  const sentimentMix = {
    positive: positiveMentions.length,
    neutral: allMentions.filter(m => m.sentiment === 'NEUTRAL').length,
    negative: negativeMentions.length,
  };
  const total = allMentions.length || 1;
  const mixPerc = {
    pos: Math.round((sentimentMix.positive / total) * 100),
    neu: Math.round((sentimentMix.neutral / total) * 100),
    neg: Math.round((sentimentMix.negative / total) * 100),
  };

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f8fafc' : '#020617', minHeight: '100vh', padding: '2rem' }}>
      <header className="header" style={{ marginBottom: '2.5rem', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : 'white', letterSpacing: '-0.025em' }}>Reputation Intelligence</h1>
            <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>Hospitality ORM & Sentiment Analysis Tool</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', background: theme === 'light' ? '#fff' : '#0f172a', padding: '0.4rem', borderRadius: '14px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
            <TabButton label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} theme={theme} />
            <TabButton label="Profiles" active={activeTab === 'profiles'} onClick={() => setActiveTab('profiles')} theme={theme} />
            <TabButton label="Weekly Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} theme={theme} />
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b' }}>⏳ Loading reputation data...</div>
      ) : (
        <>
          {activeTab === 'dashboard' && <DashboardView mix={mixPerc} mentions={allMentions} theme={theme} strengths={realStrengths} weaknesses={realWeaknesses} avgRating={avgRating} />}
          {activeTab === 'profiles' && <ProfilesView profiles={profiles} theme={theme} onSync={handleSync} syncing={syncing} onAdd={() => setShowAddModal(true)} onDelete={handleDeleteProfile} onEdit={(p: any) => { setEditingProfile(p); setModalPlatform(p.platform.includes('Other') ? 'Other (Custom Source)' : p.platform); }} />}
          {activeTab === 'reports' && <ReportsView theme={theme} onGenerate={generatePDFReport} settings={settings} onSaveSettings={handleSaveSettings} />}
        </>
      )}

      {/* Add Profile Modal */}
      {(showAddModal || editingProfile) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '2.5rem', borderRadius: '2rem', width: '450px', border: theme === 'light' ? 'none' : '1px solid #1e293b' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : 'white', marginBottom: '1.5rem' }}>{editingProfile ? 'Edit Source Link' : 'Add Source Link'}</h3>
            <form onSubmit={editingProfile ? handleUpdateProfile : handleAddProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>PLATFORM</label>
                <select 
                  name="platform" 
                  required 
                  value={modalPlatform}
                  onChange={(e) => setModalPlatform(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: theme === 'light' ? '#f8fafc' : '#1e293b', border: '1px solid #e2e8f0', color: theme === 'light' ? '#1e293b' : 'white' }}
                >
                  <option>Booking.com</option>
                  <option>Agoda</option>
                  <option>Expedia</option>
                  <option>Google Maps</option>
                  <option>MakeMyTrip</option>
                  <option>TripAdvisor</option>
                  <option>EaseMyTrip</option>
                  <option>Cleartrip</option>
                  <option>Travelguru</option>
                  <option>Yatra</option>
                  <option>Facebook</option>
                  <option>Instagram</option>
                  <option>X (Twitter)</option>
                  <option>Blog / Article</option>
                  <option>Other (Custom Source)</option>
                </select>
              </div>

              {modalPlatform === 'Other (Custom Source)' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>CUSTOM SOURCE NAME</label>
                  <input 
                    name="customPlatform" 
                    type="text" 
                    required 
                    defaultValue={editingProfile?.platform}
                    placeholder="e.g. MyHotelBlog" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: theme === 'light' ? '#f8fafc' : '#1e293b', border: '1px solid #e2e8f0', color: theme === 'light' ? '#1e293b' : 'white' }} 
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>TARGET URL</label>
                <input name="url" type="text" required defaultValue={editingProfile?.url} placeholder="example.com or https://..." style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: theme === 'light' ? '#f8fafc' : '#1e293b', border: '1px solid #e2e8f0', color: theme === 'light' ? '#1e293b' : 'white' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setShowAddModal(false); setEditingProfile(null); }} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isAdding || isSaving} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: (isAdding || isSaving) ? '#94a3b8' : '#2563eb', color: 'white', fontWeight: 700, cursor: (isAdding || isSaving) ? 'not-allowed' : 'pointer' }}>
                  {editingProfile ? (isSaving ? '⏳ Saving...' : 'Save Changes') : (isAdding ? '⏳ Adding...' : 'Add Profile')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIDDEN REPORT TEMPLATE FOR PDF GENERATION */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={reportRef} style={{ width: '800px', padding: '50px', background: 'white', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
          <header style={{ borderBottom: '4px solid #1e3a8a', paddingBottom: '30px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', margin: 0 }}>GODWIN HOTELS GROUP</h1>
              <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Weekly Reputation Intelligence Report</p>
            </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Date Range: Apr 15 - Apr 21, 2026</p>
                <p style={{ margin: '5px 0 0', fontSize: '16px', fontWeight: 900, color: '#1e3a8a' }}>Rating: {avgRating} / 5</p>
              </div>
          </header>

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderLeft: '4px solid #3b82f6', paddingLeft: '15px', marginBottom: '20px' }}>1. The Performance Snapshot</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b' }}>AVG RATING</p>
                <p style={{ margin: '5px 0 0', fontSize: '20px', fontWeight: 900 }}>{avgRating} / 5</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#10b981' }}>🔼 +0.1 vs LW</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b' }}>NEW REVIEWS</p>
                <p style={{ margin: '5px 0 0', fontSize: '20px', fontWeight: 900 }}>{allMentions.length}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#f59e0b' }}>🔽 -5 vs LW</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b' }}>RESPONSE RATE</p>
                <p style={{ margin: '5px 0 0', fontSize: '20px', fontWeight: 900 }}>100%</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#3b82f6' }}>Perfect Status</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b' }}>NEG. MENTIONS</p>
                <p style={{ margin: '5px 0 0', fontSize: '20px', fontWeight: 900 }}>6</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#ef4444' }}>🔼 +2 vs LW</p>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderLeft: '4px solid #ef4444', paddingLeft: '15px', marginBottom: '20px' }}>2. Deep Dive: "The Good, The Bad & The Urgent"</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                <h4 style={{ margin: '0 0 10px', color: '#166534', fontSize: '14px', fontWeight: 800 }}>✅ THE GOOD (Top Strengths)</h4>
                <ul style={{ margin: 0, padding: '0 0 0 15px', fontSize: '12px', lineHeight: '1.6', color: '#166534' }}>
                  {realStrengths.length > 0 ? realStrengths.map(s => <li key={s}>{s}</li>) : <li>No strengths detected yet.</li>}
                </ul>
              </div>
              <div style={{ background: '#fef2f2', padding: '20px', borderRadius: '16px', border: '1px solid #fee2e2' }}>
                <h4 style={{ margin: '0 0 10px', color: '#991b1b', fontSize: '14px', fontWeight: 800 }}>❌ THE BAD (Key Weaknesses)</h4>
                <ul style={{ margin: 0, padding: '0 0 0 15px', fontSize: '12px', lineHeight: '1.6', color: '#991b1b' }}>
                  {realWeaknesses.length > 0 ? realWeaknesses.map(w => <li key={w}>{w}</li>) : <li>No major weaknesses detected.</li>}
                </ul>
              </div>
            </div>
            <div style={{ marginTop: '20px', background: '#fffbeb', padding: '20px', borderRadius: '16px', border: '1px solid #fef3c7' }}>
              <h4 style={{ margin: '0 0 10px', color: '#92400e', fontSize: '14px', fontWeight: 800 }}>🚨 THE URGENT (Immediate Action)</h4>
              <ul style={{ margin: 0, padding: '0 0 0 15px', fontSize: '12px', lineHeight: '1.6', color: '#92400e' }}>
                <li><strong>Room 304:</strong> Multiple AC noise complaints. Maintenance needed immediately.</li>
                <li><strong>Social Media:</strong> Influencer @travel_guru tagged "Late Check-in". Reply required.</li>
              </ul>
            </div>
          </section>

          <footer style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
            This report is automatically generated by Antigravity Reputation Engine. Confidential for GM Godwin Hotels.
          </footer>
        </div>
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick, theme }: { label: string, active: boolean, onClick: () => void, theme: string }) {
  const isLight = theme === 'light';
  return (
    <button 
      onClick={onClick}
      style={{
        padding: '0.6rem 1.25rem',
        borderRadius: '10px',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: active ? '#2563eb' : 'transparent',
        color: active ? 'white' : (isLight ? '#64748b' : '#94a3b8')
      }}
    >
      {label}
    </button>
  );
}

function DashboardView({ mix, mentions, theme, strengths, weaknesses, avgRating }: any) {
  const isLight = theme === 'light';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          <StatCard title="Reputation Score" value={`${avgRating} / 5`} subValue="Live Data" icon="⭐" color="#f59e0b" theme={theme} />
          <StatCard title="Response Rate" value="100%" subValue="Perfect compliance" icon="💬" color="#3b82f6" theme={theme} />
          <StatCard title="Total Mentions" value={mentions.length.toString()} subValue="Synced from sources" icon="🗞️" color="#10b981" theme={theme} />
        </div>

        {/* Sentiment Analysis */}
        <div className="card" style={{ padding: '2rem', background: isLight ? 'white' : '#0f172a', borderRadius: '1.5rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white', marginBottom: '1.5rem' }}>Sentiment Distribution</h3>
          <div style={{ display: 'flex', height: '40px', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ width: `${mix.pos}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800 }}>{mix.pos}% POSITIVE</div>
            <div style={{ width: `${mix.neu}%`, background: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800 }}>{mix.neu}% NEUTRAL</div>
            <div style={{ width: `${mix.neg}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800 }}>{mix.neg}% NEGATIVE</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h4 style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'uppercase' }}>✅ Key Strengths</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {strengths.length > 0 ? strengths.map((s: string) => <StrengthItem key={s} text={s} theme={theme} />) : <StrengthItem text="Syncing data..." theme={theme} />}
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'uppercase' }}>❌ Critical Weaknesses</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {weaknesses.length > 0 ? weaknesses.map((w: string) => <WeaknessItem key={w} text={w} theme={theme} />) : <WeaknessItem text="No weaknesses detected" theme={theme} />}
              </ul>
            </div>
          </div>
        </div>

        {/* Live Mentions Feed */}
        <div className="card" style={{ padding: '2rem', background: isLight ? 'white' : '#0f172a', borderRadius: '1.5rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white' }}>Live Mentions Feed</h3>
            <button style={{ color: '#3b82f6', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>View All Mentions →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mentions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No mentions detected yet. Trigger a sync in Profiles.</p>
            ) : (
              mentions.map(m => (
                <MentionRow key={m.id} mention={m} theme={theme} />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', background: '#1e293b', borderRadius: '1.5rem', color: 'white' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🧠</span> AI Insights
          </h3>
          <p style={{ fontSize: '0.85rem', lineHeight: '1.6', opacity: 0.9, marginBottom: '1.25rem' }}>
            Your rating on <strong>Agoda</strong> is 0.4 points lower than Google. This is primarily due to complaints about Wi-Fi signal strength in corridor segments.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', fontSize: '0.8rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.4rem', color: '#fbbf24' }}>ACTION REQUIRED:</strong>
            Install a Wi-Fi repeater in the 3rd floor north corridor and perform a linen audit on all Deluxe rooms.
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: isLight ? 'white' : '#0f172a', borderRadius: '1.5rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white', marginBottom: '1rem' }}>Competitor Benchmarking</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <CompetitorRow name="Hotel Bloom" score={4.5} status="OUTPERFORMING" theme={theme} />
            <CompetitorRow name="Hotel City Star" score={4.1} status="LAGGING" theme={theme} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subValue, icon, color, theme }: any) {
  const isLight = theme === 'light';
  return (
    <div className="card" style={{ padding: '1.5rem', background: isLight ? 'white' : '#0f172a', borderRadius: '1.5rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{title}</p>
          <h4 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : 'white', margin: 0 }}>{value}</h4>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>{subValue}</p>
        </div>
        <div style={{ fontSize: '1.5rem', padding: '0.75rem', borderRadius: '12px', background: `${color}15`, color }}>{icon}</div>
      </div>
    </div>
  );
}

function StrengthItem({ text, theme }: any) {
  const isLight = theme === 'light';
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: isLight ? '#475569' : '#cbd5e1' }}>
      <span style={{ color: '#10b981' }}>●</span> {text}
    </li>
  );
}

function WeaknessItem({ text, theme }: any) {
  const isLight = theme === 'light';
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: isLight ? '#475569' : '#cbd5e1' }}>
      <span style={{ color: '#ef4444' }}>●</span> {text}
    </li>
  );
}

function MentionRow({ mention, theme }: any) {
  const isLight = theme === 'light';
  const getSentimentColor = () => {
    if (mention.sentiment === 'POSITIVE') return '#10b981';
    if (mention.sentiment === 'NEGATIVE') return '#ef4444';
    return '#94a3b8';
  };

  return (
    <div style={{ 
      padding: '1.25rem', 
      borderRadius: '16px', 
      background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
      border: `1px solid ${isLight ? '#f1f5f9' : '#1e293b'}`,
      display: 'grid',
      gridTemplateColumns: '100px 1fr 150px',
      gap: '1rem',
      alignItems: 'center'
    }}>
      <div>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: '6px', background: isLight ? '#fff' : '#1e293b', color: isLight ? '#1e293b' : 'white', border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}` }}>{mention.platform || 'General'}</span>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 800, color: getSentimentColor() }}>
          {mention.rating ? `⭐ ${mention.rating}${mention.platformScale ? ` / ${mention.platformScale}` : ''}` : 'MENTION'}
        </div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: isLight ? '#1e293b' : '#f1f5f9', fontWeight: 600 }}>"{mention.content}"</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>by <strong>{mention.author || 'Anonymous'}</strong> • {new Date(mention.date).toLocaleDateString()}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <a href={mention.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>Reference Link ↗</a>
      </div>
    </div>
  );
}

function CompetitorRow({ name, score, status, theme }: any) {
  const isLight = theme === 'light';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: isLight ? '#1e293b' : 'white' }}>{name}</p>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: status === 'OUTPERFORMING' ? '#ef4444' : '#10b981' }}>{status}</span>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 900, color: isLight ? '#1e293b' : 'white' }}>{score}</div>
    </div>
  );
}

function ProfilesView({ profiles, theme, onSync, syncing, onAdd, onDelete, onEdit }: any) {
  const isLight = theme === 'light';
  return (
    <div className="card" style={{ padding: '2rem', background: isLight ? 'white' : '#0f172a', borderRadius: '2rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white' }}>Monitored Source Links</h2>
        <button onClick={onAdd} className="btn btn-primary">+ Add New Source</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: `1px solid ${isLight ? '#f1f5f9' : '#1e293b'}`, color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
            <th style={{ padding: '1rem' }}>Platform</th>
            <th style={{ padding: '1rem' }}>URL</th>
            <th style={{ padding: '1rem' }}>Last Sync</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No sources configured. Add one to start monitoring.</td></tr>
          ) : (
            profiles.map((p: any) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${isLight ? '#f8fafc' : '#1e293b'}` }}>
                <td style={{ padding: '1rem', fontWeight: 700, color: isLight ? '#1e293b' : 'white' }}>{p.platform}</td>
                <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#3b82f6', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</td>
                <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>{p.lastSync ? new Date(p.lastSync).toLocaleString() : 'Never'}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => {
                        console.log("Sync clicked for:", p.id);
                        onSync(p.id);
                      }} 
                      disabled={syncing === p.id}
                      style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: syncing === p.id ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      {syncing === p.id ? '⏳ Syncing...' : '🔄 Sync'}
                    </button>
                    <button 
                      onClick={() => onEdit(p)} 
                      style={{ background: '#f59e0b15', border: 'none', color: '#f59e0b', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}
                      title="Edit Source"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => {
                        console.log("Delete button clicked for ID:", p.id);
                        onDelete(p.id);
                      }} 
                      style={{ background: '#ef444415', border: 'none', color: '#ef4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}
                      title="Remove Source"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportsView({ theme, onGenerate, settings, onSaveSettings }: any) {
  const isLight = theme === 'light';
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setLocalSettings((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '2rem' }}>
      <div className="card" style={{ padding: '2rem', background: isLight ? 'white' : '#0f172a', borderRadius: '2rem', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white' }}>Live Executive Summary</h2>
          <button className="btn btn-primary" onClick={onGenerate}>Generate PDF Report Now</button>
        </div>
        
        <div style={{ padding: '3rem', textAlign: 'center', background: isLight ? '#f8fafc' : '#1e293b10', borderRadius: '24px', border: `2px dashed ${isLight ? '#e2e8f0' : '#1e293b'}` }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ color: isLight ? '#1e293b' : 'white', marginBottom: '0.5rem' }}>No Historical Reports Yet</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Generate your first report manually or wait for the weekly scheduled sync.</p>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', background: isLight ? '#fff' : '#0f172a', borderRadius: '2rem', border: `1px solid ${isLight ? '#e2e8f0' : '#1e293b'}` }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚙️</span> Email & SMTP Configuration
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <ConfigField label="SMTP Host" name="smtpHost" value={localSettings.smtpHost} onChange={handleChange} placeholder="e.g. smtp.gmail.com" theme={theme} />
            <ConfigField label="SMTP Port" name="smtpPort" value={localSettings.smtpPort} onChange={handleChange} placeholder="587" theme={theme} />
          </div>

          <ConfigField label="SMTP Username" name="smtpUser" value={localSettings.smtpUser} onChange={handleChange} placeholder="your-email@gmail.com" theme={theme} />
          <ConfigField label="SMTP Password" name="smtpPass" value={localSettings.smtpPass} onChange={handleChange} type="password" placeholder="••••••••" theme={theme} />

          <hr style={{ border: 0, borderTop: `1px solid ${isLight ? '#f1f5f9' : '#1e293b'}`, margin: '0.5rem 0' }} />

          <ConfigField label="Sender Name" name="fromName" value={localSettings.fromName} onChange={handleChange} placeholder="Godwin Reputation AI" theme={theme} />
          <ConfigField label="Sender Email (From)" name="fromEmail" value={localSettings.fromEmail} onChange={handleChange} placeholder="notifications@godwinhotels.com" theme={theme} />
          
          <ConfigField label="Recipient Email (To)" name="recipientEmail" value={localSettings.recipientEmail} onChange={handleChange} placeholder="gm@godwinhotels.com" theme={theme} />

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => onSaveSettings(localSettings)}>
            Save Configuration
          </button>
          
          <div style={{ marginTop: '0.5rem', padding: '1rem', background: isLight ? '#f0fdf4' : '#064e3b20', border: `1px solid ${isLight ? '#dcfce7' : '#064e3b'}`, borderRadius: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: isLight ? '#166534' : '#4ade80', lineHeight: '1.4' }}>
              <strong>INFO:</strong> These settings will be used for automated weekly reports (Every Monday 8 AM) and critical alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigField({ label, name, value, onChange, placeholder, theme, type = "text" }: any) {
  const isLight = theme === 'light';
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>{label}</label>
      <input 
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ 
          width: '100%', 
          padding: '0.65rem 0.75rem', 
          borderRadius: '10px', 
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155', 
          background: isLight ? '#f8fafc' : '#1e293b', 
          color: isLight ? '#1e293b' : 'white',
          fontSize: '0.85rem'
        }} 
      />
    </div>
  );
}

function ReportRow({ date, period, score, trend, theme, onGenerate }: any) {
  const isLight = theme === 'light';
  return (
    <div style={{ padding: '1.25rem', borderRadius: '16px', border: `1px solid ${isLight ? '#f1f5f9' : '#1e293b'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isLight ? '#1e293b' : 'white' }}>Executive Report - {date}</h4>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Period: {period}</p>
      </div>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: isLight ? '#1e293b' : 'white' }}>{score}</div>
          <div style={{ fontSize: '0.7rem', color: trend.includes('🔼') ? '#10b981' : '#ef4444', fontWeight: 800 }}>{trend}</div>
        </div>
        <button onClick={onGenerate} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Download PDF</button>
      </div>
    </div>
  );
}
