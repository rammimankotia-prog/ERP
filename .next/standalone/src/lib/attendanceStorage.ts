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

export function getPreviousDateStr(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!y || !m || !d) return ''
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    return dt.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function getISTMinutesFromDate(d: Date = new Date()): number {
  try {
    const istStr = d.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    const [hStr, mStr] = istStr.split(':')
    return (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0)
  } catch {
    return 0
  }
}

/**
 * Resolves the active attendance record for an employee on `todayIST`,
 * properly handling cross-midnight Night Shifts (e.g., 7:00 PM - 7:00 AM or 8:00 PM - 8:00 AM).
 *
 * - If the employee checked in on `yesterdayIST` for a Night Shift and has NOT checked out yet,
 *   that record remains active past 12:00 AM midnight through the morning/afternoon (until check-out or 5:00 PM IST),
 *   preventing the portal/kiosk from prematurely resetting to "Ready for Check-In" at midnight.
 * - Once the employee checks out in the morning (on `todayIST`), the completed night shift record
 *   continues to display as "Completed" during daytime rest hours (until 4:00 PM / 16:00 IST),
 *   after which it resets for their next evening Night Shift check-in.
 */
export function findActiveAttendanceForEmployee(
  allAttendance: AttendanceRecord[],
  idAliases: Iterable<string>,
  todayIST: string,
  isNightShiftEmp: boolean = false,
  now: Date = new Date()
): AttendanceRecord | undefined {
  const aliasSet = new Set<string>()
  for (const a of idAliases) {
    if (a && String(a).trim()) {
      aliasSet.add(String(a).trim().toUpperCase())
    }
  }
  if (aliasSet.size === 0) return undefined

  const matchesEmp = (rec: AttendanceRecord) => {
    const aEmp = (rec.employeeId || '').trim().toUpperCase()
    return aliasSet.has(aEmp)
  }

  const getRecDateIST = (rec: AttendanceRecord): string => {
    if (rec.date && /^\d{4}-\d{2}-\d{2}$/.test(rec.date.trim())) {
      return rec.date.trim()
    }
    if (rec.punchIn) {
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(rec.punchIn))
      } catch {
        return String(rec.punchIn).slice(0, 10)
      }
    }
    return ''
  }

  const yesterdayIST = getPreviousDateStr(todayIST)
  const currentISTMinutes = getISTMinutesFromDate(now)

  const todayRecord = allAttendance.find(a => matchesEmp(a) && a.punchIn && getRecDateIST(a) === todayIST)
  const yesterdayRecord = yesterdayIST
    ? allAttendance.find(a => matchesEmp(a) && a.punchIn && getRecDateIST(a) === yesterdayIST)
    : undefined

  if (yesterdayRecord && yesterdayRecord.punchIn) {
    let punchInISTMinutes = 0
    try {
      const inDt = new Date(yesterdayRecord.punchIn)
      if (!isNaN(inDt.getTime())) {
        punchInISTMinutes = getISTMinutesFromDate(inDt)
      }
    } catch {}

    const recShiftLower = String(yesterdayRecord.shiftName || '').toLowerCase()
    const ddShiftLower = String(yesterdayRecord.doubleDutyShift || '').toLowerCase()
    const isYesterdayNightShift =
      recShiftLower.includes('night') ||
      ddShiftLower.includes('night') ||
      isNightShiftEmp ||
      punchInISTMinutes >= 990 // 16:30 (4:30 PM IST) or later

    if (isYesterdayNightShift) {
      const isYesterdayStillOpen =
        (yesterdayRecord.punchIn && !yesterdayRecord.punchOut) ||
        (yesterdayRecord.doubleDutyIn && !yesterdayRecord.doubleDutyOut)

      // 1. OPEN NIGHT SHIFT FROM YESTERDAY:
      // Keep active across midnight through morning & afternoon (until 17:00 / 5:00 PM IST or within 20h of punch-in)
      if (isYesterdayStillOpen && !todayRecord) {
        let elapsedHours = 0
        try {
          const activeInIso = (yesterdayRecord.doubleDutyIn && !yesterdayRecord.doubleDutyOut)
            ? yesterdayRecord.doubleDutyIn
            : yesterdayRecord.punchIn
          elapsedHours = (now.getTime() - new Date(activeInIso!).getTime()) / (1000 * 60 * 60)
        } catch {}

        if (currentISTMinutes < 1020 || (elapsedHours > 0 && elapsedHours <= 20)) {
          return yesterdayRecord
        }
      }

      // 2. COMPLETED NIGHT SHIFT THAT ENDED THIS MORNING (ON todayIST):
      // Keep showing as "Shift Completed" during daytime rest hours until 16:00 (4:00 PM IST),
      // so the employee doesn't immediately flip back to "Ready for Check-In" right after morning check-out.
      if (!isYesterdayStillOpen && !todayRecord && currentISTMinutes < 960) {
        const lastOutIso = yesterdayRecord.doubleDutyOut || yesterdayRecord.punchOut
        if (lastOutIso) {
          try {
            const outDateIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(lastOutIso))
            if (outDateIST === todayIST) {
              return yesterdayRecord
            }
          } catch {}
        }
      }
    }
  }

  return todayRecord
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
    const empNorm = rec.employeeId.trim().toUpperCase()
    const dateNorm = String(d).trim()
    const key = `${empNorm}_${dateNorm}`
    const existing = map.get(key)

    // Guard against creating an orphan OUT-only record on `dateNorm` when it actually belongs to yesterday's Night Shift
    if (!existing && !rec.punchIn && rec.punchOut) {
      const prevDate = getPreviousDateStr(dateNorm)
      if (prevDate) {
        const prevKey = `${empNorm}_${prevDate}`
        const prevExisting = map.get(prevKey)
        if (prevExisting && prevExisting.punchIn) {
          map.set(prevKey, {
            ...prevExisting,
            punchOut: prevExisting.punchOut || rec.punchOut,
            punchOutMode: prevExisting.punchOutMode || rec.punchOutMode || null,
            totalMinutes: rec.totalMinutes !== undefined && rec.totalMinutes !== null ? rec.totalMinutes : prevExisting.totalMinutes,
            status: rec.status || prevExisting.status,
          })
          return
        }
      }
      // Do not insert a record that has no punchIn at all
      return
    }

    if (!existing) {
      map.set(key, { ...rec, date: dateNorm })
    } else {
      // Intelligently merge without losing punchIn or punchOut
      const merged: AttendanceRecord = {
        ...existing,
        ...rec,
        date: existing.date || dateNorm,
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

  // 5. Harvest and resurrect punches from audit_trail.json & audit_trail_backup.json across all directories
  // Every kiosk and mobile punch logs exact action (IN/OUT), employeeId, employeeName, status, lateMinutes, and ISO timestamp
  for (const dir of allDirs) {
    for (const filename of ['audit_trail.json', 'audit_trail_backup.json']) {
      const fPath = path.join(dir, filename)
      const list = safeReadJsonFile<any[]>(fPath, [])
      if (Array.isArray(list)) {
        // Process chronologically (oldest first) so IN records exist before OUT records
        const chronological = [...list].reverse()
        for (const audit of chronological) {
          if (!audit || !audit.employeeId || !audit.timestamp) continue
          const action = String(audit.action || '').toUpperCase()
          if (action !== 'IN' && action !== 'OUT') continue

          let d = audit.shiftDate || ''
          if (!d) {
            try {
              d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(audit.timestamp))
            } catch {
              d = String(audit.timestamp).slice(0, 10)
            }
          }
          if (!d) continue

          if (action === 'IN') {
            mergeRecord({
              id: audit.id || `att-audit-${audit.employeeId}-${d}`,
              employeeId: audit.employeeId,
              employeeName: audit.employeeName || undefined,
              date: d,
              punchIn: audit.timestamp,
              punchInMode: audit.punchMode || 'KIOSK',
              status: audit.status || (audit.isLate || audit.lateMinutes > 0 ? 'LATE' : 'PRESENT'),
              isLate: audit.isLate !== undefined ? audit.isLate : (audit.lateMinutes > 0),
              lateMinutes: audit.lateMinutes || 0,
              shiftName: audit.shiftName || undefined,
            })
          } else if (action === 'OUT') {
            mergeRecord({
              id: audit.id || `att-audit-${audit.employeeId}-${d}`,
              employeeId: audit.employeeId,
              employeeName: audit.employeeName || undefined,
              date: d,
              punchOut: audit.timestamp,
              punchOutMode: audit.punchMode || 'KIOSK',
              totalMinutes: audit.totalMinutes || undefined,
              status: audit.status || undefined,
              shiftName: audit.shiftName || undefined,
            })
          }
        }
      }
    }
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
