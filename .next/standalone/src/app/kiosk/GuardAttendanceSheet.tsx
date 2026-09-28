'use client'

import React, { useState, useEffect, useMemo } from 'react'

interface DayInfo {
  dayNumber: number
  date: string
  dayOfWeek: string
  dayShort: string
  isToday: boolean
  isSunday: boolean
  isSaturday: boolean
}

interface CellData {
  status: 'LEAVE' | 'WEEKLY_OFF' | 'PRESENT' | 'LATE' | 'ABSENT' | 'PENDING_TODAY' | string
  badgeText: string
  isApprovedLeave?: boolean
  isOffDay?: boolean
  isNonAmended?: boolean
  leaveReason?: string | null
  leaveTypeName?: string | null
  punchIn?: string | null
  punchOut?: string | null
  isLate?: boolean
  isEarlyOut?: boolean
  earlyOutMinutes?: number
  isHalfDay?: boolean
  totalMinutes?: number | null
  title?: string
}

interface RosterEmployee {
  id: string
  employeeId: string
  name: string
  firstName?: string
  lastName?: string
  designation: string
  branch: string
  department: string
  photo?: string | null
  morningTime?: string
  eveningTime?: string
  offDays: string[]
  cells: Record<number, CellData>
}

interface SheetResponse {
  year: number
  month: number
  monthName: string
  isCurrentMonth: boolean
  maxDay: number
  todayStr: string
  days: DayInfo[]
  employees: RosterEmployee[]
  stats: {
    totalEmployees: number
    presentToday: number
    onLeaveToday: number
    offToday: number
    waitingToday: number
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function GuardAttendanceSheet({
  isLight,
  onPunchEmployee,
}: {
  isLight: boolean
  onPunchEmployee?: (empId: string) => void
}) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [sortOrder, setSortOrder] = useState<'HOTEL' | 'NAME' | 'ID'>('HOTEL')

  const [loading, setLoading] = useState(true)
  const [sheetData, setSheetData] = useState<SheetResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Leave Reason Inspection Modal State
  const [selectedLeave, setSelectedLeave] = useState<{
    employeeName: string
    employeeCode: string
    department: string
    date: string
    leaveTypeName: string
    reason: string
  } | null>(null)

  const fetchSheet = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
        branchId: branchFilter,
        departmentId: deptFilter,
        search: search.trim(),
      })
      const res = await fetch(`/api/kiosk/sheet?${query.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load roster sheet')
      }
      const data = await res.json()
      setSheetData(data)
    } catch (err: any) {
      setError(err.message || 'Error fetching attendance sheet')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSheet()
  }, [selectedYear, selectedMonth, branchFilter, deptFilter])

  // Handle Search on Enter or Debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSheet()
  }

  // Month Navigation: strictly cannot go to future months
  const isViewingCurrentOrFuture =
    selectedYear > currentYear ||
    (selectedYear === currentYear && selectedMonth >= currentMonth)

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(y => y - 1)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (isViewingCurrentOrFuture) return
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(y => y + 1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  const handleThisMonth = () => {
    setSelectedYear(currentYear)
    setSelectedMonth(currentMonth)
  }

  // Extract branches and departments for dropdowns (Hotel Grand Godwin & Godwin Deluxe first)
  const availableBranches = useMemo(() => {
    const defaultBranches = ['Hotel Grand Godwin', 'Hotel Godwin Deluxe', 'Indian Grill', 'Cafe Brownie']
    const s = new Set<string>(defaultBranches)
    if (sheetData) {
      sheetData.employees.forEach(e => {
        if (e.branch) s.add(e.branch)
      })
    }
    const priority = (name: string) => {
      const l = (name || '').toLowerCase()
      if (l.includes('grand godwin')) return 1
      if (l.includes('godwin deluxe')) return 2
      if (l.includes('indian grill')) return 3
      if (l.includes('cafe brownie') || l.includes('brownie')) return 4
      return 10
    }
    return Array.from(s).sort((a, b) => priority(a) - priority(b))
  }, [sheetData])

  const availableDepts = useMemo(() => {
    if (!sheetData) return []
    const s = new Set<string>()
    sheetData.employees.forEach(e => {
      if (e.department) s.add(e.department)
    })
    return Array.from(s)
  }, [sheetData])

  // Sort employees: Hotel Name (Hotel Grand Godwin & Hotel Godwin Deluxe first), Name or ID
  const sortedEmployees = useMemo(() => {
    if (!sheetData?.employees) return []
    const list = [...sheetData.employees]
    const priority = (name: string) => {
      const l = (name || '').toLowerCase()
      if (l.includes('grand godwin')) return 1
      if (l.includes('godwin deluxe')) return 2
      if (l.includes('indian grill')) return 3
      if (l.includes('cafe brownie') || l.includes('brownie')) return 4
      return 10
    }

    return list.sort((a, b) => {
      if (sortOrder === 'HOTEL') {
        const pA = priority(a.branch)
        const pB = priority(b.branch)
        if (pA !== pB) return pA - pB
        const bComp = (a.branch || '').localeCompare(b.branch || '')
        if (bComp !== 0) return bComp
        return (a.employeeId || '').localeCompare(b.employeeId || '')
      } else if (sortOrder === 'NAME') {
        return (a.name || '').localeCompare(b.name || '')
      } else {
        return (a.employeeId || '').localeCompare(b.employeeId || '')
      }
    })
  }, [sheetData, sortOrder])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. TOP CONTROL BAR & STATS */}
      <div
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          borderRadius: '16px',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📋</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                }}
              >
                Staff Attendance Sheet (Till Today)
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Shift Manager-level employee roster matrix. Only dates up to <strong>today</strong> are visible. Approved leaves are non-amendable.
            </p>
          </div>

          {/* Month & Year Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isLight ? '#f8fafc' : '#0f172a',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              ◀ Prev Month
            </button>

            <span
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                background: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary)',
                fontWeight: 800,
                fontSize: '0.9rem',
                border: '1px solid rgba(37, 99, 235, 0.25)',
              }}
            >
              🗓️ {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isViewingCurrentOrFuture}
              title={isViewingCurrentOrFuture ? 'Future months cannot be viewed by security terminal' : 'Next Month'}
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isViewingCurrentOrFuture
                  ? (isLight ? '#f1f5f9' : '#1e293b')
                  : (isLight ? '#f8fafc' : '#0f172a'),
                color: isViewingCurrentOrFuture ? 'var(--text-muted)' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: isViewingCurrentOrFuture ? 'not-allowed' : 'pointer',
                opacity: isViewingCurrentOrFuture ? 0.4 : 1,
              }}
            >
              Next Month ▶
            </button>

            {!isViewingCurrentOrFuture && (
              <button
                type="button"
                onClick={handleThisMonth}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Today's Month
              </button>
            )}

            <button
              type="button"
              onClick={fetchSheet}
              title="Refresh Roster Sheet"
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isLight ? '#f8fafc' : '#0f172a',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄
            </button>
          </div>
        </div>

        {/* 2. SUMMARY KPI CHIPS */}
        {sheetData && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* Total Staff */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: isLight ? '#f8fafc' : '#0f172a',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>👥</span>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)' }}>
                  {sheetData.stats.totalEmployees}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Active Employees
                </div>
              </div>
            </div>

            {/* Present Today */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>🟢</span>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>
                  {sheetData.stats.presentToday}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                  Present / Punched In
                </div>
              </div>
            </div>

            {/* Approved Leaves Today */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '2px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>🌴</span>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#d97706' }}>
                  {sheetData.stats.onLeaveToday}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 800 }}>
                  On Approved Leave 🔒
                </div>
              </div>
            </div>

            {/* Weekly Off Today */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>🏖️</span>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f43f5e' }}>
                  {sheetData.stats.offToday}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 700 }}>
                  Weekly Off Today
                </div>
              </div>
            </div>

            {/* Waiting for punch */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: isLight ? '#f8fafc' : '#0f172a',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>⏳</span>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-muted)' }}>
                  {sheetData.stats.waitingToday}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Pending Check-in
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. SEARCH & FILTERS BAR */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '1rem',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Search staff name or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                paddingLeft: '38px',
                paddingRight: '12px',
                borderRadius: '10px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isLight ? '#f8fafc' : '#0f172a',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{
              height: '40px',
              padding: '0 12px',
              borderRadius: '10px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
              background: isLight ? '#f8fafc' : '#0f172a',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">🏨 All Hotels / Branches</option>
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{
              height: '40px',
              padding: '0 12px',
              borderRadius: '10px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
              background: isLight ? '#f8fafc' : '#0f172a',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">📁 All Departments</option>
            {availableDepts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Sort Order Selector */}
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as any)}
            style={{
              height: '40px',
              padding: '0 12px',
              borderRadius: '10px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
              background: isLight ? '#f8fafc' : '#0f172a',
              color: 'var(--primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <option value="HOTEL">↕️ Sort: Hotel (Grand Godwin & Godwin Deluxe)</option>
            <option value="NAME">👤 Sort: Employee Name (A-Z)</option>
            <option value="ID">🔢 Sort: Employee ID (Ascending)</option>
          </select>

          <button
            type="submit"
            style={{
              height: '40px',
              padding: '0 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Filter
          </button>
        </form>
      </div>

      {/* 4. MAIN ATTENDANCE MATRIX TABLE */}
      <div
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          borderRadius: '16px',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        }}
      >
        {loading ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Loading staff attendance roster till today...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{ fontWeight: 700 }}>{error}</p>
          </div>
        ) : !sheetData || sheetData.employees.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No employees found</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Try clearing your search or changing department filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: isLight ? '#f8fafc' : '#0f172a', position: 'sticky', top: 0, zIndex: 10 }}>
                  {/* Sticky Employee Header */}
                  <th
                    style={{
                      padding: '0.85rem 1rem',
                      textAlign: 'left',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      minWidth: '220px',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: isLight ? '#ffffff' : '#1e293b',
                      zIndex: 11,
                      borderRight: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                    }}
                  >
                    Employee ({sortedEmployees.length})
                  </th>

                  {/* Date Columns 01 up to Today (Strictly till today) */}
                  {sheetData.days.map(day => {
                    const headerBg = day.isToday
                      ? 'rgba(14, 165, 233, 0.18)'
                      : day.isSunday
                      ? 'rgba(244, 63, 94, 0.12)'
                      : day.isSaturday
                      ? 'rgba(245, 158, 11, 0.12)'
                      : undefined

                    const headerColor = day.isToday
                      ? '#0284c7'
                      : day.isSunday
                      ? '#f43f5e'
                      : day.isSaturday
                      ? '#d97706'
                      : 'var(--text-muted)'

                    return (
                      <th
                        key={day.dayNumber}
                        style={{
                          padding: '0.5rem 0.35rem',
                          textAlign: 'center',
                          minWidth: '42px',
                          backgroundColor: headerBg,
                          color: headerColor,
                          borderBottom: day.isToday
                            ? '3px solid #0284c7'
                            : (isLight ? '2px solid #e2e8f0' : '2px solid #334155'),
                          borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                            {String(day.dayNumber).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: '0.64rem', fontWeight: 700 }}>
                            {day.dayShort}
                          </span>
                          {day.isToday && (
                            <span
                              style={{
                                fontSize: '0.55rem',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                fontWeight: 900,
                              }}
                            >
                              TODAY
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}

                  {/* Monthly Aggregate Columns */}
                  <th
                    style={{
                      padding: '0.65rem 0.6rem',
                      textAlign: 'center',
                      color: '#10b981',
                      minWidth: '48px',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      borderLeft: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      fontWeight: 800,
                    }}
                    title="Total Present Days (On-Time + Late)"
                  >
                    🟢 P
                  </th>
                  <th
                    style={{
                      padding: '0.65rem 0.6rem',
                      textAlign: 'center',
                      color: '#8b5cf6',
                      minWidth: '48px',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      fontWeight: 800,
                    }}
                    title="Total Half Days (Worked ≤ 5 Hours)"
                  >
                    🌓 ½D
                  </th>
                  <th
                    style={{
                      padding: '0.65rem 0.6rem',
                      textAlign: 'center',
                      color: '#d97706',
                      minWidth: '48px',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      fontWeight: 800,
                    }}
                    title="Total Approved Leave Days"
                  >
                    🌴 L
                  </th>
                  <th
                    style={{
                      padding: '0.65rem 0.6rem',
                      textAlign: 'center',
                      color: '#f43f5e',
                      minWidth: '48px',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      fontWeight: 800,
                    }}
                    title="Total Weekly Off Days"
                  >
                    🏖️ OFF
                  </th>
                  <th
                    style={{
                      padding: '0.65rem 0.6rem',
                      textAlign: 'center',
                      color: '#ef4444',
                      minWidth: '48px',
                      borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                      fontWeight: 800,
                    }}
                    title="Total Absent Days"
                  >
                    🔴 A
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map(emp => {
                  let presentCount = 0
                  let halfDayCount = 0
                  let leaveCount = 0
                  let offCount = 0
                  let absentCount = 0

                  sheetData.days.forEach(d => {
                    const cell = emp.cells[d.dayNumber]
                    if (!cell) return
                    if (cell.status === 'HALF_DAY' || cell.isHalfDay) halfDayCount++
                    else if (cell.status === 'PRESENT' || cell.status === 'LATE') presentCount++
                    else if (cell.status === 'LEAVE') leaveCount++
                    else if (cell.status === 'WEEKLY_OFF') offCount++
                    else if (cell.status === 'ABSENT') absentCount++
                  })

                  const isDeluxe = (emp.branch || '').toLowerCase().includes('deluxe')
                  const isGrand = (emp.branch || '').toLowerCase().includes('grand godwin')

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Sticky Employee Identity Cell */}
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: isLight ? '#ffffff' : '#1e293b',
                          zIndex: 2,
                          borderRight: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          {/* Avatar */}
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: isDeluxe
                                ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                : isGrand
                                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              flexShrink: 0,
                            }}
                          >
                            {(emp.firstName?.[0] || 'E').toUpperCase()}{(emp.lastName?.[0] || 'M').toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 800,
                                color: 'var(--text-main)',
                                fontSize: '0.86rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {emp.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                                {emp.employeeId}
                              </span>
                              {' · '}{emp.designation}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                              {/* Hotel Property Badge */}
                              <span
                                title={`Hotel: ${emp.branch}`}
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: isDeluxe
                                    ? 'rgba(99, 102, 241, 0.12)'
                                    : isGrand
                                    ? 'rgba(217, 119, 6, 0.12)'
                                    : 'rgba(16, 185, 129, 0.12)',
                                  color: isDeluxe
                                    ? '#6366f1'
                                    : isGrand
                                    ? '#d97706'
                                    : '#059669',
                                  fontWeight: 800,
                                }}
                              >
                                🏨 {isGrand ? 'Grand Godwin' : isDeluxe ? 'Godwin Deluxe' : emp.branch || 'Grand Godwin'}
                              </span>

                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: isLight ? '#f1f5f9' : '#0f172a',
                                  color: 'var(--text-muted)',
                                  fontWeight: 600,
                                }}
                              >
                                {emp.department}
                              </span>
                              {/* Configured Weekly Off Badge */}
                              <span
                                title={`Weekly Off: ${emp.offDays.join(', ')}`}
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(244, 63, 94, 0.1)',
                                  color: '#f43f5e',
                                  fontWeight: 700,
                                }}
                              >
                                🏖️ {emp.offDays.map(d => d.slice(0, 3)).join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Day Cells */}
                      {sheetData.days.map(day => {
                        const cell = emp.cells[day.dayNumber] || { status: 'ABSENT', badgeText: 'A' }
                        const isToday = day.isToday

                        // 1. APPROVED LEAVE (Non-amended & highlighted reason)
                        if (cell.status === 'LEAVE') {
                          return (
                            <td
                              key={day.dayNumber}
                              onClick={() => {
                                setSelectedLeave({
                                  employeeName: emp.name,
                                  employeeCode: emp.employeeId,
                                  department: emp.department,
                                  date: day.date,
                                  leaveTypeName: cell.leaveTypeName || 'Approved Leave',
                                  reason: cell.leaveReason || 'Authorized Leave',
                                })
                              }}
                              title={cell.title}
                              style={{
                                padding: '0.35rem 0.2rem',
                                textAlign: 'center',
                                backgroundColor: 'rgba(245, 158, 11, 0.07)',
                                borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                                cursor: 'pointer',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px',
                                }}
                              >
                                <span
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.22)',
                                    color: '#b45309',
                                    border: '1px solid rgba(245, 158, 11, 0.45)',
                                    fontWeight: 900,
                                    fontSize: '0.66rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    boxShadow: '0 1px 3px rgba(245, 158, 11, 0.15)',
                                  }}
                                >
                                  🌴 LEAVE 🔒
                                </span>

                                {/* Highlighted reason preview badge */}
                                {cell.leaveReason && (
                                  <span
                                    style={{
                                      fontSize: '0.58rem',
                                      color: '#92400e',
                                      fontWeight: 800,
                                      maxWidth: '65px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      backgroundColor: 'rgba(254, 243, 199, 0.9)',
                                      padding: '1px 3px',
                                      borderRadius: '3px',
                                      border: '1px dashed #f59e0b',
                                      marginTop: '1px',
                                    }}
                                  >
                                    {cell.leaveReason}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        }

                        // 2. WEEKLY OFF (Non-amended)
                        if (cell.status === 'WEEKLY_OFF') {
                          return (
                            <td
                              key={day.dayNumber}
                              title={cell.title}
                              style={{
                                padding: '0.35rem 0.2rem',
                                textAlign: 'center',
                                backgroundColor: isLight ? 'rgba(244, 63, 94, 0.03)' : 'rgba(244, 63, 94, 0.06)',
                                borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                              }}
                            >
                              <span
                                style={{
                                  padding: '2px 5px',
                                  borderRadius: '5px',
                                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                                  color: '#f43f5e',
                                  border: '1px solid rgba(244, 63, 94, 0.25)',
                                  fontWeight: 800,
                                  fontSize: '0.66rem',
                                }}
                              >
                                OFF
                              </span>
                            </td>
                          )
                        }

                        // 3. HALF DAY (<= 5 hours worked)
                        if (cell.status === 'HALF_DAY' || cell.isHalfDay) {
                          return (
                            <td
                              key={day.dayNumber}
                              title={cell.title}
                              style={{
                                padding: '0.35rem 0.2rem',
                                textAlign: 'center',
                                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                <span
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                    color: '#7c3aed',
                                    border: '1px solid rgba(139, 92, 246, 0.45)',
                                    fontWeight: 800,
                                    fontSize: '0.66rem',
                                    boxShadow: '0 1px 3px rgba(139, 92, 246, 0.15)',
                                  }}
                                >
                                  ½ DAY
                                </span>
                                {cell.punchIn && (
                                  <span style={{ fontSize: '0.56rem', color: '#7c3aed', fontWeight: 700 }}>
                                    {cell.punchIn.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        }

                        // 4. PRESENT / LATE / EARLY OUT
                        if (cell.status === 'PRESENT' || cell.status === 'LATE' || cell.status === 'EARLY_OUT' || cell.status === 'LATE_AND_EARLY') {
                          const isLate = cell.isLate || cell.status === 'LATE' || cell.status === 'LATE_AND_EARLY'
                          const isEarly = cell.isEarlyOut || cell.status === 'EARLY_OUT' || cell.status === 'LATE_AND_EARLY'
                          const badgeLabel = cell.badgeText || (isLate && isEarly ? 'L/E' : isLate ? 'LATE' : isEarly ? 'EARLY' : 'P')
                          const badgeBg = isLate && isEarly ? 'rgba(239, 68, 68, 0.15)' : isLate ? 'rgba(245, 158, 11, 0.15)' : isEarly ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)'
                          const badgeColor = isLate && isEarly ? '#ef4444' : isLate ? '#d97706' : isEarly ? '#ea580c' : '#10b981'
                          const badgeBorder = isLate && isEarly ? '1px solid rgba(239, 68, 68, 0.3)' : isLate ? '1px solid rgba(245, 158, 11, 0.3)' : isEarly ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'

                          return (
                            <td
                              key={day.dayNumber}
                              title={cell.title}
                              style={{
                                padding: '0.35rem 0.2rem',
                                textAlign: 'center',
                                backgroundColor: isToday ? 'rgba(14, 165, 233, 0.05)' : undefined,
                                borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                <span
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    backgroundColor: badgeBg,
                                    color: badgeColor,
                                    border: badgeBorder,
                                    fontWeight: 800,
                                    fontSize: '0.66rem',
                                  }}
                                >
                                  {badgeLabel}
                                </span>
                                {cell.punchIn && (
                                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {cell.punchIn.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        }

                        // 5. TODAY WAITING
                        if (cell.status === 'PENDING_TODAY') {
                          return (
                            <td
                              key={day.dayNumber}
                              title={cell.title}
                              onClick={() => onPunchEmployee && onPunchEmployee(emp.id)}
                              style={{
                                padding: '0.35rem 0.2rem',
                                textAlign: 'center',
                                backgroundColor: 'rgba(14, 165, 233, 0.08)',
                                borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                                cursor: onPunchEmployee ? 'pointer' : 'default',
                              }}
                            >
                              <span
                                style={{
                                  padding: '2px 5px',
                                  borderRadius: '5px',
                                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                  color: '#0284c7',
                                  border: '1px solid rgba(14, 165, 233, 0.25)',
                                  fontWeight: 700,
                                  fontSize: '0.65rem',
                                }}
                              >
                                Ready
                              </span>
                            </td>
                          )
                        }

                        // 6. ABSENT
                        return (
                          <td
                            key={day.dayNumber}
                            title={cell.title}
                            style={{
                              padding: '0.35rem 0.2rem',
                              textAlign: 'center',
                              borderLeft: isLight ? '1px solid #f1f5f9' : '1px solid #334155',
                            }}
                          >
                            <span
                              style={{
                                padding: '2px 5px',
                                borderRadius: '5px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontWeight: 700,
                                fontSize: '0.66rem',
                              }}
                            >
                              A
                            </span>
                          </td>
                        )
                      })}

                      {/* Summary Cells */}
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#10b981',
                          borderLeft: isLight ? '2px solid #e2e8f0' : '2px solid #334155',
                        }}
                      >
                        {presentCount}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#8b5cf6',
                        }}
                      >
                        {halfDayCount}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#d97706',
                        }}
                      >
                        {leaveCount}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#f43f5e',
                        }}
                      >
                        {offCount}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#ef4444',
                        }}
                      >
                        {absentCount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. APPROVED LEAVE DETAIL & REASON INSPECTOR MODAL */}
      {selectedLeave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: isLight ? '#ffffff' : '#1e293b',
              border: '2px solid #f59e0b',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedLeave(null)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                🌴
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Approved Leave Details
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: '#d97706',
                    fontWeight: 800,
                  }}
                >
                  🔒 Locked · Non-Amendable Management Approval
                </span>
              </div>
            </div>

            {/* Employee info */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: isLight ? '#f8fafc' : '#0f172a',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Staff Name:</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{selectedLeave.employeeName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Staff Code:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                  {selectedLeave.employeeCode}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedLeave.department}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Leave Date:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{selectedLeave.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Category:</span>
                <span style={{ fontWeight: 700, color: '#d97706' }}>{selectedLeave.leaveTypeName}</span>
              </div>
            </div>

            {/* Employee Stated Reason (Prominently highlighted) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#b45309',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                📝 Reason Stated by Employee (Highlighted):
              </label>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '2px solid rgba(245, 158, 11, 0.4)',
                  color: isLight ? '#78350f' : '#fef3c7',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  lineHeight: '1.4',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                "{selectedLeave.reason}"
              </div>
            </div>

            {/* Non-amendable security statement */}
            <div
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
                lineHeight: '1.35',
                marginBottom: '1.25rem',
                display: 'flex',
                gap: '6px',
                alignItems: 'flex-start',
              }}
            >
              <span>🔒</span>
              <span>
                <strong>Notice for Security Guard:</strong> This leave has been officially reviewed and authorized by Management. It cannot be altered, amended, or overridden at the gate kiosk terminal.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLeave(null)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
