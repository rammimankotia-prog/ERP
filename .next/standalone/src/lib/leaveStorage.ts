import fs from 'fs'
import path from 'path'
import {
  getAllDataDirs,
  safeReadJsonFile,
  safeWriteJsonFile,
  writeToAllTiers,
  appendToImmutableJournal,
  ensureDirExists
} from './persistentVault'

export interface LeaveRecord {
  id: string
  employeeId: string
  employeeCode?: string
  employeeName?: string
  designation?: string
  leaveType: {
    id?: string
    name: string
    category: string
  }
  leaveTypeId?: string
  leaveTypeName?: string
  fromDate: string
  toDate: string
  totalDays: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string
  approverId?: string
  approverNote?: string
  approvedAt?: string
  rejectedAt?: string
  createdAt: string
  updatedAt?: string
  [key: string]: any
}

/**
 * Get all merged leave records across all persistent storage tiers and historical deployments.
 * Guarantees that no leave records are lost even if git pull or server update overwrites hr_leaves.json.
 */
export function getMergedLeaves(): LeaveRecord[] {
  const map = new Map<string, LeaveRecord>()

  const mergeRecord = (rec: any) => {
    if (!rec || !rec.id) return
    const key = String(rec.id).trim()
    const existing = map.get(key)

    if (!existing) {
      map.set(key, rec)
    } else {
      // Prioritize finalized status (APPROVED / REJECTED) over PENDING
      const statusRank: Record<string, number> = { APPROVED: 3, REJECTED: 3, CANCELLED: 2, PENDING: 1 }
      const existingRank = statusRank[existing.status] || 0
      const newRank = statusRank[rec.status] || 0

      const preferred = newRank >= existingRank ? rec : existing
      map.set(key, {
        ...existing,
        ...rec,
        status: preferred.status,
        approverId: preferred.approverId || existing.approverId || rec.approverId,
        approverNote: preferred.approverNote || existing.approverNote || rec.approverNote,
        approvedAt: preferred.approvedAt || existing.approvedAt || rec.approvedAt,
        rejectedAt: preferred.rejectedAt || existing.rejectedAt || rec.rejectedAt,
      })
    }
  }

  const allDirs = getAllDataDirs()

  // 1. Read Master Vault Files across all directories
  for (const dir of allDirs) {
    const mv = path.join(dir, 'leave_vault', 'master_leaves.json')
    const list = safeReadJsonFile<any[]>(mv, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // 2. Read Primary and Backup Files across all directories
  for (const dir of allDirs) {
    for (const filename of ['hr_leaves.json', 'hr_leaves_backup.json']) {
      const fPath = path.join(dir, filename)
      const list = safeReadJsonFile<any[]>(fPath, [])
      if (Array.isArray(list)) list.forEach(mergeRecord)
    }
  }

  // 3. Read Append-Only Journal Files across all directories
  for (const dir of allDirs) {
    const jFile = path.join(dir, 'leave_vault', 'leave_journal.jsonl')
    try {
      if (fs.existsSync(jFile)) {
        const lines = fs.readFileSync(jFile, 'utf-8').split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const entry = JSON.parse(trimmed)
            mergeRecord(entry)
          } catch {}
        }
      }
    } catch {}
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || a.fromDate).getTime() || 0
    const timeB = new Date(b.createdAt || b.fromDate).getTime() || 0
    return timeB - timeA
  })

  // Self-heal: If vault or backup had more records than active hr_leaves.json, synchronize all files
  if (merged.length > 0) {
    try {
      const localPrimary = path.join(process.cwd(), 'data', 'hr_leaves.json')
      const currentOnDisk = safeReadJsonFile<any[]>(localPrimary, [])
      if (currentOnDisk.length !== merged.length) {
        saveAllLeaves(merged)
      }
    } catch {}
  }

  return merged
}

/**
 * Save all leave records atomically across all persistent storage tiers.
 */
export function saveAllLeaves(leaves: LeaveRecord[]): void {
  writeToAllTiers('hr_leaves.json', leaves)
  const allDirs = getAllDataDirs()
  for (const dir of allDirs) {
    const vDir = path.join(dir, 'leave_vault')
    ensureDirExists(vDir)
    safeWriteJsonFile(path.join(vDir, 'master_leaves.json'), leaves)
  }
}

/**
 * Save or insert a new leave record into all storage tiers and journal.
 */
export function saveLeaveRecord(record: LeaveRecord): LeaveRecord {
  const leaves = getMergedLeaves()
  const existingIdx = leaves.findIndex(l => l.id === record.id)

  if (existingIdx !== -1) {
    leaves[existingIdx] = { ...leaves[existingIdx], ...record, updatedAt: new Date().toISOString() }
  } else {
    leaves.unshift({ ...record, createdAt: record.createdAt || new Date().toISOString() })
  }

  saveAllLeaves(leaves)
  appendToImmutableJournal('leave_vault', 'leave_journal.jsonl', record)
  return record
}

/**
 * Update an existing leave record (e.g. approve, reject, cancel).
 */
export function updateLeaveRecord(id: string, updates: Partial<LeaveRecord>): LeaveRecord | null {
  const leaves = getMergedLeaves()
  const idx = leaves.findIndex(l => l.id === id)

  if (idx === -1) {
    const synthetic: LeaveRecord = {
      id,
      employeeId: updates.employeeId || 'unknown',
      leaveType: updates.leaveType || { name: 'Leave', category: 'CASUAL' },
      fromDate: updates.fromDate || new Date().toISOString().slice(0, 10),
      toDate: updates.toDate || new Date().toISOString().slice(0, 10),
      totalDays: updates.totalDays || 1,
      reason: updates.reason || 'Leave application',
      status: updates.status || 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...updates
    }
    leaves.unshift(synthetic)
    saveAllLeaves(leaves)
    appendToImmutableJournal('leave_vault', 'leave_journal.jsonl', synthetic)
    return synthetic
  }

  const updated: LeaveRecord = {
    ...leaves[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  leaves[idx] = updated
  saveAllLeaves(leaves)
  appendToImmutableJournal('leave_vault', 'leave_journal.jsonl', updated)
  return updated
}
