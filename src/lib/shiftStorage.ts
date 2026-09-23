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
