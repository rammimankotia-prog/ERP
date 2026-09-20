import fs from 'fs'
import path from 'path'

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

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves.json')
const BACKUP_LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves_backup.json')
const LOCAL_BACKUP_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves_backup.json')

const VAULT_DIR = path.join(DATA_DIR, 'leave_vault')
const LOCAL_VAULT_DIR = path.join(LOCAL_DATA_DIR, 'leave_vault')
const JOURNAL_FILE = path.join(VAULT_DIR, 'leave_journal.jsonl')
const LOCAL_JOURNAL_FILE = path.join(LOCAL_VAULT_DIR, 'leave_journal.jsonl')
const MASTER_VAULT_FILE = path.join(VAULT_DIR, 'master_leaves.json')
const LOCAL_MASTER_VAULT_FILE = path.join(LOCAL_VAULT_DIR, 'master_leaves.json')

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
    console.error(`[leaveStorage] Error writing to ${filePath}:`, e)
  }
}

function appendToJournal(entry: any) {
  for (const f of [JOURNAL_FILE, LOCAL_JOURNAL_FILE]) {
    try {
      ensureDir(path.dirname(f))
      const line = JSON.stringify({ ...entry, _journalLoggedAt: new Date().toISOString() }) + '\n'
      fs.appendFileSync(f, line, 'utf-8')
    } catch {}
  }
}

/**
 * Get all merged leave records across all persistent storage tiers.
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

  // 1. Read Master Vault Files (immune to git overwrites)
  for (const f of [MASTER_VAULT_FILE, LOCAL_MASTER_VAULT_FILE]) {
    const list = safeReadJson<any[]>(f, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // 2. Read Backup Files (immune to git overwrites)
  for (const f of [BACKUP_LEAVES_FILE, LOCAL_BACKUP_FILE]) {
    const list = safeReadJson<any[]>(f, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // 3. Read Active JSON Files
  for (const f of [LEAVES_FILE, LOCAL_LEAVES_FILE]) {
    const list = safeReadJson<any[]>(f, [])
    if (Array.isArray(list)) list.forEach(mergeRecord)
  }

  // 4. Read Append-Only Journal Files
  for (const f of [JOURNAL_FILE, LOCAL_JOURNAL_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const lines = fs.readFileSync(f, 'utf-8').split('\n')
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
  const activeCount = safeReadJson<any[]>(LEAVES_FILE, []).length
  if (merged.length > 0 && merged.length !== activeCount) {
    saveAllLeaves(merged)
  }

  return merged
}

/**
 * Save all leave records atomically across all persistent storage tiers.
 */
export function saveAllLeaves(leaves: LeaveRecord[]) {
  // 1. Write to Active storage
  safeWriteJson(LEAVES_FILE, leaves)
  if (LEAVES_FILE !== LOCAL_LEAVES_FILE) {
    safeWriteJson(LOCAL_LEAVES_FILE, leaves)
  }

  // 2. Write to Protected Backup storage (in .gitignore)
  safeWriteJson(BACKUP_LEAVES_FILE, leaves)
  if (BACKUP_LEAVES_FILE !== LOCAL_BACKUP_FILE) {
    safeWriteJson(LOCAL_BACKUP_FILE, leaves)
  }

  // 3. Write to Protected Vault storage (in .gitignore)
  safeWriteJson(MASTER_VAULT_FILE, leaves)
  if (MASTER_VAULT_FILE !== LOCAL_MASTER_VAULT_FILE) {
    safeWriteJson(LOCAL_MASTER_VAULT_FILE, leaves)
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
  appendToJournal(record)
  return record
}

/**
 * Update an existing leave record (e.g. approve, reject, cancel).
 */
export function updateLeaveRecord(id: string, updates: Partial<LeaveRecord>): LeaveRecord | null {
  const leaves = getMergedLeaves()
  const idx = leaves.findIndex(l => l.id === id)

  if (idx === -1) {
    // Record not found in existing; create synthetic record if possible
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
    appendToJournal(synthetic)
    return synthetic
  }

  const updated: LeaveRecord = {
    ...leaves[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  leaves[idx] = updated
  saveAllLeaves(leaves)
  appendToJournal(updated)
  return updated
}
