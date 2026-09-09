import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

function writeJson(file: string, data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error writing json to', file, err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { employeeId, action } = await req.json()

    if (!employeeId || !action) {
      return NextResponse.json({ error: 'employeeId and action required' }, { status: 400 })
    }

    const allAttendance = readJson<any[]>(ATTENDANCE_FILE, [])
    const dateStr = new Date().toISOString().split('T')[0]

    let existingIndex = allAttendance.findIndex(a => 
      (a.employeeId === employeeId) && a.date === dateStr
    )

    const now = new Date().toISOString()

    if (action === 'IN') {
      if (existingIndex !== -1 && allAttendance[existingIndex].punchIn) {
        return NextResponse.json({ error: 'Already punched in today' }, { status: 400 })
      }
      
      const newRecord = {
        id: `att-${Date.now()}`,
        employeeId,
        date: dateStr,
        punchIn: now,
        punchOut: null,
        status: 'PRESENT',
        punchInMode: 'KIOSK',
        totalMinutes: null
      }
      allAttendance.push(newRecord)
      writeJson(ATTENDANCE_FILE, allAttendance)
      return NextResponse.json({ success: true, record: newRecord })

    } else if (action === 'OUT') {
      if (existingIndex === -1 || !allAttendance[existingIndex].punchIn) {
        return NextResponse.json({ error: 'No punch-in found for today' }, { status: 400 })
      }
      if (allAttendance[existingIndex].punchOut) {
        return NextResponse.json({ error: 'Already punched out today' }, { status: 400 })
      }

      const punchInTime = new Date(allAttendance[existingIndex].punchIn).getTime()
      const punchOutTime = new Date(now).getTime()
      const totalMinutes = Math.floor((punchOutTime - punchInTime) / 60000)

      allAttendance[existingIndex].punchOut = now
      allAttendance[existingIndex].punchOutMode = 'KIOSK'
      allAttendance[existingIndex].totalMinutes = totalMinutes

      writeJson(ATTENDANCE_FILE, allAttendance)
      return NextResponse.json({ success: true, record: allAttendance[existingIndex] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Punch failed' }, { status: 500 })
  }
}
