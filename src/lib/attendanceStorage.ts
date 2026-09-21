import fs from 'fs'
import path from 'path'
import {
  getAllDataDirs,
  getPermanentDataDir,
  safeReadJsonFile,
  safeWriteJsonFile,
  writeToAllTiers,
  appendToImmutableJournal,
  ensureDirExists
} from './persistentVault'

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

/**
 * Get all merged attendance records across all storage tiers and historical deployments.
 * Guarantees that no punches are lost even across server updates, PM2 reloads, or git pulls.
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

  const allDirs = getAllDataDirs()

  // 1. Read daily vault files from attendance_vault/ across all permanent, local, and historical dirs
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'attendance_vault')
    try {
      if (fs.existsSync(vDir)) {
        const files = fs.readdirSync(vDir)
        for (const file of files) {
          if (file.startsWith('attendance_') && file.endsWith('.json')) {
            const list = safeReadJsonFile<any[]>(path.join(vDir, file), [])
            if (Array.isArray(list)) list.forEach(mergeRecord)
          }
        }
      }
    } catch {}
  }

  // 2. Read master vault files across all directories
  for (const dir of allDirs) {
    const mv = path.join(dir, 'attendance_vault', 'master_attendance.json')
    const list = safeReadJsonFile<any[]>(mv, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // 3. Read primary and backup files across all directories
  for (const dir of allDirs) {
    for (const filename of ['hr_attendance.json', 'hr_attendance_backup.json']) {
      const fPath = path.join(dir, filename)
      const list = safeReadJsonFile<any[]>(fPath, [])
      if (Array.isArray(list)) list.forEach(mergeRecord)
    }
  }

  // 4. Read append-only journals across all directories
  for (const dir of allDirs) {
    const jFile = path.join(dir, 'attendance_vault', 'audit_journal.jsonl')
    try {
      if (fs.existsSync(jFile)) {
        const lines = fs.readFileSync(jFile, 'utf-8').split('\n')
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
  }

  const mergedList = Array.from(map.values())

  // Self-healing: If records exist, synchronize them to all tiers to ensure consistency
  if (mergedList.length > 0) {
    try {
      const localPrimary = path.join(process.cwd(), 'data', 'hr_attendance.json')
      const currentOnDisk = safeReadJsonFile<any[]>(localPrimary, [])
      if (currentOnDisk.length !== mergedList.length) {
        writeToAllTiers('hr_attendance.json', mergedList)
        for (const dir of allDirs) {
          const vDir = path.join(dir, 'attendance_vault')
          ensureDirExists(vDir)
          safeWriteJsonFile(path.join(vDir, 'master_attendance.json'), mergedList)
        }
      }
    } catch {}
  }

  return mergedList
}

/**
 * Persist an attendance record across all indestructible vaults.
 */
export function saveAttendanceRecord(record: AttendanceRecord): AttendanceRecord[] {
  if (!record || !record.employeeId || !record.date) {
    return getMergedAttendance()
  }

  const allDirs = getAllDataDirs()

  // 1. Append to tamper-proof Journal across all vaults
  appendToImmutableJournal('attendance_vault', 'audit_journal.jsonl', record)

  // 2. Save to Date-Specific Vault (e.g. attendance_vault/attendance_2026-09-21.json)
  const dailyFilename = `attendance_${record.date}.json`
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'attendance_vault')
    ensureDirExists(vDir)
    const dailyVaultPath = path.join(vDir, dailyFilename)
    const dailyRecords = safeReadJsonFile<AttendanceRecord[]>(dailyVaultPath, [])
    const dailyIdx = dailyRecords.findIndex(
      r => r.employeeId.trim().toUpperCase() === record.employeeId.trim().toUpperCase() && r.date === record.date
    )
    if (dailyIdx >= 0) {
      dailyRecords[dailyIdx] = { ...dailyRecords[dailyIdx], ...record }
    } else {
      dailyRecords.push(record)
    }
    safeWriteJsonFile(dailyVaultPath, dailyRecords)
  }

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
  writeToAllTiers('hr_attendance.json', allMerged)
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'attendance_vault')
    ensureDirExists(vDir)
    safeWriteJsonFile(path.join(vDir, 'master_attendance.json'), allMerged)
  }

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

  writeToAllTiers('hr_attendance.json', filtered)
  const allDirs = getAllDataDirs()
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'attendance_vault')
    ensureDirExists(vDir)
    safeWriteJsonFile(path.join(vDir, 'master_attendance.json'), filtered)

    if (date) {
      const dailyVaultPath = path.join(vDir, `attendance_${date}.json`)
      const daily = safeReadJsonFile<AttendanceRecord[]>(dailyVaultPath, []).filter(
        r => r.employeeId.trim().toUpperCase() !== employeeId.trim().toUpperCase()
      )
      safeWriteJsonFile(dailyVaultPath, daily)
    }
  }
}
