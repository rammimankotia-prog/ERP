import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getAllEmployees } from '@/lib/employeeData'
import { getEmployeeRosterShift } from '@/lib/shiftStorage'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

// GET /api/kiosk/attendance?employeeId=X&id=Y&email=Z
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || searchParams.get('id') || searchParams.get('code') || ''
  const emailParam = searchParams.get('email') || ''

  if (!employeeId && !emailParam) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  try {
    const employees = await getAllEmployees()
    const targetQuery = employeeId.trim().toUpperCase()
    const emailLower = emailParam.trim().toLowerCase()

    const emp = employees.find(e =>
      (e.id && e.id.trim().toUpperCase() === targetQuery) ||
      (e.employeeId && e.employeeId.trim().toUpperCase() === targetQuery) ||
      (e.email && e.email.trim().toLowerCase() === targetQuery.toLowerCase()) ||
      (emailLower && e.email && e.email.trim().toLowerCase() === emailLower)
    )

    // Build all possible aliases for this employee (e.g. "emp-1789635127747", "GG-1003", email, name)
    const idAliases = new Set<string>()
    if (employeeId.trim()) idAliases.add(employeeId.trim().toUpperCase())
    if (emp) {
      if (emp.id) idAliases.add(emp.id.trim().toUpperCase())
      if (emp.employeeId) idAliases.add(emp.employeeId.trim().toUpperCase())
      if (emp.email) idAliases.add(emp.email.trim().toUpperCase())
    }

    const aliasArray = Array.from(idAliases)

    // 1. Fetch from Prisma DB attendanceLog if reachable
    let dbLogs: any[] = []
    try {
      const dbRecords = await prisma.attendanceLog.findMany({
        where: {
          OR: aliasArray.map(alias => ({ employeeId: alias }))
        },
        orderBy: {
          date: 'desc'
        },
        take: 100
      })
      if (dbRecords && dbRecords.length > 0) {
        dbLogs = dbRecords.map(l => {
          let dateStr = ''
          if (l.date instanceof Date) {
            try {
              dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(l.date)
            } catch {
              dateStr = l.date.toISOString().slice(0, 10)
            }
          } else {
            dateStr = String(l.date || '').slice(0, 10)
          }
          if (!dateStr && l.punchIn) {
            try {
              dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.punchIn))
            } catch {
              dateStr = String(l.punchIn).slice(0, 10)
            }
          }
          return {
            id: l.id,
            employeeId: l.employeeId,
            date: dateStr,
            punchIn: l.punchIn instanceof Date ? l.punchIn.toISOString() : (l.punchIn || null),
            punchOut: l.punchOut instanceof Date ? l.punchOut.toISOString() : (l.punchOut || null),
            punchInMode: l.punchInMode || 'WEB',
            punchOutMode: l.punchOutMode || null,
            status: String(l.status || 'PRESENT'),
            totalMinutes: l.totalMinutes || null,
            remarks: (l as any).notes || null,
          }
        })
      }
    } catch (dbErr) {
      // DB fallback
    }

    // 2. Fetch from persistent multi-tier JSON storage
    const allAttendance = getMergedAttendance()
    const empFullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toUpperCase() : ''
    const jsonLogs = allAttendance.filter(a => {
      const aEmp = (a.employeeId || '').trim().toUpperCase()
      const aName = (a.employeeName || '').trim().toUpperCase()
      return idAliases.has(aEmp) || (empFullName && (aName === empFullName || aEmp === empFullName))
    })

    // Merge punches: map keyed by date
    const punchesByDate = new Map<string, any>()

    // Insert DB logs first
    for (const dl of dbLogs) {
      if (dl.date) punchesByDate.set(dl.date, dl)
    }

    // Merge JSON logs (or override/supplement)
    for (const jl of jsonLogs) {
      let jDate = jl.date || ''
      if (!jDate && jl.punchIn) {
        try {
          jDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(jl.punchIn))
        } catch {
          jDate = String(jl.punchIn).slice(0, 10)
        }
      }
      if (!jDate) continue
      const existing = punchesByDate.get(jDate)
      if (!existing) {
        punchesByDate.set(jDate, { ...jl, date: jDate })
      } else {
        punchesByDate.set(jDate, {
          ...existing,
          ...jl,
          date: jDate,
          punchIn: jl.punchIn || existing.punchIn || null,
          punchOut: jl.punchOut || existing.punchOut || null,
          totalMinutes: jl.totalMinutes !== undefined && jl.totalMinutes !== null ? jl.totalMinutes : existing.totalMinutes,
          status: jl.status || existing.status || 'PRESENT',
        })
      }
    }

    // 3. Approved leaves
    let approvedLeaves: any[] = []
    try {
      const { getMergedLeaves } = await import('@/lib/leaveStorage')
      const leaves = getMergedLeaves()
      approvedLeaves = leaves.filter(l =>
        l.status === 'APPROVED' &&
        (idAliases.has((l.employeeId || '').toUpperCase()) || idAliases.has((l.employeeCode || '').toUpperCase()))
      )
    } catch {}

    // 4. Determine Target Year and Month (supports ?month=YYYY-MM, defaults dynamically to current IST month)
    const now = new Date()
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
    const [todayYearStr, todayMonthStr, todayDayStr] = todayIST.split('-')

    const monthParam = searchParams.get('month') || '' // format "YYYY-MM"
    let targetYear = parseInt(todayYearStr, 10)
    let targetMonth = parseInt(todayMonthStr, 10)

    if (monthParam && /^\d{4}-\d{1,2}$/.test(monthParam.trim())) {
      const parts = monthParam.trim().split('-')
      targetYear = parseInt(parts[0], 10)
      targetMonth = parseInt(parts[1], 10)
    }

    const targetYearStr = String(targetYear)
    const targetMonthStr = String(targetMonth).padStart(2, '0')
    const targetMonthPrefix = `${targetYearStr}-${targetMonthStr}`

    // Total days in target month (e.g. 28, 29, 30, or 31)
    const totalDaysInMonth = new Date(targetYear, targetMonth, 0).getDate()

    // Combined days map for the target month
    const combinedDaysMap = new Map<string, any>()

    // Populate all real punches recorded for this target month
    for (const [dStr, pRec] of punchesByDate.entries()) {
      if (dStr.startsWith(targetMonthPrefix)) {
        combinedDaysMap.set(dStr, pRec)
      }
    }

    const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Generate every day of the month
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dayPad = String(dayNum).padStart(2, '0')
      const dateStr = `${targetYearStr}-${targetMonthStr}-${dayPad}`

      if (!combinedDaysMap.has(dateStr)) {
        const dObj = new Date(`${dateStr}T12:00:00+05:30`)
        const dayOfWeek = daysOfWeekNames[dObj.getDay()]
        const isSunday = dObj.getDay() === 0

        // Check if on approved leave
        const leave = approvedLeaves.find(l => {
          const fromD = (l.fromDate || '').slice(0, 10)
          const toD = (l.toDate || fromD).slice(0, 10)
          return dateStr >= fromD && dateStr <= toD
        })

        if (leave) {
          combinedDaysMap.set(dateStr, {
            id: `leave-${dateStr}`,
            employeeId: emp?.employeeId || emp?.id || employeeId,
            date: dateStr,
            punchIn: null,
            punchOut: null,
            status: leave.leaveTypeName || 'LEAVE',
            remarks: leave.reason || 'Approved Leave'
          })
          continue
        }

        // Check roster / off days
        let isOff = isSunday
        let shiftLabel = 'Scheduled Duty'
        if (emp) {
          const rosterShift = getEmployeeRosterShift(emp, dateStr)
          if (rosterShift.isOff || rosterShift.startTime === 'OFF') {
            isOff = true
          } else if (Array.isArray(emp.offDays) && emp.offDays.length > 0) {
            isOff = emp.offDays.some((od: string) => od.toLowerCase() === dayOfWeek.toLowerCase())
          }
          if (rosterShift.shiftName) {
            shiftLabel = `${rosterShift.shiftName} (${rosterShift.startTime} - ${rosterShift.endTime})`
          }
        }

        if (isOff) {
          combinedDaysMap.set(dateStr, {
            id: `off-${dateStr}`,
            employeeId: emp?.employeeId || emp?.id || employeeId,
            date: dateStr,
            punchIn: null,
            punchOut: null,
            status: 'WEEKLY_OFF',
            remarks: `${dayOfWeek} Off`
          })
        } else if (dateStr < todayIST) {
          combinedDaysMap.set(dateStr, {
            id: `absent-${dateStr}`,
            employeeId: emp?.employeeId || emp?.id || employeeId,
            date: dateStr,
            punchIn: null,
            punchOut: null,
            status: 'ABSENT',
            remarks: 'Absent'
          })
        } else if (dateStr === todayIST) {
          combinedDaysMap.set(dateStr, {
            id: `pending-${dateStr}`,
            employeeId: emp?.employeeId || emp?.id || employeeId,
            date: dateStr,
            punchIn: null,
            punchOut: null,
            status: 'PENDING',
            remarks: 'Punch In Pending'
          })
        } else {
          // Future scheduled day in current or future month
          combinedDaysMap.set(dateStr, {
            id: `sched-${dateStr}`,
            employeeId: emp?.employeeId || emp?.id || employeeId,
            date: dateStr,
            punchIn: null,
            punchOut: null,
            status: 'SCHEDULED',
            remarks: shiftLabel
          })
        }
      }
    }

    const logs = Array.from(combinedDaysMap.values())

    // Sort descending by date (newest day first)
    logs.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      return dateB.localeCompare(dateA)
    })

    return NextResponse.json({
      logs,
      month: targetMonthPrefix,
      totalDays: totalDaysInMonth,
      employeeId: emp?.employeeId || emp?.id || employeeId,
      employeeName: empFullName || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim()
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch attendance history' }, { status: 500 })
  }
}
