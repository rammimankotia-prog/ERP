import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

import { parseTimeToISTMinutes } from '@/app/api/hr/reports/route'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getAllEmployees } from '@/lib/employeeData'

const prisma = new PrismaClient()

// GET /api/hr/attendance?date=2024-05-15
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const dateStr = searchParams.get('date') || todayIST

  try {
    const employees = await getAllEmployees()
    const allAttendance = getMergedAttendance()

    // Query Prisma DB attendanceLog if connected
    let dbLogs: any[] = []
    try {
      const startOfDay = new Date(`${dateStr}T00:00:00+05:30`)
      const endOfDay = new Date(`${dateStr}T23:59:59+05:30`)
      const prevDay = new Date(startOfDay.getTime() - 24 * 3600 * 1000)
      const nextDay = new Date(endOfDay.getTime() + 24 * 3600 * 1000)

      dbLogs = await prisma.attendanceLog.findMany({
        where: {
          OR: [
            { date: { gte: prevDay, lte: nextDay } },
            { punchIn: { gte: prevDay, lte: nextDay } }
          ]
        }
      })
    } catch {}

    // Map Prisma DB logs to standard attendance structure
    const mappedDbLogs = dbLogs.map(l => {
      let d = ''
      if (l.date instanceof Date) {
        try {
          d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(l.date)
        } catch {
          d = l.date.toISOString().slice(0, 10)
        }
      } else if (l.punchIn instanceof Date) {
        try {
          d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(l.punchIn)
        } catch {
          d = l.punchIn.toISOString().slice(0, 10)
        }
      }
      return {
        id: l.id,
        employeeId: l.employeeId,
        date: d || dateStr,
        punchIn: l.punchIn instanceof Date ? l.punchIn.toISOString() : (l.punchIn || null),
        punchOut: l.punchOut instanceof Date ? l.punchOut.toISOString() : (l.punchOut || null),
        punchInMode: l.punchInMode || 'WEB',
        punchOutMode: l.punchOutMode || null,
        status: String(l.status || 'PRESENT'),
        totalMinutes: l.totalMinutes || null,
        notes: l.notes || null,
      }
    })

    // Combine storage records and DB logs
    const combinedRecords = [...allAttendance]
    for (const dRec of mappedDbLogs) {
      const key = `${(dRec.employeeId || '').toUpperCase()}_${dRec.date}`
      const existingIdx = combinedRecords.findIndex(c => 
        `${(c.employeeId || '').toUpperCase()}_${c.date}` === key ||
        (c.punchIn && dRec.punchIn && c.employeeId.toUpperCase() === dRec.employeeId.toUpperCase())
      )
      if (existingIdx === -1) {
        combinedRecords.push(dRec)
      } else {
        combinedRecords[existingIdx] = {
          ...combinedRecords[existingIdx],
          ...dRec,
          punchIn: combinedRecords[existingIdx].punchIn || dRec.punchIn || null,
          punchOut: dRec.punchOut || combinedRecords[existingIdx].punchOut || null,
        }
      }
    }

    const todayAttendance = combinedRecords.filter(a => {
      if (a.date === dateStr) return true
      if (a.punchIn) {
        if (a.punchIn.slice(0, 10) === dateStr) return true
        try {
          const inDateIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(a.punchIn))
          if (inDateIST === dateStr) return true
        } catch {}
      }
      return false
    })

    // Combine employees with their attendance
    const teamAttendance = employees.map(emp => {
      const empIdNorm = (emp.id || '').trim().toUpperCase()
      const empCodeNorm = (emp.employeeId || '').trim().toUpperCase()
      const empEmailNorm = (emp.email || '').trim().toUpperCase()
      const empFullNameNorm = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toUpperCase()

      const record = todayAttendance.find(a => {
        const aIdNorm = (a.employeeId || '').trim().toUpperCase()
        const aNameNorm = (a.employeeName || '').trim().toUpperCase()

        if (aIdNorm && (aIdNorm === empIdNorm || aIdNorm === empCodeNorm)) return true
        if (empEmailNorm && aIdNorm === empEmailNorm) return true
        if (empFullNameNorm && (aNameNorm === empFullNameNorm || aIdNorm === empFullNameNorm)) return true
        return false
      })

      let status = record ? (record.status || 'PRESENT') : 'ABSENT'

      // Late arrival check
      let isLate = false
      let lateMinutes = 0
      if (record && record.punchIn) {
        const shiftInMinutes = parseTimeToISTMinutes(emp.morningTime || '09:00')
        const punchInMinutes = parseTimeToISTMinutes(record.punchIn)
        lateMinutes = record.lateMinutes !== undefined ? record.lateMinutes : Math.max(0, punchInMinutes - shiftInMinutes)
        isLate = record.isLate === true || record.status === 'LATE' || lateMinutes > 15
        if (isLate && status === 'PRESENT') {
          status = 'LATE'
        }
        // If punchIn exists, it can NEVER be ABSENT
        if (status === 'ABSENT') {
          status = isLate ? 'LATE' : 'PRESENT'
        }
      }

      // Half-day check: worked <= 5 hours
      if (record && record.punchIn && record.punchOut) {
        let totalMins = record.totalMinutes
        if (totalMins === undefined || totalMins === null) {
          try {
            totalMins = Math.floor(
              (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / 60000
            )
          } catch {}
        }
        if (typeof totalMins === 'number' && totalMins > 0 && totalMins <= 300) {
          status = 'HALF_DAY'
        }
      }

      return {
        employeeId: emp.employeeId || emp.id,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        department: emp.department?.name || emp.departmentId || 'Unassigned',
        designation: emp.designation || 'Staff',
        status,
        isLate,
        lateMinutes,
        punchIn: record ? record.punchIn : null,
        punchOut: record ? record.punchOut : null,
        totalMinutes: record ? record.totalMinutes : null,
        punchInMode: record ? (record.punchInMode || 'KIOSK') : null,
      }
    })

    return NextResponse.json({ date: dateStr, logs: teamAttendance })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 })
  }
}
