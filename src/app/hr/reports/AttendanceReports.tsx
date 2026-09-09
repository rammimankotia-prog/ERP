'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { ReportRecord } from '@/app/api/hr/reports/route'

type ReportMode = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
type ExceptionFilter = 'ALL' | 'LATE' | 'EARLY_OUT' | 'UNPAID_LEAVE' | 'PAID_LEAVE' | 'ABSENT' | 'OVERTIME'

interface EmployeeSummary {
  employeeId: string
  empCode: string
  employeeName: string
  designation: string
  branchName: string
  departmentName: string
  scheduledIn: string
  scheduledOut: string
  totalDays: number
  workingDays: number
  presentDays: number
  lateDays: number
  lateMinutes: number
  earlyOutDays: number
  earlyOutMinutes: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  absentDays: number
  halfDays: number
  totalMinutes: number
  overtimeMinutes: number
  attendanceRate: number
}

interface ReportResponse {
  dateRange: { from: string; to: string; totalDays: number }
  summary: {
    totalEmployees: number
    totalRecords: number
    totalWorkingDays: number
    totalPresent: number
    totalLate: number
    totalEarlyOut: number
    totalPaidLeave: number
    totalUnpaidLeave: number
    totalAbsent: number
    totalHalfDay: number
    totalWorkingMinutes: number
    totalOvertimeMinutes: number
    attendanceRate: number
  }
  employeeSummaries: EmployeeSummary[]
  records: ReportRecord[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return '—'
  }
}

function fmtMinutes(m: number | null | undefined) {
  if (!m || m <= 0) return '0h 0m'
  const h = Math.floor(m / 60)
  const rem = m % 60
  return `${h}h ${rem}m`
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateDisplay(dateStr: string) {
  try {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// Helpers to get week dates
function getWeekRange(refDate: Date) {
  const d = new Date(refDate)
  const day = d.getDay()
  const diffToMonday = d.getDate() - (day === 0 ? 6 : day - 1)
  const monday = new Date(d.getFullYear(), d.getMonth(), diffToMonday)
  const sunday = new Date(d.getFullYear(), d.getMonth(), diffToMonday + 6)
  return {
    from: formatLocalDate(monday),
    to: formatLocalDate(sunday)
  }
}

function getMonthRange(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)
  return {
    from: formatLocalDate(firstDay),
    to: formatLocalDate(lastDay)
  }
}

export default function AttendanceReports() {
  const now = new Date()
  const [mode, setMode] = useState<ReportMode>('MONTHLY')
  const [viewTab, setViewTab] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY')
  const [selectedException, setSelectedException] = useState<ExceptionFilter>('ALL')

  // Date controls
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(8) // 8 = September (0-indexed)
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(2026, 8, 1)
    return d.toISOString().split('T')[0]
  })
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date(2026, 8, 9)
    return d.toISOString().split('T')[0]
  })
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Data state
  const [reportData, setReportData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      setIsFullScreen(true)
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } else {
      setIsFullScreen(false)
      if (typeof document !== 'undefined' && document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        setIsFullScreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Compute active date range based on mode
  const activeRange = useMemo(() => {
    if (mode === 'WEEKLY') {
      const targetDate = new Date(2026, 8, 9) // Current demo anchor date: 9 Sep 2026
      targetDate.setDate(targetDate.getDate() + (weekOffset * 7))
      return getWeekRange(targetDate)
    } else if (mode === 'MONTHLY') {
      return getMonthRange(selectedYear, selectedMonth)
    } else {
      return { from: customFrom, to: customTo }
    }
  }, [mode, weekOffset, selectedYear, selectedMonth, customFrom, customTo])

  // Fetch report data from API
  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        from: activeRange.from,
        to: activeRange.to,
        employeeId: employeeFilter,
        branchId: branchFilter,
        departmentId: deptFilter
      })
      const res = await fetch(`/api/hr/reports?${params}`)
      if (!res.ok) throw new Error('Failed to load report data')
      const data: ReportResponse = await res.json()
      setReportData(data)
    } catch (err: any) {
      console.error(err)
      setError('Could not retrieve attendance report. Showing local fallback.')
    } finally {
      setLoading(false)
    }
  }, [activeRange, employeeFilter, branchFilter, deptFilter])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Filter detailed records by exception pills and search query
  const filteredRecords = useMemo(() => {
    if (!reportData?.records) return []
    let list = reportData.records

    // Quick exception pills
    if (selectedException === 'LATE') {
      list = list.filter(r => r.isLate)
    } else if (selectedException === 'EARLY_OUT') {
      list = list.filter(r => r.isEarlyOut)
    } else if (selectedException === 'UNPAID_LEAVE') {
      list = list.filter(r => r.status === 'UNPAID_LEAVE')
    } else if (selectedException === 'PAID_LEAVE') {
      list = list.filter(r => r.status === 'PAID_LEAVE')
    } else if (selectedException === 'ABSENT') {
      list = list.filter(r => r.status === 'ABSENT')
    } else if (selectedException === 'OVERTIME') {
      list = list.filter(r => r.overtimeMinutes > 0)
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.employeeName.toLowerCase().includes(q) ||
        r.empCode.toLowerCase().includes(q) ||
        r.designation.toLowerCase().includes(q) ||
        r.departmentName.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q)
      )
    }

    return list
  }, [reportData, selectedException, searchQuery])

  // Filter employee summaries by search
  const filteredEmployeeSummaries = useMemo(() => {
    if (!reportData?.employeeSummaries) return []
    if (!searchQuery.trim()) return reportData.employeeSummaries
    const q = searchQuery.toLowerCase()
    return reportData.employeeSummaries.filter(e =>
      e.employeeName.toLowerCase().includes(q) ||
      e.empCode.toLowerCase().includes(q) ||
      e.designation.toLowerCase().includes(q) ||
      e.departmentName.toLowerCase().includes(q) ||
      e.branchName.toLowerCase().includes(q)
    )
  }, [reportData, searchQuery])

  // CSV Downloader
  const handleDownloadCSV = () => {
    if (!reportData) return
    const headers = [
      'Date',
      'Day',
      'Employee ID',
      'Employee Name',
      'Designation',
      'Branch',
      'Department',
      'Scheduled In',
      'Scheduled Out',
      'Punch In',
      'Punch Out',
      'Late Mins',
      'Early Out Mins',
      'Total Hours',
      'Overtime Hours',
      'Status',
      'Exception Tags',
      'Remarks'
    ]

    const rows = filteredRecords.map(r => [
      r.date,
      r.dayOfWeek,
      r.empCode,
      `"${r.employeeName}"`,
      `"${r.designation}"`,
      `"${r.branchName}"`,
      `"${r.departmentName}"`,
      r.scheduledIn,
      r.scheduledOut,
      fmtTime(r.punchIn),
      fmtTime(r.punchOut),
      r.lateMinutes || 0,
      r.earlyOutMinutes || 0,
      fmtMinutes(r.totalMinutes),
      fmtMinutes(r.overtimeMinutes),
      r.status,
      `"${[
        r.isLate ? `Late (+${r.lateMinutes}m)` : '',
        r.isEarlyOut ? `Early Out (-${r.earlyOutMinutes}m)` : '',
        r.status === 'UNPAID_LEAVE' ? 'Unpaid Leave (LWP)' : '',
        r.status === 'PAID_LEAVE' ? 'Paid Leave' : '',
        r.overtimeMinutes > 0 ? `OT (+${r.overtimeMinutes}m)` : ''
      ].filter(Boolean).join('; ')}"`,
      `"${r.remarks || ''}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-report-${activeRange.from}-to-${activeRange.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const summary = reportData?.summary

  return (
    <div
      style={
        isFullScreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99999,
              backgroundColor: 'var(--bg-main)',
              padding: '1.25rem 2rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              width: '100%'
            }
      }
    >
      {/* Top Header Card with Report Mode Switcher */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📊</span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Staff Attendance & Exception Reports
            </h2>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Track employee-wise attendance, late arrivals, early exits, paid vs unpaid leaves across Hotel Grand Godwin & Hotel Godwin Deluxe.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            onClick={() => setMode('WEEKLY')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: mode === 'WEEKLY' ? 'var(--primary)' : 'transparent',
              color: mode === 'WEEKLY' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📅 Weekly Report
          </button>
          <button
            onClick={() => setMode('MONTHLY')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: mode === 'MONTHLY' ? 'var(--primary)' : 'transparent',
              color: mode === 'MONTHLY' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📆 Monthly Report
          </button>
          <button
            onClick={() => setMode('CUSTOM')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: mode === 'CUSTOM' ? 'var(--primary)' : 'transparent',
              color: mode === 'CUSTOM' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            🗓️ Date-Customised
          </button>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.25rem 1.5rem'
        }}
      >
        {/* Date Selector Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {mode === 'WEEKLY' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select Week:</span>
              <button
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setWeekOffset(p => p - 1)}
              >
                ◀ Previous Week
              </button>
              <span
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                {formatDateDisplay(activeRange.from)} — {formatDateDisplay(activeRange.to)}
                {weekOffset === 0 ? ' (Current Week)' : weekOffset === -1 ? ' (Last Week)' : ''}
              </span>
              <button
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setWeekOffset(p => p + 1)}
                disabled={weekOffset >= 0}
              >
                Next Week ▶
              </button>
              {weekOffset !== 0 && (
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => setWeekOffset(0)}
                >
                  This Week
                </button>
              )}
            </div>
          )}

          {mode === 'MONTHLY' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select Month:</span>
              <select
                className="form-input"
                style={{ width: '150px', padding: '0.45rem 0.75rem' }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <select
                className="form-input"
                style={{ width: '100px', padding: '0.45rem 0.75rem' }}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {[2026, 2025, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                Period: <strong style={{ color: 'var(--text-main)' }}>{formatDateDisplay(activeRange.from)} to {formatDateDisplay(activeRange.to)}</strong>
              </span>
            </div>
          )}

          {mode === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>From:</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '160px', padding: '0.45rem 0.75rem' }}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>To:</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '160px', padding: '0.45rem 0.75rem' }}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-outline"
              onClick={toggleFullScreen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: isFullScreen ? 'var(--primary)' : 'rgba(59, 130, 246, 0.1)',
                color: isFullScreen ? '#fff' : 'var(--primary)',
                fontWeight: 700,
                borderColor: isFullScreen ? 'var(--primary)' : 'rgba(59, 130, 246, 0.3)'
              }}
              title={isFullScreen ? "Exit Fullscreen Window Mode" : "Open Fullscreen Window Mode"}
            >
              {isFullScreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen Window'}
            </button>
            <button
              className="btn btn-outline"
              onClick={handleDownloadCSV}
              disabled={!reportData || filteredRecords.length === 0}
              title="Download detailed CSV report"
            >
              📥 Export CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => window.print()}
              title="Print report or save to PDF"
            >
              🖨️ Print PDF
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Employee, Branch, Department, Search */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border)'
          }}
        >
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Employee
            </label>
            <select
              className="form-input"
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
            >
              <option value="ALL">👥 All Employees (Entire Team)</option>
              <option value="mock-emp-1">GG-1001 Raman Mankotia (GM)</option>
              <option value="mock-emp-2">GG-1002 Priya Sharma (Front Desk)</option>
              <option value="mock-emp-3">GD-1001 Rajiv Kumar (Housekeeping)</option>
              <option value="mock-emp-4">GD-1002 Sunita Verma (Security)</option>
              <option value="mock-emp-5">GG-1003 Amit Singh (Accounts)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Branch
            </label>
            <select
              className="form-input"
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
            >
              <option value="ALL">🏨 All Branches</option>
              <option value="mock-1">Hotel Grand Godwin (Pahar Ganj)</option>
              <option value="mock-2">Hotel Godwin Deluxe (Pahar Ganj)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Department
            </label>
            <select
              className="form-input"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="ALL">🏢 All Departments</option>
              <option value="dept-1">Front Office</option>
              <option value="dept-2">Housekeeping</option>
              <option value="dept-3">Security</option>
              <option value="dept-4">Accounts</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Search Records
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Search name, code, role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Exception Filter Badges Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            paddingTop: '0.75rem',
            borderTop: '1px dashed var(--border)'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.5rem' }}>
            Filter By Exception:
          </span>

          {[
            { id: 'ALL', label: 'All Records', icon: '📋', count: reportData?.records?.length },
            { id: 'LATE', label: 'Late Arrive', icon: '⚠️', count: summary?.totalLate, color: '#f59e0b' },
            { id: 'EARLY_OUT', label: 'Early Out', icon: '🚪', count: summary?.totalEarlyOut, color: '#f97316' },
            { id: 'UNPAID_LEAVE', label: 'Unpaid Leave (LWP)', icon: '🚫', count: summary?.totalUnpaidLeave, color: '#ef4444' },
            { id: 'PAID_LEAVE', label: 'Paid Leave', icon: '🏖️', count: summary?.totalPaidLeave, color: '#3b82f6' },
            { id: 'ABSENT', label: 'Absent', icon: '❌', count: summary?.totalAbsent, color: '#dc2626' },
            { id: 'OVERTIME', label: 'Overtime', icon: '🎯', count: reportData?.records?.filter(r => r.overtimeMinutes > 0).length, color: '#10b981' }
          ].map(tab => {
            const isActive = selectedException === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedException(tab.id as ExceptionFilter)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: isActive ? `1.5px solid ${tab.color || 'var(--primary)'}` : '1px solid var(--border)',
                  background: isActive ? (tab.color ? `${tab.color}20` : 'rgba(59, 130, 246, 0.2)') : 'transparent',
                  color: isActive ? (tab.color || 'var(--primary)') : 'var(--text-muted)',
                  fontSize: '0.775rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      background: isActive ? (tab.color || 'var(--primary)') : 'rgba(255, 255, 255, 0.1)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      marginLeft: '0.2rem'
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.85rem'
          }}
        >
          {[
            { label: 'Staff Evaluated', value: summary.totalEmployees, icon: '👥', color: 'var(--text-main)' },
            { label: 'Present Days', value: summary.totalPresent, icon: '✅', color: 'var(--success)' },
            { label: 'Late Arrivals', value: summary.totalLate, icon: '⚠️', color: '#f59e0b', sub: 'punch after grace' },
            { label: 'Early Exits', value: summary.totalEarlyOut, icon: '🚪', color: '#f97316', sub: 'left before shift end' },
            { label: 'Unpaid Leave (LWP)', value: summary.totalUnpaidLeave, icon: '🚫', color: '#ef4444', sub: 'salary deductible' },
            { label: 'Paid Leave', value: summary.totalPaidLeave, icon: '🏖️', color: 'var(--info)' },
            { label: 'Total Hours', value: fmtMinutes(summary.totalWorkingMinutes), icon: '⏱️', color: 'var(--primary)' },
            { label: 'Overtime Hours', value: fmtMinutes(summary.totalOvertimeMinutes), icon: '🎯', color: '#8b5cf6' },
            {
              label: 'Attendance Rate',
              value: `${summary.attendanceRate}%`,
              icon: '📈',
              color: summary.attendanceRate >= 85 ? 'var(--success)' : summary.attendanceRate >= 70 ? '#f59e0b' : 'var(--error)'
            }
          ].map(stat => (
            <div
              key={stat.label}
              className="card"
              style={{
                padding: '0.85rem 1rem',
                textAlign: 'center',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>
                {stat.label}
              </div>
              {stat.sub && (
                <div style={{ fontSize: '0.65rem', color: stat.color, opacity: 0.85, marginTop: '0.15rem' }}>
                  {stat.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area with View Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table View Switcher Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
              {mode === 'WEEKLY' ? 'Weekly' : mode === 'MONTHLY' ? 'Monthly' : 'Custom'} Attendance Ledger
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing records from <strong>{formatDateDisplay(activeRange.from)}</strong> to <strong>{formatDateDisplay(activeRange.to)}</strong>
              {employeeFilter !== 'ALL' && ' (Filtered for individual employee)'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setViewTab('SUMMARY')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: viewTab === 'SUMMARY' ? 'var(--primary)' : 'transparent',
                color: viewTab === 'SUMMARY' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              👥 Employee Summary Matrix
            </button>
            <button
              onClick={() => setViewTab('DETAILED')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: viewTab === 'DETAILED' ? 'var(--primary)' : 'transparent',
                color: viewTab === 'DETAILED' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📋 Detailed Daily Log ({filteredRecords.length})
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1rem'
              }}
            />
            <p>Compiling attendance report and exception logs...</p>
          </div>
        )}

        {/* TAB 1: EMPLOYEE SUMMARY MATRIX */}
        {!loading && viewTab === 'SUMMARY' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Employee</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Branch & Dept</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Shift</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Work Days</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--success)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Present</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#f59e0b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Late Arrive</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#f97316', fontSize: '0.75rem', textTransform: 'uppercase' }}>Early Out</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--info)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Paid Leave</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#ef4444', fontSize: '0.75rem', textTransform: 'uppercase' }}>Unpaid (LWP)</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--error)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Absent</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Hours</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#8b5cf6', fontSize: '0.75rem', textTransform: 'uppercase' }}>Overtime</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Attendance %</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployeeSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No employee summaries match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployeeSummaries.map(emp => (
                    <tr
                      key={emp.empCode}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.employeeName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>{emp.empCode} • {emp.designation}</div>
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{emp.branchName}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{emp.departmentName}</div>
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {emp.scheduledIn} – {emp.scheduledOut}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>
                        {emp.workingDays}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>
                        {emp.presentDays}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {emp.lateDays > 0 ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                            title={`Late on ${emp.lateDays} days, total ${emp.lateMinutes} mins`}
                          >
                            ⚠️ {emp.lateDays} <small style={{ opacity: 0.8 }}>({emp.lateMinutes}m)</small>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {emp.earlyOutDays > 0 ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(249, 115, 22, 0.15)',
                              color: '#f97316',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                            title={`Early out on ${emp.earlyOutDays} days, total ${emp.earlyOutMinutes} mins`}
                          >
                            🚪 {emp.earlyOutDays} <small style={{ opacity: 0.8 }}>({emp.earlyOutMinutes}m)</small>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {emp.paidLeaveDays > 0 ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              color: 'var(--info)',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          >
                            🏖️ {emp.paidLeaveDays}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {emp.unpaidLeaveDays > 0 ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                            title="Unpaid leave (LWP) - salary deductible"
                          >
                            🚫 {emp.unpaidLeaveDays}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {emp.absentDays > 0 ? (
                          <span style={{ color: 'var(--error)', fontWeight: 700 }}>{emp.absentDays}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                        {fmtMinutes(emp.totalMinutes)}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', color: emp.overtimeMinutes > 0 ? '#8b5cf6' : 'var(--text-muted)', fontWeight: 600 }}>
                        {emp.overtimeMinutes > 0 ? `+${fmtMinutes(emp.overtimeMinutes)}` : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: emp.attendanceRate >= 85 ? 'var(--success)' : emp.attendanceRate >= 70 ? '#f59e0b' : 'var(--error)'
                            }}
                          >
                            {emp.attendanceRate}%
                          </span>
                          <div
                            style={{
                              width: '45px',
                              height: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${emp.attendanceRate}%`,
                                height: '100%',
                                backgroundColor: emp.attendanceRate >= 85 ? 'var(--success)' : emp.attendanceRate >= 70 ? '#f59e0b' : 'var(--error)'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setEmployeeFilter(emp.empCode)
                            setViewTab('DETAILED')
                          }}
                        >
                          View Logs ▶
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: DETAILED DAILY ATTENDANCE LOG */}
        {!loading && viewTab === 'DETAILED' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date & Day</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Employee</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Shift</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Punch In</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Punch Out</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Hours Worked</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Overtime</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status & Exceptions</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No daily records match your selected exception or search filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => {
                    const isSun = record.dayOfWeek === 'Sunday'
                    const isSat = record.dayOfWeek === 'Saturday'

                    return (
                      <tr
                        key={record.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: isSun ? 'rgba(239, 68, 68, 0.03)' : isSat ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Date & Day */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {formatDateDisplay(record.date)}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: isSun ? '#ef4444' : isSat ? '#3b82f6' : 'var(--text-muted)'
                            }}
                          >
                            {record.dayOfWeek}
                          </span>
                        </td>

                        {/* Employee info */}
                        <td style={{ padding: '0.8rem 0.75rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{record.employeeName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{record.empCode}</span> • {record.branchName}
                          </div>
                        </td>

                        {/* Shift */}
                        <td style={{ padding: '0.8rem 0.75rem', textAlign: 'center', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                          {record.scheduledIn} – {record.scheduledOut}
                        </td>

                        {/* Punch In */}
                        <td style={{ padding: '0.8rem 0.75rem', textAlign: 'center' }}>
                          {record.punchIn ? (
                            <div>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: record.isLate ? '#f59e0b' : 'var(--success)',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {fmtTime(record.punchIn)}
                              </span>
                              {record.isLate && (
                                <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                                  +{record.lateMinutes}m late
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Punch Out */}
                        <td style={{ padding: '0.8rem 0.75rem', textAlign: 'center' }}>
                          {record.punchOut ? (
                            <div>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: record.isEarlyOut ? '#f97316' : 'var(--text-main)',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {fmtTime(record.punchOut)}
                              </span>
                              {record.isEarlyOut && (
                                <div style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 600 }}>
                                  -{record.earlyOutMinutes}m early
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Total Working Hours */}
                        <td style={{ padding: '0.8rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>
                          {record.totalMinutes > 0 ? fmtMinutes(record.totalMinutes) : '—'}
                        </td>

                        {/* Overtime */}
                        <td style={{ padding: '0.8rem 0.75rem', textAlign: 'center', color: record.overtimeMinutes > 0 ? '#8b5cf6' : 'var(--text-muted)', fontWeight: 600 }}>
                          {record.overtimeMinutes > 0 ? `+${fmtMinutes(record.overtimeMinutes)}` : '—'}
                        </td>

                        {/* Status & Exception Badges */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                            {/* Primary Status Badge */}
                            {record.status === 'PRESENT' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                ✅ On Time
                              </span>
                            )}

                            {record.status === 'WEEKLY_OFF' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }}>
                                ☕ Weekly Off
                              </span>
                            )}

                            {record.status === 'PAID_LEAVE' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                🏖️ Paid Leave
                              </span>
                            )}

                            {record.status === 'UNPAID_LEAVE' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}>
                                🚫 Unpaid Leave (LWP)
                              </span>
                            )}

                            {record.status === 'ABSENT' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }}>
                                ❌ Absent
                              </span>
                            )}

                            {record.status === 'HALF_DAY' && (
                              <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                                🌓 Half Day
                              </span>
                            )}

                            {/* Exception Tags */}
                            {record.isLate && (
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                                  color: '#f59e0b',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  border: '1px solid rgba(245, 158, 11, 0.4)'
                                }}
                              >
                                ⚠️ Late Arrive (+{record.lateMinutes}m)
                              </span>
                            )}

                            {record.isEarlyOut && (
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(249, 115, 22, 0.18)',
                                  color: '#f97316',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  border: '1px solid rgba(249, 115, 22, 0.4)'
                                }}
                              >
                                🚪 Early Out (-{record.earlyOutMinutes}m)
                              </span>
                            )}

                            {record.overtimeMinutes > 0 && (
                              <span
                                style={{
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                  color: '#a78bfa',
                                  fontSize: '0.725rem',
                                  fontWeight: 600
                                }}
                              >
                                🎯 OT +{fmtMinutes(record.overtimeMinutes)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Remarks */}
                        <td style={{ padding: '0.8rem 1rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                          {record.remarks || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Report Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 11pt !important;
          }
          nav, header, .btn, select, input, button {
            display: none !important;
          }
          .card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            page-break-inside: avoid;
          }
          table {
            color: #000 !important;
            border: 1px solid #ddd !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #1e293b !important;
          }
          td {
            border-top: 1px solid #e2e8f0 !important;
            color: #1e293b !important;
          }
        }
      `}</style>
    </div>
  )
}
