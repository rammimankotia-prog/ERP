'use client'

import React, { useState, useEffect, useMemo } from 'react'

type Shift = {
  id: string
  name: string
  type: string
  startTime: string
  endTime: string
  firstSlot?: string
  secondSlot?: string
  breakTime?: string
  graceMinutes: number
  branchId: string
}

const SHIFT_TYPE_COLOR: Record<string, string> = {
  FIXED: '#10b981',
  ROTATING: '#f59e0b',
  NIGHT: '#8b5cf6',
  BREAK: '#0ea5e9',
  SPLIT: '#0ea5e9',
}

export type EmployeeItem = {
  id: string
  code: string
  name: string
  designation: string
  branch: string
  dept: string
  offDays?: string[]
  swapShiftEligible?: boolean
  morningTime?: string
  eveningTime?: string
  shiftName?: string
  isNightShift?: boolean
  nightShiftStart?: string
  nightShiftEnd?: string
}

export const DEFAULT_ROSTER_EMPLOYEES: EmployeeItem[] = []

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEK_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Generate realistic monthly roster pattern for any staff list
function generateInitialMonthlyRoster(year: number, month: number, employees: EmployeeItem[] = DEFAULT_ROSTER_EMPLOYEES) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const res: Record<string, Record<number, string>> = {}

  employees.forEach(emp => {
    res[emp.id] = {}
    const empOffDays = Array.isArray(emp.offDays) && emp.offDays.length > 0 ? emp.offDays : ['Sunday']
    const isNightProfile =
      (emp as any).isNightShift === true ||
      (emp as any).shiftName?.toLowerCase().includes('night') ||
      (emp as any).shift?.toLowerCase().includes('night') ||
      (emp.morningTime || '').startsWith('2') ||
      (emp.morningTime || '').startsWith('19') ||
      (emp.eveningTime || '') === '08:00' ||
      (emp.eveningTime || '') === '07:00'
    const isSecurity = emp.dept.toLowerCase().includes('security') || emp.designation.toLowerCase().includes('security')
    const isHousekeeping = emp.dept.toLowerCase().includes('housekeeping')
    const isCafe = emp.branch.toLowerCase().includes('cafe') || emp.dept.toLowerCase().includes('beverage')

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat
      const dayName = WEEK_DAY_NAMES[dayOfWeek]
      const isConfiguredOff = empOffDays.some(od => od.toLowerCase() === dayName.toLowerCase())

      if (isConfiguredOff) {
        res[emp.id][day] = 'OFF'
      } else if (isNightProfile) {
        res[emp.id][day] = 'Night Shift'
      } else if (isSecurity) {
        res[emp.id][day] = day % 2 === 0 ? 'Night Shift' : 'Morning Shift'
      } else if (isCafe) {
        res[emp.id][day] = day % 3 === 0 ? 'Break Shift' : 'Morning Shift'
      } else if (isHousekeeping) {
        res[emp.id][day] = (dayOfWeek === 5 || dayOfWeek === 6) ? 'Night Shift' : 'Morning Shift'
      } else {
        res[emp.id][day] = 'Morning Shift'
      }
    }
  })

  return res
}

const SHORT_TO_FULL_DAYS: Record<string, string> = {
  'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday'
}

// Generate weekly roster for all staff
function generateInitialWeeklyRoster(employees: EmployeeItem[] = DEFAULT_ROSTER_EMPLOYEES): Record<string, Record<string, string>> {
  const res: Record<string, Record<string, string>> = {}
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  employees.forEach(emp => {
    res[emp.id] = {}
    const empOffDays = Array.isArray(emp.offDays) && emp.offDays.length > 0 ? emp.offDays : ['Sunday']
    const isNightProfile =
      (emp as any).isNightShift === true ||
      (emp as any).shiftName?.toLowerCase().includes('night') ||
      (emp as any).shift?.toLowerCase().includes('night') ||
      (emp.morningTime || '').startsWith('2') ||
      (emp.morningTime || '').startsWith('19') ||
      (emp.eveningTime || '') === '08:00' ||
      (emp.eveningTime || '') === '07:00'
    const isSecurity = emp.dept.toLowerCase().includes('security') || emp.designation.toLowerCase().includes('security')
    const isHousekeeping = emp.dept.toLowerCase().includes('housekeeping')
    const isCafe = emp.branch.toLowerCase().includes('cafe') || emp.dept.toLowerCase().includes('beverage')

    days.forEach((day, idx) => {
      const fullDayName = SHORT_TO_FULL_DAYS[day] || day
      const isConfiguredOff = empOffDays.some(od => od.toLowerCase() === fullDayName.toLowerCase())

      if (isConfiguredOff) {
        res[emp.id][day] = 'OFF'
      } else if (isNightProfile) {
        res[emp.id][day] = 'Night Shift'
      } else if (isSecurity) {
        res[emp.id][day] = idx % 2 === 0 ? 'Night Shift' : 'Morning Shift'
      } else if (isCafe) {
        res[emp.id][day] = (day === 'Fri' || day === 'Sat') ? 'Break Shift' : 'Morning Shift'
      } else if (isHousekeeping) {
        res[emp.id][day] = (day === 'Fri' || day === 'Sat') ? 'Night Shift' : 'Morning Shift'
      } else {
        res[emp.id][day] = 'Morning Shift'
      }
    })
  })

  return res
}

// Helper to get Monday of any date
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// Format week range: e.g. "07 Sep – 13 Sep 2026"
function formatWeekRange(startMonday: Date): string {
  const endSunday = new Date(startMonday)
  endSunday.setDate(startMonday.getDate() + 6)

  const startDay = startMonday.getDate().toString().padStart(2, '0')
  const startMonth = startMonday.toLocaleDateString('en-GB', { month: 'short' })
  const endDay = endSunday.getDate().toString().padStart(2, '0')
  const endMonth = endSunday.toLocaleDateString('en-GB', { month: 'short' })
  const year = endSunday.getFullYear()

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} ${startMonth} ${year}`
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`
}

// LocalStorage Persistence Keys & Helpers
const getMonthlyStorageKey = (year: number, month: number) => `GODWIN_ROSTER_MONTHLY_${year}_${month}`
const getWeeklyStorageKey = (monday: Date) => {
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `GODWIN_ROSTER_WEEKLY_${y}-${m}-${d}`
}

function saveMonthlyToStorage(year: number, month: number, data: Record<string, Record<number, string>>) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getMonthlyStorageKey(year, month), JSON.stringify(data))
    } catch {}
    // Also persist to server (non-blocking) so attendance punch can be roster-aware
    try {
      fetch('/api/hr/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, roster: data }),
      }).catch(() => {})
    } catch {}
  }
}

function saveWeeklyToStorage(monday: Date, data: Record<string, Record<string, string>>) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getWeeklyStorageKey(monday), JSON.stringify(data))
    } catch {}
  }
}

export const DEFAULT_SHIFTS_LIST: Shift[] = [
  { id: 'shift-1', name: 'Morning Shift', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' },
  { id: 'shift-afternoon', name: 'Afternoon Shift', type: 'FIXED', startTime: '13:00', endTime: '23:00', graceMinutes: 15, branchId: 'mock-1' },
  { id: 'shift-2', name: 'Break Shift', type: 'BREAK', startTime: '10:00', endTime: '22:00', firstSlot: '10:00 – 14:00', secondSlot: '18:00 – 22:00', breakTime: '14:00 – 18:00', graceMinutes: 15, branchId: 'mock-1' },
  { id: 'shift-3', name: 'Night Shift', type: 'NIGHT', startTime: '20:00', endTime: '08:00', graceMinutes: 20, branchId: 'mock-1' },
]

export default function ShiftsManager() {
  const [employeesList, setEmployeesList] = useState<EmployeeItem[]>(DEFAULT_ROSTER_EMPLOYEES)
  const [shifts, setShifts] = useState<Shift[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('GODWIN_SHIFTS_BACKUP_V1')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {}
    }
    return DEFAULT_SHIFTS_LIST
  })
  const [roster, setRoster] = useState<Record<string, Record<string, string>>>(() =>
    generateInitialWeeklyRoster(DEFAULT_ROSTER_EMPLOYEES)
  )
  const [showForm, setShowForm] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Live Local Time
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDateStr, setCurrentDateStr] = useState<string>('')

  // Roster View Mode: 'MONTHLY' | 'WEEKLY'
  const [rosterViewMode, setRosterViewMode] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY')
  const [isRosterFullscreen, setIsRosterFullscreen] = useState(false)

  // Monthly Roster State
  const [selectedMonth, setSelectedMonth] = useState<number>(8) // September (0-indexed)
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Dynamic available years list: supports past and future years indefinitely
  const availableYears = useMemo(() => {
    const startY = 2024
    const endY = Math.max(new Date().getFullYear() + 25, selectedYear + 10, 2050)
    const list: number[] = []
    for (let y = startY; y <= endY; y++) {
      list.push(y)
    }
    if (!list.includes(selectedYear)) {
      list.push(selectedYear)
      list.sort((a, b) => a - b)
    }
    return list
  }, [selectedYear])

  const [monthlyRoster, setMonthlyRoster] = useState<Record<string, Record<number, string>>>(() =>
    generateInitialMonthlyRoster(2026, 8, DEFAULT_ROSTER_EMPLOYEES)
  )

  // Branch & Department Filters: Grand Godwin, Godwin Deluxe, Cafe Brownie & Housekeeping, Front Office, Security Guard
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const [deptFilter, setDeptFilter] = useState<string>('ALL')

  // Employee Name / ID Search Filter
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('')

  // Calendar / Date-wise Inspector State
  const [calendarDate, setCalendarDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [highlightedDay, setHighlightedDay] = useState<number | null>(() => new Date().getDate())
  const [showFromCurrentDate, setShowFromCurrentDate] = useState<boolean>(false)
  const [showDateInspector, setShowDateInspector] = useState<boolean>(true)

  // Calendar / Week State
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => getMonday(new Date()))

  // Drag & Drop Shift State
  const [draggedCell, setDraggedCell] = useState<{
    type: 'MONTHLY' | 'WEEKLY'
    empId: string
    dayKey: number | string
    shift: string
  } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{
    empId: string
    dayKey: number | string
  } | null>(null)

  // Employee Drag-to-Sort State
  const [draggedEmpId, setDraggedEmpId] = useState<string | null>(null)
  const [dragOverEmpId, setDragOverEmpId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)

  // Shift Swap Modal State (Day ⇄ Night / Date Range)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapScope, setSwapScope] = useState<'ALL_VISIBLE' | 'SINGLE' | 'TWO'>('ALL_VISIBLE')
  const [swapAction, setSwapAction] = useState<'DAY_NIGHT_FLIP' | 'DAY_TO_NIGHT' | 'NIGHT_TO_DAY' | 'EXCHANGE_TWO' | 'SET_SHIFT'>('DAY_NIGHT_FLIP')
  const [swapTargetShift, setSwapTargetShift] = useState<string>('Night Shift')
  const [swapSelectedEmpId, setSwapSelectedEmpId] = useState<string>('')
  const [swapSecondEmpId, setSwapSecondEmpId] = useState<string>('')
  const [swapFromDay, setSwapFromDay] = useState<number>(1)
  const [swapToDay, setSwapToDay] = useState<number>(15)

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
      setCurrentDateStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      )
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load live employees from ERP API and synchronize with localStorage roster cache
  useEffect(() => {
    fetch('/api/hr/employees')
      .then(r => r.json())
      .then(d => {
        const rawList = Array.isArray(d) ? d : (Array.isArray(d?.employees) ? d.employees : [])
        const mapped: EmployeeItem[] = rawList
          .filter((e: any) => e.status === 'ACTIVE' || !e.status)
          .map((e: any) => ({
            id: e.id,
            code: e.employeeId || e.code || 'EMP',
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || 'Staff',
            designation: e.designation || 'Staff',
            branch: e.branch?.name || e.branch || 'Hotel Grand Godwin',
            dept: e.department?.name || e.department || e.dept || 'Front Office',
            offDays: Array.isArray(e.offDays) && e.offDays.length > 0 ? e.offDays : ['Sunday'],
            swapShiftEligible: e.swapShiftEligible === true,
            morningTime: e.morningTime || '09:00',
            eveningTime: e.eveningTime || '18:00',
          }))

        // Restore custom employee sort order from localStorage if present
        if (typeof window !== 'undefined') {
          const savedOrder = localStorage.getItem('GODWIN_ROSTER_EMPLOYEE_SORT_ORDER')
          if (savedOrder) {
            try {
              const orderIds: string[] = JSON.parse(savedOrder)
              mapped.sort((a, b) => {
                const idxA = orderIds.indexOf(a.id)
                const idxB = orderIds.indexOf(b.id)
                if (idxA === -1 && idxB === -1) return 0
                if (idxA === -1) return 1
                if (idxB === -1) return -1
                return idxA - idxB
              })
            } catch {}
          }
        }

        setEmployeesList(mapped)

        if (mapped.length > 0) {
          if (!swapSelectedEmpId) setSwapSelectedEmpId(mapped[0].id)
          if (!swapSecondEmpId && mapped.length > 1) setSwapSecondEmpId(mapped[1].id)

          // 1. Monthly Roster Sync
          let mRoster = generateInitialMonthlyRoster(selectedYear, selectedMonth, mapped)
          if (typeof window !== 'undefined') {
            const savedMonthly = localStorage.getItem(getMonthlyStorageKey(selectedYear, selectedMonth))
            if (savedMonthly) {
              try {
                const parsed = JSON.parse(savedMonthly)
                if (parsed && Object.keys(parsed).length > 0) {
                  mRoster = { ...mRoster, ...parsed }
                }
              } catch {}
            }
          }
          setMonthlyRoster(mRoster)
          saveMonthlyToStorage(selectedYear, selectedMonth, mRoster)

          // 2. Weekly Roster Sync
          let wRoster = generateInitialWeeklyRoster(mapped)
          if (typeof window !== 'undefined') {
            const savedWeekly = localStorage.getItem(getWeeklyStorageKey(selectedMonday))
            if (savedWeekly) {
              try {
                const parsed = JSON.parse(savedWeekly)
                if (parsed && Object.keys(parsed).length > 0) {
                  wRoster = { ...wRoster, ...parsed }
                }
              } catch {}
            }
          }
          setRoster(wRoster)
          saveWeeklyToStorage(selectedMonday, wRoster)
        } else {
          setMonthlyRoster({})
          setRoster({})
        }
      })
      .catch(() => {})
  }, [selectedYear, selectedMonth, selectedMonday])

  // Form states
  const [form, setForm] = useState({
    name: 'Break Shift',
    type: 'BREAK',
    startTime: '10:00',
    endTime: '22:00',
    morningStart: '10:00',
    morningEnd: '14:00',
    eveningStart: '18:00',
    eveningEnd: '22:00',
    graceMinutes: 15,
    branchId: 'mock-1',
  })

  useEffect(() => {
    fetch('/api/hr/shifts')
      .then(r => r.json())
      .then(d => {
        if (d.shifts && Array.isArray(d.shifts) && d.shifts.length > 0) {
          setShifts(d.shifts)
          try {
            localStorage.setItem('GODWIN_SHIFTS_BACKUP_V1', JSON.stringify(d.shifts))
          } catch {}
        } else {
          const cached = typeof window !== 'undefined' ? localStorage.getItem('GODWIN_SHIFTS_BACKUP_V1') : null
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setShifts(parsed)
                return
              }
            } catch {}
          }
          setShifts(DEFAULT_SHIFTS_LIST)
        }
      })
      .catch(() => {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('GODWIN_SHIFTS_BACKUP_V1') : null
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setShifts(parsed)
              return
            }
          } catch {}
        }
        setShifts(DEFAULT_SHIFTS_LIST)
      })
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      morningStart: '10:00',
      morningEnd: '14:00',
      eveningStart: '18:00',
      eveningEnd: '22:00',
      graceMinutes: 15,
      branchId: 'mock-1',
    })
    setEditingShiftId(null)
    setShowForm(false)
  }

  const handleOpenCreateBreakShift = () => {
    setForm({
      name: 'Break Shift',
      type: 'BREAK',
      startTime: '10:00',
      endTime: '22:00',
      morningStart: '10:00',
      morningEnd: '14:00',
      eveningStart: '18:00',
      eveningEnd: '22:00',
      graceMinutes: 15,
      branchId: 'mock-1',
    })
    setEditingShiftId(null)
    setShowForm(true)
  }

  const handleEditShift = (shift: Shift) => {
    let mStart = '10:00'
    let mEnd = '14:00'
    let eStart = '18:00'
    let eEnd = '22:00'

    if (shift.firstSlot) {
      const parts = shift.firstSlot.split('–').map(s => s.trim())
      if (parts.length === 2) {
        mStart = parts[0]
        mEnd = parts[1]
      }
    }
    if (shift.secondSlot) {
      const parts = shift.secondSlot.split('–').map(s => s.trim())
      if (parts.length === 2) {
        eStart = parts[0]
        eEnd = parts[1]
      }
    }

    setForm({
      name: shift.name,
      type: shift.type,
      startTime: shift.startTime,
      endTime: shift.endTime,
      morningStart: mStart,
      morningEnd: mEnd,
      eveningStart: eStart,
      eveningEnd: eEnd,
      graceMinutes: shift.graceMinutes,
      branchId: shift.branchId || 'mock-1',
    })
    setEditingShiftId(shift.id)
    setShowForm(true)
  }

  const handleDeleteShift = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      let updatedList = shifts.filter(s => s.id !== id)
      try {
        const res = await fetch(`/api/hr/shifts?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (data.shifts && Array.isArray(data.shifts)) {
          updatedList = data.shifts
        }
      } catch {}
      setShifts(updatedList)
      try {
        localStorage.setItem('GODWIN_SHIFTS_BACKUP_V1', JSON.stringify(updatedList))
      } catch {}
      setMessage(`🗑️ Shift "${name}" removed.`)
    }
  }

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const isBreak = form.type === 'BREAK' || form.type === 'SPLIT'
    const payload = {
      name: form.name,
      type: form.type,
      startTime: isBreak ? form.morningStart : form.startTime,
      endTime: isBreak ? form.eveningEnd : form.endTime,
      firstSlot: isBreak ? `${form.morningStart} – ${form.morningEnd}` : undefined,
      secondSlot: isBreak ? `${form.eveningStart} – ${form.eveningEnd}` : undefined,
      breakTime: isBreak ? `${form.morningEnd} – ${form.eveningStart}` : undefined,
      graceMinutes: form.graceMinutes,
      branchId: form.branchId,
    }

    try {
      if (editingShiftId) {
        const res = await fetch('/api/hr/shifts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingShiftId, ...payload }),
        })
        const data = await res.json()
        const updatedList = data.shifts && Array.isArray(data.shifts) && data.shifts.length > 0
          ? data.shifts
          : shifts.map(s => s.id === editingShiftId ? { ...s, ...payload } : s)
        setShifts(updatedList)
        try {
          localStorage.setItem('GODWIN_SHIFTS_BACKUP_V1', JSON.stringify(updatedList))
        } catch {}
        setMessage('✅ Shift updated successfully!')
        resetForm()
      } else {
        const res = await fetch('/api/hr/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        const newShift: Shift = data.shift || {
          id: 'shift-' + Date.now(),
          ...payload,
        }
        const updatedList = data.shifts && Array.isArray(data.shifts) && data.shifts.length > 0
          ? data.shifts
          : [...shifts, newShift]
        setShifts(updatedList)
        try {
          localStorage.setItem('GODWIN_SHIFTS_BACKUP_V1', JSON.stringify(updatedList))
        } catch {}
        setMessage('✅ Shift created successfully!')
        resetForm()
      }
    } catch {
      let updatedList = shifts
      if (editingShiftId) {
        updatedList = shifts.map(s => s.id === editingShiftId ? { ...s, ...payload } : s)
      } else {
        updatedList = [...shifts, { id: 'shift-' + Date.now(), ...payload }]
      }
      setShifts(updatedList)
      try {
        localStorage.setItem('GODWIN_SHIFTS_BACKUP_V1', JSON.stringify(updatedList))
      } catch {}
      setMessage('✅ Saved (offline mode)')
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  // Weekly shift toggle
  const cycleRosterShift = (empId: string, day: string) => {
    const emp = employeesList.find(e => e.id === empId)
    // Lock non-eligible employees — show brief message instead of toggling
    if (emp && emp.swapShiftEligible === false) {
      setMessage(`🔒 ${emp.name} is a Single Shift employee. Enable "Swap Shift Eligible" in Employee profile to allow shift changes.`)
      return
    }
    const shiftOptions = ['Morning Shift', 'Afternoon Shift', 'Break Shift', 'Night Shift', 'OFF']
    const current = roster[empId]?.[day] || 'Morning Shift'
    const nextIdx = (shiftOptions.indexOf(current) + 1) % shiftOptions.length
    const nextShift = shiftOptions[nextIdx]

    setRoster(prev => {
      const updated = {
        ...prev,
        [empId]: {
          ...prev[empId],
          [day]: nextShift,
        },
      }
      saveWeeklyToStorage(selectedMonday, updated)
      return updated
    })
  }

  // Monthly shift toggle
  const cycleMonthlyRosterShift = (empId: string, dayNum: number) => {
    const emp = employeesList.find(e => e.id === empId)
    // Lock non-eligible employees — show brief message instead of toggling
    if (emp && emp.swapShiftEligible === false) {
      setMessage(`🔒 ${emp.name} is a Single Shift employee. Enable "Swap Shift Eligible" in Employee profile to allow shift changes.`)
      return
    }
    const shiftOptions = ['Morning Shift', 'Afternoon Shift', 'Break Shift', 'Night Shift', 'OFF']
    const current = monthlyRoster[empId]?.[dayNum] || 'Morning Shift'
    const nextIdx = (shiftOptions.indexOf(current) + 1) % shiftOptions.length
    const nextShift = shiftOptions[nextIdx]

    setMonthlyRoster(prev => {
      const updated = {
        ...prev,
        [empId]: {
          ...prev[empId],
          [dayNum]: nextShift,
        }
      }
      saveMonthlyToStorage(selectedYear, selectedMonth, updated)
      return updated
    })
  }

  // Month navigation handlers
  const handleMonthChange = (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(getMonthlyStorageKey(newYear, newMonth))
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && Object.keys(parsed).length > 0) {
            setMonthlyRoster(parsed)
            return
          }
        } catch {}
      }
    }
    const generated = generateInitialMonthlyRoster(newYear, newMonth, employeesList)
    setMonthlyRoster(generated)
    saveMonthlyToStorage(newYear, newMonth, generated)
  }

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      handleMonthChange(11, selectedYear - 1)
    } else {
      handleMonthChange(selectedMonth - 1, selectedYear)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      handleMonthChange(0, selectedYear + 1)
    } else {
      handleMonthChange(selectedMonth + 1, selectedYear)
    }
  }

  const handleCurrentMonth = () => {
    const now = new Date()
    handleMonthChange(now.getMonth(), now.getFullYear())
  }

  // Auto-populate monthly shifts pattern
  const handleAutoPopulateMonth = () => {
    const generated = generateInitialMonthlyRoster(selectedYear, selectedMonth, employeesList)
    setMonthlyRoster(generated)
    saveMonthlyToStorage(selectedYear, selectedMonth, generated)
    setMessage(`✨ Auto-populated standard hotel duty patterns for ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`)
  }

  // Shift Swap Handler across Date Range
  const handleApplyShiftSwap = () => {
    const minDay = Math.min(Number(swapFromDay) || 1, Number(swapToDay) || 1)
    const maxDay = Math.min(Math.max(Number(swapFromDay) || 1, Number(swapToDay) || 1), daysInMonth)

    let targetEmps: EmployeeItem[] = []
    if (swapScope === 'ALL_VISIBLE') {
      targetEmps = filteredEmployees
    } else if (swapScope === 'SINGLE') {
      const found = employeesList.find(e => e.id === swapSelectedEmpId)
      if (found) targetEmps = [found]
    }

    if (swapScope === 'TWO' || swapAction === 'EXCHANGE_TWO') {
      if (!swapSelectedEmpId || !swapSecondEmpId || swapSelectedEmpId === swapSecondEmpId) {
        alert('Please select two different employees to exchange duties.')
        return
      }
      setMonthlyRoster(prev => {
        const next = { ...prev }
        const r1 = { ...(next[swapSelectedEmpId] || {}) }
        const r2 = { ...(next[swapSecondEmpId] || {}) }
        for (let d = minDay; d <= maxDay; d++) {
          const s1 = r1[d] || 'Morning Shift'
          const s2 = r2[d] || 'Morning Shift'
          r1[d] = s2
          r2[d] = s1
        }
        next[swapSelectedEmpId] = r1
        next[swapSecondEmpId] = r2
        saveMonthlyToStorage(selectedYear, selectedMonth, next)
        return next
      })
      const emp1Name = employeesList.find(e => e.id === swapSelectedEmpId)?.name || 'Staff 1'
      const emp2Name = employeesList.find(e => e.id === swapSecondEmpId)?.name || 'Staff 2'
      setMessage(`🔄 Exchanged shifts between ${emp1Name} and ${emp2Name} from Day ${minDay} to ${maxDay} (${MONTH_NAMES[selectedMonth]} ${selectedYear}).`)
      setShowSwapModal(false)
      return
    }

    if (targetEmps.length === 0) {
      alert('Please select at least one employee.')
      return
    }

    setMonthlyRoster(prev => {
      const next = { ...prev }
      targetEmps.forEach(emp => {
        const empR = { ...(next[emp.id] || {}) }
        for (let d = minDay; d <= maxDay; d++) {
          const cur = empR[d] || 'Morning Shift'
          if (swapAction === 'DAY_NIGHT_FLIP') {
            if (cur === 'Morning Shift') empR[d] = 'Night Shift'
            else if (cur === 'Night Shift') empR[d] = 'Morning Shift'
          } else if (swapAction === 'DAY_TO_NIGHT') {
            if (cur === 'Morning Shift') empR[d] = 'Night Shift'
          } else if (swapAction === 'NIGHT_TO_DAY') {
            if (cur === 'Night Shift') empR[d] = 'Morning Shift'
          } else if (swapAction === 'SET_SHIFT') {
            empR[d] = swapTargetShift
          }
        }
        next[emp.id] = empR
      })
      saveMonthlyToStorage(selectedYear, selectedMonth, next)
      return next
    })

    const actionText =
      swapAction === 'DAY_NIGHT_FLIP'
        ? 'Day ⇄ Night (Bidirectional Swap)'
        : swapAction === 'DAY_TO_NIGHT'
        ? 'Day ➔ Night'
        : swapAction === 'NIGHT_TO_DAY'
        ? 'Night ➔ Day'
        : `assigned to ${swapTargetShift}`

    setMessage(`🔄 Shift swap applied (${actionText}) for ${targetEmps.length} staff from Day ${minDay} to Day ${maxDay} (${MONTH_NAMES[selectedMonth]} ${selectedYear}).`)
    setShowSwapModal(false)
  }

  // Drag & Drop Employee Sorting Handler
  const handleReorderEmployee = (sourceId: string, targetId: string, position: 'above' | 'below') => {
    setEmployeesList(prev => {
      const sourceIdx = prev.findIndex(x => x.id === sourceId)
      if (sourceIdx === -1) return prev
      const targetIdx = prev.findIndex(x => x.id === targetId)
      if (targetIdx === -1) return prev

      const nextList = [...prev]
      const [movedItem] = nextList.splice(sourceIdx, 1)
      const newTargetIdx = nextList.findIndex(x => x.id === targetId)
      const insertIdx = position === 'above' ? newTargetIdx : newTargetIdx + 1
      nextList.splice(insertIdx, 0, movedItem)

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('GODWIN_ROSTER_EMPLOYEE_SORT_ORDER', JSON.stringify(nextList.map(x => x.id)))
        } catch {}
      }
      setMessage(`↕️ Reordered ${movedItem.name} in staff duty roster.`)
      return nextList
    })
  }

  // Reset staff ordering to alphabetical
  const handleResetEmployeeSort = () => {
    setEmployeesList(prev => {
      const nextList = [...prev].sort((a, b) => a.name.localeCompare(b.name))
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('GODWIN_ROSTER_EMPLOYEE_SORT_ORDER', JSON.stringify(nextList.map(x => x.id)))
        } catch {}
      }
      setMessage('🔤 Staff sorted alphabetically (A-Z).')
      return nextList
    })
  }

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate()
  }, [selectedYear, selectedMonth])

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [daysInMonth])

  // Filter employees by Branch (Grand Godwin, Godwin Deluxe, Cafe Brownie) and Department (Housekeeping, Front Office, Security Guard)
  const filteredEmployees = useMemo(() => {
    return employeesList.filter(emp => {
      // Branch filter
      let branchMatch = true
      if (branchFilter !== 'ALL') {
        const b = emp.branch.toLowerCase()
        const target = branchFilter.toLowerCase()
        if (target.includes('grand') || target === 'grand godwin') {
          branchMatch = b.includes('grand')
        } else if (target.includes('deluxe') || target === 'godwin deluxe') {
          branchMatch = b.includes('deluxe')
        } else if (target.includes('brownie') || target === 'cafe brownie') {
          branchMatch = b.includes('brownie') || b.includes('cafe')
        } else {
          branchMatch = b.includes(target)
        }
      }

      // Department filter
      let deptMatch = true
      if (deptFilter !== 'ALL') {
        const d = emp.dept.toLowerCase()
        const des = emp.designation.toLowerCase()
        const target = deptFilter.toLowerCase()

        if (target.includes('housekeeping')) {
          deptMatch = d.includes('housekeeping') || des.includes('housekeeping')
        } else if (target.includes('front') || target.includes('front office')) {
          deptMatch = d.includes('front') || des.includes('front')
        } else if (target.includes('security') || target.includes('guard')) {
          deptMatch = d.includes('security') || des.includes('security') || d.includes('guard') || des.includes('guard')
        } else if (target.includes('beverage') || target.includes('food') || target.includes('cafe')) {
          deptMatch = d.includes('beverage') || d.includes('cafe') || des.includes('barista') || des.includes('cafe')
        } else if (target.includes('accounts')) {
          deptMatch = d.includes('accounts') || des.includes('accounts')
        } else {
          deptMatch = d.includes(target) || des.includes(target)
        }
      }

      // Employee Name / ID / Designation Search filter
      let nameMatch = true
      if (employeeSearchQuery.trim()) {
        const q = employeeSearchQuery.toLowerCase().trim()
        nameMatch =
          emp.name.toLowerCase().includes(q) ||
          emp.code.toLowerCase().includes(q) ||
          emp.designation.toLowerCase().includes(q) ||
          emp.dept.toLowerCase().includes(q)
      }

      return branchMatch && deptMatch && nameMatch
    })
  }, [employeesList, branchFilter, deptFilter, employeeSearchQuery])

  // Today Date Reference
  const today = new Date()
  const todayDay = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  // Visible days in monthly view (optionally filtered from selected date onwards)
  const visibleDaysArray = useMemo(() => {
    if (showFromCurrentDate && highlightedDay) {
      return daysArray.filter(d => d >= highlightedDay)
    }
    return daysArray
  }, [daysArray, showFromCurrentDate, highlightedDay])

  // Calendar Date Pick Handler
  const handleCalendarDateChange = (newDateStr: string) => {
    if (!newDateStr) return
    const parts = newDateStr.split('-')
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) - 1 // 0-indexed
      const d = parseInt(parts[2], 10)
      setCalendarDate(newDateStr)
      setHighlightedDay(d)
      if (y !== selectedYear || m !== selectedMonth) {
        handleMonthChange(m, y)
      }
      const pickedObj = new Date(y, m, d)
      setSelectedMonday(getMonday(pickedObj))
      setMessage(`📅 Date selected: ${d} ${MONTH_NAMES[m]} ${y}. Inspecting shifts date-wise.`)
    }
  }

  // Jump to Current Date Handler
  const handleJumpToCurrentDate = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    setCalendarDate(dateStr)
    setHighlightedDay(d)
    if (y !== selectedYear || m !== selectedMonth) {
      handleMonthChange(m, y)
    }
    setSelectedMonday(getMonday(now))
    setMessage(`📍 Jumped to Today: ${d} ${MONTH_NAMES[m]} ${y}`)
  }

  // Date-wise Duty Inspector Stats for Selected Day
  const dateDutyStats = useMemo(() => {
    const targetDay = highlightedDay || todayDay
    const morning: EmployeeItem[] = []
    const afternoon: EmployeeItem[] = []
    const breakShift: EmployeeItem[] = []
    const night: EmployeeItem[] = []
    const off: EmployeeItem[] = []

    filteredEmployees.forEach(emp => {
      const shift = monthlyRoster[emp.id]?.[targetDay] || 'Morning Shift'
      if (shift === 'Night Shift') night.push(emp)
      else if (shift === 'Afternoon Shift') afternoon.push(emp)
      else if (shift === 'Break Shift') breakShift.push(emp)
      else if (shift === 'Morning Shift') morning.push(emp)
      else off.push(emp)
    })

    return {
      day: targetDay,
      morning,
      afternoon,
      breakShift,
      night,
      off,
      totalDuty: morning.length + afternoon.length + breakShift.length + night.length
    }
  }, [filteredEmployees, monthlyRoster, highlightedDay, todayDay])

  // Monthly CSV Export
  const handleDownloadMonthlyCSV = () => {
    const dayHeaders = daysArray.map(d => `"${d} ${MONTH_NAMES[selectedMonth].slice(0, 3)}"`)
    const headers = [
      '"Employee ID"',
      '"Employee Name"',
      '"Designation"',
      '"Branch"',
      '"Department"',
      ...dayHeaders,
      '"Morning (M)"',
      '"Afternoon (A)"',
      '"Break (B)"',
      '"Night (N)"',
      '"Weekly Off (OFF)"',
      '"Total Work Days"'
    ]

    const rows = filteredEmployees.map(emp => {
      const empRoster = monthlyRoster[emp.id] || {}
      const dayValues = daysArray.map(d => `"${empRoster[d] || 'OFF'}"`)

      let mCount = 0
      let aCount = 0
      let bCount = 0
      let nCount = 0
      let offCount = 0

      daysArray.forEach(d => {
        const s = empRoster[d]
        if (s === 'Morning Shift') mCount++
        else if (s === 'Afternoon Shift') aCount++
        else if (s === 'Break Shift') bCount++
        else if (s === 'Night Shift') nCount++
        else offCount++
      })

      const totalWork = mCount + aCount + bCount + nCount

      return [
        `"${emp.code}"`,
        `"${emp.name}"`,
        `"${emp.designation}"`,
        `"${emp.branch}"`,
        `"${emp.dept}"`,
        ...dayValues,
        mCount,
        aCount,
        bCount,
        nCount,
        offCount,
        totalWork
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `monthly-roster-${MONTH_NAMES[selectedMonth]}-${selectedYear}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Week calculation helpers
  const handlePrevWeek = () => {
    setSelectedMonday(prev => {
      const n = new Date(prev)
      n.setDate(n.getDate() - 7)
      return n
    })
  }

  const handleNextWeek = () => {
    setSelectedMonday(prev => {
      const n = new Date(prev)
      n.setDate(n.getDate() + 7)
      return n
    })
  }

  const handleToday = () => {
    setSelectedMonday(getMonday(new Date()))
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-')
      if (parts.length === 3) {
        const picked = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        setSelectedMonday(getMonday(picked))
      }
    }
  }

  // Generate 7 days for current week view
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const weekDays = dayNames.map((dayName, idx) => {
    const d = new Date(selectedMonday)
    d.setDate(selectedMonday.getDate() + idx)
    const isToday =
      d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear
    const isSat = dayName === 'Sat'
    const isSun = dayName === 'Sun'

    return {
      dayKey: dayName,
      label: dayName,
      dateNum: d.getDate().toString().padStart(2, '0'),
      monthName: d.toLocaleDateString('en-GB', { month: 'short' }),
      isToday,
      isSat,
      isSun,
    }
  })

  return (
    <div
      style={
        isRosterFullscreen
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
              gap: '2rem',
              width: '100%'
            }
      }
    >
      {message && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--success)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.875rem'
          }}
        >
          <span>{message}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.2rem' }}>
            ×
          </button>
        </div>
      )}

      {/* Shifts Definition Header Cards (Hidden in Fullscreen Roster Mode for Focus) */}
      {!isRosterFullscreen && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.4rem' }}>Defined Shifts</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hotel staff schedules with Fixed, Split / Break, and Night duties</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handleOpenCreateBreakShift}
                style={{
                  borderColor: '#0ea5e9',
                  color: '#38bdf8',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>☕ + Break Shift</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (showForm) {
                    resetForm()
                  } else {
                    resetForm()
                    setShowForm(true)
                  }
                }}
              >
                {showForm ? 'Cancel' : '+ New Shift'}
              </button>
            </div>
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--primary)', animation: 'fadeIn 0.2s ease-in-out' }}>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editingShiftId ? '✏️ Edit Shift' : '✨ Create New Shift'}
              </h3>
              <form onSubmit={handleSaveShift} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Shift Name *</label>
                    <input
                      required
                      className="form-input"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Break Shift, Morning Shift"
                    />
                  </div>
                  <div className="form-group">
                    <label>Shift Type *</label>
                    <select
                      className="form-input"
                      value={form.type}
                      onChange={e => {
                        const newType = e.target.value
                        setForm(p => ({
                          ...p,
                          type: newType,
                          name: newType === 'BREAK' ? 'Break Shift' : p.name,
                        }))
                      }}
                    >
                      <option value="FIXED">Fixed (Standard 8-9 Hours)</option>
                      <option value="BREAK">Split / Break Shift (Morning + Evening)</option>
                      <option value="NIGHT">Night Duty (Overnight)</option>
                      <option value="ROTATING">Rotating</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Hotel Branch</label>
                    <select
                      className="form-input"
                      value={form.branchId}
                      onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                    >
                      <option value="mock-1">Hotel Grand Godwin (Pahar Ganj)</option>
                      <option value="mock-2">Hotel Godwin Deluxe (Pahar Ganj)</option>
                      <option value="mock-3">Indian Grill Rooftop</option>
                      <option value="mock-4">Cafe Brownie Lobby</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className="form-input"
                      value={form.graceMinutes}
                      onChange={e => setForm(p => ({ ...p, graceMinutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {form.type === 'BREAK' ? (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'rgba(14, 165, 233, 0.05)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(14, 165, 233, 0.2)',
                    }}
                  >
                    <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                      ☕ Break Shift Dual Slot Configuration
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label>🌅 Morning Slot Start</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.morningStart}
                          onChange={e => setForm(p => ({ ...p, morningStart: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌅 Morning Slot End</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.morningEnd}
                          onChange={e => setForm(p => ({ ...p, morningEnd: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌆 Evening Slot Start</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.eveningStart}
                          onChange={e => setForm(p => ({ ...p, eveningStart: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌆 Evening Slot End</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.eveningEnd}
                          onChange={e => setForm(p => ({ ...p, eveningEnd: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Shift Start Time *</label>
                      <input
                        required
                        type="time"
                        className="form-input"
                        value={form.startTime}
                        onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Shift End Time *</label>
                      <input
                        required
                        type="time"
                        className="form-input"
                        value={form.endTime}
                        onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
                    {loading ? 'Saving...' : editingShiftId ? 'Update Shift' : 'Create Shift'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <style>{`
            @media (min-width: 960px) {
              .shifts-top-grid {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              }
            }
            @media (max-width: 959px) and (min-width: 580px) {
              .shifts-top-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
            @media (max-width: 579px) {
              .shifts-top-grid {
                grid-template-columns: 1fr !important;
              }
            }
            .shift-card-compact {
              padding: 0.75rem 0.85rem !important;
              gap: 0.55rem !important;
            }
          `}</style>
          <div className="shifts-top-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {shifts.map(shift => {
              const isBreak = shift.type === 'BREAK' || shift.type === 'SPLIT'
              const badgeColor = SHIFT_TYPE_COLOR[shift.type] || '#10b981'

              return (
                <div
                  key={shift.id}
                  className="card shift-card-compact"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: isBreak ? '1px solid rgba(14, 165, 233, 0.4)' : undefined,
                    boxShadow: isBreak ? '0 4px 16px rgba(14, 165, 233, 0.08)' : undefined,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isBreak && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                      }}
                    />
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ color: 'var(--text-main)', fontSize: '0.94rem', fontWeight: 700, margin: '0 0 0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shift.name}
                        </h3>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${badgeColor}22`,
                            color: badgeColor,
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            border: `1px solid ${badgeColor}44`,
                          }}
                        >
                          {isBreak ? 'BREAK' : shift.type}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEditShift(shift)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '0.15rem 0.4rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                          title="Edit Shift"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift.id, shift.name)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '0.15rem 0.4rem',
                            color: 'var(--danger, #ef4444)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                          title="Delete Shift"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {isBreak ? (
                      <div
                        style={{
                          padding: '0.4rem 0.55rem',
                          backgroundColor: 'rgba(14, 165, 233, 0.05)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(14, 165, 233, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            🌅 <b>Morn:</b>
                          </span>
                          <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.82rem' }}>
                            {shift.firstSlot || '10:00 – 14:00'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            🌆 <b>Eve:</b>
                          </span>
                          <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.82rem' }}>
                            {shift.secondSlot || '18:00 – 22:00'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '0.2rem 0', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.18rem', letterSpacing: '0.5px' }}>
                          {shift.startTime} – {shift.endTime}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.45rem',
                    }}
                  >
                    <span>⏱ Grace: {shift.graceMinutes}m</span>
                    <span>
                      {isBreak
                        ? `☕ ${shift.breakTime || '14:00 – 18:00'}`
                        : shift.type === 'NIGHT'
                        ? '🌙 Night Duty'
                        : shift.name.toLowerCase().includes('afternoon')
                        ? '🌆 Afternoon Duty'
                        : '☀️ Day Duty'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Roster Card: Supporting Monthly & Weekly Options */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* Top Control Bar with View Switcher */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📅</span>
                <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                  Staff Duty Roster
                </h2>
              </div>

              {/* View Switcher: Monthly vs Weekly */}
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--bg-main)',
                  padding: '3px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setRosterViewMode('MONTHLY')}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: rosterViewMode === 'MONTHLY' ? 'var(--primary)' : 'transparent',
                    color: rosterViewMode === 'MONTHLY' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📆 Monthly Roster
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewMode('WEEKLY')}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: rosterViewMode === 'WEEKLY' ? 'var(--primary)' : 'transparent',
                    color: rosterViewMode === 'WEEKLY' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📅 Weekly Roster
                </button>
              </div>

              {/* Branch Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>🏨 Branch:</span>
                <select
                  className="form-input"
                  style={{ width: '185px', padding: '0.35rem 0.6rem', fontSize: '0.82rem', fontWeight: 600 }}
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                >
                  <option value="ALL">🏨 All Branches</option>
                  <option value="Grand Godwin">Hotel Grand Godwin</option>
                  <option value="Godwin Deluxe">Hotel Godwin Deluxe</option>
                  <option value="Cafe Brownie">Cafe Brownie</option>
                </select>
              </div>

              {/* Department Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>📁 Dept:</span>
                <select
                  className="form-input"
                  style={{ width: '185px', padding: '0.35rem 0.6rem', fontSize: '0.82rem', fontWeight: 600 }}
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                >
                  <option value="ALL">📁 All Departments</option>
                  <option value="Housekeeping">🧹 Housekeeping</option>
                  <option value="Front Office">🛎️ Front Office</option>
                  <option value="Security Guard">🛡️ Security Guard</option>
                  <option value="Food & Beverage">☕ Food & Beverage (Cafe)</option>
                  <option value="Accounts">💼 Accounts</option>
                </select>
              </div>

              {/* Employee Name Filter Input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>🔍</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter employee name / ID..."
                  value={employeeSearchQuery}
                  onChange={e => setEmployeeSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: '30px',
                    paddingRight: employeeSearchQuery ? '26px' : '10px',
                    width: '230px',
                    height: '35px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                  }}
                />
                {employeeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setEmployeeSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                    }}
                    title="Clear employee search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Clear Filters button */}
              {(branchFilter !== 'ALL' || deptFilter !== 'ALL' || employeeSearchQuery) && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setBranchFilter('ALL'); setDeptFilter('ALL'); setEmployeeSearchQuery(''); }}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#fca5a5' }}
                  title="Clear all filters"
                >
                  ✕ Clear
                </button>
              )}

              {/* Staff Count Badge */}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}
              >
                {filteredEmployees.length} Staff
              </span>
            </div>

            {/* Shift Badges Legend */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700 }}>M</span> Morning (09-18)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 700 }}>A</span> Afternoon (13-23)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(14, 165, 233, 0.2)', color: '#0ea5e9', fontWeight: 700 }}>B</span> Break Shift
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', fontWeight: 700 }}>N</span> Night Duty
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(245, 158, 11, 0.7)' }}></span> Sat (Weekend)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f43f5e', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(244, 63, 94, 0.7)' }}></span> Sun (Weekly Off)
              </span>
            </div>
          </div>

          {/* Right Action Controls: Live Time, Fullscreen, CSV, Print */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Live Clock */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: 'var(--success)',
                fontWeight: 600,
              }}
              title={`Local Date: ${currentDateStr}`}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
              <span>🕒 <b>{currentTime || '--:--'}</b></span>
            </div>

            {/* Swap Shifts (Date Range) Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowSwapModal(true)}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                cursor: 'pointer'
              }}
              title="Swap Day & Night duties across a date range or exchange staff schedules"
            >
              <span>🔄 Swap Shifts</span>
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsRosterFullscreen(!isRosterFullscreen)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title={isRosterFullscreen ? 'Exit Fullscreen' : 'Open Fullscreen Window'}
            >
              {isRosterFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen Window'}
            </button>

            {/* Export CSV */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDownloadMonthlyCSV}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title="Download full monthly roster as CSV"
            >
              📥 Export CSV
            </button>

            {/* Print */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => window.print()}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title="Print Monthly Roster"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPTION 1: MONTHLY ROSTER VIEW */}
        {/* ========================================================================= */}
        {rosterViewMode === 'MONTHLY' && (
          <div>
            {/* Month Navigation & Filtering Sub-bar */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* Calendar Date-Wise Picker */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1' }}>📅 Check Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    value={calendarDate}
                    onChange={e => handleCalendarDateChange(e.target.value)}
                    style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', fontWeight: 600, width: '135px', height: '32px', cursor: 'pointer' }}
                    title="Select a specific date to inspect duties date-wise"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleJumpToCurrentDate}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', height: '32px', whiteSpace: 'nowrap' }}
                    title="Jump to today's current date"
                  >
                    📍 Today
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowFromCurrentDate(!showFromCurrentDate)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.78rem',
                      height: '32px',
                      whiteSpace: 'nowrap',
                      backgroundColor: showFromCurrentDate ? 'rgba(99, 102, 241, 0.15)' : undefined,
                      borderColor: showFromCurrentDate ? '#6366f1' : undefined,
                      color: showFromCurrentDate ? '#6366f1' : undefined,
                      fontWeight: showFromCurrentDate ? 700 : 500,
                    }}
                    title={showFromCurrentDate ? "Showing days from selected date onwards (Click to show all days)" : "Filter table to only show days from selected date onwards"}
                  >
                    {showFromCurrentDate ? '⏩ From Date: ON' : '⏩ From Date'}
                  </button>
                </div>

                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevMonth}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  ◀ Prev
                </button>

                <select
                  className="form-input"
                  style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                  value={selectedMonth}
                  onChange={e => handleMonthChange(Number(e.target.value), selectedYear)}
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                <select
                  className="form-input"
                  style={{ width: '90px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                  value={selectedYear}
                  onChange={e => handleMonthChange(selectedMonth, Number(e.target.value))}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleNextMonth}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Next ▶
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCurrentMonth}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                >
                  This Month
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Branch:</label>
                  <select
                    className="form-input"
                    style={{ width: '185px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                  >
                    <option value="ALL">🏨 All Branches</option>
                    <option value="Grand Godwin">Hotel Grand Godwin</option>
                    <option value="Godwin Deluxe">Hotel Godwin Deluxe</option>
                    <option value="Cafe Brownie">Cafe Brownie</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dept:</label>
                  <select
                    className="form-input"
                    style={{ width: '175px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                  >
                    <option value="ALL">📁 All Departments</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Front Office">Front Office</option>
                    <option value="Security Guard">Security Guard</option>
                    <option value="Food & Beverage">Food & Beverage (Cafe)</option>
                    <option value="Accounts">Accounts</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAutoPopulateMonth}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  title="Auto-fill standard duty pattern across all days of the month"
                >
                  ✨ Auto-Fill Pattern
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowSwapModal(true)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    borderColor: '#6366f1',
                    color: '#818cf8',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  title="Swap Day ⇄ Night across date range or exchange staff schedules"
                >
                  <span>🔄 Swap Shifts (Date Range)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetEmployeeSort}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  title="Reset staff order alphabetically (A-Z)"
                >
                  <span>🔤 Sort A–Z</span>
                </button>
              </div>
            </div>

            {/* Date-Wise Duty Inspector for Selected Date */}
            {highlightedDay && (
              <div
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.05)',
                  borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>📅</span>
                    <span>Date-Wise Duty Inspector: <b>{highlightedDay} {MONTH_NAMES[selectedMonth]} {selectedYear}</b></span>
                    {highlightedDay === todayDay && selectedMonth === todayMonth && selectedYear === todayYear && (
                      <span style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        TODAY
                      </span>
                    )}
                  </span>

                  <span style={{ color: 'var(--text-muted)' }}>|</span>

                  {/* Duty breakdown chips */}
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      color: '#8b5cf6',
                      fontWeight: 700,
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    }}
                    title={dateDutyStats.night.map(e => e.name).join(', ') || 'No staff'}
                  >
                    🌙 Night (8 PM – 8 AM): <b>{dateDutyStats.night.length}</b> staff
                    {dateDutyStats.night.length > 0 && (
                      <span style={{ opacity: 0.85, fontSize: '0.72rem', marginLeft: '4px' }}>
                        ({dateDutyStats.night.map(e => e.name.split(' ')[0]).slice(0, 3).join(', ')}{dateDutyStats.night.length > 3 ? '...' : ''})
                      </span>
                    )}
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      fontWeight: 700,
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                    title={dateDutyStats.morning.map(e => e.name).join(', ') || 'No staff'}
                  >
                    ☀️ Morning: <b>{dateDutyStats.morning.length}</b>
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      fontWeight: 700,
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                    title={dateDutyStats.afternoon.map(e => e.name).join(', ') || 'No staff'}
                  >
                    🌆 Afternoon: <b>{dateDutyStats.afternoon.length}</b>
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(14, 165, 233, 0.12)',
                      color: '#0ea5e9',
                      fontWeight: 700,
                      border: '1px solid rgba(14, 165, 233, 0.25)',
                    }}
                    title={dateDutyStats.breakShift.map(e => e.name).join(', ') || 'No staff'}
                  >
                    ☕ Break: <b>{dateDutyStats.breakShift.length}</b>
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(244, 63, 94, 0.12)',
                      color: '#f43f5e',
                      fontWeight: 700,
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                    }}
                    title={dateDutyStats.off.map(e => e.name).join(', ') || 'No staff'}
                  >
                    🏖️ Off: <b>{dateDutyStats.off.length}</b>
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Total Active on Duty: <b style={{ color: 'var(--text-main)' }}>{dateDutyStats.totalDuty}</b></span>
                </div>
              </div>
            )}

            {/* Monthly Calendar Matrix Table */}
            <div className="table-scroll-container" style={{ overflowX: 'auto', maxHeight: isRosterFullscreen ? 'calc(100vh - 180px)' : '750px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1050px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10 }}>
                    {/* Sticky Employee Header */}
                    <th
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        minWidth: '200px',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'var(--bg-card)',
                        zIndex: 11,
                        borderRight: '2px solid var(--border)',
                        borderBottom: '2px solid var(--border)',
                      }}
                    >
                      <span style={{ marginRight: '6px', opacity: 0.7 }} title="Drag ⠿ handles to reorder staff">↕</span>
                      Employee ({filteredEmployees.length})
                    </th>

                    {/* Day Columns 1 to 30/31 (or filtered from selected/current date) */}
                    {visibleDaysArray.map(dayNum => {
                      const d = new Date(selectedYear, selectedMonth, dayNum)
                      const dayOfWeekNum = d.getDay()
                      const dayOfWeekName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekNum]
                      const isSun = dayOfWeekNum === 0
                      const isSat = dayOfWeekNum === 6
                      const isToday =
                        d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear
                      const isSelected = highlightedDay === dayNum

                      const headerBg = isSelected
                        ? 'rgba(99, 102, 241, 0.22)'
                        : isToday
                        ? 'rgba(14, 165, 233, 0.18)'
                        : isSat
                        ? 'rgba(245, 158, 11, 0.12)'
                        : isSun
                        ? 'rgba(244, 63, 94, 0.12)'
                        : undefined

                      const headerTextColor = isSelected
                        ? '#818cf8'
                        : isToday
                        ? '#38bdf8'
                        : isSat
                        ? '#f59e0b'
                        : isSun
                        ? '#f43f5e'
                        : 'var(--text-muted)'

                      return (
                        <th
                          key={dayNum}
                          onClick={() => {
                            setHighlightedDay(dayNum)
                            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                            setCalendarDate(dateStr)
                          }}
                          title={`Click to inspect staff duties on ${dayNum} ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                          style={{
                            padding: '0.5rem 0.35rem',
                            textAlign: 'center',
                            minWidth: '38px',
                            backgroundColor: headerBg,
                            color: headerTextColor,
                            cursor: 'pointer',
                            borderBottom: isSelected ? '3px solid #6366f1' : isToday ? '2px solid #0ea5e9' : '2px solid var(--border)',
                            borderLeft: isSelected ? '2px solid #6366f1' : isSat ? '1px dashed rgba(245, 158, 11, 0.3)' : isSun ? '1px dashed rgba(244, 63, 94, 0.3)' : '1px solid var(--border)',
                            borderRight: isSelected ? '2px solid #6366f1' : undefined,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{dayNum.toString().padStart(2, '0')}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{dayOfWeekName}</span>
                            {isToday ? (
                              <span style={{ fontSize: '0.55rem', backgroundColor: '#0ea5e9', color: '#fff', padding: '1px 3px', borderRadius: '3px', fontWeight: 800 }}>
                                NOW
                              </span>
                            ) : isSelected ? (
                              <span style={{ fontSize: '0.55rem', backgroundColor: '#6366f1', color: '#fff', padding: '1px 3px', borderRadius: '3px', fontWeight: 800 }}>
                                CHECK
                              </span>
                            ) : null}
                          </div>
                        </th>
                      )
                    })}

                    {/* Summary Columns */}
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#10b981', minWidth: '45px', borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--border)' }} title="Morning Shifts">☀️ M</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#f59e0b', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Afternoon Shifts">🌆 A</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#0ea5e9', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Break Shifts">☕ B</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#8b5cf6', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Night Shifts">🌙 N</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#f43f5e', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Weekly Off Days">🏖️ OFF</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--text-main)', minWidth: '65px', borderBottom: '2px solid var(--border)', fontWeight: 700 }} title="Total Duty Days">Work Days</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const empRoster = monthlyRoster[emp.id] || {}

                    let morningCount = 0
                    let afternoonCount = 0
                    let breakCount = 0
                    let nightCount = 0
                    let offCount = 0

                    daysArray.forEach(d => {
                      const s = empRoster[d]
                      if (s === 'Morning Shift') morningCount++
                      else if (s === 'Afternoon Shift') afternoonCount++
                      else if (s === 'Break Shift') breakCount++
                      else if (s === 'Night Shift') nightCount++
                      else offCount++
                    })

                    const totalWorkDays = morningCount + afternoonCount + breakCount + nightCount

                    const isEmpDragged = draggedEmpId === emp.id
                    const isEmpDragOver = dragOverEmpId === emp.id
                    const borderTopHighlight = isEmpDragOver && dropPosition === 'above' ? '3px solid #6366f1' : undefined
                    const borderBottomHighlight = isEmpDragOver && dropPosition === 'below' ? '3px solid #6366f1' : '1px solid var(--border)'

                    return (
                      <tr
                        key={emp.id}
                        onDragOver={(e) => {
                          if (!draggedEmpId) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          const rect = e.currentTarget.getBoundingClientRect()
                          const midY = rect.top + rect.height / 2
                          const pos = e.clientY < midY ? 'above' : 'below'
                          if (dragOverEmpId !== emp.id || dropPosition !== pos) {
                            setDragOverEmpId(emp.id)
                            setDropPosition(pos)
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverEmpId === emp.id) {
                            setDragOverEmpId(null)
                            setDropPosition(null)
                          }
                        }}
                        onDrop={(e) => {
                          if (!draggedEmpId) return
                          e.preventDefault()
                          e.stopPropagation()
                          if (draggedEmpId !== emp.id) {
                            handleReorderEmployee(draggedEmpId, emp.id, dropPosition || 'below')
                          }
                          setDraggedEmpId(null)
                          setDragOverEmpId(null)
                          setDropPosition(null)
                        }}
                        style={{
                          borderBottom: borderBottomHighlight,
                          borderTop: borderTopHighlight,
                          opacity: isEmpDragged ? 0.35 : 1,
                          backgroundColor: isEmpDragOver ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          transition: 'background-color 0.12s ease',
                        }}
                      >
                        {/* Sticky Employee Info Cell with Drag Handle */}
                        <td
                          style={{
                            padding: '0.65rem 0.85rem',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: isEmpDragOver ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                            zIndex: 2,
                            borderRight: '2px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                            <div
                              draggable={true}
                              onDragStart={(e) => {
                                e.stopPropagation()
                                setDraggedEmpId(emp.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'EMPLOYEE_SORT', empId: emp.id }))
                              }}
                              onDragEnd={() => {
                                setDraggedEmpId(null)
                                setDragOverEmpId(null)
                                setDropPosition(null)
                              }}
                              style={{
                                cursor: 'grab',
                                padding: '2px 4px',
                                color: 'var(--text-muted)',
                                fontSize: '1rem',
                                userSelect: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                marginTop: '1px',
                                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                                border: '1px solid rgba(100, 116, 139, 0.2)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Drag ⠿ up or down to reorder employee in staff roster"
                            >
                              ⠿
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {emp.name}
                                {emp.swapShiftEligible === false && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                    🔒 Single Shift
                                  </span>
                                )}
                                {emp.swapShiftEligible === true && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 700, backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                    ☀️🌙 Swap
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{emp.code}</span> • {emp.designation}
                              </div>
                              <div style={{ fontSize: '0.68rem', marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                                  {emp.branch}
                                </span>
                                <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {emp.dept}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Days Shift Cells (all days or filtered from selected/current date) */}
                        {visibleDaysArray.map(dayNum => {
                          const assignment = empRoster[dayNum] || 'Morning Shift'
                          const d = new Date(selectedYear, selectedMonth, dayNum)
                          const dayOfWeekNum = d.getDay()
                          const isSun = dayOfWeekNum === 0
                          const isSat = dayOfWeekNum === 6
                          const isToday =
                            d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear
                          const isSelectedDate = dayNum === highlightedDay

                          // Badge styling
                          let badgeBg = 'rgba(16, 185, 129, 0.18)'
                          let badgeColor = '#10b981'
                          let badgeText = 'M'
                          let title = 'Morning Shift (09:00 - 18:00)'

                          if (assignment === 'Afternoon Shift') {
                            badgeBg = 'rgba(245, 158, 11, 0.18)'
                            badgeColor = '#f59e0b'
                            badgeText = 'A'
                            title = 'Afternoon Shift (13:00 - 23:00)'
                          } else if (assignment === 'Break Shift') {
                            badgeBg = 'rgba(14, 165, 233, 0.18)'
                            badgeColor = '#0ea5e9'
                            badgeText = 'B'
                            title = 'Break Shift (10:00 - 14:00 & 18:00 - 22:00)'
                          } else if (assignment === 'Night Shift') {
                            badgeBg = 'rgba(139, 92, 246, 0.18)'
                            badgeColor = '#8b5cf6'
                            badgeText = 'N'
                            title = 'Night Duty (20:00 - 08:00)'
                          } else if (assignment === 'OFF') {
                            badgeBg = isSun ? 'rgba(244, 63, 94, 0.18)' : isSat ? 'rgba(245, 158, 11, 0.18)' : 'rgba(100, 116, 139, 0.12)'
                            badgeColor = isSun ? '#f43f5e' : isSat ? '#f59e0b' : '#94a3b8'
                            badgeText = 'OFF'
                            title = 'Weekly Off'
                          }

                          const isDragOver = dragOverCell?.empId === emp.id && dragOverCell?.dayKey === dayNum
                          const isBeingDragged = draggedCell?.empId === emp.id && draggedCell?.dayKey === dayNum

                          return (
                            <td
                              key={dayNum}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                                if (!dragOverCell || dragOverCell.empId !== emp.id || dragOverCell.dayKey !== dayNum) {
                                  setDragOverCell({ empId: emp.id, dayKey: dayNum })
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverCell?.empId === emp.id && dragOverCell?.dayKey === dayNum) {
                                  setDragOverCell(null)
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                if (!draggedCell || draggedCell.type !== 'MONTHLY') return
                                const sourceEmpId = draggedCell.empId
                                const sourceDay = Number(draggedCell.dayKey)
                                const targetEmpId = emp.id
                                const targetDay = dayNum

                                if (sourceEmpId === targetEmpId && sourceDay === targetDay) {
                                  setDraggedCell(null)
                                  setDragOverCell(null)
                                  return
                                }

                                setMonthlyRoster(prev => {
                                  const sourceShift = prev[sourceEmpId]?.[sourceDay] || 'Morning Shift'
                                  const targetShift = prev[targetEmpId]?.[targetDay] || 'Morning Shift'
                                  const next = {
                                    ...prev,
                                    [sourceEmpId]: {
                                      ...(prev[sourceEmpId] || {}),
                                      [sourceDay]: targetShift,
                                    },
                                    [targetEmpId]: {
                                      ...(prev[targetEmpId] || {}),
                                      [targetDay]: sourceShift,
                                    }
                                  }
                                  saveMonthlyToStorage(selectedYear, selectedMonth, next)
                                  return next
                                })

                                const sourceEmpName = employeesList.find(x => x.id === sourceEmpId)?.name || 'Staff'
                                const targetEmpName = emp.name
                                if (sourceEmpId === targetEmpId) {
                                  setMessage(`🔀 Swapped shifts for ${targetEmpName}: Day ${sourceDay} (${draggedCell.shift}) ⇄ Day ${targetDay} (${assignment})`)
                                } else {
                                  setMessage(`🔀 Swapped shifts: ${sourceEmpName} Day ${sourceDay} (${draggedCell.shift}) ⇄ ${targetEmpName} Day ${targetDay} (${assignment})`)
                                }
                                setDraggedCell(null)
                                setDragOverCell(null)
                              }}
                              style={{
                                padding: '0.4rem 0.25rem',
                                textAlign: 'center',
                                backgroundColor: isDragOver
                                  ? 'rgba(99, 102, 241, 0.25)'
                                  : isSelectedDate
                                  ? 'rgba(99, 102, 241, 0.12)'
                                  : isToday
                                  ? 'rgba(14, 165, 233, 0.05)'
                                  : isSat
                                  ? 'rgba(245, 158, 11, 0.03)'
                                  : isSun
                                  ? 'rgba(244, 63, 94, 0.03)'
                                  : undefined,
                                outline: isDragOver ? '2px dashed #6366f1' : undefined,
                                outlineOffset: isDragOver ? '-2px' : undefined,
                                borderLeft: isSelectedDate ? '2px solid rgba(99, 102, 241, 0.4)' : isSat ? '1px dashed rgba(245, 158, 11, 0.15)' : isSun ? '1px dashed rgba(244, 63, 94, 0.15)' : '1px solid var(--border)',
                                borderRight: isSelectedDate ? '2px solid rgba(99, 102, 241, 0.4)' : undefined,
                                transition: 'background-color 0.15s ease',
                              }}
                            >
                              <button
                                type="button"
                                draggable={!emp.swapShiftEligible === false}
                                onDragStart={(e) => {
                                  if (emp.swapShiftEligible === false) { e.preventDefault(); return }
                                  setDraggedCell({ type: 'MONTHLY', empId: emp.id, dayKey: dayNum, shift: assignment })
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'MONTHLY', empId: emp.id, dayKey: dayNum, shift: assignment }))
                                }}
                                onDragEnd={() => {
                                  setDraggedCell(null)
                                  setDragOverCell(null)
                                }}
                                onClick={() => cycleMonthlyRosterShift(emp.id, dayNum)}
                                style={{
                                  width: '32px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  backgroundColor: emp.swapShiftEligible === false ? (assignment === 'OFF' ? badgeBg : 'rgba(245, 158, 11, 0.08)') : badgeBg,
                                  color: emp.swapShiftEligible === false ? (assignment === 'OFF' ? badgeColor : '#d97706') : badgeColor,
                                  border: emp.swapShiftEligible === false ? '1px solid rgba(245, 158, 11, 0.4)' : `1px solid ${badgeColor}40`,
                                  fontSize: badgeText === 'OFF' ? '0.65rem' : '0.75rem',
                                  fontWeight: 800,
                                  cursor: emp.swapShiftEligible === false ? 'not-allowed' : 'grab',
                                  opacity: isBeingDragged ? 0.35 : 1,
                                  transform: isBeingDragged ? 'scale(0.9)' : 'none',
                                  transition: 'all 0.12s ease',
                                  padding: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: isDragOver ? '0 0 8px rgba(99, 102, 241, 0.5)' : undefined,
                                  position: 'relative',
                                }}
                                title={emp.swapShiftEligible === false
                                  ? `🔒 ${emp.name} — Single Shift Only (Swap not enabled). Profile: ${title}`
                                  : `${emp.name} — ${dayNum} ${MONTH_NAMES[selectedMonth]}: ${title} (Click to cycle • Drag & Drop to swap)`}
                              >
                                {emp.swapShiftEligible === false && assignment !== 'OFF' ? '🔒' : badgeText}
                              </button>
                            </td>

                          )
                        })}

                        {/* Summary Columns per Employee */}
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#10b981', borderLeft: '2px solid var(--border)' }}>
                          {morningCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>
                          {afternoonCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#0ea5e9' }}>
                          {breakCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#8b5cf6' }}>
                          {nightCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#f43f5e' }}>
                          {offCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          {totalWorkDays}d
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Monthly Legend & Instructions */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.775rem',
                color: 'var(--text-muted)'
              }}
            >
              <div>
                💡 <b>Quick Edit:</b> Click any cell to cycle shifts (<b>M</b> ➔ <b>B</b> ➔ <b>N</b> ➔ <b>OFF</b>) • <b>Drag & Drop</b> any shift badge to swap duties • Use <b>🔄 Swap Shifts</b> to bulk swap Day ⇄ Night across date ranges.
              </div>
              <div>
                Showing <b>{daysInMonth} Days</b> in {MONTH_NAMES[selectedMonth]} {selectedYear}. All duties synchronize with biometric logs.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPTION 2: WEEKLY ROSTER VIEW */}
        {/* ========================================================================= */}
        {rosterViewMode === 'WEEKLY' && (
          <div>
            {/* Weekly Navigation Bar */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Week:</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevWeek}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  ◀ Prev Week
                </button>

                <span
                  style={{
                    padding: '0.3rem 0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '6px',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    position: 'relative'
                  }}
                >
                  {formatWeekRange(selectedMonday)}
                  <input
                    type="date"
                    onChange={handleDateChange}
                    style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    title="Click to pick week date"
                  />
                </span>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleNextWeek}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Next Week ▶
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleToday}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                >
                  Current Week
                </button>
              </div>

              {/* Weekly Toolbar Branch & Department Selectors */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Branch:</span>
                  <select
                    className="form-input"
                    style={{ width: '175px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                  >
                    <option value="ALL">🏨 All Branches</option>
                    <option value="Grand Godwin">Hotel Grand Godwin</option>
                    <option value="Godwin Deluxe">Hotel Godwin Deluxe</option>
                    <option value="Cafe Brownie">Cafe Brownie</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Dept:</span>
                  <select
                    className="form-input"
                    style={{ width: '170px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                  >
                    <option value="ALL">📁 All Departments</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Front Office">Front Office</option>
                    <option value="Security Guard">Security Guard</option>
                    <option value="Food & Beverage">Food & Beverage (Cafe)</option>
                    <option value="Accounts">Accounts</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Staff:</span>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Filter staff name / ID..."
                      value={employeeSearchQuery}
                      onChange={e => setEmployeeSearchQuery(e.target.value)}
                      style={{ width: '175px', padding: '0.35rem 1.6rem 0.35rem 0.6rem', fontSize: '0.8rem' }}
                    />
                    {employeeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEmployeeSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                          padding: 0,
                          lineHeight: 1,
                        }}
                        title="Clear filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetEmployeeSort}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}
                  title="Reset staff order alphabetically (A-Z)"
                >
                  🔤 Sort A–Z
                </button>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 Click cell to toggle shift • Drag ⠿ to sort staff.
                </span>
              </div>
            </div>

            {/* Weekly Table */}
            <div className="table-scroll-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
                <thead style={{ backgroundColor: 'var(--bg-main)' }}>
                  <tr>
                    <th
                      style={{
                        padding: '0.875rem 1.25rem',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        minWidth: '180px',
                      }}
                    >
                      <span style={{ marginRight: '6px', opacity: 0.7 }} title="Drag ⠿ handles to reorder staff">↕</span>
                      Employee ({filteredEmployees.length})
                    </th>
                    {weekDays.map(d => {
                      const headerBg = d.isToday
                        ? 'rgba(14, 165, 233, 0.12)'
                        : d.isSat
                        ? 'rgba(245, 158, 11, 0.1)'
                        : d.isSun
                        ? 'rgba(244, 63, 94, 0.1)'
                        : undefined

                      const headerTextColor = d.isToday
                        ? '#38bdf8'
                        : d.isSat
                        ? '#f59e0b'
                        : d.isSun
                        ? '#f43f5e'
                        : 'var(--text-muted)'

                      return (
                        <th
                          key={d.dayKey}
                          style={{
                            padding: '0.75rem 0.85rem',
                            textAlign: 'center',
                            fontWeight: 600,
                            color: headerTextColor,
                            fontSize: '0.8rem',
                            backgroundColor: headerBg,
                            borderBottom: d.isToday ? '2px solid #0ea5e9' : d.isSat ? '2px solid #f59e0b' : d.isSun ? '2px solid #f43f5e' : '1px solid var(--border)',
                            borderLeft: d.isSat ? '1px dashed rgba(245, 158, 11, 0.3)' : d.isSun ? '1px dashed rgba(244, 63, 94, 0.3)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{d.label}</span>
                            <span style={{ fontSize: '0.72rem', opacity: d.isToday || d.isSat || d.isSun ? 1 : 0.7 }}>
                              {d.dateNum} {d.monthName}
                            </span>
                            {d.isToday && (
                              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '999px', backgroundColor: '#0ea5e9', color: '#fff', fontWeight: 700 }}>
                                TODAY
                              </span>
                            )}
                            {!d.isToday && d.isSat && (
                              <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '999px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                SAT
                              </span>
                            )}
                            {!d.isToday && d.isSun && (
                              <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '999px', backgroundColor: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', fontWeight: 700, border: '1px solid rgba(244, 63, 94, 0.4)' }}>
                                SUN OFF
                              </span>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const isEmpDragged = draggedEmpId === emp.id
                    const isEmpDragOver = dragOverEmpId === emp.id
                    const borderTopHighlight = isEmpDragOver && dropPosition === 'above' ? '3px solid #6366f1' : undefined
                    const borderBottomHighlight = isEmpDragOver && dropPosition === 'below' ? '3px solid #6366f1' : '1px solid var(--border)'

                    return (
                      <tr
                        key={emp.id}
                        onDragOver={(e) => {
                          if (!draggedEmpId) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          const rect = e.currentTarget.getBoundingClientRect()
                          const midY = rect.top + rect.height / 2
                          const pos = e.clientY < midY ? 'above' : 'below'
                          if (dragOverEmpId !== emp.id || dropPosition !== pos) {
                            setDragOverEmpId(emp.id)
                            setDropPosition(pos)
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverEmpId === emp.id) {
                            setDragOverEmpId(null)
                            setDropPosition(null)
                          }
                        }}
                        onDrop={(e) => {
                          if (!draggedEmpId) return
                          e.preventDefault()
                          e.stopPropagation()
                          if (draggedEmpId !== emp.id) {
                            handleReorderEmployee(draggedEmpId, emp.id, dropPosition || 'below')
                          }
                          setDraggedEmpId(null)
                          setDragOverEmpId(null)
                          setDropPosition(null)
                        }}
                        style={{
                          borderTop: borderTopHighlight || '1px solid var(--border)',
                          borderBottom: borderBottomHighlight,
                          opacity: isEmpDragged ? 0.35 : 1,
                          backgroundColor: isEmpDragOver ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          transition: 'background-color 0.12s ease',
                        }}
                      >
                        <td style={{ padding: '0.875rem 1.25rem', backgroundColor: isEmpDragOver ? 'rgba(99, 102, 241, 0.12)' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                            <div
                              draggable={true}
                              onDragStart={(e) => {
                                e.stopPropagation()
                                setDraggedEmpId(emp.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'EMPLOYEE_SORT', empId: emp.id }))
                              }}
                              onDragEnd={() => {
                                setDraggedEmpId(null)
                                setDragOverEmpId(null)
                                setDropPosition(null)
                              }}
                              style={{
                                cursor: 'grab',
                                padding: '2px 4px',
                                color: 'var(--text-muted)',
                                fontSize: '1rem',
                                userSelect: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                marginTop: '1px',
                                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                                border: '1px solid rgba(100, 116, 139, 0.2)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Drag ⠿ up or down to reorder employee in staff roster"
                            >
                              ⠿
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{emp.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{emp.code}</span> • {emp.designation}
                              </div>
                              <div style={{ fontSize: '0.68rem', marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                                  {emp.branch}
                                </span>
                                <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {emp.dept}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      {weekDays.map(d => {
                        const assignment = roster[emp.id]?.[d.dayKey] || 'Unassigned'
                        const isOff = assignment === 'OFF'
                        const isNight = assignment === 'Night Shift'
                        const isBreak = assignment === 'Break Shift'
                        const isAfternoon = assignment === 'Afternoon Shift'

                        let bgColor = 'rgba(16, 185, 129, 0.12)'
                        let textColor = 'var(--success)'
                        let borderColor = 'transparent'

                        if (isOff) {
                          if (d.isSun) {
                            bgColor = 'rgba(244, 63, 94, 0.15)'
                            textColor = '#f43f5e'
                            borderColor = 'rgba(244, 63, 94, 0.3)'
                          } else if (d.isSat) {
                            bgColor = 'rgba(245, 158, 11, 0.15)'
                            textColor = '#f59e0b'
                            borderColor = 'rgba(245, 158, 11, 0.3)'
                          } else {
                            bgColor = 'rgba(100, 116, 139, 0.1)'
                            textColor = 'var(--text-muted)'
                          }
                        } else if (isNight) {
                          bgColor = 'rgba(139, 92, 246, 0.15)'
                          textColor = '#8b5cf6'
                          borderColor = 'rgba(139, 92, 246, 0.3)'
                        } else if (isBreak) {
                          bgColor = 'rgba(14, 165, 233, 0.15)'
                          textColor = '#0ea5e9'
                          borderColor = 'rgba(14, 165, 233, 0.35)'
                        } else if (isAfternoon) {
                          bgColor = 'rgba(245, 158, 11, 0.15)'
                          textColor = '#f59e0b'
                          borderColor = 'rgba(245, 158, 11, 0.35)'
                        }

                        const isDragOver = dragOverCell?.empId === emp.id && dragOverCell?.dayKey === d.dayKey
                        const isBeingDragged = draggedCell?.empId === emp.id && draggedCell?.dayKey === d.dayKey

                        return (
                          <td
                            key={d.dayKey}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              if (!dragOverCell || dragOverCell.empId !== emp.id || dragOverCell.dayKey !== d.dayKey) {
                                setDragOverCell({ empId: emp.id, dayKey: d.dayKey })
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverCell?.empId === emp.id && dragOverCell?.dayKey === d.dayKey) {
                                setDragOverCell(null)
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (!draggedCell || draggedCell.type !== 'WEEKLY') return
                              const sourceEmpId = draggedCell.empId
                              const sourceDay = String(draggedCell.dayKey)
                              const targetEmpId = emp.id
                              const targetDay = d.dayKey

                              if (sourceEmpId === targetEmpId && sourceDay === targetDay) {
                                setDraggedCell(null)
                                setDragOverCell(null)
                                return
                              }

                              setRoster(prev => {
                                const sourceShift = prev[sourceEmpId]?.[sourceDay] || 'Morning Shift'
                                const targetShift = prev[targetEmpId]?.[targetDay] || 'Morning Shift'
                                const next = {
                                  ...prev,
                                  [sourceEmpId]: {
                                    ...(prev[sourceEmpId] || {}),
                                    [sourceDay]: targetShift,
                                  },
                                  [targetEmpId]: {
                                    ...(prev[targetEmpId] || {}),
                                    [targetDay]: sourceShift,
                                  }
                                }
                                saveWeeklyToStorage(selectedMonday, next)
                                return next
                              })

                              const sourceEmpName = employeesList.find(x => x.id === sourceEmpId)?.name || 'Staff'
                              const targetEmpName = emp.name
                              if (sourceEmpId === targetEmpId) {
                                setMessage(`🔀 Swapped shifts for ${targetEmpName}: ${sourceDay} (${draggedCell.shift}) ⇄ ${targetDay} (${assignment})`)
                              } else {
                                setMessage(`🔀 Swapped shifts: ${sourceEmpName} ${sourceDay} (${draggedCell.shift}) ⇄ ${targetEmpName} ${targetDay} (${assignment})`)
                              }
                              setDraggedCell(null)
                              setDragOverCell(null)
                            }}
                            style={{
                              padding: '0.75rem',
                              textAlign: 'center',
                              backgroundColor: isDragOver
                                ? 'rgba(99, 102, 241, 0.25)'
                                : d.isToday
                                ? 'rgba(14, 165, 233, 0.03)'
                                : d.isSat
                                ? 'rgba(245, 158, 11, 0.03)'
                                : d.isSun
                                ? 'rgba(244, 63, 94, 0.03)'
                                : undefined,
                              outline: isDragOver ? '2px dashed #6366f1' : undefined,
                              outlineOffset: isDragOver ? '-2px' : undefined,
                              borderLeft: d.isSat ? '1px dashed rgba(245, 158, 11, 0.15)' : d.isSun ? '1px dashed rgba(244, 63, 94, 0.15)' : undefined,
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <button
                              type="button"
                              draggable={true}
                              onDragStart={(e) => {
                                setDraggedCell({ type: 'WEEKLY', empId: emp.id, dayKey: d.dayKey, shift: assignment })
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'WEEKLY', empId: emp.id, dayKey: d.dayKey, shift: assignment }))
                              }}
                              onDragEnd={() => {
                                setDraggedCell(null)
                                setDragOverCell(null)
                              }}
                              onClick={() => cycleRosterShift(emp.id, d.dayKey)}
                              style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: bgColor,
                                color: textColor,
                                border: `1px solid ${borderColor}`,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                cursor: 'grab',
                                opacity: isBeingDragged ? 0.35 : 1,
                                transform: isBeingDragged ? 'scale(0.92)' : 'none',
                                transition: 'all 0.15s ease-in-out',
                                boxShadow: isDragOver ? '0 0 8px rgba(99, 102, 241, 0.5)' : undefined,
                              }}
                              title={`Click to cycle shift • Drag & Drop to swap (${d.dayKey}: ${assignment})`}
                            >
                              {isOff ? (d.isSun ? 'OFF' : d.isSat ? 'OFF' : '—') : assignment.replace(' Shift', '')}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SHIFT SWAP MODAL (Day ⇄ Night / Date Range / 2-Staff Duty Exchange) */}
      {/* ========================================================================= */}
      {showSwapModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSwapModal(false)
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              border: '1px solid var(--border)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔄</span> Swap Shifts (Date Range)
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Swap Day (Morning) and Night duties or exchange schedules across selected dates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '0.2rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Scope Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>
                1. Target Staff Scope
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSwapScope('ALL_VISIBLE')}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: swapScope === 'ALL_VISIBLE' ? '2px solid #6366f1' : '1px solid var(--border)',
                    backgroundColor: swapScope === 'ALL_VISIBLE' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-main)',
                    color: swapScope === 'ALL_VISIBLE' ? '#818cf8' : 'var(--text-main)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  👥 All Filtered Staff ({filteredEmployees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSwapScope('SINGLE')}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: swapScope === 'SINGLE' ? '2px solid #6366f1' : '1px solid var(--border)',
                    backgroundColor: swapScope === 'SINGLE' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-main)',
                    color: swapScope === 'SINGLE' ? '#818cf8' : 'var(--text-main)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  👤 Single Employee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwapScope('TWO')
                    setSwapAction('EXCHANGE_TWO')
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: swapScope === 'TWO' ? '2px solid #6366f1' : '1px solid var(--border)',
                    backgroundColor: swapScope === 'TWO' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-main)',
                    color: swapScope === 'TWO' ? '#818cf8' : 'var(--text-main)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  🔁 Exchange 2 Staff
                </button>
              </div>

              {swapScope === 'SINGLE' && (
                <div style={{ marginTop: '0.4rem' }}>
                  <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Select Staff Member:</label>
                  <select
                    className="form-input"
                    value={swapSelectedEmpId}
                    onChange={e => setSwapSelectedEmpId(e.target.value)}
                    style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.825rem' }}
                  >
                    {employeesList.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.code} — {e.dept})</option>
                    ))}
                  </select>
                </div>
              )}

              {swapScope === 'TWO' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.4rem' }}>
                  <div>
                    <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Staff Member A:</label>
                    <select
                      className="form-input"
                      value={swapSelectedEmpId}
                      onChange={e => setSwapSelectedEmpId(e.target.value)}
                      style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.825rem' }}
                    >
                      {employeesList.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Staff Member B:</label>
                    <select
                      className="form-input"
                      value={swapSecondEmpId}
                      onChange={e => setSwapSecondEmpId(e.target.value)}
                      style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.825rem' }}
                    >
                      {employeesList.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  2. Date Range ({MONTH_NAMES[selectedMonth]} {selectedYear})
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setSwapFromDay(1); setSwapToDay(15); }}
                    style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                  >
                    1–15
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setSwapFromDay(16); setSwapToDay(daysInMonth); }}
                    style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                  >
                    16–{daysInMonth}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setSwapFromDay(1); setSwapToDay(daysInMonth); }}
                    style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                  >
                    Full Month
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>From Day:</label>
                  <select
                    className="form-input"
                    value={swapFromDay}
                    onChange={e => setSwapFromDay(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.825rem' }}
                  >
                    {daysArray.map(d => (
                      <option key={d} value={d}>
                        {d.toString().padStart(2, '0')} {MONTH_NAMES[selectedMonth].slice(0, 3)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>To Day:</label>
                  <select
                    className="form-input"
                    value={swapToDay}
                    onChange={e => setSwapToDay(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.825rem' }}
                  >
                    {daysArray.map(d => (
                      <option key={d} value={d}>
                        {d.toString().padStart(2, '0')} {MONTH_NAMES[selectedMonth].slice(0, 3)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Action Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>
                3. Swap Action
              </label>

              {swapScope !== 'TWO' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: swapAction === 'DAY_NIGHT_FLIP' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                      border: swapAction === 'DAY_NIGHT_FLIP' ? '1px solid #6366f1' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="swapAction"
                      checked={swapAction === 'DAY_NIGHT_FLIP'}
                      onChange={() => setSwapAction('DAY_NIGHT_FLIP')}
                    />
                    <span>
                      <b>🔁 Day ⇄ Night Flip (Bidirectional)</b>: Day becomes Night, Night becomes Day
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: swapAction === 'DAY_TO_NIGHT' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                      border: swapAction === 'DAY_TO_NIGHT' ? '1px solid #6366f1' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="swapAction"
                      checked={swapAction === 'DAY_TO_NIGHT'}
                      onChange={() => setSwapAction('DAY_TO_NIGHT')}
                    />
                    <span>
                      <b>☀️ ➔ 🌙 Day to Night</b>: Change all Day shifts to Night Shift
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: swapAction === 'NIGHT_TO_DAY' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                      border: swapAction === 'NIGHT_TO_DAY' ? '1px solid #6366f1' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="swapAction"
                      checked={swapAction === 'NIGHT_TO_DAY'}
                      onChange={() => setSwapAction('NIGHT_TO_DAY')}
                    />
                    <span>
                      <b>🌙 ➔ ☀️ Night to Day</b>: Change all Night shifts to Day Shift
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: swapAction === 'SET_SHIFT' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                      border: swapAction === 'SET_SHIFT' ? '1px solid #6366f1' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="swapAction"
                      checked={swapAction === 'SET_SHIFT'}
                      onChange={() => setSwapAction('SET_SHIFT')}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <b>🎯 Assign Specific Shift:</b>
                      <select
                        className="form-input"
                        value={swapTargetShift}
                        onChange={e => {
                          setSwapTargetShift(e.target.value)
                          setSwapAction('SET_SHIFT')
                        }}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
                      >
                        <option value="Morning Shift">Morning (Day)</option>
                        <option value="Afternoon Shift">Afternoon Shift</option>
                        <option value="Night Shift">Night Shift</option>
                        <option value="Break Shift">Break Shift</option>
                        <option value="OFF">Weekly Off</option>
                      </select>
                    </span>
                  </label>
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)'
                  }}
                >
                  🔄 <b>Exchange duties between Staff A and Staff B</b>: For each day in the selected range, Staff A takes Staff B's shift and Staff B takes Staff A's shift.
                </div>
              )}
            </div>

            {/* Action Summary Pill */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                fontSize: '0.78rem',
                color: 'var(--primary)',
                lineHeight: 1.4
              }}
            >
              ℹ️ <b>Summary:</b> From Day <b>{Math.min(swapFromDay, swapToDay)}</b> to <b>{Math.max(swapFromDay, swapToDay)} {MONTH_NAMES[selectedMonth]} {selectedYear}</b>,{' '}
              {swapScope === 'TWO'
                ? `swap schedules between selected two staff members.`
                : swapAction === 'DAY_NIGHT_FLIP'
                ? `swap Day (Morning) ⇄ Night shifts for ${swapScope === 'ALL_VISIBLE' ? `${filteredEmployees.length} staff` : 'selected staff'}.`
                : swapAction === 'DAY_TO_NIGHT'
                ? `set all Day shifts to Night Shift.`
                : swapAction === 'NIGHT_TO_DAY'
                ? `set all Night shifts to Day Shift.`
                : `set all shifts to ${swapTargetShift}.`}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSwapModal(false)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyShiftSwap}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: '0.825rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  cursor: 'pointer'
                }}
              >
                ✓ Apply Shift Swap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Sheet Styles for Staff Bulletin Board */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          nav, header, .btn, select, button, input {
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
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #94a3b8 !important;
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  )
}
