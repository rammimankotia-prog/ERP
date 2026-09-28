import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { saveAttendanceRecord, getMergedAttendance } from '@/lib/attendanceStorage'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items = Array.isArray(body) ? body : [body]
    const saved: any[] = []

    for (const item of items) {
      if (!item || !item.employeeId) continue

      const record = {
        id: item.id || `att-sync-${item.employeeId}-${Date.now()}`,
        employeeId: item.employeeId,
        employeeName: item.employeeName || undefined,
        date: item.date || (item.punchIn ? item.punchIn.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        punchIn: item.punchIn || null,
        punchOut: item.punchOut || null,
        status: item.status || 'PRESENT',
        isLate: !!item.isLate,
        lateMinutes: item.lateMinutes || 0,
        punchInMode: item.punchInMode || 'WEB',
        punchOutMode: item.punchOutMode || null,
        totalMinutes: item.totalMinutes || null,
        shiftName: item.shiftName || undefined,
      }

      saveAttendanceRecord(record)
      saved.push(record)

      // Also upsert into Prisma if DB is available
      try {
        const dateObj = new Date(`${record.date}T00:00:00+05:30`)
        await prisma.attendanceLog.upsert({
          where: {
            employeeId_date: {
              employeeId: record.employeeId,
              date: dateObj
            }
          },
          create: {
            employeeId: record.employeeId,
            date: dateObj,
            punchIn: record.punchIn ? new Date(record.punchIn) : null,
            punchOut: record.punchOut ? new Date(record.punchOut) : null,
            status: (record.status as any) || 'PRESENT',
            punchInMode: (record.punchInMode as any) || 'WEB',
            totalMinutes: record.totalMinutes,
          },
          update: {
            punchIn: record.punchIn ? new Date(record.punchIn) : undefined,
            punchOut: record.punchOut ? new Date(record.punchOut) : undefined,
            status: (record.status as any) || undefined,
            totalMinutes: record.totalMinutes || undefined,
          }
        })
      } catch {}
    }

    return NextResponse.json({ success: true, count: saved.length, records: saved })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
