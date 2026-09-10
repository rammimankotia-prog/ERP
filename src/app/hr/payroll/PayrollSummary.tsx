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

type ReportFilterType = 'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'OVERTIME' | 'PAID' | 'PENDING'

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

function downloadCSV(data: PayrollRecord[], month: string, year: number, filterName: string) {
  const headers = [
    'Sr No',
    'Employee ID',
    'Name',
    'Designation',
    'Department',
    'Branch',
    'Month Days',
    'Present (P)',
    'Paid Leave (L)',
    'Absent (A)',
    'Half Days (HD)',
    'Late Arrivals (L)',
    'Payable Days',
    'Basic Salary (INR)',
    'Total Working Hours',
    'Overtime Hours',
    'OT Pay (INR)',
    'Deductions (INR)',
    'Net Salary (INR)',
    'Payment Status'
  ]

  const rows = data.map((r, i) => [
    i + 1,
    r.employeeId,
    `"${r.employeeName}"`,
    `"${r.designation}"`,
    `"${r.department}"`,
    `"${r.branchName || (r.branchPrefix === 'GD' ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin')}"`,
    r.daysInMonth || 30,
    r.presentDays,
    r.leaveDays,
    r.absentDays,
    r.halfDays || 0,
    r.lateDays,
    r.payableDays,
    r.baseSalary,
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
  a.download = `Godwin-Payroll-${filterName}-${month}-${year}.csv`
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
  const [reportFilter, setReportFilter] = useState<ReportFilterType>('ALL')
  const [metricViewMode, setMetricViewMode] = useState<'ATTENDANCE' | 'SALARY' | 'ALL'>('ATTENDANCE')
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [showPrintPreview, setShowPrintPreview] = useState(false)

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

  // Overall totals across all unfiltered records in period
  const overallTotals = useMemo(() => {
    return records.reduce((acc, r) => ({
      baseSalary: acc.baseSalary + (r.baseSalary || 0),
      netSalary: acc.netSalary + (r.netSalary || 0),
      present: acc.present + r.presentDays,
      absent: acc.absent + r.absentDays,
      leave: acc.leave + r.leaveDays,
      halfDays: acc.halfDays + (r.halfDays || 0),
      late: acc.late + r.lateDays,
      payableDays: acc.payableDays + r.payableDays,
      totalMins: acc.totalMins + r.totalMinutes,
      otMins: acc.otMins + r.overtimeMinutes,
      otAmount: acc.otAmount + (r.overtimeAmount || 0),
      deductions: acc.deductions + (r.deductions || 0),
      presentCount: acc.presentCount + (r.presentDays > 0 ? 1 : 0),
      absentCount: acc.absentCount + (r.absentDays > 0 ? 1 : 0),
      lateCount: acc.lateCount + (r.lateDays > 0 ? 1 : 0),
      otCount: acc.otCount + (r.overtimeMinutes > 0 ? 1 : 0),
      paidCount: acc.paidCount + (r.paymentStatus === 'PAID' ? 1 : 0),
      processedCount: acc.processedCount + (r.paymentStatus === 'PROCESSED' ? 1 : 0),
      pendingCount: acc.pendingCount + (r.paymentStatus === 'PENDING' ? 1 : 0),
    }), {
      baseSalary: 0,
      netSalary: 0,
      present: 0,
      absent: 0,
      leave: 0,
      halfDays: 0,
      late: 0,
      payableDays: 0,
      totalMins: 0,
      otMins: 0,
      otAmount: 0,
      deductions: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      otCount: 0,
      paidCount: 0,
      processedCount: 0,
      pendingCount: 0
    })
  }, [records])

  // Filter records by search query AND active report metric filter
  const filteredRecords = useMemo(() => {
    let list = records

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        r.designation.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      )
    }

    // Apply report toggle filter
    if (reportFilter === 'PRESENT') {
      list = list.filter(r => r.presentDays > 0)
    } else if (reportFilter === 'ABSENT') {
      list = list.filter(r => r.absentDays > 0)
    } else if (reportFilter === 'LATE') {
      list = list.filter(r => r.lateDays > 0)
    } else if (reportFilter === 'OVERTIME') {
      list = list.filter(r => r.overtimeMinutes > 0)
    } else if (reportFilter === 'PAID') {
      list = list.filter(r => r.paymentStatus === 'PAID')
    } else if (reportFilter === 'PENDING') {
      list = list.filter(r => r.paymentStatus === 'PENDING')
    }

    return list
  }, [records, searchQuery, reportFilter])

  // Filtered totals for bottom row
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, r) => ({
      baseSalary: acc.baseSalary + (r.baseSalary || 0),
      netSalary: acc.netSalary + (r.netSalary || 0),
      present: acc.present + r.presentDays,
      absent: acc.absent + r.absentDays,
      leave: acc.leave + r.leaveDays,
      halfDays: acc.halfDays + (r.halfDays || 0),
      late: acc.late + r.lateDays,
      payableDays: acc.payableDays + r.payableDays,
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
      leave: 0,
      halfDays: 0,
      late: 0,
      payableDays: 0,
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

  const triggerPrint = () => {
    window.print()
  }

  // Toggle filter helper
  const handleCardToggle = (filterType: ReportFilterType) => {
    setReportFilter(prev => prev === filterType ? 'ALL' : filterType)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Dedicated Print & PDF CSS */}
      <style>{`
        @media print {
          @page {
            size: landscape A4;
            margin: 8mm 6mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            font-size: 8.5pt !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide app sidebar, navigation, controls, buttons, modals, toasts */
          nav, aside, header, .no-print, .header, .card:not(.print-sheet), .toast-notification, select, input, button {
            display: none !important;
          }
          .screen-only {
            display: none !important;
          }
          .print-sheet {
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 8px !important;
            font-size: 8pt !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border: 1px solid #64748b !important;
            padding: 5px 4px !important;
            font-weight: 800 !important;
            text-align: center !important;
            vertical-align: middle !important;
          }
          .print-table td {
            border: 1px solid #94a3b8 !important;
            padding: 4px 4px !important;
            color: #0f172a !important;
            vertical-align: middle !important;
          }
          .print-table tr:nth-child(even) {
            background-color: #f8fafc !important;
          }
          .print-footer-signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 28px !important;
            page-break-inside: avoid !important;
          }
        }

        @media screen {
          .print-sheet {
            display: none;
          }
        }
      `}</style>

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
      <div className="card no-print" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
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

          <div className="form-group" style={{ marginBottom: 0, minWidth: '190px' }}>
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
          <button
            className="btn btn-primary"
            onClick={triggerPrint}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
            }}
          >
            🖨️ Print / Save PDF
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowPrintPreview(prev => !prev)}
            style={{ fontWeight: 700 }}
          >
            {showPrintPreview ? '👁️ Hide Preview' : '📋 Report Preview'}
          </button>
          <button className="btn btn-outline" onClick={() => downloadCSV(filteredRecords, monthName, year, reportFilter)} disabled={filteredRecords.length === 0}>
            ⬇️ Export CSV
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

      {/* TOGGLE REPORT METRICS BAR */}
      <div className="no-print" style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-main)',
        border: '1px solid var(--border)'
      }}>
        {/* Left: View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>VIEW METRICS:</span>
          <div style={{ display: 'inline-flex', background: 'var(--bg-card)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setMetricViewMode('ATTENDANCE')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '4px',
                border: 'none',
                background: metricViewMode === 'ATTENDANCE' ? 'var(--primary)' : 'transparent',
                color: metricViewMode === 'ATTENDANCE' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ⏱️ Attendance & Hours
            </button>
            <button
              onClick={() => setMetricViewMode('SALARY')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '4px',
                border: 'none',
                background: metricViewMode === 'SALARY' ? 'var(--primary)' : 'transparent',
                color: metricViewMode === 'SALARY' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              💰 Salary & Payout
            </button>
            <button
              onClick={() => setMetricViewMode('ALL')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '4px',
                border: 'none',
                background: metricViewMode === 'ALL' ? 'var(--primary)' : 'transparent',
                color: metricViewMode === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📊 All Metrics
            </button>
          </div>
        </div>

        {/* Right: Active Filter Pill & Quick Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Filter by Report:
          </span>
          <span style={{
            fontSize: '0.78rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '99px',
            background: reportFilter === 'ALL' ? 'rgba(255,255,255,0.08)' : 'rgba(59, 130, 246, 0.2)',
            color: reportFilter === 'ALL' ? 'var(--text-muted)' : '#60a5fa',
            border: reportFilter === 'ALL' ? '1px solid var(--border)' : '1px solid #3b82f6',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span>●</span>
            <span>
              {reportFilter === 'ALL'
                ? 'ALL RECORDS (5)'
                : reportFilter === 'PRESENT'
                ? `PRESENT EMPLOYEES (${filteredRecords.length})`
                : reportFilter === 'ABSENT'
                ? `ABSENT / LOP EMPLOYEES (${filteredRecords.length})`
                : reportFilter === 'LATE'
                ? `LATE ARRIVALS (${filteredRecords.length})`
                : reportFilter === 'OVERTIME'
                ? `OVERTIME EMPLOYEES (${filteredRecords.length})`
                : reportFilter === 'PAID'
                ? `PAID EMPLOYEES (${filteredRecords.length})`
                : `PENDING EMPLOYEES (${filteredRecords.length})`}
            </span>
          </span>

          {reportFilter !== 'ALL' && (
            <button
              onClick={() => setReportFilter('ALL')}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✕ Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* 5 REPORT SUMMARY CARDS (Interactive Toggle Filters) */}
      {(metricViewMode === 'ATTENDANCE' || metricViewMode === 'ALL') && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          {[
            {
              id: 'PRESENT' as const,
              label: 'TOTAL PRESENT',
              value: overallTotals.present,
              color: 'var(--success)',
              icon: '✅',
              subtext: `${overallTotals.presentCount} employees active`
            },
            {
              id: 'ABSENT' as const,
              label: 'TOTAL ABSENT',
              value: overallTotals.absent,
              color: 'var(--error)',
              icon: '❌',
              subtext: `${overallTotals.absentCount} employees with LOP`
            },
            {
              id: 'LATE' as const,
              label: 'LATE ARRIVALS',
              value: overallTotals.late,
              color: 'var(--warning)',
              icon: '⚠️',
              subtext: `${overallTotals.lateCount} employees flagged`
            },
            {
              id: 'ALL' as const,
              label: 'TOTAL HOURS',
              value: formatMinutes(overallTotals.totalMins),
              color: 'var(--primary)',
              icon: '⏱️',
              subtext: 'Across all shifts'
            },
            {
              id: 'OVERTIME' as const,
              label: 'OVERTIME HOURS',
              value: formatMinutes(overallTotals.otMins),
              color: 'var(--accent)',
              icon: '🎯',
              subtext: `${overallTotals.otCount} employees worked OT`
            },
          ].map(s => {
            const isSelected = reportFilter === s.id && s.id !== 'ALL'
            return (
              <div
                key={s.label}
                onClick={() => handleCardToggle(s.id)}
                className="card"
                title={`Click to toggle filter by ${s.label}`}
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  position: 'relative',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                  boxShadow: isSelected ? '0 0 16px rgba(59, 130, 246, 0.3)' : 'none',
                  transform: isSelected ? 'scale(1.02)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                {isSelected && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    background: 'var(--primary)',
                    color: '#ffffff',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px'
                  }}>
                    ACTIVE
                  </span>
                )}
                <div style={{ fontSize: '1.6rem' }}>{s.icon}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color, lineHeight: 1.1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: isSelected ? '#60a5fa' : 'var(--text-muted)', opacity: 0.85 }}>
                  {s.subtext}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Salary Financial Metric Cards (Interactive Toggle Filters) */}
      {(metricViewMode === 'SALARY' || metricViewMode === 'ALL') && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
          {/* Total Net Payroll */}
          <div
            onClick={() => setReportFilter('ALL')}
            className="card"
            title="Click to view all payroll records"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.04))',
              border: reportFilter === 'ALL' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL NET PAYROLL
              </span>
              <span style={{ fontSize: '1.25rem' }}>💰</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1.1 }}>
              {formatCurrency(overallTotals.netSalary)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Base Cost: {formatCurrency(overallTotals.baseSalary)}
            </div>
          </div>

          {/* Total Overtime */}
          <div
            onClick={() => handleCardToggle('OVERTIME')}
            className="card"
            title="Click to filter employees with Overtime"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.04))',
              border: reportFilter === 'OVERTIME' ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                OVERTIME PAYOUT (1.5X)
              </span>
              <span style={{ fontSize: '1.25rem' }}>⏱️</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1.1 }}>
              +{formatCurrency(overallTotals.otAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total OT: {formatMinutes(overallTotals.otMins)} ({overallTotals.otCount} staff)
            </div>
          </div>

          {/* Total Deductions / LOP */}
          <div
            onClick={() => handleCardToggle('ABSENT')}
            className="card"
            title="Click to filter employees with Deductions/LOP"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.03))',
              border: reportFilter === 'ABSENT' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DEDUCTIONS & LOP
              </span>
              <span style={{ fontSize: '1.25rem' }}>📉</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', lineHeight: 1.1 }}>
              -{formatCurrency(overallTotals.deductions)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Absent Days: {overallTotals.absent}d • Late: {overallTotals.late}
            </div>
          </div>

          {/* Disbursement Status */}
          <div
            onClick={() => handleCardToggle('PAID')}
            className="card"
            title="Click to filter Paid / Disbursed employees"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              cursor: 'pointer',
              border: reportFilter === 'PAID' ? '2px solid #10b981' : '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                PAYMENT DISBURSEMENT
              </span>
              <span style={{ fontSize: '1.25rem' }}>💳</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>
                {overallTotals.paidCount}/{records.length}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Disbursed</span>
            </div>
            <div style={{ height: '6px', borderRadius: '99px', background: 'var(--bg-main)', overflow: 'hidden', marginTop: '0.2rem' }}>
              <div style={{
                height: '100%',
                borderRadius: '99px',
                background: '#10b981',
                width: `${records.length > 0 ? (overallTotals.paidCount / records.length) * 100 : 0}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {overallTotals.processedCount} Processed • {overallTotals.pendingCount} Pending
            </div>
          </div>
        </div>
      )}

      {/* Screen Interactive Table */}
      <div className="card no-print" style={{ padding: 0, overflow: 'hidden' }}>
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
              {fullMonthName} {year} • Showing {filteredRecords.length} of {records.length} employees
              {reportFilter !== 'ALL' && <strong style={{ color: 'var(--primary)', marginLeft: '0.35rem' }}>[Filtered by: {reportFilter}]</strong>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => handleCardToggle('PAID')}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: reportFilter === 'PAID' ? '#10b981' : 'rgba(16, 185, 129, 0.1)',
                color: reportFilter === 'PAID' ? '#ffffff' : '#10b981',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ● {totals.paidCount} Paid
            </button>
            <button
              onClick={() => handleCardToggle('PENDING')}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: reportFilter === 'PENDING' ? '#fbbf24' : 'rgba(245, 158, 11, 0.1)',
                color: reportFilter === 'PENDING' ? '#0f172a' : '#fbbf24',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ● {totals.pendingCount} Pending
            </button>
            <button
              onClick={() => setReportFilter('ALL')}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                background: reportFilter === 'ALL' ? 'var(--primary)' : 'var(--bg-main)',
                color: reportFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              All ({records.length})
            </button>
          </div>
        </div>

        <div className="table-scroll-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                {[
                  '#',
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
                    padding: '0.875rem 0.9rem',
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
                  <td colSpan={11} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    ⏳ Calculating payroll records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No employees match the active report filter (<strong>{reportFilter}</strong>).
                    <div style={{ marginTop: '0.5rem' }}>
                      <button onClick={() => setReportFilter('ALL')} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                        Reset Filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s ease' }}>
                    <td style={{ padding: '0.875rem 0.9rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    {/* Employee info */}
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                    <td style={{ padding: '0.875rem 0.9rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {formatCurrency(r.baseSalary)}
                    </td>

                    {/* Attendance breakdown */}
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                          Payable: <strong>{r.payableDays}d</strong> / {r.daysInMonth || 30}d
                        </div>
                      </div>
                    </td>

                    {/* Working Hours */}
                    <td style={{ padding: '0.875rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatMinutes(r.totalMinutes)}
                    </td>

                    {/* Overtime */}
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                    <td style={{ padding: '0.875rem 0.9rem' }}>
                      {r.deductions > 0 ? (
                        <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.85rem' }}>
                          -{formatCurrency(r.deductions)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹0</span>
                      )}
                    </td>

                    {/* Net Payable */}
                    <td style={{ padding: '0.875rem 0.9rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                        {formatCurrency(r.netSalary)}
                      </span>
                    </td>

                    {/* Payment Status Pill */}
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                    <td style={{ padding: '0.875rem 0.9rem' }}>
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
                  <td colSpan={3} style={{ padding: '1rem 0.9rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    TOTALS ({filteredRecords.length} Employees)
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatCurrency(totals.baseSalary)}
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 800, color: 'var(--success)' }}>
                    P: {totals.present} • L: {totals.leave} • A: {totals.absent}
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatMinutes(totals.totalMins)}
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 800, color: '#3b82f6' }}>
                    +{formatCurrency(totals.otAmount)}
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 800, color: 'var(--error)' }}>
                    -{formatCurrency(totals.deductions)}
                  </td>
                  <td style={{ padding: '1rem 0.9rem', fontWeight: 900, color: '#10b981', fontSize: '1.1rem' }}>
                    {formatCurrency(totals.netSalary)}
                  </td>
                  <td colSpan={2} style={{ padding: '1rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {totals.paidCount} Paid • {totals.pendingCount} Pending
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* On-Screen Report Preview Card */}
      {showPrintPreview && (
        <div className="card no-print" style={{ border: '2px dashed var(--primary)', background: '#ffffff', color: '#0f172a', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                📄 PDF / PRINT REPORT PREVIEW (Landscape A4 Layout)
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', color: '#0f172a', fontSize: '1.1rem' }}>
                Complete Hotel Salary & Attendance Register
                {reportFilter !== 'ALL' && <span style={{ color: '#2563eb', marginLeft: '0.5rem' }}>({reportFilter} FILTERED)</span>}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={triggerPrint} className="btn btn-primary" style={{ padding: '0.45rem 1.2rem', fontWeight: 800 }}>
                🖨️ Print / Save to PDF
              </button>
              <button onClick={() => setShowPrintPreview(false)} className="btn btn-outline" style={{ padding: '0.45rem 0.8rem', color: '#475569', borderColor: '#cbd5e1' }}>
                Close Preview
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {renderPrintRegister(filteredRecords, fullMonthName, year, branchFilter, totals, reportFilter)}
          </div>
        </div>
      )}

      {/* DEDICATED PRINTABLE CONTAINER (Visible ONLY during print/PDF generation) */}
      <div className="print-sheet">
        {renderPrintRegister(filteredRecords, fullMonthName, year, branchFilter, totals, reportFilter)}
      </div>

      {/* PAYSLIP MODAL DIALOG */}
      {selectedPayslip && (
        <div className="no-print" style={{
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

/**
 * Renders the formal Hotel Monthly Attendance & Salary Register Report
 * containing all essential columns required for auditing, accounts, and PDF printing.
 */
function renderPrintRegister(
  records: PayrollRecord[],
  monthName: string,
  year: number,
  branchFilter: string,
  totals: any,
  reportFilter: string = 'ALL'
) {
  const branchLabel =
    branchFilter === 'GG'
      ? 'Hotel Grand Godwin (GG)'
      : branchFilter === 'GD'
      ? 'Hotel Godwin Deluxe (GD)'
      : 'Hotel Grand Godwin & Hotel Godwin Deluxe'

  const printedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div style={{ width: '100%', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
      {/* Formal Header */}
      <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '15pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a' }}>
              HOTEL GRAND GODWIN & HOTEL GODWIN DELUXE
            </h1>
            <div style={{ fontSize: '8.5pt', color: '#475569', marginTop: '2px' }}>
              8501/41-42, Arakashan Road, Ram Nagar, Pahar Ganj, New Delhi - 110055 • GSTIN: 07AAAAG0000A1Z5
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
              MONTHLY SALARY REGISTER & ATTENDANCE PAYROLL REPORT — {monthName.toUpperCase()} {year}
              {reportFilter !== 'ALL' && <span style={{ color: '#b91c1c', marginLeft: '8px', fontSize: '9pt' }}>[REPORT FILTER: {reportFilter}]</span>}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '8pt', color: '#334155' }}>
            <div><strong>Branch:</strong> {branchLabel}</div>
            <div><strong>Generated:</strong> {printedAt}</div>
            <div><strong>Staff Strength:</strong> {records.length} Employees {reportFilter !== 'ALL' ? `(${reportFilter})` : ''}</div>
          </div>
        </div>
      </div>

      {/* Complete Table with All Requisite Columns */}
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ width: '25px', padding: '5px 3px' }}>Sr.</th>
            <th style={{ width: '65px', padding: '5px 4px' }}>Emp ID</th>
            <th style={{ padding: '5px 6px', textAlign: 'left' }}>Employee Name</th>
            <th style={{ padding: '5px 4px', textAlign: 'left' }}>Designation</th>
            <th style={{ padding: '5px 4px', textAlign: 'left' }}>Department</th>
            <th style={{ padding: '5px 4px' }}>Branch</th>
            <th style={{ width: '38px', padding: '5px 2px' }} title="Month Days">Days</th>
            <th style={{ width: '32px', padding: '5px 2px' }} title="Present Days">P</th>
            <th style={{ width: '32px', padding: '5px 2px' }} title="Paid Leave Days">PL</th>
            <th style={{ width: '32px', padding: '5px 2px' }} title="Absent / LOP Days">A</th>
            <th style={{ width: '32px', padding: '5px 2px' }} title="Late Days">L</th>
            <th style={{ width: '42px', padding: '5px 2px' }} title="Payable Days">Pay Days</th>
            <th style={{ padding: '5px 4px', textAlign: 'right' }}>Basic Pay (₹)</th>
            <th style={{ padding: '5px 3px' }}>OT Hrs</th>
            <th style={{ padding: '5px 4px', textAlign: 'right' }}>OT Pay (₹)</th>
            <th style={{ padding: '5px 4px', textAlign: 'right' }}>Deduction (₹)</th>
            <th style={{ padding: '5px 5px', textAlign: 'right', fontWeight: 900 }}>Net Pay (₹)</th>
            <th style={{ width: '65px', padding: '5px 3px' }}>Status</th>
            <th style={{ width: '90px', padding: '5px 4px' }}>Signature</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={19} style={{ textAlign: 'center', padding: '15px' }}>
                No records found matching filter "{reportFilter}".
              </td>
            </tr>
          ) : (
            records.map((r, i) => (
              <tr key={r.employeeId}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.employeeId}</td>
                <td style={{ fontWeight: 700 }}>{r.employeeName}</td>
                <td>{r.designation}</td>
                <td>{r.department}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontWeight: 700 }}>
                    {r.branchPrefix || (r.branchId === 'mock-2' ? 'GD' : 'GG')}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>{r.daysInMonth || 30}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: '#15803d' }}>{r.presentDays}</td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{r.leaveDays}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: r.absentDays > 0 ? '#dc2626' : '#64748b' }}>
                  {r.absentDays}
                </td>
                <td style={{ textAlign: 'center', color: r.lateDays > 0 ? '#b45309' : '#64748b' }}>{r.lateDays}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{r.payableDays}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.baseSalary.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'center' }}>{formatMinutes(r.overtimeMinutes)}</td>
                <td style={{ textAlign: 'right', color: r.overtimeAmount > 0 ? '#1d4ed8' : '#64748b', fontWeight: 600 }}>
                  {r.overtimeAmount > 0 ? `+${r.overtimeAmount.toLocaleString('en-IN')}` : '—'}
                </td>
                <td style={{ textAlign: 'right', color: r.deductions > 0 ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
                  {r.deductions > 0 ? `-${r.deductions.toLocaleString('en-IN')}` : '0'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#047857', fontSize: '8pt' }}>
                  ₹{r.netSalary.toLocaleString('en-IN')}
                </td>
                <td style={{ textAlign: 'center', fontSize: '7pt', fontWeight: 700 }}>
                  {r.paymentStatus}
                </td>
                <td style={{ borderBottom: '1px solid #94a3b8', height: '24px' }}>
                  {/* Space for employee sign */}
                </td>
              </tr>
            ))
          )}
        </tbody>

        {/* Totals Summary Row */}
        <tfoot>
          <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 800, borderTop: '2px solid #0f172a' }}>
            <td colSpan={6} style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 900 }}>
              TOTALS ({records.length} Employees)
            </td>
            <td style={{ textAlign: 'center' }}>—</td>
            <td style={{ textAlign: 'center', color: '#15803d' }}>{totals.present}</td>
            <td style={{ textAlign: 'center', color: '#2563eb' }}>{totals.leave}</td>
            <td style={{ textAlign: 'center', color: '#dc2626' }}>{totals.absent}</td>
            <td style={{ textAlign: 'center' }}>{totals.late}</td>
            <td style={{ textAlign: 'center' }}>{totals.payableDays}</td>
            <td style={{ textAlign: 'right' }}>₹{totals.baseSalary.toLocaleString('en-IN')}</td>
            <td style={{ textAlign: 'center' }}>{formatMinutes(totals.otMins)}</td>
            <td style={{ textAlign: 'right', color: '#1d4ed8' }}>₹{totals.otAmount.toLocaleString('en-IN')}</td>
            <td style={{ textAlign: 'right', color: '#b91c1c' }}>₹{totals.deductions.toLocaleString('en-IN')}</td>
            <td style={{ textAlign: 'right', color: '#047857', fontWeight: 900, fontSize: '8.5pt' }}>
              ₹{totals.netSalary.toLocaleString('en-IN')}
            </td>
            <td colSpan={2} style={{ textAlign: 'center', fontSize: '7pt' }}>
              {totals.paidCount} Paid • {totals.pendingCount} Pending
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Summary Box & Official Signatures */}
      <div className="print-footer-signatures" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', gap: '30px', fontSize: '8pt', color: '#334155' }}>
          <div>
            <strong>Financial Summary:</strong>
            <div>Total Base Wage: ₹{totals.baseSalary.toLocaleString('en-IN')}</div>
            <div>Overtime Wage: +₹{totals.otAmount.toLocaleString('en-IN')}</div>
            <div>Total Deductions: -₹{totals.deductions.toLocaleString('en-IN')}</div>
            <div style={{ fontWeight: 800, color: '#047857' }}>Net Disbursed: ₹{totals.netSalary.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <strong>Attendance Summary:</strong>
            <div>Total Present: {totals.present} days</div>
            <div>Paid Leaves: {totals.leave} days</div>
            <div>Total LOP: {totals.absent} days</div>
          </div>
        </div>

        {/* 3 Authority Signatures */}
        <div style={{ display: 'flex', gap: '36px', textAlign: 'center' }}>
          <div style={{ width: '130px' }}>
            <div style={{ borderBottom: '1px solid #0f172a', height: '36px', marginBottom: '4px' }} />
            <div style={{ fontSize: '8pt', fontWeight: 800 }}>Prepared By</div>
            <div style={{ fontSize: '7pt', color: '#64748b' }}>HR Officer</div>
          </div>

          <div style={{ width: '130px' }}>
            <div style={{ borderBottom: '1px solid #0f172a', height: '36px', marginBottom: '4px' }} />
            <div style={{ fontSize: '8pt', fontWeight: 800 }}>Checked & Verified By</div>
            <div style={{ fontSize: '7pt', color: '#64748b' }}>Accounts Department</div>
          </div>

          <div style={{ width: '140px' }}>
            <div style={{ borderBottom: '1px solid #0f172a', height: '36px', marginBottom: '4px' }} />
            <div style={{ fontSize: '8pt', fontWeight: 800 }}>Approved By</div>
            <div style={{ fontSize: '7pt', color: '#64748b' }}>General Manager</div>
          </div>
        </div>
      </div>
    </div>
  )
}
