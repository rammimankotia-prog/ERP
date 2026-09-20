import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const SHIFTS_FILE = path.join(DATA_DIR, 'hr_shifts.json')
const LOCAL_SHIFTS_FILE = path.join(process.cwd(), 'data', 'hr_shifts.json')

const DEFAULT_SHIFTS = [
  { 
    id: 'shift-1', 
    name: 'Morning Shift', 
    type: 'FIXED', 
    startTime: '09:00', 
    endTime: '18:00', 
    graceMinutes: 15, 
    branchId: 'mock-1' 
  },
  { 
    id: 'shift-2', 
    name: 'Break Shift', 
    type: 'BREAK', 
    startTime: '10:00', 
    endTime: '22:00', 
    firstSlot: '10:00 – 14:00',
    secondSlot: '18:00 – 22:00',
    breakTime: '14:00 – 18:00',
    graceMinutes: 15, 
    branchId: 'mock-1' 
  },
  { 
    id: 'shift-3', 
    name: 'Night Shift', 
    type: 'NIGHT', 
    startTime: '20:00', 
    endTime: '08:00', 
    graceMinutes: 20, 
    branchId: 'mock-1' 
  },
]

function readShifts(): any[] {
  try {
    const targetFile = fs.existsSync(SHIFTS_FILE)
      ? SHIFTS_FILE
      : fs.existsSync(LOCAL_SHIFTS_FILE)
      ? LOCAL_SHIFTS_FILE
      : null

    if (targetFile) {
      const raw = fs.readFileSync(targetFile, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Auto-migrate legacy 22:00 night shift to 20:00 - 08:00
        let modified = false
        const migrated = parsed.map(s => {
          if (s.name?.toLowerCase().includes('night') && s.startTime === '22:00') {
            modified = true
            return { ...s, startTime: '20:00', endTime: '08:00' }
          }
          return s
        })
        if (modified) {
          writeShifts(migrated)
        }
        return migrated
      }
    }
  } catch (e) {
    console.error('Error reading hr_shifts.json:', e)
  }

  writeShifts(DEFAULT_SHIFTS)
  return DEFAULT_SHIFTS
}

function writeShifts(shifts: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(SHIFTS_FILE, JSON.stringify(shifts, null, 2), 'utf-8')
    if (LOCAL_SHIFTS_FILE !== SHIFTS_FILE) {
      const localDir = path.dirname(LOCAL_SHIFTS_FILE)
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true })
      fs.writeFileSync(LOCAL_SHIFTS_FILE, JSON.stringify(shifts, null, 2), 'utf-8')
    }
  } catch (e) {
    console.error('Error writing hr_shifts.json:', e)
  }
}

// ─── GET: Fetch all defined shifts ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const shifts = readShifts()
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

    const shifts = readShifts()
    const newShift = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    shifts.push(newShift)
    writeShifts(shifts)

    return NextResponse.json({ shift: newShift, shifts }, { status: 201 })
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

    const shifts = readShifts()
    const idx = shifts.findIndex(s => s.id === id)

    if (idx === -1) {
      return NextResponse.json({ error: `Shift with id "${id}" not found` }, { status: 404 })
    }

    shifts[idx] = {
      ...shifts[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    writeShifts(shifts)
    return NextResponse.json({ success: true, shift: shifts[idx], shifts })
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

    let shifts = readShifts()
    shifts = shifts.filter(s => s.id !== id)
    writeShifts(shifts)

    return NextResponse.json({ success: true, shifts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete shift' }, { status: 500 })
  }
}
