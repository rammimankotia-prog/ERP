import { NextRequest, NextResponse } from 'next/server'
import { getMergedShifts, updateShift, createShift, deleteShift, ShiftRecord, DEFAULT_SHIFTS } from '@/lib/shiftStorage'

export const dynamic = 'force-dynamic'

// ─── GET: Fetch all defined shifts ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const shifts = getMergedShifts()
    return NextResponse.json({ shifts })
  } catch (e: any) {
    return NextResponse.json({ shifts: DEFAULT_SHIFTS, error: e.message })
  }
}

// ─── POST: Create a new shift ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, startTime, endTime, firstSlot, secondSlot, breakTime, graceMinutes, branchId } = body

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'name, startTime, endTime are required' }, { status: 400 })
    }

    const newShift: ShiftRecord = {
      id: 'shift-' + Date.now(),
      name,
      type: type || 'FIXED',
      startTime,
      endTime,
      firstSlot: firstSlot || null,
      secondSlot: secondSlot || null,
      breakTime: breakTime || null,
      graceMinutes: typeof graceMinutes === 'number' ? graceMinutes : 15,
      branchId: branchId || 'mock-1',
    }

    createShift(newShift)
    const allShifts = getMergedShifts()

    return NextResponse.json({ shift: newShift, shifts: allShifts }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create shift' }, { status: 500 })
  }
}

// ─── PUT: Update an existing shift ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Shift id is required' }, { status: 400 })
    }

    const updated = updateShift(id, updates)

    if (!updated) {
      return NextResponse.json({ error: `Shift with id "${id}" not found` }, { status: 404 })
    }

    const allShifts = getMergedShifts()
    return NextResponse.json({ success: true, shift: updated, shifts: allShifts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update shift' }, { status: 500 })
  }
}

// ─── DELETE: Remove a shift ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Shift id is required' }, { status: 400 })
    }

    const remaining = deleteShift(id)
    return NextResponse.json({ success: true, shifts: remaining })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete shift' }, { status: 500 })
  }
}

