'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';
import { formatCurrency } from '@/lib/utils';

type TabType = 'vehicles' | 'slips' | 'packages' | 'new-slip';

export default function FleetPage() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('slips');
  const [isLoaded, setIsLoaded] = useState(false);

  // --- DATA STATES ---
  const [fleet, setFleet] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  // --- FORM STATES ---
  const [slipData, setSlipData] = useState({
    serialNo: '',
    assignment: 'Own Car',
    serviceType: 'Local Sightseeing',
    hotelProperty: 'Hotel Grand Godwin',
    driverName: '',
    vehicleNo: '',
    vehicleType: 'Sedan',
    guestName: '',
    roomNo: '',
    assignedBy: '',
    tourManager: '',
    tourNo: '', 
    serviceDate: new Date().toISOString().split('T')[0],
    reportingPlace: 'Hotel Grand Godwin',
    dropPlace: '',
    openingKm: '',
    closingKm: '',
    startTime: '',
    endTime: '',
    parkingCollected: 'No',
    parkingPaidToDriver: 'No',
    parkingAmount: 0,
    remarks: '',
    dateTime: '' 
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [viewingSlip, setViewingSlip] = useState<any>(null);
  const [editingSlip, setEditingSlip] = useState<any>(null);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [viewingSchedule, setViewingSchedule] = useState<any>(null);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [viewingPackage, setViewingPackage] = useState<any>(null);
  const [newPackage, setNewPackage] = useState({
    name: '',
    duration: '',
    price: 0,
    totalCost: 0
  });

  const [newVehicle, setNewVehicle] = useState({
    type: 'Sedan',
    model: '',
    rateDay: 2500,
    rateKm: 12,
    capacity: '4+1'
  });

  // --- INITIAL LOAD ---
  useEffect(() => {
    const savedFleet = localStorage.getItem('GODWIN_FLEET');
    const savedSlips = localStorage.getItem('GODWIN_DUTY_SLIPS');
    const savedPackages = localStorage.getItem('GODWIN_PACKAGES');

    if (savedFleet) setFleet(JSON.parse(savedFleet));
    else setFleet([
      { id: 'f1', type: 'Sedan', model: 'Maruti Dzire / Toyota Etios', rateDay: 2500, rateKm: 12, capacity: '4+1' },
      { id: 'f2', type: 'SUV', model: 'Innova Crysta', rateDay: 4500, rateKm: 18, capacity: '6+1' },
      { id: 'f3', type: 'Tempo Traveller', model: 'Force Tempo', rateDay: 6500, rateKm: 24, capacity: '12+1' },
    ]);

    if (savedSlips) {
      const parsedSlips = JSON.parse(savedSlips);
      // Remove duplicates by serialNo to fix previous testing artifacts
      const uniqueSlips = parsedSlips.filter((v: any, i: number, a: any[]) => 
        a.findIndex(t => t.serialNo === v.serialNo) === i
      );
      setSlips(uniqueSlips);
    }
    
    if (savedPackages) setPackages(JSON.parse(savedPackages));
    else setPackages([
      { id: 'p1', name: 'Golden Triangle (Delhi-Agra-Jaipur)', duration: '3N/4D', price: 24999, totalCost: 18000 },
      { id: 'p2', name: 'Same Day Agra Tour', duration: '1 Day', price: 5500, totalCost: 3800 }
    ]);

    setIsLoaded(true);
  }, []);

  // --- PERSISTENCE ---
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('GODWIN_FLEET', JSON.stringify(fleet));
      localStorage.setItem('GODWIN_DUTY_SLIPS', JSON.stringify(slips));
      localStorage.setItem('GODWIN_PACKAGES', JSON.stringify(packages));
    }
  }, [fleet, slips, packages, isLoaded]);

  // --- HELPERS ---
  const generateSerial = (hotel: string) => {
    const prefix = hotel === 'Hotel Grand Godwin' ? 'GG-' : 'GDX-';
    return prefix + Math.floor(10000 + Math.random() * 90000);
  };

  const getTourNumber = (date: string) => {
    const d = new Date(date);
    const dateStr = `${d.getDate()}${d.getMonth()+1}${d.getFullYear()}`;
    const dailyCount = slips.filter(s => s.serviceDate === date).length + 1;
    return `T-${dateStr}-${dailyCount.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS ---
  const handleSaveSlip = () => {
    // Basic Validation
    if (!slipData.guestName.trim()) {
      alert("Please enter Guest Name.");
      return false;
    }

    if (editingSlip) {
      // Update existing
      setSlips(slips.map(s => s.id === editingSlip.id ? { ...slipData, id: editingSlip.id } : s));
      setEditingSlip(null);
      alert("Slip updated successfully!");
    } else {
      // Create new
      // Duplicate Check (by Serial Number primarily)
      const duplicate = slips.find(s => s.serialNo === slipData.serialNo);
      if (duplicate) {
        alert(`Slip ${slipData.serialNo} already exists in records.`);
        return false;
      }

      const newSlip = {
        ...slipData,
        id: Date.now().toString(),
        dateTime: new Date().toLocaleString('en-IN')
      };
      
      setSlips([newSlip, ...slips]);
    }

    setActiveTab('slips');
    
    // Reset form
    setSlipData(prev => ({
      ...prev,
      serialNo: generateSerial(prev.hotelProperty),
      tourNo: getTourNumber(prev.serviceDate),
      guestName: '',
      roomNo: '',
      driverName: '',
      vehicleNo: '',
      remarks: ''
    }));
    
    return true;
  };

  const deleteSlip = (id: string) => {
    if (confirm('Delete this duty slip record?')) {
      setSlips(slips.filter(s => s.id !== id));
    }
  };

  const handleSaveVehicle = () => {
    if (!newVehicle.model.trim()) {
      alert("Please enter Vehicle Model.");
      return;
    }
    if (editingVehicle) {
      setFleet(fleet.map(v => v.id === editingVehicle.id ? { ...newVehicle, id: editingVehicle.id } : v));
      setEditingVehicle(null);
    } else {
      setFleet([...fleet, { ...newVehicle, id: Date.now().toString() }]);
      setIsAddVehicleOpen(false);
    }
    setNewVehicle({ type: 'Sedan', model: '', rateDay: 2500, rateKm: 12, capacity: '4+1' });
  };

  const deleteVehicle = (id: string) => {
    if (confirm('Delete this vehicle from fleet?')) {
      setFleet(fleet.filter(v => v.id !== id));
    }
  };

  const handleSavePackage = () => {
    if (!newPackage.name.trim()) {
      alert("Please enter Package Name.");
      return;
    }
    if (editingPackage) {
      setPackages(packages.map(p => p.id === editingPackage.id ? { ...newPackage, id: editingPackage.id } : p));
      setEditingPackage(null);
    } else {
      setPackages([...packages, { ...newPackage, id: Date.now().toString() }]);
      setIsAddPackageOpen(false);
    }
    setNewPackage({ name: '', duration: '', price: 0, totalCost: 0 });
  };

  const deletePackage = (id: string) => {
    if (confirm('Delete this tour package?')) {
      setPackages(packages.filter(p => p.id !== id));
    }
  };
  const filteredSlips = useMemo(() => {
    return slips.filter(s => {
      const matchesSearch = !searchQuery || 
        s.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.serialNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase());
      
      const sDate = dateFilter.start ? new Date(dateFilter.start) : null;
      const eDate = dateFilter.end ? new Date(dateFilter.end) : null;
      const dDate = new Date(s.serviceDate);
      
      let matchesDate = true;
      if (sDate && dDate < sDate) matchesDate = false;
      if (eDate && dDate > eDate) matchesDate = false;

      return matchesSearch && matchesDate;
    });
  }, [slips, searchQuery, dateFilter]);

  const printSingleSlip = (slip: any) => {
    setSlipData(slip);
    // Increased delay to ensure state update and rendering complete
    setTimeout(() => window.print(), 300);
  };

  // --- RENDER HELPERS ---
  const TabButton = ({ id, label, icon }: { id: TabType, label: string, icon: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`btn ${activeTab === id ? 'btn-primary' : 'btn-outline'}`}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, padding: '0.75rem' }}
    >
      <span>{icon}</span> {label}
    </button>
  );

  return (
    <main className="main-content">
      <header className="header no-print" style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
            <span style={{ fontSize: '1.1em', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>🚐</span> Fleet & Logistics
          </h1>
          <p style={{ fontSize: '0.95rem', fontWeight: 500, opacity: 0.8 }}>Godwin ERP Control Panel • Transport Management</p>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '0.4rem', 
          background: theme === 'light' ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)', 
          padding: '0.4rem', 
          borderRadius: '16px', 
          border: '1px solid var(--border)',
          width: '600px' 
        }}>
          <TabButton id="slips" label="History" icon="📜" />
          <TabButton id="new-slip" label="Duty Slip" icon="📝" />
          <TabButton id="vehicles" label="Fleet" icon="🚗" />
          <TabButton id="packages" label="Packages" icon="🎁" />
        </div>
      </header>

      {/* --- CONTENT TABS --- */}
      <div className="no-print">
        {activeTab === 'slips' && (
          <section className="card animate-in">
            <h3 style={{ margin: '0 0 2rem 0' }}>Duty Slip Archives</h3>
            <div className="filter-bar" style={{ 
              display: 'flex', 
              gap: '1rem', 
              marginBottom: '2rem', 
              background: theme === 'light' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 23, 42, 0.3)',
              padding: '1rem',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(10px)',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Search Guest, Driver, Slip #..." 
                  className="input-premium" 
                  style={{ paddingLeft: '3rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: '300px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, position: 'absolute', top: '-8px', left: '12px', background: 'var(--bg-card)', padding: '0 4px', color: 'var(--primary)', zIndex: 1 }}>FROM</label>
                  <input type="date" className="input-premium" style={{ fontSize: '0.85rem' }} value={dateFilter.start} onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})} />
                </div>
                <span style={{ fontWeight: 700, opacity: 0.5 }}>→</span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, position: 'absolute', top: '-8px', left: '12px', background: 'var(--bg-card)', padding: '0 4px', color: 'var(--primary)', zIndex: 1 }}>TO</label>
                  <input type="date" className="input-premium" style={{ fontSize: '0.85rem' }} value={dateFilter.end} onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})} />
                </div>
              </div>
              <button className="btn btn-outline" style={{ height: '52px', padding: '0 1.5rem', borderRadius: '12px' }} onClick={() => { setSearchQuery(''); setDateFilter({start: '', end: ''}); }}>
                Reset
              </button>
            </div>

            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Slip #</th>
                    <th style={{ width: '130px' }}>Date</th>
                    <th>Guest Details</th>
                    <th>Vehicle Details</th>
                    <th>Driver</th>
                    <th style={{ width: '150px' }}>Duty Type</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ textAlign: 'right', width: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlips.map(s => (
                    <tr key={s.id} style={{ transition: 'background 0.2s' }}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px' }}>{s.serialNo}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.serviceDate}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.guestName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ opacity: 0.7 }}>🚪</span> Room: {s.roomNo || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{s.vehicleNo}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ opacity: 0.7 }}>🚗</span> {s.vehicleType}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{s.driverName}</td>
                      <td>
                        <span className="badge" style={{ background: theme === 'light' ? '#e2e8f0' : '#334155', color: 'inherit', border: '1px solid var(--border)' }}>
                          {s.serviceType}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.closingKm ? 'badge-platinum' : 'badge-gold'}`} style={{ width: '90px', textAlign: 'center' }}>
                          {s.closingKm ? 'Completed' : 'Running'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-action btn-view" title="View Details" onClick={() => setViewingSlip(s)}>👁️</button>
                          <button className="btn-action" title="Edit" style={{ color: 'var(--primary)' }} onClick={() => { setEditingSlip(s); setSlipData(s); setActiveTab('new-slip'); }}>✏️</button>
                          <button className="btn-action btn-print" title="Print" onClick={() => printSingleSlip(s)}>🖨️</button>
                          <button className="btn-action btn-delete" title="Delete" onClick={() => deleteSlip(s.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSlips.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        No records found matching your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'new-slip' && (
          <section className="card animate-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Create New Duty Slip</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Fill all logistics details for accurate records.</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{slipData.serialNo || 'GG-XXXXX'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generated ID</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Hotel & Date */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label-premium">Issuing Property</label>
                <div style={{ display: 'flex', gap: '1rem', background: theme === 'light' ? '#f1f5f9' : '#0f172a', padding: '0.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  {['Hotel Grand Godwin', 'Hotel Godwin Deluxe'].map(h => (
                    <button 
                      key={h}
                      onClick={() => {
                        const newSerial = generateSerial(h);
                        setSlipData({...slipData, hotelProperty: h, serialNo: newSerial});
                      }}
                      style={{ 
                        flex: 1, 
                        padding: '1rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 800, 
                        fontSize: '0.9rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: slipData.hotelProperty === h ? 'var(--primary)' : 'transparent', 
                        color: slipData.hotelProperty === h ? 'white' : 'var(--text-muted)',
                        boxShadow: slipData.hotelProperty === h ? '0 4px 15px rgba(37, 99, 235, 0.3)' : 'none'
                      }}
                    >
                      {h === 'Hotel Grand Godwin' ? '🏨 Grand Godwin' : '🏛️ Godwin Deluxe'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-premium">Service Date</label>
                <input 
                  type="date" 
                  className="input-premium" 
                  value={slipData.serviceDate} 
                  onChange={(e) => setSlipData({...slipData, serviceDate: e.target.value, tourNo: getTourNumber(e.target.value)})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label-premium">Service Type</label>
                <select className="input-premium" value={slipData.serviceType} onChange={(e) => setSlipData({...slipData, serviceType: e.target.value})}>
                  <option>Local Sightseeing</option>
                  <option>Airport Pickup</option>
                  <option>Airport Drop</option>
                  <option>Railway Pickup</option>
                  <option>Railway Drop</option>
                  <option>Outstation Trip</option>
                </select>
              </div>

              {/* Guest Details */}
              <div className="form-group">
                <label className="form-label-premium">Guest Name</label>
                <input type="text" className="input-premium" placeholder="Enter Full Name" value={slipData.guestName} onChange={(e) => setSlipData({...slipData, guestName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label-premium">Room Number</label>
                <input type="text" className="input-premium" placeholder="e.g. 304" value={slipData.roomNo} onChange={(e) => setSlipData({...slipData, roomNo: e.target.value})} />
              </div>

              {/* Logistics */}
              <div className="form-group">
                <label className="form-label-premium">Reporting Place</label>
                <input type="text" className="input-premium" value={slipData.reportingPlace} onChange={(e) => setSlipData({...slipData, reportingPlace: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label-premium">Destination / Drop Place</label>
                <input type="text" className="input-premium" placeholder="e.g. Taj Mahal, Agra" value={slipData.dropPlace} onChange={(e) => setSlipData({...slipData, dropPlace: e.target.value})} />
              </div>

              {/* Driver & Vehicle */}
              <div className="form-group">
                <label className="form-label-premium">Driver Name</label>
                <input type="text" className="input-premium" placeholder="Driver Full Name" value={slipData.driverName} onChange={(e) => setSlipData({...slipData, driverName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label-premium">Vehicle Number</label>
                <input type="text" className="input-premium" placeholder="e.g. DL 1C A 1234" value={slipData.vehicleNo} onChange={(e) => setSlipData({...slipData, vehicleNo: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label-premium">Vehicle Type</label>
                <select className="input-premium" value={slipData.vehicleType} onChange={(e) => setSlipData({...slipData, vehicleType: e.target.value})}>
                  <option>Sedan (Dzire/Etios)</option>
                  <option>SUV (Innova/Crysta)</option>
                  <option>Tempo Traveller</option>
                  <option>Luxury Car</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label-premium">Duty Managed By</label>
                <input type="text" className="input-premium" placeholder="Staff Member Name" value={slipData.assignedBy} onChange={(e) => setSlipData({...slipData, assignedBy: e.target.value})} />
              </div>

              {/* Remarks */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label-premium">Remarks / Special Instructions</label>
                <textarea 
                  className="input-premium" 
                  style={{ height: '100px', resize: 'none' }}
                  placeholder="Add any specific guest requirements or route instructions..."
                  value={slipData.remarks}
                  onChange={(e) => setSlipData({...slipData, remarks: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 2, padding: '1.25rem', fontSize: '1rem', fontWeight: 800 }}
                onClick={() => {
                  const saved = handleSaveSlip();
                  if (saved) {
                    alert(editingSlip ? "Slip updated successfully!" : "Slip recorded successfully!");
                    setEditingSlip(null);
                  }
                }}
              >
                {editingSlip ? '💾 Update Duty Slip Record' : '💾 Save Duty Slip Record'}
              </button>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '1.25rem', border: '2px solid var(--primary)', color: 'var(--primary)' }}
                onClick={() => { 
                  const saved = handleSaveSlip(); 
                  if (saved) {
                    setTimeout(() => window.print(), 500); 
                  }
                }}
              >
                🖨️ Save & Print Slip
              </button>
            </div>
          </section>
        )}

        {activeTab === 'vehicles' && (
          <section className="animate-in">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0 }}>Managed Fleet Vehicles</h3>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsAddVehicleOpen(true)}>
                   <span>➕</span> Add New Vehicle
                </button>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              {fleet.map(v => (
                <div key={v.id} className="card hover-scale" style={{ padding: '2rem', border: '1px solid var(--border)', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.05, transform: 'rotate(-15deg)', pointerEvents: 'none' }}>🚗</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div style={{ width: '50px', height: '50px', background: 'var(--primary)', color: 'white', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)' }}>
                      {v.type === 'Sedan' ? '🚕' : v.type === 'SUV' ? '🚙' : '🚐'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => deleteVehicle(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.5 }}>🗑️</button>
                      <span className="badge badge-platinum" style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}>{v.type}</span>
                    </div>
                  </div>
                  <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.4rem', fontWeight: 800 }}>{v.model}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="fleet-stat-row">
                      <span className="text-muted">Daily (8h/80km)</span>
                      <span style={{ fontWeight: 800, color: 'var(--success)' }}>₹{v.rateDay.toLocaleString()}</span>
                    </div>
                    <div className="fleet-stat-row">
                      <span className="text-muted">Extra KM Rate</span>
                      <span style={{ fontWeight: 800 }}>₹{v.rateKm}/km</span>
                    </div>
                    <div className="fleet-stat-row">
                      <span className="text-muted">Seating Capacity</span>
                      <span style={{ fontWeight: 800 }}>{v.capacity} Pax</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
                     <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.8rem', fontWeight: 700 }} onClick={() => { setEditingVehicle(v); setNewVehicle(v); }}>Edit Specs</button>
                     <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.8rem', fontWeight: 700 }} onClick={() => setViewingSchedule(v)}>Schedule</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'packages' && (
           <section className="card animate-in" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Standard Tour Packages</h3>
              <button className="btn btn-primary" onClick={() => setIsAddPackageOpen(true)}>➕ New Package</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead style={{ background: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                  <tr>
                    <th style={{ paddingLeft: '2rem' }}>Package Description</th>
                    <th>Duration</th>
                    <th>Selling Price</th>
                    <th>Estimated Cost</th>
                    <th>Profit Margin</th>
                    <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map(p => (
                    <tr key={p.id}>
                      <td style={{ paddingLeft: '2rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: PKG-{p.id.slice(-4)}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.duration}</td>
                      <td>
                        <div style={{ color: 'var(--success)', fontWeight: 900, fontSize: '1.1rem' }}>₹{p.price.toLocaleString()}</div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{p.totalCost ? `₹${p.totalCost.toLocaleString()}` : 'N/A'}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          {p.totalCost ? `${Math.round(((p.price - p.totalCost) / p.price) * 100)}%` : '--'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '2rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-action btn-view" title="View" onClick={() => setViewingPackage(p)}>👁️</button>
                          <button className="btn-action" title="Edit" onClick={() => { setEditingPackage(p); setNewPackage(p); }}>✏️</button>
                          <button className="btn-action btn-delete" title="Delete" onClick={() => deletePackage(p.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           </section>
        )}
      </div>

      {/* --- PRINTABLE SLIPS (Dual Copy) --- */}
      <div className="print-only">
        <DutySlipComponent title="DUTY SLIP - OFFICE COPY" data={slipData} />
      </div>

      {/* --- VIEW MODAL --- */}
      {viewingSlip && (
        <div className="modal-overlay no-print" onClick={() => setViewingSlip(null)}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Duty Slip Details</h2>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Reference: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{viewingSlip.serialNo}</span></p>
              </div>
              <button className="btn btn-outline" onClick={() => setViewingSlip(null)} style={{ padding: '0.5rem', borderRadius: '50%', width: '36px', height: '36px' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <section>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>General Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailRow label="Property" value={viewingSlip.hotelProperty} />
                  <DetailRow label="Date" value={viewingSlip.serviceDate} />
                  <DetailRow label="Tour #" value={viewingSlip.tourNo} />
                  <DetailRow label="Duty Type" value={viewingSlip.serviceType} />
                </div>
              </section>

              <section>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Guest & Room</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailRow label="Guest Name" value={viewingSlip.guestName} />
                  <DetailRow label="Room No" value={viewingSlip.roomNo || 'N/A'} />
                  <DetailRow label="Reporting" value={viewingSlip.reportingPlace} />
                  <DetailRow label="Destination" value={viewingSlip.dropPlace || 'Local'} />
                </div>
              </section>

              <section>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Vehicle & Driver</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailRow label="Vehicle No" value={viewingSlip.vehicleNo} />
                  <DetailRow label="Vehicle Type" value={viewingSlip.vehicleType} />
                  <DetailRow label="Driver" value={viewingSlip.driverName} />
                  <DetailRow label="Managed By" value={viewingSlip.assignedBy} />
                </div>
              </section>

              <section>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Log Meter</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: theme === 'light' ? '#f1f5f9' : '#0f172a', borderRadius: '12px' }}>
                   <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OPENING KM</div>
                      <div style={{ fontWeight: 700 }}>{viewingSlip.openingKm || '---'}</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CLOSING KM</div>
                      <div style={{ fontWeight: 700 }}>{viewingSlip.closingKm || '---'}</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>START TIME</div>
                      <div style={{ fontWeight: 700 }}>{viewingSlip.startTime || '--:--'}</div>
                   </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>END TIME</div>
                      <div style={{ fontWeight: 700 }}>{viewingSlip.endTime || '--:--'}</div>
                    </div>
                </div>
              </section>

              <section style={{ gridColumn: 'span 2' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Remarks</h4>
                <div style={{ padding: '1rem', background: theme === 'light' ? '#f8fafc' : '#1e293b', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  {viewingSlip.remarks || "No additional instructions provided."}
                </div>
              </section>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setViewingSlip(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { printSingleSlip(viewingSlip); setViewingSlip(null); }}>
                🖨️ Print Duty Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT VEHICLE MODAL --- */}
      {(isAddVehicleOpen || editingVehicle) && (
        <div className="modal-overlay no-print" onClick={() => { setIsAddVehicleOpen(false); setEditingVehicle(null); }}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '2rem' }}>{editingVehicle ? 'Edit Vehicle Specs' : 'Add New Vehicle'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label-premium">Vehicle Category</label>
                <select className="input-premium" value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value})}>
                  <option>Sedan</option>
                  <option>SUV</option>
                  <option>Tempo Traveller</option>
                  <option>Luxury Car</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label-premium">Model Name</label>
                <input type="text" className="input-premium" placeholder="e.g. Toyota Innova" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label-premium">Daily Rate (8h/80km)</label>
                  <input type="number" className="input-premium" value={newVehicle.rateDay} onChange={e => setNewVehicle({...newVehicle, rateDay: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label-premium">Extra KM Rate</label>
                  <input type="number" className="input-premium" value={newVehicle.rateKm} onChange={e => setNewVehicle({...newVehicle, rateKm: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label-premium">Seating Capacity</label>
                <input type="text" className="input-premium" placeholder="e.g. 6+1 Pax" value={newVehicle.capacity} onChange={e => setNewVehicle({...newVehicle, capacity: e.target.value})} />
              </div>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsAddVehicleOpen(false); setEditingVehicle(null); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSaveVehicle}>Save Vehicle</button>
            </div>
          </div>
        </div>
      )}

      {/* --- VEHICLE SCHEDULE MODAL --- */}
      {viewingSchedule && (
        <div className="modal-overlay no-print" onClick={() => setViewingSchedule(null)}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0 }}>Schedule: {viewingSchedule.model}</h2>
              <button className="btn btn-outline" onClick={() => setViewingSchedule(null)}>✕</button>
            </div>
            
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Guest</th>
                    <th>Duty Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.filter(s => s.vehicleType.includes(viewingSchedule.type)).length > 0 ? (
                    slips.filter(s => s.vehicleType.includes(viewingSchedule.type)).map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.serviceDate}</td>
                        <td>{s.guestName}</td>
                        <td><span className="badge badge-silver">{s.serviceType}</span></td>
                        <td><span className="badge badge-gold">Active</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                        No duties assigned to this vehicle type yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; padding: 0 !important; width: 100% !important; height: auto !important; position: static !important; }
          body { background: white !important; margin: 0; padding: 10mm; }
          .main-content { padding: 0 !important; overflow: visible !important; display: block !important; }
          html, body { height: auto !important; }
        }
        .print-only {
          display: none;
        }
        .animate-in {
          animation: slideUp 0.4s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hover-scale { transition: transform 0.2s; cursor: pointer; }
        .hover-scale:hover { transform: translateY(-5px); }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1rem;
        }
        .modal-content {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 2.5rem;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border);
        }
        .table th, .table td {
          padding: 1.25rem 1rem !important;
          vertical-align: middle;
        }
        .form-label-premium {
          display: block;
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .input-premium {
          width: 100%;
          padding: 1rem 1.25rem;
          background-color: ${theme === 'light' ? '#fff' : '#0f172a'};
          border: 1.5px solid var(--border);
          border-radius: 12px;
          color: var(--text-main);
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .input-premium:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--ring);
          transform: translateY(-1px);
        }
        .btn-action {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }
        .btn-view:hover { background: var(--primary); color: white; border-color: var(--primary); }
        .btn-print:hover { background: var(--success); color: white; border-color: var(--success); }
        .btn-delete:hover { background: var(--error); color: white; border-color: var(--error); }
        .fleet-stat-row {
          display: flex;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed var(--border);
          font-size: 0.9rem;
        }
      `}</style>
      {/* --- ADD/EDIT PACKAGE MODAL --- */}
      {(isAddPackageOpen || editingPackage) && (
        <div className="modal-overlay no-print" onClick={() => { setIsAddPackageOpen(false); setEditingPackage(null); }}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '2rem' }}>{editingPackage ? 'Edit Tour Package' : 'Create New Package'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label-premium">Package Name</label>
                <input type="text" className="input-premium" placeholder="e.g. Golden Triangle Tour" value={newPackage.name} onChange={e => setNewPackage({...newPackage, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label-premium">Duration</label>
                <input type="text" className="input-premium" placeholder="e.g. 3 Nights / 4 Days" value={newPackage.duration} onChange={e => setNewPackage({...newPackage, duration: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label-premium">Selling Price (₹)</label>
                  <input type="number" className="input-premium" value={newPackage.price} onChange={e => setNewPackage({...newPackage, price: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label-premium">Estimated Cost (₹)</label>
                  <input type="number" className="input-premium" value={newPackage.totalCost} onChange={e => setNewPackage({...newPackage, totalCost: parseInt(e.target.value)})} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsAddPackageOpen(false); setEditingPackage(null); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSavePackage}>Save Package</button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW PACKAGE MODAL --- */}
      {viewingPackage && (
        <div className="modal-overlay no-print" onClick={() => setViewingPackage(null)}>
          <div className="modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{viewingPackage.name}</h2>
            <div className="badge badge-platinum" style={{ marginBottom: '2rem' }}>Package ID: PKG-{viewingPackage.id.slice(-4)}</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <DetailRow label="Duration" value={viewingPackage.duration} />
              <DetailRow label="Selling Price" value={`₹${viewingPackage.price.toLocaleString()}`} />
              <DetailRow label="Operating Cost" value={viewingPackage.totalCost ? `₹${viewingPackage.totalCost.toLocaleString()}` : 'N/A'} />
              <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 800, marginBottom: '0.5rem' }}>ESTIMATED PROFIT MARGIN</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--success)' }}>
                   {viewingPackage.totalCost ? `${Math.round(((viewingPackage.price - viewingPackage.totalCost) / viewingPackage.price) * 100)}%` : '--'}
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Net Profit: ₹{(viewingPackage.price - (viewingPackage.totalCost || 0)).toLocaleString()}</div>
              </div>
            </div>
            
            <div style={{ marginTop: '2.5rem', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setViewingPackage(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function DutySlipComponent({ title, data }: { title: string, data: any }) {
  return (
    <div style={{ border: '2px solid #000', padding: '25px', borderRadius: '8px', color: '#000', fontFamily: 'serif', width: '100%', boxSizing: 'border-box', background: '#fff', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '15px' }}>
        <div style={{ width: '70%' }}>
          <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>{(data?.hotelProperty || 'Hotel Grand Godwin').toUpperCase()}</h1>
          <p style={{ margin: '5px 0', fontSize: '12px' }}>Aarakshan Road, Paharganj, New Delhi-110055</p>
          <p style={{ margin: '2px 0', fontSize: '12px' }}>Ph: +91 11 4754 5454 | Email: info@godwinhotels.com</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ border: '2px solid #000', padding: '5px 15px', fontWeight: 800, marginBottom: '5px' }}>DUTY SLIP</div>
          <div style={{ fontSize: '12px', fontWeight: 800 }}>{title}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <tbody>
              <tr><td style={{ width: '120px', padding: '5px 0' }}><strong>Slip Number:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.serialNo}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Service Date:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.serviceDate}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Tour Number:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.tourNo}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Service Type:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.serviceType}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <tbody>
              <tr><td style={{ width: '120px', padding: '5px 0' }}><strong>Vehicle No:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.vehicleNo}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Vehicle Type:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.vehicleType}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Driver Name:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.driverName}</td></tr>
              <tr><td style={{ padding: '5px 0' }}><strong>Assigned By:</strong></td><td style={{ borderBottom: '1px dotted #000' }}>{data.assignedBy}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ border: '1px solid #000', padding: '15px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
          <div>
            <p style={{ margin: '10px 0', borderBottom: '1px dotted #000' }}><strong>Guest Name:</strong> {data.guestName}</p>
            <p style={{ margin: '10px 0', borderBottom: '1px dotted #000' }}><strong>Room No:</strong> {data.roomNo}</p>
            <p style={{ margin: '10px 0', borderBottom: '1px dotted #000' }}><strong>Reporting:</strong> {data.reportingPlace}</p>
            <p style={{ margin: '10px 0', borderBottom: '1px dotted #000' }}><strong>Destination:</strong> {data.dropPlace}</p>
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textAlign: 'center', background: '#000', color: '#fff' }}>LOG METER (FOR OFFICE USE)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
              <div>Opening KM: ________</div>
              <div>Start Time: ________</div>
              <div>Closing KM: ________</div>
              <div>End Time: ________</div>
              <div>Total KM: ________</div>
              <div>Total Time: ________</div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px' }}>
              Parking/Toll: ₹_________
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Instructions:</strong> <span style={{ fontSize: '12px' }}>{data.remarks || 'Standard route instructions apply.'}</span>
      </div>

      <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <div style={{ textAlign: 'center', width: '150px' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>GUEST SIGNATURE</div>
        </div>
        <div style={{ textAlign: 'center', width: '150px' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>DRIVER SIGNATURE</div>
        </div>
        <div style={{ textAlign: 'center', width: '150px' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>FOR GODWIN HOTELS</div>
        </div>
      </div>
    </div>
  );
}
