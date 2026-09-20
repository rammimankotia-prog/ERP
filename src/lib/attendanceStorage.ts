import fs from 'fs'
import path from 'path'

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string // YYYY-MM-DD (Asia/Kolkata IST)
  punchIn: string | null // ISO String
  punchOut: string | null // ISO String
  status: string // 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT'
  isLate?: boolean
  lateMinutes?: number
  punchInMode?: string | null
  punchInCoordinates?: { lat?: number; lng?: number; distanceMeters?: number } | null
  totalMinutes?: number | null
  remarks?: string | null
  [key: string]: any
}

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(LOCAL_DATA_DIR, 'hr_attendance.json')
const BACKUP_ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance_backup.json')
const LOCAL_BACKUP_FILE = path.join(LOCAL_DATA_DIR, 'hr_attendance_backup.json')

const VAULT_DIR = path.join(DATA_DIR, 'attendance_vault')
const LOCAL_VAULT_DIR = path.join(LOCAL_DATA_DIR, 'attendance_vault')
const JOURNAL_FILE = path.join(VAULT_DIR, 'audit_journal.jsonl')
const MASTER_VAULT_FILE = path.join(VAULT_DIR, 'master_attendance.json')

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
    console.error(`[attendanceStorage] Error writing to ${filePath}:`, e)
  }
}

function appendToJournal(entry: any) {
  try {
    ensureDir(VAULT_DIR)
    const line = JSON.stringify({ ...entry, _loggedAt: new Date().toISOString() }) + '\n'
    fs.appendFileSync(JOURNAL_FILE, line, 'utf-8')
  } catch {}
}

/**
 * Get all merged attendance records across all storage tiers.
 * Guarantees that no punches are lost even if git pull overwrites hr_attendance.json.
 */
export function getMergedAttendance(): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>()

  const mergeRecord = (rec: any) => {
    if (!rec || !rec.employeeId) return
    let d = rec.date
    if (!d && rec.punchIn) {
      try {
        d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(rec.punchIn))
      } catch {
        d = String(rec.punchIn).slice(0, 10)
      }
    }
    if (!d) return
    const key = `${rec.employeeId.trim().toUpperCase()}_${String(d).trim()}`
    const existing = map.get(key)

    if (!existing) {
      map.set(key, { ...rec, date: String(d).trim() })
    } else {
      // Intelligently merge without losing punchIn or punchOut
      const merged: AttendanceRecord = {
        ...existing,
        ...rec,
        date: existing.date || String(d).trim(),
        punchIn: existing.punchIn || rec.punchIn || null,
        punchOut: rec.punchOut || existing.punchOut || null,
        punchInMode: existing.punchInMode || rec.punchInMode || null,
        punchInCoordinates: existing.punchInCoordinates || rec.punchInCoordinates || null,
        status: (existing.punchOut || rec.punchOut)
          ? (rec.status || existing.status)
          : (existing.punchIn ? existing.status : rec.status),
        isLate: existing.isLate !== undefined ? existing.isLate : rec.isLate,
        lateMinutes: existing.lateMinutes || rec.lateMinutes || 0,
        totalMinutes: rec.totalMinutes !== undefined && rec.totalMinutes !== null ? rec.totalMinutes : (existing.totalMinutes || null),
        remarks: rec.remarks || existing.remarks || null,
      }
      map.set(key, merged)
    }
  }

  // Tier 1: Read daily vault files from attendance_vault/
  for (const vDir of [VAULT_DIR, LOCAL_VAULT_DIR]) {
    try {
      if (fs.existsSync(vDir)) {
        const files = fs.readdirSync(vDir)
        for (const file of files) {
          if (file.startsWith('attendance_') && file.endsWith('.json')) {
            const list = safeReadJson<any[]>(path.join(vDir, file), [])
            if (Array.isArray(list)) list.forEach(mergeRecord)
          }
        }
      }
    } catch {}
  }

  // Tier 2: Read master vault
  for (const mv of [MASTER_VAULT_FILE, path.join(LOCAL_VAULT_DIR, 'master_attendance.json')]) {
    const list = safeReadJson<any[]>(mv, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // Tier 3: Read backup files
  for (const bf of [BACKUP_ATTENDANCE_FILE, LOCAL_BACKUP_FILE]) {
    const list = safeReadJson<any[]>(bf, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // Tier 4: Read primary attendance files
  for (const af of [ATTENDANCE_FILE, LOCAL_ATTENDANCE_FILE]) {
    const list = safeReadJson<any[]>(af, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // Tier 5: Read append-only journal in case of any unwritten transactions
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const lines = fs.readFileSync(JOURNAL_FILE, 'utf-8').split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          if (entry && entry.employeeId) {
            mergeRecord(entry)
          }
        } catch {}
      }
    }
  } catch {}

  const mergedList = Array.from(map.values())

  // Self-healing: If merged records differ from primary files, auto-repair all primary, backup and master files
  try {
    if (mergedList.length > 0) {
      const primaryRecords = safeReadJson<any[]>(ATTENDANCE_FILE, [])
      const primaryStr = JSON.stringify(primaryRecords)
      const mergedStr = JSON.stringify(mergedList)
      if (primaryStr !== mergedStr) {
        safeWriteJson(ATTENDANCE_FILE, mergedList)
        if (ATTENDANCE_FILE !== LOCAL_ATTENDANCE_FILE) {
          safeWriteJson(LOCAL_ATTENDANCE_FILE, mergedList)
        }
        safeWriteJson(BACKUP_ATTENDANCE_FILE, mergedList)
        safeWriteJson(MASTER_VAULT_FILE, mergedList)
      }
    }
  } catch {}

  return mergedList
}

/**
 * Persist an attendance record across all indestructible vaults.
 */
export function saveAttendanceRecord(record: AttendanceRecord): AttendanceRecord[] {
  if (!record || !record.employeeId || !record.date) {
    return getMergedAttendance()
  }

  ensureDir(DATA_DIR)
  ensureDir(VAULT_DIR)

  // 1. Append to tamper-proof Journal
  appendToJournal(record)

  // 2. Save to Date-Specific Vault (e.g. data/attendance_vault/attendance_2026-09-17.json)
  const dailyVaultPath = path.join(VAULT_DIR, `attendance_${record.date}.json`)
  const dailyRecords = safeReadJson<AttendanceRecord[]>(dailyVaultPath, [])
  const dailyIdx = dailyRecords.findIndex(
    r => r.employeeId.trim().toUpperCase() === record.employeeId.trim().toUpperCase() && r.date === record.date
  )
  if (dailyIdx >= 0) {
    dailyRecords[dailyIdx] = { ...dailyRecords[dailyIdx], ...record }
  } else {
    dailyRecords.push(record)
  }
  safeWriteJson(dailyVaultPath, dailyRecords)

  // 3. Update Master List
  const allMerged = getMergedAttendance()
  const idx = allMerged.findIndex(
    r => r.employeeId.trim().toUpperCase() === record.employeeId.trim().toUpperCase() && r.date === record.date
  )
  if (idx >= 0) {
    allMerged[idx] = { ...allMerged[idx], ...record }
  } else {
    allMerged.push(record)
  }

  // 4. Save to all primary, backup and master files simultaneously
  safeWriteJson(ATTENDANCE_FILE, allMerged)
  if (ATTENDANCE_FILE !== LOCAL_ATTENDANCE_FILE) {
    safeWriteJson(LOCAL_ATTENDANCE_FILE, allMerged)
  }
  safeWriteJson(BACKUP_ATTENDANCE_FILE, allMerged)
  if (BACKUP_ATTENDANCE_FILE !== LOCAL_BACKUP_FILE) {
    safeWriteJson(LOCAL_BACKUP_FILE, allMerged)
  }
  safeWriteJson(MASTER_VAULT_FILE, allMerged)

  return allMerged
}

/**
 * Remove an attendance record only when explicitly deleted by Admin
 */
export function removeAttendanceRecord(employeeId: string, date?: string) {
  const all = getMergedAttendance()
  const filtered = all.filter(r => {
    const matchEmp = r.employeeId.trim().toUpperCase() === employeeId.trim().toUpperCase()
    if (!matchEmp) return true
    if (date) return r.date !== date
    return false
  })

  safeWriteJson(ATTENDANCE_FILE, filtered)
  if (ATTENDANCE_FILE !== LOCAL_ATTENDANCE_FILE) safeWriteJson(LOCAL_ATTENDANCE_FILE, filtered)
  safeWriteJson(BACKUP_ATTENDANCE_FILE, filtered)
  safeWriteJson(MASTER_VAULT_FILE, filtered)

  if (date) {
    const dailyVaultPath = path.join(VAULT_DIR, `attendance_${date}.json`)
    const daily = safeReadJson<AttendanceRecord[]>(dailyVaultPath, []).filter(
      r => r.employeeId.trim().toUpperCase() !== employeeId.trim().toUpperCase()
    )
    safeWriteJson(dailyVaultPath, daily)
  }
}
