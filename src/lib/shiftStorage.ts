import fs from 'fs'
import path from 'path'
import {
  getAllDataDirs,
  safeReadJsonFile,
  safeWriteJsonFile,
  writeToAllTiers,
  ensureDirExists
} from './persistentVault'

export interface ShiftRecord {
  id: string
  name: string
  type: string
  startTime: string
  endTime: string
  firstSlot?: string | null
  secondSlot?: string | null
  breakTime?: string | null
  graceMinutes: number
  branchId?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export const DEFAULT_SHIFTS: ShiftRecord[] = [
  {
    id: 'shift-1',
    name: 'Morning Shift',
    type: 'FIXED',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    branchId: 'mock-1'
  },
  {
    id: 'shift-afternoon',
    name: 'Afternoon Shift',
    type: 'FIXED',
    startTime: '13:00',
    endTime: '23:00',
    graceMinutes: 15,
    branchId: 'mock-1'
  },
  {
    id: 'shift-2',
    name: 'Break Shift',
    type: 'BREAK',
    startTime: '10:00',
    endTime: '22:00',
    firstSlot: '10:00 – 14:00',
    secondSlot: '18:00 – 22:00',
    breakTime: '14:00 – 18:00',
    graceMinutes: 15,
    branchId: 'mock-1'
  },
  {
    id: 'shift-3',
    name: 'Night Shift',
    type: 'NIGHT',
    startTime: '20:00',
    endTime: '08:00',
    graceMinutes: 20,
    branchId: 'mock-1'
  }
]

/**
 * Get all merged shifts across all persistent storage tiers and historical deployments.
 * Guarantees Morning Shift custom times and Afternoon Shift are never lost during git updates or redeploys.
 */
export function getMergedShifts(): ShiftRecord[] {
  const map = new Map<string, ShiftRecord>()

  const mergeShift = (s: any) => {
    if (!s || !s.id) return
    // Guard: Morning Shift standard start time is 09:00, NEVER 08:00
    if (s.name === 'Morning Shift' && s.startTime === '08:00') {
      s.startTime = '09:00'
    }
    const key = String(s.id).trim()
    const existing = map.get(key)

    if (!existing) {
      map.set(key, s)
    } else {
      // Prioritize the version with more recent updatedAt or customized time
      const existingUpdated = new Date(existing.updatedAt || '2000-01-01').getTime()
      const newUpdated = new Date(s.updatedAt || '2000-01-01').getTime()

      if (newUpdated >= existingUpdated) {
        map.set(key, { ...existing, ...s })
      } else {
        map.set(key, { ...s, ...existing })
      }
    }
  }

  // 1. Start with defaults (ensures Afternoon Shift always exists)
  DEFAULT_SHIFTS.forEach(mergeShift)

  const allDirs = getAllDataDirs()

  // 2. Read Primary and Backup files across all directories
  for (const dir of allDirs) {
    for (const filename of ['hr_shifts.json', 'hr_shifts_backup.json']) {
      const fPath = path.join(dir, filename)
      const list = safeReadJsonFile<any[]>(fPath, [])
      if (Array.isArray(list)) list.forEach(mergeShift)
    }
  }

  // 3. Read Master Vault files across all directories
  for (const dir of allDirs) {
    const mv = path.join(dir, 'shift_vault', 'master_shifts.json')
    const list = safeReadJsonFile<any[]>(mv, [])
    if (Array.isArray(list)) list.forEach(mergeShift)
  }

  const merged = Array.from(map.values())

  // Ensure Morning Shift custom times are preserved and Afternoon Shift exists
  const hasAfternoon = merged.some(s => s.name?.toLowerCase().includes('afternoon') || s.id === 'shift-afternoon')
  if (!hasAfternoon) {
    merged.splice(1, 0, DEFAULT_SHIFTS[1])
  }

  // Self-heal: Save merged list to all tiers so all files are in sync
  saveAllShifts(merged)
  return merged
}

/**
 * Save all shifts atomically across all storage tiers.
 */
export function saveAllShifts(shifts: ShiftRecord[]): void {
  writeToAllTiers('hr_shifts.json', shifts)
  const allDirs = getAllDataDirs()
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'shift_vault')
    ensureDirExists(vDir)
    safeWriteJsonFile(path.join(vDir, 'master_shifts.json'), shifts)
  }
}

/**
 * Update an existing shift by id and persist across all tiers.
 */
export function updateShift(id: string, updates: Partial<ShiftRecord>): ShiftRecord | null {
  const shifts = getMergedShifts()
  const idx = shifts.findIndex(s => s.id === id)

  if (idx === -1) return null

  const updated: ShiftRecord = {
    ...shifts[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  shifts[idx] = updated
  saveAllShifts(shifts)
  return updated
}

/**
 * Create a new shift and persist across all tiers.
 */
export function createShift(newShift: ShiftRecord): ShiftRecord {
  const shifts = getMergedShifts()
  shifts.push({
    ...newShift,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  saveAllShifts(shifts)
  return newShift
}

/**
 * Delete a shift by id.
 */
export function deleteShift(id: string): ShiftRecord[] {
  let shifts = getMergedShifts()
  shifts = shifts.filter(s => s.id !== id)
  saveAllShifts(shifts)
  return shifts
}

/**
 * Format a 24-hour time string ("20:00", "08:00") to 12-hour AM/PM ("8 PM", "8 AM", "8:30 AM")
 */
export function formatTime12Hour(time24: string): string {
  if (!time24 || typeof time24 !== 'string') return ''
  const trimmed = time24.trim()
  if (trimmed.toUpperCase() === 'OFF') return 'Weekly Off'
  const parts = trimmed.split(':')
  if (parts.length < 2) return trimmed
  const h = parseInt(parts[0], 10)
  const m = parts[1]
  if (isNaN(h)) return trimmed
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mClean = m.padStart(2, '0')
  return mClean === '00' ? `${h12} ${ampm}` : `${h12}:${mClean} ${ampm}`
}

/**
 * Returns human-friendly shift timing label, e.g. "8 PM to 8 AM (Night Shift)" or "9 AM to 6 PM (Morning Shift)"
 */
export function formatShiftTimingLabel(startTime: string, endTime: string, shiftName?: string): string {
  if (!startTime || !endTime || startTime === 'OFF' || endTime === 'OFF' || shiftName === 'Weekly Off' || shiftName === 'OFF') {
    return '🏖️ Weekly Off'
  }
  const start12 = formatTime12Hour(startTime)
  const end12 = formatTime12Hour(endTime)
  const timeSpan = `${start12} to ${end12}` // e.g. "8 PM to 8 AM"
  const label = shiftName && !shiftName.toLowerCase().includes('default') && !shiftName.toLowerCase().includes('fixed')
    ? ` (${shiftName})`
    : ''
  return `${timeSpan}${label}`
}

/**
 * Resolve an employee's exact shift for a given date (defaults to today in IST).
 * Inspects monthly roster first (where shifts may be swapped or rotated).
 * Falls back to the employee's configured profile morningTime / eveningTime.
 */
export function getEmployeeRosterShift(
  emp: any,
  dateStr?: string
): {
  startTime: string
  endTime: string
  shiftName: string
  formatted12H: string
  isNightShift: boolean
  isOff: boolean
} {
  try {
    const todayIST = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
    const [yStr, mStr, dStr] = todayIST.split('-')
    const year = parseInt(yStr, 10)
    const month = parseInt(mStr, 10) - 1 // 0-indexed month (0 = Jan, 8 = Sep)
    const dayNum = parseInt(dStr, 10)

    const allDirs = getAllDataDirs()
    let roster: Record<string, Record<string, string>> = {}

    for (const dir of allDirs) {
      const rosterFile = path.join(dir, `hr_roster_${year}_${month}.json`)
      const data = safeReadJsonFile<Record<string, Record<string, string>>>(rosterFile, {})
      if (data && Object.keys(data).length > 0) {
        roster = data
        break
      }
    }

    const empId = emp?.id
    const empCode = emp?.employeeId
    const empRoster = (empId && roster[empId]) || (empCode && roster[empCode]) || {}
    const assignedShiftName: string = empRoster[dayNum] || empRoster[String(dayNum)] || ''

    if (assignedShiftName) {
      const allShifts = getMergedShifts()
      const matched = allShifts.find((s: any) =>
        (s.name && s.name.trim().toLowerCase() === assignedShiftName.trim().toLowerCase()) ||
        (s.id && s.id.trim().toLowerCase() === assignedShiftName.trim().toLowerCase())
      )

      if (matched) {
        const sTime = matched.startTime || '09:00'
        const eTime = matched.endTime || '18:00'
        const isNight = matched.type === 'NIGHT' || sTime === '20:00' || matched.name.toLowerCase().includes('night')
        return {
          startTime: sTime,
          endTime: eTime,
          shiftName: matched.name || assignedShiftName,
          formatted12H: formatShiftTimingLabel(sTime, eTime, matched.name || assignedShiftName),
          isNightShift: isNight,
          isOff: false,
        }
      }

      if (assignedShiftName === 'Night Shift') {
        return {
          startTime: '20:00',
          endTime: '08:00',
          shiftName: 'Night Shift',
          formatted12H: '8 PM to 8 AM (Night Shift)',
          isNightShift: true,
          isOff: false,
        }
      }

      if (assignedShiftName === 'Morning Shift') {
        return {
          startTime: '09:00',
          endTime: '18:00',
          shiftName: 'Morning Shift',
          formatted12H: '9 AM to 6 PM (Morning Shift)',
          isNightShift: false,
          isOff: false,
        }
      }

      if (assignedShiftName === 'Afternoon Shift') {
        return {
          startTime: '13:00',
          endTime: '23:00',
          shiftName: 'Afternoon Shift',
          formatted12H: '1 PM to 11 PM (Afternoon Shift)',
          isNightShift: false,
          isOff: false,
        }
      }

      if (assignedShiftName === 'Break Shift') {
        return {
          startTime: '10:00',
          endTime: '22:00',
          shiftName: 'Break Shift',
          formatted12H: '10 AM to 10 PM (Break Shift)',
          isNightShift: false,
          isOff: false,
        }
      }

      if (assignedShiftName === 'OFF') {
        return {
          startTime: 'OFF',
          endTime: 'OFF',
          shiftName: 'Weekly Off',
          formatted12H: '🏖️ Weekly Off',
          isNightShift: false,
          isOff: true,
        }
      }
    }

    // Fall back to employee individual morningTime / eveningTime
    const sTime = (emp?.morningTime && String(emp.morningTime).trim()) || '09:00'
    const eTime = (emp?.eveningTime && String(emp.eveningTime).trim()) || '18:00'
    const isNight = sTime === '20:00' || eTime === '08:00' || sTime === '22:00' || sTime.startsWith('2')
    const fallbackShiftName = isNight
      ? 'Night Shift'
      : sTime === '13:00'
      ? 'Afternoon Shift'
      : sTime === '10:00' && eTime === '22:00'
      ? 'Break Shift'
      : 'Morning Shift'

    return {
      startTime: sTime,
      endTime: eTime,
      shiftName: fallbackShiftName,
      formatted12H: formatShiftTimingLabel(sTime, eTime, fallbackShiftName),
      isNightShift: isNight,
      isOff: false,
    }
  } catch {
    const sTime = (emp?.morningTime && String(emp.morningTime).trim()) || '09:00'
    const eTime = (emp?.eveningTime && String(emp.eveningTime).trim()) || '18:00'
    const isNight = sTime === '20:00' || eTime === '08:00'
    const fallbackShiftName = isNight ? 'Night Shift' : 'Morning Shift'
    return {
      startTime: sTime,
      endTime: eTime,
      shiftName: fallbackShiftName,
      formatted12H: formatShiftTimingLabel(sTime, eTime, fallbackShiftName),
      isNightShift: isNight,
      isOff: false,
    }
  }
}

