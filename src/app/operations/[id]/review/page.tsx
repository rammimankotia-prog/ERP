'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ExpenseReviewPage() {
  const { theme } = useTheme();
  const { id } = useParams();
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const opRes = await fetch('/api/operations');
        const allTours = await opRes.json();
        const currentTour = allTours.find((t: any) => t.id === id);
        if (currentTour) setTour(currentTour);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAction = async (status: string) => {
    if (status === 'QUESTIONED' && !remark) {
      alert('Please enter a remark to raise a question.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tour.expense.id,
          status,
          adminRemark: status === 'QUESTIONED' ? remark : tour.expense.adminRemark,
        }),
      });

      if (res.ok) {
        alert(`Expense ${status.toLowerCase()} successfully!`);
        router.push('/operations');
      } else {
        alert('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="main-content">Loading...</div>;
  if (!tour || !tour.expense) return <div className="main-content">No expenses found for this tour.</div>;

  return (
    <main className="main-content">
      <header className="header">
        <div>
          <Link href="/operations" style={{ textDecoration: 'none', color: '#3b82f6', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            ← Back to Operations
          </Link>
          <h1>Review Expenses: {tour.tourPackage?.name || 'Custom Tour'}</h1>
          <p>Submitted by: Ajay | Total: ₹ {tour.expense.dailyExpenses.reduce((sum: number, d: any) => sum + d.hotelExpense + d.fleetExpense + d.monumentExpense + d.otherExpense, 0)}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => handleAction('APPROVED')}
            disabled={submitting}
            style={{ padding: '0.75rem 2rem', background: '#22c55e' }}
          >
            Approve All
          </button>
        </div>
      </header>

      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
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
            {tour.expense.dailyExpenses.map((day: any, index: number) => (
              <tr key={index} style={{ borderBottom: theme === 'light' ? '1px solid #f1f5f9' : '1px solid #1e293b' }}>
                <td style={{ padding: '1rem', fontWeight: 700 }}>Day {day.dayNumber}</td>
                <td style={{ padding: '1rem' }}>₹ {day.hotelExpense}</td>
                <td style={{ padding: '1rem' }}>₹ {day.fleetExpense}</td>
                <td style={{ padding: '1rem' }}>₹ {day.monumentExpense}</td>
                <td style={{ padding: '1rem' }}>₹ {day.otherExpense}</td>
                <td style={{ padding: '1rem' }}>{day.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Raise a Question / Provide Feedback</h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>If something looks wrong, enter your remark below and click "Raise Question". The manager will see this and can reply.</p>
        <textarea 
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Enter your question or remark here..."
          style={{ 
            width: '100%', 
            minHeight: '100px', 
            padding: '1rem', 
            borderRadius: '12px', 
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
            background: theme === 'light' ? 'white' : '#0f172a',
            color: theme === 'light' ? '#1e293b' : 'white',
            marginBottom: '1rem',
            outline: 'none'
          }}
        />
        <button 
          className="btn btn-outline" 
          onClick={() => handleAction('QUESTIONED')}
          disabled={submitting}
          style={{ borderColor: '#ef4444', color: '#ef4444' }}
        >
          Raise Question
        </button>
      </div>
    </main>
  );
}
