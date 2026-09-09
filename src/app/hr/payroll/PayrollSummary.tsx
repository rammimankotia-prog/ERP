'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type PayrollRecord = {
  employeeId: string
  employeeName: string
  designation: string
  department: string
  branchId?: string
  branchName?: string
  branchPrefix?: string
  baseSalary: number
  presentDays: number
  absentDays: number
  lateDays: number
  halfDays: number
  leaveDays: number
  daysInMonth?: number
  payableDays: number
  totalMinutes: number
  overtimeMinutes: number
  overtimeRate?: number
  overtimeAmount: number
  deductions: number
  grossEarned?: number
  netSalary: number
  paymentStatus: 'PAID' | 'PROCESSED' | 'PENDING'
  paymentDate?: string | null
}

function formatMinutes(mins: number) {
  if (!mins) return '0h'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

function downloadCSV(data: PayrollRecord[], month: string, year: number) {
  const headers = [
    'Employee ID',
    'Name',
    'Designation',
    'Department',
    'Branch',
    'Base Salary (INR)',
    'Present Days',
    'Absent Days',
    'Late Days',
    'Paid Leave Days',
    'Payable Days',
    'Total Hours',
    'Overtime Hours',
    'OT Pay (INR)',
    'Deductions (INR)',
    'Net Salary (INR)',
    'Payment Status'
  ]

  const rows = data.map(r => [
    r.employeeId,
    `"${r.employeeName}"`,
    `"${r.designation}"`,
    `"${r.department}"`,
    `"${r.branchName || (r.branchPrefix === 'GD' ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin')}"`,
    r.baseSalary,
    r.presentDays,
    r.absentDays,
    r.lateDays,
    r.leaveDays,
    r.payableDays,
    formatMinutes(r.totalMinutes),
    formatMinutes(r.overtimeMinutes),
    r.overtimeAmount,
    r.deductions,
    r.netSalary,
    r.paymentStatus
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Godwin-Payroll-Summary-${month}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PayrollSummary() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const fetchPayroll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/payroll/summary?month=${month}&year=${year}&branch=${branchFilter}&department=${deptFilter}`)
      const data = await res.json()
      if (data.summary && Array.isArray(data.summary)) {
        setRecords(data.summary)
      } else {
        setRecords([])
      }
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [month, year, branchFilter, deptFilter])

  useEffect(() => {
    fetchPayroll()
  }, [fetchPayroll])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // Toggle status locally and show feedback
  const handleToggleStatus = (employeeId: string) => {
    setRecords(prev => prev.map(r => {
      if (r.employeeId !== employeeId) return r
      const nextStatus = r.paymentStatus === 'PAID' ? 'PENDING' : r.paymentStatus === 'PENDING' ? 'PROCESSED' : 'PAID'
      return { ...r, paymentStatus: nextStatus }
    }))
    showToast(`Updated payment status for ${employeeId}`)
  }

  // Mark all as paid
  const handleMarkAllPaid = () => {
    setRecords(prev => prev.map(r => ({ ...r, paymentStatus: 'PAID' })))
    showToast('All employees marked as PAID for this pay period')
  }

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records
    const q = searchQuery.toLowerCase()
    return records.filter(r =>
      r.employeeName.toLowerCase().includes(q) ||
      r.employeeId.toLowerCase().includes(q) ||
      r.designation.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    )
  }, [records, searchQuery])

  // Calculated totals
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, r) => ({
      baseSalary: acc.baseSalary + (r.baseSalary || 0),
      netSalary: acc.netSalary + (r.netSalary || 0),
      present: acc.present + r.presentDays,
      absent: acc.absent + r.absentDays,
      late: acc.late + r.lateDays,
      totalMins: acc.totalMins + r.totalMinutes,
      otMins: acc.otMins + r.overtimeMinutes,
      otAmount: acc.otAmount + (r.overtimeAmount || 0),
      deductions: acc.deductions + (r.deductions || 0),
      paidCount: acc.paidCount + (r.paymentStatus === 'PAID' ? 1 : 0),
      processedCount: acc.processedCount + (r.paymentStatus === 'PROCESSED' ? 1 : 0),
      pendingCount: acc.pendingCount + (r.paymentStatus === 'PENDING' ? 1 : 0),
    }), {
      baseSalary: 0,
      netSalary: 0,
      present: 0,
      absent: 0,
      late: 0,
      totalMins: 0,
      otMins: 0,
      otAmount: 0,
      deductions: 0,
      paidCount: 0,
      processedCount: 0,
      pendingCount: 0
    })
  }, [filteredRecords])

  const monthName = MONTHS[month - 1]
  const fullMonthName = FULL_MONTHS[month - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#10b981',
          border: '1px solid #10b981',
          padding: '0.85rem 1.4rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '110px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>PAY MONTH</label>
            <select className="form-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '100px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>YEAR</label>
            <select className="form-input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>HOTEL BRANCH</label>
            <select className="form-input" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">All Branches (GG + GD)</option>
              <option value="GG">Hotel Grand Godwin (GG)</option>
              <option value="GD">Hotel Godwin Deluxe (GD)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>DEPARTMENT</label>
            <select className="form-input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="ALL">All Departments</option>
              <option value="Operations">Operations</option>
              <option value="Front Office">Front Office</option>
              <option value="Housekeeping">Housekeeping</option>
              <option value="Security">Security</option>
              <option value="Accounts">Accounts</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>SEARCH EMPLOYEE</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search name or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={fetchPayroll} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {loading ? '⏳ Calculating...' : '🔄 Recalculate'}
          </button>
          <button className="btn btn-outline" onClick={() => downloadCSV(filteredRecords, monthName, year)} disabled={filteredRecords.length === 0}>
            ⬇️ Export CSV
          </button>
          <button className="btn btn-outline" onClick={() => window.print()} title="Print Summary Table">
            🖨️ Print
          </button>
          <button
            className="btn btn-outline"
            onClick={handleMarkAllPaid}
            disabled={filteredRecords.length === 0}
            style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
          >
            ⚡ Mark All Paid
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* Total Net Payroll */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.04))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TOTAL NET PAYROLL
            </span>
            <span style={{ fontSize: '1.25rem' }}>💰</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1.1 }}>
            {formatCurrency(totals.netSalary)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Base Cost: {formatCurrency(totals.baseSalary)}
          </div>
        </div>

        {/* Total Overtime */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.04))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OVERTIME PAYOUT (1.5X)
            </span>
            <span style={{ fontSize: '1.25rem' }}>⏱️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1.1 }}>
            +{formatCurrency(totals.otAmount)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Total OT: {formatMinutes(totals.otMins)}
          </div>
        </div>

        {/* Total Deductions / LOP */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.03))',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              DEDUCTIONS & LOP
            </span>
            <span style={{ fontSize: '1.25rem' }}>📉</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', lineHeight: 1.1 }}>
            -{formatCurrency(totals.deductions)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Absent Days: {totals.absent}d • Late: {totals.late}
          </div>
        </div>

        {/* Disbursement Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PAYMENT DISBURSEMENT
            </span>
            <span style={{ fontSize: '1.25rem' }}>💳</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>
              {totals.paidCount}/{filteredRecords.length}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Disbursed</span>
          </div>
          {/* Progress Bar */}
          <div style={{ height: '6px', borderRadius: '99px', background: 'var(--bg-main)', overflow: 'hidden', marginTop: '0.2rem' }}>
            <div style={{
              height: '100%',
              borderRadius: '99px',
              background: '#10b981',
              width: `${filteredRecords.length > 0 ? (totals.paidCount / filteredRecords.length) * 100 : 0}%`,
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            {totals.processedCount} Processed • {totals.pendingCount} Pending
          </div>
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }} id="printable-payroll">
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              Staff Payroll Summary Sheet
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {fullMonthName} {year} • Showing {filteredRecords.length} employees across {branchFilter === 'ALL' ? 'Grand Godwin & Godwin Deluxe' : branchFilter}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 700 }}>
              ● {totals.paidCount} Paid
            </span>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontWeight: 700 }}>
              ● {totals.processedCount} Processed
            </span>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', fontWeight: 700 }}>
              ● {totals.pendingCount} Pending
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                {[
                  'Employee',
                  'Branch & Dept',
                  'Basic Salary',
                  'Attendance & Days',
                  'Total Working',
                  'Overtime (1.5x)',
                  'Deductions (LOP)',
                  'Net Payable',
                  'Status',
                  'Actions'
                ].map(h => (
                  <th key={h} style={{
                    padding: '0.875rem 1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    ⏳ Calculating payroll records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payroll data found for the selected month and filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(r => (
                  <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s ease' }}>
                    {/* Employee info */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: r.branchPrefix === 'GD' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}>
                          {r.employeeName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {r.employeeName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {r.employeeId} • {r.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Branch & Dept */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: r.branchPrefix === 'GD' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: r.branchPrefix === 'GD' ? '#fbbf24' : '#60a5fa',
                          width: 'fit-content'
                        }}>
                          {r.branchPrefix === 'GD' ? 'Godwin Deluxe (GD)' : 'Grand Godwin (GG)'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {r.department}
                        </span>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {formatCurrency(r.baseSalary)}
                    </td>

                    {/* Attendance breakdown */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)' }} title="Present Days">
                            P: {r.presentDays}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: r.absentDays > 0 ? 'var(--error)' : 'var(--text-muted)' }} title="Absent Days">
                            A: {r.absentDays}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }} title="Paid Leave Days">
                            L: {r.leaveDays}
                          </span>
                          {r.lateDays > 0 && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--warning)' }} title="Late Arrivals">
                              Late: {r.lateDays}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Payable: <strong>{r.payableDays}d</strong>
                        </div>
                      </div>
                    </td>

                    {/* Working Hours */}
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatMinutes(r.totalMinutes)}
                    </td>

                    {/* Overtime */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {r.overtimeAmount > 0 ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.85rem' }}>
                            +{formatCurrency(r.overtimeAmount)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {formatMinutes(r.overtimeMinutes)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    {/* Deductions */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {r.deductions > 0 ? (
                        <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.85rem' }}>
                          -{formatCurrency(r.deductions)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹0</span>
                      )}
                    </td>

                    {/* Net Payable */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                        {formatCurrency(r.netSalary)}
                      </span>
                    </td>

                    {/* Payment Status Pill (Clickable) */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => handleToggleStatus(r.employeeId)}
                        title="Click to toggle status"
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '99px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: 'none',
                          background:
                            r.paymentStatus === 'PAID'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : r.paymentStatus === 'PROCESSED'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color:
                            r.paymentStatus === 'PAID'
                              ? '#10b981'
                              : r.paymentStatus === 'PROCESSED'
                              ? '#60a5fa'
                              : '#fbbf24',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{r.paymentStatus === 'PAID' ? '✓' : r.paymentStatus === 'PROCESSED' ? '⚡' : '⏳'}</span>
                        <span>{r.paymentStatus}</span>
                      </button>
                    </td>

                    {/* Action Button: View Payslip */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => setSelectedPayslip(r)}
                        className="btn btn-outline"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                      >
                        📄 Payslip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredRecords.length > 0 && (
              <tfoot style={{ backgroundColor: 'var(--bg-main)', borderTop: '2px solid var(--border)' }}>
                <tr>
                  <td colSpan={2} style={{ padding: '1rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    TOTALS ({filteredRecords.length} Employees)
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatCurrency(totals.baseSalary)}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 800, color: 'var(--success)' }}>
                    P: {totals.present} • A: {totals.absent}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatMinutes(totals.totalMins)}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 800, color: '#3b82f6' }}>
                    +{formatCurrency(totals.otAmount)}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 800, color: 'var(--error)' }}>
                    -{formatCurrency(totals.deductions)}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 900, color: '#10b981', fontSize: '1.1rem' }}>
                    {formatCurrency(totals.netSalary)}
                  </td>
                  <td colSpan={2} style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {totals.paidCount} Paid • {totals.pendingCount} Pending
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PAYSLIP MODAL DIALOG */}
      {selectedPayslip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 'var(--radius-md)',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>
                  {selectedPayslip.branchPrefix === 'GD' ? 'HOTEL GODWIN DELUXE' : 'HOTEL GRAND GODWIN'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Arakashan Road, Pahar Ganj, New Delhi - 110055 • info@grandgodwin.com
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.5rem' }}>
                  SALARY SLIP — {fullMonthName.toUpperCase()} {year}
                </div>
              </div>

              <button
                onClick={() => setSelectedPayslip(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Employee Particulars */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.65rem',
              padding: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-main)',
              border: '1px solid var(--border)',
              marginBottom: '1.25rem',
              fontSize: '0.82rem'
            }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Employee Name:</span> <strong>{selectedPayslip.employeeName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Employee ID:</span> <strong>{selectedPayslip.employeeId}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Designation:</span> <strong>{selectedPayslip.designation}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Department:</span> <strong>{selectedPayslip.department}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Working Days:</span> <strong>{selectedPayslip.daysInMonth || 30} days</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Payable Days:</span> <strong>{selectedPayslip.payableDays} days</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Bank A/c:</span> <strong>HDFC Bank (••••4892)</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>PAN:</span> <strong>ABCDE••••F</strong></div>
            </div>

            {/* Earnings & Deductions Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Earnings */}
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                <div style={{ fontWeight: 800, color: '#34d399', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
                  EARNINGS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Basic Salary:</span>
                    <span>{formatCurrency(Math.round(selectedPayslip.baseSalary * 0.6))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>HRA (40%):</span>
                    <span>{formatCurrency(Math.round(selectedPayslip.baseSalary * 0.24))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Special Allowance:</span>
                    <span>{formatCurrency(Math.round(selectedPayslip.baseSalary * 0.16))}</span>
                  </div>
                  {selectedPayslip.overtimeAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa', fontWeight: 600 }}>
                      <span>Overtime Pay ({formatMinutes(selectedPayslip.overtimeMinutes)}):</span>
                      <span>+{formatCurrency(selectedPayslip.overtimeAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    <span>Gross Earnings:</span>
                    <span>{formatCurrency(selectedPayslip.baseSalary + selectedPayslip.overtimeAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                <div style={{ fontWeight: 800, color: '#f87171', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
                  DEDUCTIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Loss of Pay (Absent):</span>
                    <span>{selectedPayslip.deductions > 0 ? formatCurrency(selectedPayslip.deductions) : '₹0'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Provident Fund (PF):</span>
                    <span>₹0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Professional Tax:</span>
                    <span>₹0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem', fontWeight: 800, color: '#f87171' }}>
                    <span>Total Deductions:</span>
                    <span>-{formatCurrency(selectedPayslip.deductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Banner */}
            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                  NET SALARY PAYABLE
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Mode: Direct Bank Transfer • Status: <strong style={{ color: '#10b981' }}>{selectedPayslip.paymentStatus}</strong>
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>
                {formatCurrency(selectedPayslip.netSalary)}
              </div>
            </div>

            {/* Footer / Print Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                System generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • Godwin ERP
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.2rem' }}
                >
                  🖨️ Print Slip
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
