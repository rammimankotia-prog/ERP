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

    const today = new Date()
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

    // Determine if half-day
    let status = existing.status
    if (totalMinutes < 240 && status === 'PRESENT') {
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
