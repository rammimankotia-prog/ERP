'use client';

import { useState, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';

const RATE_PLANS = [
  { id: 'ep', name: 'EP', type: 'UPDATE RATE' },
  { id: 'cp', name: 'CP', type: 'UPDATE RATE' },
  { id: 'map', name: 'MAP', type: 'NON EDITABLE' },
];

const PROPERTIES = ['Hotel Grand Godwin', 'Godwin Deluxe'];

const ALL_ROOM_DATA = [
  // Grand Godwin
  { id: 'gg-deluxe', name: 'Deluxe Room', inventory: 16, property: 'Hotel Grand Godwin' },
  { id: 'gg-executive', name: 'Executive Room', inventory: 14, property: 'Hotel Grand Godwin' },
  { id: 'gg-studio', name: 'Studio Room', inventory: 4, property: 'Hotel Grand Godwin' },
  // Godwin Deluxe
  { id: 'gd-deluxe', name: 'Deluxe Room', inventory: 12, property: 'Godwin Deluxe' },
  { id: 'gd-premier', name: 'Premier Room', inventory: 18, property: 'Godwin Deluxe' },
  { id: 'gd-suite', name: 'Executive Suite', inventory: 6, property: 'Godwin Deluxe' },
];

export default function InventoryPage() {
  const { theme } = useTheme();
  const [selectedProperty, setSelectedProperty] = useState('Hotel Grand Godwin');
  const [currentDate, setCurrentDate] = useState(new Date('2026-05-04'));
  const [expandedRooms, setExpandedRooms] = useState<string[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  const shiftDate = (days: number) => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const roomData = useMemo(() => {
    return ALL_ROOM_DATA.filter(r => r.property === selectedProperty);
  }, [selectedProperty]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      return date;
    });
  }, [currentDate]);

  const formatDate = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const d = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return { day, d, month };
  };

  const toggleRoom = (id: string) => {
    setExpandedRooms(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (expandedRooms.length === roomData.length) {
      setExpandedRooms([]);
    } else {
      setExpandedRooms(roomData.map(r => r.id));
    }
  };

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f5f7fa' : '#0a0f1d', minHeight: '100vh', padding: '2rem', position: 'relative' }}>
      <div className="inventory-container" style={{ background: theme === 'light' ? 'white' : '#0f172a', borderRadius: '8px', padding: '1.5rem', boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.3)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
        
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="outline-btn">CREATE SUPER PACKAGE <span>▶</span></button>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#64748b' }}>i</div>
          </div>

          {/* Property Toggle */}
          <div style={{ 
            display: 'flex', 
            background: theme === 'light' ? '#f1f5f9' : '#1e293b', 
            padding: '4px', 
            borderRadius: '12px', 
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
          }}>
            {PROPERTIES.map(prop => (
              <button
                key={prop}
                onClick={() => { setSelectedProperty(prop); setExpandedRooms([]); }}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedProperty === prop ? (theme === 'light' ? 'white' : '#334155') : 'transparent',
                  color: selectedProperty === prop ? (theme === 'light' ? '#1e293b' : '#f8fafc') : (theme === 'light' ? '#64748b' : '#94a3b8'),
                  boxShadow: selectedProperty === prop ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {prop}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button 
                className="outline-btn"
                onClick={() => setShowBulkMenu(!showBulkMenu)}
              >
                BULK UPDATE <span>▶</span>
              </button>
              {showBulkMenu && (
                <div style={dropdownStyle(theme)}>
                  <div className="dropdown-item" onClick={() => { setShowUpdateModal(true); setShowBulkMenu(false); }}>Inventory</div>
                  <div className="dropdown-item">Rates</div>
                  <div className="dropdown-item">Restrictions</div>
                </div>
              )}
            </div>
            
            <div className="date-nav" style={{ display: 'flex', border: '1px solid #3b82f6', borderRadius: '6px', overflow: 'hidden' }}>
              <button onClick={() => shiftDate(-7)} style={{ ...navBtnStyle, background: theme === 'light' ? 'white' : '#1e293b' }}>{'<'}</button>
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)}
                style={{ ...navBtnStyle, background: theme === 'light' ? 'white' : '#1e293b', borderLeft: '1px solid #3b82f6', borderRight: '1px solid #3b82f6', padding: '0 0.75rem' }}
              >
                📅
              </button>
              <button onClick={() => shiftDate(7)} style={{ ...navBtnStyle, background: theme === 'light' ? 'white' : '#1e293b' }}>{'>'}</button>
              
              {showDatePicker && (
                <div style={calendarPopoverStyle}>
                  <DatePicker 
                    theme={theme}
                    selectedDate={currentDate} 
                    onSelect={(date) => { setCurrentDate(date); setShowDatePicker(false); }} 
                    onClose={() => setShowDatePicker(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <button 
          onClick={toggleAll}
          style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}
        >
          <span style={{ background: '#3b82f6', color: 'white', padding: '2px 4px', borderRadius: '2px', fontSize: '0.6rem' }}>
            {expandedRooms.length === roomData.length ? '-' : '+'}
          </span>
          {expandedRooms.length === roomData.length ? 'COLLAPSE ALL' : 'EXPAND ALL ROOMS & RATEPLANS'}
        </button>

        {/* Inventory Grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
            <thead>
              <tr style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
                <th style={{ width: '300px', padding: '1rem 1.5rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', textAlign: 'left', background: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>
                    <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>🛏️</div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rooms & Rates</span>
                  </div>
                </th>
                {days.map((date, idx) => {
                  const { day, d, month } = formatDate(date);
                  return (
                    <th key={idx} style={{ padding: '0.5rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', textAlign: 'center', width: '120px', background: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
                      <div style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 800 }}>{day}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme === 'light' ? '#475569' : '#f1f5f9', lineHeight: 1 }}>{d}</div>
                      <div style={{ color: theme === 'light' ? '#94a3b8' : '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>{month}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomData.map((room) => (
                <RoomRow 
                  key={room.id} 
                  room={room} 
                  days={days} 
                  theme={theme}
                  isExpanded={expandedRooms.includes(room.id)} 
                  onToggle={() => toggleRoom(room.id)}
                  onUpdateClick={() => { setSelectedRoom(room); setShowUpdateModal(true); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Inventory Modal */}
      {showUpdateModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, background: theme === 'light' ? 'white' : '#0f172a', color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Update Inventory - {selectedRoom?.name || 'Room'}</h2>
              <button onClick={() => setShowUpdateModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: theme === 'light' ? '#94a3b8' : '#64748b' }}>×</button>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Select stay dates and update room inventory and restrictions</p>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                Select Stay Dates <span style={infoIconStyle(theme)}>?</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ ...modalInputWrapper, background: theme === 'light' ? 'white' : '#1e293b', borderColor: theme === 'light' ? '#cbd5e1' : '#334155' }}>
                  <input type="text" placeholder="Add Dates/Date Range" style={{ ...modalInputStyle, background: 'transparent', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} />
                  <span>📅</span>
                </div>
                <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>+ Add Another Stay Date</span>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                Room Inventory <span style={infoIconStyle(theme)}>?</span>
              </label>
              <div>
                <p style={{ fontSize: '0.8rem', color: theme === 'light' ? '#475569' : '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Number of rooms to sell</p>
                <input type="text" placeholder="Enter" style={{ ...modalInputStyle, width: '200px', background: theme === 'light' ? 'white' : '#1e293b', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} />
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Inventory & Restrictions</h3>
                <span>︿</span>
              </div>
              <div style={{ display: 'flex', gap: '3rem' }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Minimum Length of Stay</p>
                  <input type="text" placeholder="Enter minimum stay" style={{ ...modalInputStyle, width: '250px', background: theme === 'light' ? 'white' : '#1e293b', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>Block/Unblock Inventory</p>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type="radio" name="block" /> Block
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type="radio" name="block" /> Unblock
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
              <button onClick={() => setShowUpdateModal(false)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
              <button style={{ background: '#e45d25', color: 'white', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .outline-btn {
          background: white;
          border: 1px solid #3b82f6;
          color: #3b82f6;
          padding: 0.6rem 1.2rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .outline-btn span {
          font-size: 0.6rem;
        }
        .outline-btn:hover {
          background: #f0f7ff;
        }
        .dropdown-item {
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 700;
          color: ${theme === 'light' ? '#1e293b' : '#f1f5f9'};
          cursor: pointer;
          transition: background 0.2s;
        }
        .dropdown-item:hover {
          background: ${theme === 'light' ? '#f8fafc' : '#1e293b'};
        }
      `}</style>
    </main>
  );
}

function RoomRow({ room, days, isExpanded, onToggle, onUpdateClick, theme }: any) {
  return (
    <>
      <tr style={{ background: isExpanded ? (theme === 'light' ? '#f8faff' : '#1e293b') : (theme === 'light' ? 'white' : '#0f172a') }}>
        <td style={{ padding: '1.25rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={onToggle} style={isExpanded ? squareBtnStyleActive(theme) : squareBtnStyle(theme)}>
                {isExpanded ? '-' : '+'}
              </button>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme === 'light' ? '#334155' : '#f1f5f9' }}>{room.name}</span>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>❯</div>
          </div>
        </td>
        {days.map((_: any, dIdx: number) => (
          <td key={dIdx} style={{ padding: '0.5rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ 
                border: '1px solid #dc3545', 
                borderRadius: '6px', 
                width: '80px', 
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme === 'light' ? 'white' : '#0a0f1d',
                cursor: 'pointer'
              }} onClick={onUpdateClick}>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#dc3545', letterSpacing: '-0.05em' }}>{room.inventory}</span>
              </div>
              <span style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700, marginTop: '2px', cursor: 'pointer' }} onClick={onUpdateClick}>Add rates</span>
            </div>
          </td>
        ))}
      </tr>

      {isExpanded && RATE_PLANS.map((plan) => (
        <tr key={plan.id}>
          <td style={{ padding: 0, border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
            <div style={{ padding: '1rem 1.5rem', paddingLeft: '3rem', borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.75rem' }}>-</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: theme === 'light' ? '#334155' : '#cbd5e1' }}>{plan.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>
                  2 👤 <br/> <span style={{fontSize: '0.6rem'}}>Base Rate</span>
                </div>
              </div>
              <div style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 800, marginTop: '0.5rem' }}>{plan.type}</div>
              <div style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700, marginTop: '1rem' }}>Extra Rates & Restrictions</div>
            </div>
          </td>
          {days.map((_: any, dIdx: number) => (
            <td key={dIdx} style={{ padding: '0.5rem', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', verticalAlign: 'top' }}>
              {plan.id === 'map' ? (
                 <div style={{ width: '80px', height: '35px', background: theme === 'light' ? '#f1f5f9' : '#1e293b', borderRadius: '4px', margin: '0 auto' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="text" style={{ ...rateInputStyle(theme) }} />
                  <div style={warningBar(theme)}>Please note, you have not added your Base Adult Rate...</div>
                </div>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const dropdownStyle = (theme: string): any => ({
  position: 'absolute',
  top: '100%',
  right: 0,
  background: theme === 'light' ? 'white' : '#1e293b',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  borderRadius: '8px',
  border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
  zIndex: 100,
  minWidth: '200px',
  marginTop: '0.5rem',
  padding: '0.5rem 0'
});

const modalOverlayStyle: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalContentStyle = (theme: string): any => ({
  background: theme === 'light' ? 'white' : '#0f172a',
  width: '800px',
  borderRadius: '16px',
  padding: '2.5rem',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  border: theme === 'light' ? 'none' : '1px solid #1e293b',
  position: 'relative'
});

const modalInputWrapper = (theme: string): any => ({
  display: 'flex',
  alignItems: 'center',
  border: theme === 'light' ? '1.5px solid #cbd5e1' : '1.5px solid #334155',
  borderRadius: '8px',
  padding: '0.5rem 1rem',
  width: '350px',
  gap: '0.5rem',
  background: theme === 'light' ? 'white' : '#1e293b'
});

const modalInputStyle = (theme: string): any => ({
  border: 'none',
  outline: 'none',
  flex: 1,
  fontSize: '0.9rem',
  background: 'transparent',
  color: theme === 'light' ? '#1e293b' : '#f1f5f9'
});

const infoIconStyle = (theme: string): any => ({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  border: theme === 'light' ? '1.5px solid #cbd5e1' : '1.5px solid #334155',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  color: theme === 'light' ? '#64748b' : '#94a3b8',
  fontWeight: 800
});

const rateInputStyle = (theme: string): any => ({
  width: '80px',
  height: '35px',
  border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155',
  borderRadius: '4px',
  outline: 'none',
  textAlign: 'center',
  fontSize: '0.9rem',
  background: theme === 'light' ? 'white' : '#1e293b',
  color: theme === 'light' ? '#1e293b' : '#f1f5f9'
});

const warningBar = (theme: string): any => ({
  background: theme === 'light' ? '#fef2f2' : 'rgba(239, 68, 68, 0.1)',
  color: '#ef4444',
  fontSize: '0.5rem',
  padding: '4px',
  borderRadius: '2px',
  textAlign: 'left',
  lineHeight: 1.2,
  width: '100px',
  fontWeight: 600,
  borderLeft: '2px solid #ef4444'
});

const navBtnStyle = (theme: string) => ({
  background: theme === 'light' ? 'white' : '#1e293b',
  border: 'none',
  color: '#3b82f6',
  padding: '0.4rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 700,
  borderRadius: '6px',
  transition: 'all 0.2s'
});

const squareBtnStyle = (theme: string) => ({
  width: '20px',
  height: '20px',
  borderRadius: '4px',
  border: '1px solid #3b82f6',
  background: '#3b82f6',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 800
});

const squareBtnStyleActive = (theme: string) => ({
  ...squareBtnStyle(theme),
  background: theme === 'light' ? 'white' : '#1e293b',
  color: '#3b82f6'
});

function DatePicker({ selectedDate, onSelect, onClose, theme }: { selectedDate: Date, onSelect: (date: Date) => void, onClose: () => void, theme: string }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  
  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();
  
  const daysInMonth = new Date(year, viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(year, viewDate.getMonth(), 1).getDay(); // 0 is Sun
  // Adjust to Mon as first day (Mon=0, ..., Sun=6)
  const offset = (firstDay + 6) % 7;

  const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: offset }, (_, i) => i);

  const isToday = (d: number) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
  };

  const isSelected = (d: number) => {
    return selectedDate.getDate() === d && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
  };

  const changeMonth = (delta: number) => {
    const next = new Date(viewDate);
    next.setMonth(viewDate.getMonth() + delta);
    setViewDate(next);
  };

  return (
    <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '1.5rem', borderRadius: '12px', width: '320px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => changeMonth(-1)} style={{ ...calNavBtn(theme) }}>{'<'}</button>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1rem', fontWeight: 700, color: theme === 'light' ? '#334155' : '#f1f5f9' }}>
          <span>{monthName} ⌵</span>
          <span>{year} ⌵</span>
        </div>
        <button onClick={() => changeMonth(1)} style={{ ...calNavBtn(theme) }}>{'>'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>{d}</div>
        ))}
        {blanks.map(i => <div key={`b-${i}`} />)}
        {daysArr.map(d => (
          <div 
            key={d} 
            onClick={() => onSelect(new Date(year, viewDate.getMonth(), d))}
            style={{
              padding: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '50%',
              background: isSelected(d) ? '#3b82f6' : 'transparent',
              color: isSelected(d) ? 'white' : (theme === 'light' ? '#1e293b' : '#cbd5e1'),
              transition: 'all 0.2s',
              border: isToday(d) ? '1px solid #3b82f6' : 'none'
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${theme === 'light' ? '#f1f5f9' : '#1e293b'}`, marginTop: '1.5rem', paddingTop: '1rem', textAlign: 'right' }}>
        <button 
          onClick={() => onSelect(new Date())}
          style={{ background: '#e45d25', color: 'white', border: 'none', padding: '0.6rem 2rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', width: '100%' }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

const calendarPopoverStyle: any = {
  position: 'absolute',
  top: '100%',
  right: 0,
  zIndex: 1000,
  marginTop: '0.5rem'
};

const calNavBtn = (theme: string) => ({
  border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
  background: theme === 'light' ? 'white' : '#1e293b',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontWeight: 800,
  color: '#3b82f6'
});
