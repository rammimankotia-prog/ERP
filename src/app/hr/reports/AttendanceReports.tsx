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

  // Date controls — always initialized from REAL current date
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()) // 0-indexed
  const [customFrom, setCustomFrom] = useState(() => {
    // Default custom range: first day of current month to today
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return formatLocalDate(firstOfMonth)
  })
  const [customTo, setCustomTo] = useState(() => formatLocalDate(now))
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Live filter sources
  const [liveEmployees, setLiveEmployees] = useState<{ id: string; employeeId: string; name: string; designation: string }[]>([])
  const [liveBranches, setLiveBranches] = useState<{ id: string; name: string }[]>([])
  const [liveDepartments, setLiveDepartments] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/hr/employees')
      .then(r => r.json())
      .then(d => {
        if (d) {
          if (Array.isArray(d.employees)) {
            setLiveEmployees(d.employees.map((e: any) => ({
              id: e.id,
              employeeId: e.employeeId || e.id,
              name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || 'Staff',
              designation: e.designation || 'Staff'
            })))
          }
          if (Array.isArray(d.branches)) {
            setLiveBranches(d.branches)
          }
          if (Array.isArray(d.departments)) {
            const seen = new Set<string>()
            const uniqueDepts: { id: string; name: string }[] = []
            for (const dept of d.departments) {
              const name = (dept.name || '').trim()
              if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase())
                uniqueDepts.push({ id: dept.id, name })
              }
            }
            setLiveDepartments(uniqueDepts.sort((a, b) => a.name.localeCompare(b.name)))
          }
        }
      })
      .catch(() => {})
  }, [])

  // Data state
  const [reportData, setReportData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)

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

  // Compute active date range based on mode — uses REAL current date as anchor
  const activeRange = useMemo(() => {
    if (mode === 'WEEKLY') {
      const today = new Date()
      today.setDate(today.getDate() + (weekOffset * 7))
      return getWeekRange(today)
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
      list = list.filter(r => r.isLate || r.status === 'LATE' || r.status === 'LATE_AND_EARLY')
    } else if (selectedException === 'EARLY_OUT') {
      list = list.filter(r => r.isEarlyOut || r.status === 'EARLY_OUT' || r.status === 'LATE_AND_EARLY')
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

  // Resolved scope labels for printable header
  const selectedEmployeeObj = liveEmployees.find(e => e.id === employeeFilter || e.employeeId === employeeFilter)
  const employeeLabel = employeeFilter === 'ALL'
    ? 'All Employees (Entire Team)'
    : (selectedEmployeeObj ? `${selectedEmployeeObj.employeeId} - ${selectedEmployeeObj.name}` : employeeFilter)
  const selectedBranchObj = liveBranches.find(b => b.id === branchFilter)
  const branchLabel = branchFilter === 'ALL' ? 'All Branches' : (selectedBranchObj ? selectedBranchObj.name : branchFilter)
  const selectedDeptObj = liveDepartments.find(d => d.id === deptFilter)
  const deptLabel = deptFilter === 'ALL' ? 'All Departments' : (selectedDeptObj ? selectedDeptObj.name : deptFilter)

  // Direct PDF Download Handler
  const handleDownloadPDF = async () => {
    if (!reportData) return
    setIsExportingPDF(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')

      const element = document.getElementById('printable-report-wrapper')
      if (!element) {
        window.print()
        return
      }

      // Temporarily reveal print elements for html2canvas capture
      const printOnlyEls = element.querySelectorAll<HTMLElement>('.print-only')
      printOnlyEls.forEach(el => {
        if (el.classList.contains('print-footer')) {
          el.style.display = 'flex'
        } else {
          el.style.display = 'block'
        }
      })
      const printHideEls = element.querySelectorAll<HTMLElement>('.print-hide-col, .no-print')
      printHideEls.forEach(el => { el.style.display = 'none' })

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      // Revert inline display styles
      printOnlyEls.forEach(el => { el.style.display = '' })
      printHideEls.forEach(el => { el.style.display = '' })

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = 297
      const pdfHeight = 210
      const margin = 8
      const contentWidth = pdfWidth - margin * 2
      const contentHeight = (canvas.height * contentWidth) / canvas.width

      let heightLeft = contentHeight
      let position = margin

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, contentHeight)
      heightLeft -= (pdfHeight - margin * 2)

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, contentHeight)
        heightLeft -= (pdfHeight - margin * 2)
      }

      const cleanFrom = activeRange.from || 'start'
      const cleanTo = activeRange.to || 'end'
      pdf.save(`Attendance_Report_${cleanFrom}_to_${cleanTo}.pdf`)
    } catch (err) {
      console.error('Direct PDF export error:', err)
      window.print()
    } finally {
      setIsExportingPDF(false)
    }
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
        className="card no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
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
            backgroundColor: 'var(--bg-main)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border)'
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
        className="card no-print"
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
                title={weekOffset >= 0 ? 'Cannot navigate to future weeks' : 'Go to next week'}
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
                {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => new Date().getFullYear() - i).map(y => (
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
              onClick={handleDownloadPDF}
              disabled={isExportingPDF || !reportData || filteredRecords.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontWeight: 600,
                cursor: isExportingPDF ? 'not-allowed' : 'pointer'
              }}
              title="Download direct PDF file (.pdf)"
            >
              {isExportingPDF ? (
                <>
                  <span style={{ width: 13, height: 13, border: '2px solid #f87171', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.75s linear infinite' }} />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <span>📄</span>
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontWeight: 700,
                border: '1px solid #3b82f6',
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
                cursor: 'pointer'
              }}
              title="Print report or save to PDF (A4 Landscape formatted)"
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
              {liveEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeId} {emp.name} ({emp.designation})
                </option>
              ))}
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
              {liveBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
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
              {liveDepartments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
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
          className="no-print"
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
      <div id="printable-report-wrapper" className="card printable-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Print-Only Official Letterhead Header */}
        <div
          className="print-only letterhead-section"
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '2px solid #1e3a8a',
            backgroundColor: '#ffffff',
            color: '#0f172a'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18pt' }}>👑</span>
                <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#1e3a8a', letterSpacing: '-0.5px' }}>
                  HOTEL GRAND GODWIN & HOTEL GODWIN DELUXE
                </h1>
              </div>
              <div style={{ fontSize: '8.5pt', color: '#475569', marginTop: '3px', fontWeight: 500 }}>
                EXECUTIVE ENTERPRISE PORTAL • 8501/42, Arakashan Road, Ram Nagar, Paharganj, New Delhi - 110055 • Ph: +91 11 4766 5500
              </div>
              <h2 style={{ margin: '10px 0 0', fontSize: '13pt', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {mode === 'WEEKLY' ? 'Weekly' : mode === 'MONTHLY' ? 'Monthly' : 'Custom Period'} Attendance & Exception Ledger
              </h2>
            </div>

            <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#334155', lineHeight: 1.5 }}>
              <div><strong>Period:</strong> {formatDateDisplay(activeRange.from)} to {formatDateDisplay(activeRange.to)}</div>
              <div><strong>Generated:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
              <div><strong>Scope:</strong> {branchLabel} • {deptLabel}</div>
              <div><strong>Employee:</strong> {employeeLabel}</div>
              <div><strong>Active View:</strong> {viewTab === 'SUMMARY' ? 'Employee Summary Matrix' : 'Detailed Daily Attendance Log'}</div>
            </div>
          </div>

          {/* Compact Executive KPI Strip for Print */}
          {summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '8px',
                marginTop: '12px',
                background: '#f8fafc',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '8pt',
                textAlign: 'center'
              }}
            >
              <div><span style={{ color: '#64748b' }}>Staff Evaluated:</span> <strong style={{ color: '#0f172a', display: 'block', fontSize: '10pt' }}>{summary.totalEmployees}</strong></div>
              <div><span style={{ color: '#64748b' }}>Present Days:</span> <strong style={{ color: '#16a34a', display: 'block', fontSize: '10pt' }}>{summary.totalPresent}</strong></div>
              <div><span style={{ color: '#64748b' }}>Late Arrivals:</span> <strong style={{ color: '#d97706', display: 'block', fontSize: '10pt' }}>{summary.totalLate}</strong></div>
              <div><span style={{ color: '#64748b' }}>Early Exits:</span> <strong style={{ color: '#ea580c', display: 'block', fontSize: '10pt' }}>{summary.totalEarlyOut}</strong></div>
              <div><span style={{ color: '#64748b' }}>Leaves:</span> <strong style={{ color: '#dc2626', display: 'block', fontSize: '10pt' }}>{summary.totalUnpaidLeave} LWP / {summary.totalPaidLeave} PL</strong></div>
              <div><span style={{ color: '#64748b' }}>Total Hours / Rate:</span> <strong style={{ color: '#2563eb', display: 'block', fontSize: '10pt' }}>{fmtMinutes(summary.totalWorkingMinutes)} ({summary.attendanceRate}%)</strong></div>
            </div>
          )}
        </div>

        {/* Table View Switcher Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-main)',
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

          <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
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
          <div className="table-scroll-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '950px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
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
                  <th className="print-hide-col" style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Action</th>
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
                              backgroundColor: 'var(--border)',
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
                      <td className="print-hide-col" style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
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
          <div className="table-scroll-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '950px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
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
                        <td style={{ padding: '0.8rem 1rem' }}>
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
                                  +{record.lateMinutes >= 60 ? `${Math.floor(record.lateMinutes / 60)}h ${record.lateMinutes % 60}m` : `${record.lateMinutes}m`} late
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Punch Out */}
                        <td style={{ padding: '0.8rem 1rem' }}>
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
                                  -{record.earlyOutMinutes >= 60 ? `${Math.floor(record.earlyOutMinutes / 60)}h ${record.earlyOutMinutes % 60}m` : `${record.earlyOutMinutes}m`} early
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
                            {(record.status === 'LATE' || (record.status === 'PRESENT' && record.isLate)) && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  fontWeight: 700
                                }}
                              >
                                ⚠️ Late ({record.lateMinutes >= 60 ? `${Math.floor(record.lateMinutes / 60)}h ${record.lateMinutes % 60}m` : `+${record.lateMinutes}m`})
                              </span>
                            )}

                            {record.status === 'LATE_AND_EARLY' && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  fontWeight: 700
                                }}
                              >
                                ⚠️ Late & Early Out
                              </span>
                            )}

                            {record.status === 'EARLY_OUT' && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(249, 115, 22, 0.18)',
                                  color: '#f97316',
                                  border: '1px solid rgba(249, 115, 22, 0.4)',
                                  fontWeight: 700
                                }}
                              >
                                🚪 Early Out (-{record.earlyOutMinutes}m)
                              </span>
                            )}

                            {record.status === 'PRESENT' && !record.isLate && !record.isEarlyOut && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontWeight: 600
                                }}
                              >
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

                            {/* Exception Tags (when not already shown as primary status) */}
                            {record.isLate && record.status !== 'LATE' && record.status !== 'LATE_AND_EARLY' && (
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

                            {record.isEarlyOut && record.status !== 'EARLY_OUT' && record.status !== 'LATE_AND_EARLY' && (
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

        {/* Print-Only Official Footer */}
        <div
          className="print-only print-footer"
          style={{
            display: 'none',
            padding: '12px 20px',
            borderTop: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '8pt',
            color: '#64748b',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>Hotel Grand Godwin ERP • Official Attendance Record • System Generated</div>
          <div>Authorized HR Signatory: __________________________</div>
        </div>
      </div>

      {/* Printable Report Styles */}
      <style jsx global>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 10mm 10mm;
          }

          /* Unlock scrolling and fixed height so browser can paginate across multiple pages */
          html, body, .dashboard-container, #__next, div[style*="height: 100vh"], div[style*="overflow"] {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }

          /* Hide navigation, sidebars, buttons, inputs, interactive filters */
          aside, nav, header, [class*="sidebar"], [class*="topnavbar"], .no-print, .btn, select, input, button, .print-hide-col {
            display: none !important;
          }

          /* Display print-only letterhead & footer */
          .print-only {
            display: block !important;
          }
          .print-only.letterhead-section {
            display: block !important;
          }
          .print-only.print-footer {
            display: flex !important;
          }

          /* Container & card adjustments for clean paper print */
          .page-container, #printable-report-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          .card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            break-inside: auto !important;
            padding: 0 !important;
            margin: 0 0 12px 0 !important;
            overflow: visible !important;
          }

          /* Table pagination and border styling */
          .table-scroll-container {
            overflow: visible !important;
            max-height: none !important;
            width: 100% !important;
          }

          table {
            width: 100% !important;
            min-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
            color: #0f172a !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            font-size: 7.5pt !important;
            text-transform: uppercase !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          td {
            border: 1px solid #e2e8f0 !important;
            padding: 5px 8px !important;
            color: #1e293b !important;
            font-size: 8pt !important;
            background-color: transparent !important;
          }

          /* Ensure all nested text colors are dark in print */
          td * {
            color: inherit !important;
          }

          /* Badges in print */
          .badge, span[style*="border-radius"] {
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            background: #f8fafc !important;
            font-size: 7pt !important;
            padding: 1px 4px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}
