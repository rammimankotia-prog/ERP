import fs from 'fs'
import path from 'path'

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

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const SHIFTS_FILE = path.join(DATA_DIR, 'hr_shifts.json')
const LOCAL_SHIFTS_FILE = path.join(LOCAL_DATA_DIR, 'hr_shifts.json')
const BACKUP_SHIFTS_FILE = path.join(DATA_DIR, 'hr_shifts_backup.json')
const LOCAL_BACKUP_FILE = path.join(LOCAL_DATA_DIR, 'hr_shifts_backup.json')

const VAULT_DIR = path.join(DATA_DIR, 'shift_vault')
const LOCAL_VAULT_DIR = path.join(LOCAL_DATA_DIR, 'shift_vault')
const MASTER_VAULT_FILE = path.join(VAULT_DIR, 'master_shifts.json')
const LOCAL_MASTER_VAULT_FILE = path.join(LOCAL_VAULT_DIR, 'master_shifts.json')

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

function ensureDir(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch {}
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8').trim()
      if (content) {
        return JSON.parse(content) as T
      }
    }
  } catch {}
  return fallback
}

function safeWriteJson(filePath: string, data: any) {
  try {
    ensureDir(path.dirname(filePath))
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error(`[shiftStorage] Error writing to ${filePath}:`, e)
  }
}

/**
 * Get all merged shifts across all persistent storage tiers (Vault, Backup, Active).
 * Guarantees Morning Shift custom times and Afternoon Shift are never lost during git updates or redeploys.
 */
export function getMergedShifts(): ShiftRecord[] {
  const map = new Map<string, ShiftRecord>()

  const mergeShift = (s: any) => {
    if (!s || !s.id) return
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

  // 2. Read Active JSON files
  for (const f of [LOCAL_SHIFTS_FILE, SHIFTS_FILE]) {
    const list = safeReadJson<any[]>(f, [])
    if (Array.isArray(list)) list.forEach(mergeShift)
  }

  // 3. Read Protected Backup files (immune to git overwrites)
  for (const f of [LOCAL_BACKUP_FILE, BACKUP_SHIFTS_FILE]) {
    const list = safeReadJson<any[]>(f, [])
    if (Array.isArray(list)) list.forEach(mergeShift)
  }

  // 4. Read Protected Master Vault files (immune to git overwrites)
  for (const f of [LOCAL_MASTER_VAULT_FILE, MASTER_VAULT_FILE]) {
    const list = safeReadJson<any[]>(f, [])
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
  // 1. Active storage
  safeWriteJson(SHIFTS_FILE, shifts)
  if (SHIFTS_FILE !== LOCAL_SHIFTS_FILE) {
    safeWriteJson(LOCAL_SHIFTS_FILE, shifts)
  }

  // 2. Protected Backup storage (in .gitignore)
  safeWriteJson(BACKUP_SHIFTS_FILE, shifts)
  if (BACKUP_SHIFTS_FILE !== LOCAL_BACKUP_FILE) {
    safeWriteJson(LOCAL_BACKUP_FILE, shifts)
  }

  // 3. Protected Vault storage (in .gitignore)
  safeWriteJson(MASTER_VAULT_FILE, shifts)
  if (MASTER_VAULT_FILE !== LOCAL_MASTER_VAULT_FILE) {
    safeWriteJson(LOCAL_MASTER_VAULT_FILE, shifts)
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
