import fs from 'fs'
import path from 'path'

// Indestructible Persistent Storage Engine for Godwin ERP
// Multi-tier writes and historical recovery across deployments.

let cachedPermanentDir: string | null = null

export function ensureDirExists(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch {}
}

/**
 * Resolves the true external permanent directory that survives all deployments and builds.
 */
export function getPermanentDataDir(): string {
  if (cachedPermanentDir) return cachedPermanentDir

  // 1. Explicit Environment Variable
  if (process.env.PERSISTENT_DATA_DIR && process.env.PERSISTENT_DATA_DIR.trim()) {
    const envDir = process.env.PERSISTENT_DATA_DIR.trim()
    ensureDirExists(envDir)
    cachedPermanentDir = envDir
    return envDir
  }

  const cwd = process.cwd()

  // 2. Hostinger / Linux Cloud Detection
  // Check if running inside Hostinger versioned structure (e.g. .../hbuilds/versions/<UUID>/nodejs)
  try {
    let curr = cwd
    for (let i = 0; i < 6; i++) {
      const parent = path.dirname(curr)
      if (path.basename(curr) === 'domains' || fs.existsSync(path.join(curr, 'domains'))) {
        const domainDir = path.basename(curr) === 'domains' ? curr : path.join(curr, 'domains')
        // Target: /home/u790942238/domains/grandgodwin.com/godwin_permanent_data
        const grandGodwinDomain = path.join(domainDir, 'grandgodwin.com')
        const targetDir = fs.existsSync(grandGodwinDomain)
          ? path.join(grandGodwinDomain, 'godwin_permanent_data')
          : path.join(domainDir, 'godwin_permanent_data')
        ensureDirExists(targetDir)
        cachedPermanentDir = targetDir
        return targetDir
      }
      if (curr.includes('hbuilds')) {
        // e.g. /home/u790942238/domains/grandgodwin.com/hbuilds -> traverse to grandgodwin.com
        const beforeHbuilds = curr.split('hbuilds')[0]
        if (beforeHbuilds) {
          const targetDir = path.join(beforeHbuilds, 'godwin_permanent_data')
          ensureDirExists(targetDir)
          cachedPermanentDir = targetDir
          return targetDir
        }
      }
      if (parent === curr) break
      curr = parent
    }

    // Check for user home directory on Linux
    if (process.platform === 'linux' && process.env.HOME) {
      const homePermanent = path.join(process.env.HOME, 'godwin_permanent_data')
      ensureDirExists(homePermanent)
      cachedPermanentDir = homePermanent
      return homePermanent
    }
  } catch {}

  // 3. Local Development / Windows Fallback
  // Create permanent vault alongside workspace if possible, else local data/
  try {
    const parentDir = path.dirname(cwd)
    const externalLocal = path.join(parentDir, 'godwin_local_permanent_vault')
    ensureDirExists(externalLocal)
    cachedPermanentDir = externalLocal
    return externalLocal
  } catch {
    const defaultData = path.join(cwd, 'data')
    ensureDirExists(defaultData)
    cachedPermanentDir = defaultData
    return defaultData
  }
}

/**
 * Returns all storage directories ordered by permanence (Permanent External > Local Data > Sibling Builds)
 */
export function getAllDataDirs(): string[] {
  const dirs: string[] = []
  const perm = getPermanentDataDir()
  if (perm && !dirs.includes(perm)) dirs.push(perm)

  const local = path.join(process.cwd(), 'data')
  if (!dirs.includes(local)) dirs.push(local)

  // Find sibling version build directories if on Hostinger / versioned system
  try {
    const cwd = process.cwd()
    if (cwd.includes('versions')) {
      // cwd: .../hbuilds/versions/<uuid>/nodejs
      const versionsDir = path.dirname(path.dirname(cwd))
      if (fs.existsSync(versionsDir)) {
        const versionFolders = fs.readdirSync(versionsDir)
        for (const vf of versionFolders) {
          const cand1 = path.join(versionsDir, vf, 'nodejs', 'data')
          const cand2 = path.join(versionsDir, vf, 'data')
          for (const cand of [cand1, cand2]) {
            if (fs.existsSync(cand) && !dirs.includes(cand)) {
              dirs.push(cand)
            }
          }
        }
      }
    }
  } catch {}

  return dirs
}

/**
 * Safely reads and parses JSON from a file
 */
export function safeReadJsonFile<T>(filePath: string, fallback: T): T {
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

/**
 * Safely writes JSON atomically
 */
export function safeWriteJsonFile(filePath: string, data: any): void {
  try {
    ensureDirExists(path.dirname(filePath))
    const tempFile = `${filePath}.tmp.${Date.now()}`
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tempFile, filePath)
  } catch {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.error(`[persistentVault] Failed to write ${filePath}:`, e)
    }
  }
}

/**
 * Writes data across ALL permanent and local tiers simultaneously
 */
export function writeToAllTiers(filename: string, data: any): void {
  const dirs = getAllDataDirs()
  for (const dir of dirs) {
    try {
      const target = path.join(dir, filename)
      safeWriteJsonFile(target, data)
      // Also write backup copy
      const ext = path.extname(filename)
      const base = path.basename(filename, ext)
      const backupTarget = path.join(dir, `${base}_backup${ext}`)
      safeWriteJsonFile(backupTarget, data)
    } catch {}
  }
}

/**
 * Appends an immutable line to a .jsonl journal file across all directories
 */
export function appendToImmutableJournal(subDir: string, journalFilename: string, entry: any): void {
  const dirs = getAllDataDirs()
  const payload = JSON.stringify({ ...entry, _journalTimestamp: new Date().toISOString() }) + '\n'
  for (const dir of dirs) {
    try {
      const targetDir = subDir ? path.join(dir, subDir) : dir
      ensureDirExists(targetDir)
      const targetFile = path.join(targetDir, journalFilename)
      fs.appendFileSync(targetFile, payload, 'utf-8')
    } catch {}
  }
}
