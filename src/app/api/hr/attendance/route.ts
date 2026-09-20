import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

import { parseTimeToISTMinutes } from '@/app/api/hr/reports/route'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getAllEmployees } from '@/lib/employeeData'

// GET /api/hr/attendance?date=2024-05-15
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    const employees = await getAllEmployees()
    const allAttendance = getMergedAttendance()

    const todayAttendance = allAttendance.filter(a => {
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
      const record = todayAttendance.find(a => {
        const aIdNorm = (a.employeeId || '').trim().toUpperCase()
        return aIdNorm === empIdNorm || aIdNorm === empCodeNorm
      })
      let status = record ? record.status : 'ABSENT'

      // Late arrival check
      let isLate = false
      let lateMinutes = 0
      if (record && record.punchIn) {
        const shiftInMinutes = parseTimeToISTMinutes(emp.morningTime || '09:00')
        const punchInMinutes = parseTimeToISTMinutes(record.punchIn)
        lateMinutes = Math.max(0, punchInMinutes - shiftInMinutes)
        isLate = record.isLate === true || record.status === 'LATE' || lateMinutes > 15
        if (isLate && status === 'PRESENT') {
          status = 'LATE'
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
        punchInMode: record ? record.punchInMode : null,
      }
    })

    return NextResponse.json({ date: dateStr, logs: teamAttendance })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 })
  }
}
