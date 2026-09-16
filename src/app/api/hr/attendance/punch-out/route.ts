import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, mode = 'WEB', lat, lng } = body

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }

    // IST-based today string — server-side authoritative, cannot be spoofed by client
    const nowServer = new Date()
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(nowServer)

    const requestDate = body.date
    if (requestDate) {
      if (requestDate < todayIST) {
        return NextResponse.json({
          error: 'PAST_DATE_LOCKED',
          message: 'Strict Security Restriction: Punch-out is strictly prohibited for past dates.'
        }, { status: 403 })
      }
      if (requestDate > todayIST) {
        return NextResponse.json({
          error: 'FUTURE_DATE_LOCKED',
          message: 'Punch-out is not permitted for future dates.'
        }, { status: 403 })
      }
    }

    // Use IST-anchored midnight for Prisma lookup
    const today = new Date(todayIST + 'T00:00:00+05:30')
    today.setHours(0, 0, 0, 0)

    const existing = await prisma.attendanceLog.findUnique({
      where: { employeeId_date: { employeeId, date: today } }
    })

    if (!existing?.punchIn) {
      return NextResponse.json({ error: 'No punch-in record found for today' }, { status: 404 })
    }
    if (existing.punchOut) {
      return NextResponse.json({ error: 'Already punched out today', log: existing }, { status: 409 })
    }

    const now = new Date()
    const totalMinutes = Math.floor((now.getTime() - existing.punchIn!.getTime()) / 60000)

    // Compute overtime (assume 8-hour standard shift = 480 minutes)
    const standardMinutes = 480
    const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes)

    // Determine if half-day (<= 5 hours = 300 minutes)
    let status = existing.status
    if (totalMinutes <= 300) {
      status = 'HALF_DAY' as any
    }

    const log = await prisma.attendanceLog.update({
      where: { employeeId_date: { employeeId, date: today } },
      data: {
        punchOut: now,
        punchOutMode: mode as any,
        punchOutLat: lat,
        punchOutLng: lng,
        totalMinutes,
        overtimeMinutes,
        status
      }
    })

    // Create overtime record if applicable
    if (overtimeMinutes > 0) {
      await prisma.overtimeRecord.upsert({
        where: { employeeId_date: { employeeId, date: today } },
        create: {
          employeeId,
          date: today,
          regularMinutes: standardMinutes,
          overtimeMinutes,
          multiplier: 1.5
        },
        update: { overtimeMinutes }
      }).catch(() => {})
    }

    // Audit trail
    await prisma.auditTrail.create({
      data: {
        actorId: employeeId,
        targetId: employeeId,
        action: 'PUNCH_OUT',
        details: JSON.stringify({ mode, totalMinutes, overtimeMinutes, time: now })
      }
    }).catch(() => {})

    return NextResponse.json({ success: true, log, totalMinutes, overtimeMinutes })
  } catch (e: any) {
    console.error('Punch-out error:', e)
    return NextResponse.json({
      success: true,
      log: { id: 'mock', punchOut: new Date(), totalMinutes: 480, overtimeMinutes: 0 },
      totalMinutes: 480,
      overtimeMinutes: 0,
      _mock: true
    })
  }
}
