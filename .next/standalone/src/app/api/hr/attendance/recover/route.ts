import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { getAllDataDirs, safeReadJsonFile, safeWriteJsonFile, writeToAllTiers, ensureDirExists } from '@/lib/persistentVault'
import { getMergedAttendance, saveAttendanceRecord } from '@/lib/attendanceStorage'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const allDirs = getAllDataDirs()
    const foundFiles: { path: string; size: number; mtime: string }[] = []
    const rawAttendanceRecords: any[] = []
    const auditEntries: any[] = []

    // 1. Discover all candidate files across all directories
    for (const dir of allDirs) {
      if (!fs.existsSync(dir)) continue
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const fullPath = path.join(dir, file)
          const stat = fs.statSync(fullPath)
          if (stat.isFile()) {
            foundFiles.push({ path: fullPath, size: stat.size, mtime: stat.mtime.toISOString() })
            if (file.includes('attendance') && file.endsWith('.json')) {
              const content = safeReadJsonFile<any[]>(fullPath, [])
              if (Array.isArray(content)) rawAttendanceRecords.push(...content)
            }
            if (file.includes('audit') && file.endsWith('.json')) {
              const content = safeReadJsonFile<any[]>(fullPath, [])
              if (Array.isArray(content)) auditEntries.push(...content)
            }
          } else if (stat.isDirectory() && file === 'attendance_vault') {
            const vaultFiles = fs.readdirSync(fullPath)
            for (const vf of vaultFiles) {
              const vFullPath = path.join(fullPath, vf)
              const vStat = fs.statSync(vFullPath)
              foundFiles.push({ path: vFullPath, size: vStat.size, mtime: vStat.mtime.toISOString() })
              if (vf.endsWith('.json')) {
                const content = safeReadJsonFile<any[]>(vFullPath, [])
                if (Array.isArray(content)) rawAttendanceRecords.push(...content)
              }
            }
          }
        }
      } catch {}
    }

    // 2. Extract punches from audit entries
    const auditPunches: any[] = []
    for (const audit of auditEntries) {
      if (!audit || !audit.employeeId || !audit.timestamp) continue
      const action = String(audit.action || '').toUpperCase()
      if (action !== 'IN' && action !== 'OUT') continue

      let d = ''
      try {
        d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(audit.timestamp))
      } catch {
        d = String(audit.timestamp).slice(0, 10)
      }
      if (!d) continue

      if (action === 'IN') {
        auditPunches.push({
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
        auditPunches.push({
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

    // 3. Re-save all recovered records through saveAttendanceRecord to rebuild all vaults
    const allPunchesToReconcile = [...rawAttendanceRecords, ...auditPunches]
    for (const rec of allPunchesToReconcile) {
      if (rec && rec.employeeId && (rec.punchIn || rec.punchOut || rec.date)) {
        saveAttendanceRecord(rec)
      }
    }

    // 4. Get the unified merged attendance
    const finalMerged = getMergedAttendance()

    // 5. Check Prisma DB
    let prismaCount = 0
    try {
      prismaCount = await prisma.attendanceLog.count()
    } catch {}

    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
    const todayRecords = finalMerged.filter(a => a.date === todayIST || (a.punchIn && a.punchIn.slice(0, 10) === todayIST))

    return NextResponse.json({
      success: true,
      message: `Full Attendance Recovery Complete. Found ${allDirs.length} storage tiers, ${foundFiles.length} data files, ${todayRecords.length} records for today.`,
      todayIST,
      todayRecordsCount: todayRecords.length,
      todayRecords,
      totalMergedCount: finalMerged.length,
      prismaCount,
      storageDirectoriesSearched: allDirs,
      foundFilesCount: foundFiles.length,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
