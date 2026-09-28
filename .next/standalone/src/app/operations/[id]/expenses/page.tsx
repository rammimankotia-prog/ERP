'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ExpenseLoggingPage() {
  const { theme } = useTheme();
  const { id } = useParams();
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch tour details and existing expenses
    const fetchData = async () => {
      try {
        const opRes = await fetch('/api/operations');
        const allTours = await opRes.json();
        const currentTour = allTours.find((t: any) => t.id === id);
        
        if (currentTour) {
          setTour(currentTour);
          
          // Calculate number of days
          const start = new Date(currentTour.startDate);
          const end = new Date(currentTour.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          // Initialize daily expenses
          const existing = currentTour.expense?.dailyExpenses || [];
          const initial = Array.from({ length: diffDays }, (_, i) => {
            const dayNum = i + 1;
            const found = existing.find((e: any) => e.dayNumber === dayNum);
            return found || {
              dayNumber: dayNum,
              hotelExpense: 0,
              fleetExpense: 0,
              monumentExpense: 0,
              otherExpense: 0,
              description: '',
            };
          });
          setDailyExpenses(initial);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleInputChange = (index: number, field: string, value: any) => {
    const updated = [...dailyExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setDailyExpenses(updated);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationTourId: id,
          managerId: 'ajay-123', // Mocked ID
          dailyExpenses,
        }),
      });

      if (res.ok) {
        alert('Expenses submitted successfully!');
        router.push('/operations');
      } else {
        alert('Failed to save expenses.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving expenses.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="main-content">Loading...</div>;
  if (!tour) return <div className="main-content">Tour not found.</div>;

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <Link href="/operations" style={{ textDecoration: 'none', color: '#3b82f6', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            ← Back to Operations
          </Link>
          <h1>Log Expenses: {tour.tourPackage?.name || 'Custom Tour'}</h1>
          <p>Recording expenses for {tour.quotation.guestName} ({tour.quotation.quoteNumber})</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSubmit}
          disabled={saving}
          style={{ padding: '0.75rem 2rem' }}
        >
          {saving ? 'Saving...' : 'Submit Expenses'}
        </button>
      </header>

      {tour.expense?.status === 'QUESTIONED' && (
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', marginBottom: '1.5rem', padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>⚠️ Admin Question:</h4>
          <p style={{ margin: 0 }}>{tour.expense.adminRemark}</p>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', backgroundColor: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
              <th style={{ padding: '1rem' }}>Day</th>
              <th style={{ padding: '1rem' }}>Hotel Exp.</th>
              <th style={{ padding: '1rem' }}>Fleet Exp.</th>
              <th style={{ padding: '1rem' }}>Monument Exp.</th>
              <th style={{ padding: '1rem' }}>Other Exp.</th>
              <th style={{ padding: '1rem' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {dailyExpenses.map((day, index) => (
              <tr key={index} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                <td style={{ padding: '1rem', fontWeight: 700 }}>Day {day.dayNumber}</td>
                <td style={{ padding: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={day.hotelExpense} 
                    onChange={(e) => handleInputChange(index, 'hotelExpense', e.target.value)}
                    className="input-field"
                  />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={day.fleetExpense} 
                    onChange={(e) => handleInputChange(index, 'fleetExpense', e.target.value)}
                    className="input-field"
                  />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={day.monumentExpense} 
                    onChange={(e) => handleInputChange(index, 'monumentExpense', e.target.value)}
                    className="input-field"
                  />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={day.otherExpense} 
                    onChange={(e) => handleInputChange(index, 'otherExpense', e.target.value)}
                    className="input-field"
                  />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="E.g. Lunch at Taj"
                    value={day.description || ''} 
                    onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                    className="input-field"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 800, background: theme === 'light' ? '#f8fafc' : '#1e293b' }}>
              <td style={{ padding: '1rem' }}>Total</td>
              <td style={{ padding: '1rem' }}>₹ {dailyExpenses.reduce((sum, d) => sum + (parseFloat(d.hotelExpense) || 0), 0)}</td>
              <td style={{ padding: '1rem' }}>₹ {dailyExpenses.reduce((sum, d) => sum + (parseFloat(d.fleetExpense) || 0), 0)}</td>
              <td style={{ padding: '1rem' }}>₹ {dailyExpenses.reduce((sum, d) => sum + (parseFloat(d.monumentExpense) || 0), 0)}</td>
              <td style={{ padding: '1rem' }}>₹ {dailyExpenses.reduce((sum, d) => sum + (parseFloat(d.otherExpense) || 0), 0)}</td>
              <td style={{ padding: '1rem' }}>
                ₹ {dailyExpenses.reduce((sum, d) => 
                  sum + 
                  (parseFloat(d.hotelExpense) || 0) + 
                  (parseFloat(d.fleetExpense) || 0) + 
                  (parseFloat(d.monumentExpense) || 0) + 
                  (parseFloat(d.otherExpense) || 0), 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1px solid ${theme === 'light' ? '#e2e8f0' : '#334155'};
          background: ${theme === 'light' ? 'white' : '#0f172a'};
          color: ${theme === 'light' ? '#1e293b' : 'white'};
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #3b82f6;
        }
      `}</style>
    </main>
  );
}
