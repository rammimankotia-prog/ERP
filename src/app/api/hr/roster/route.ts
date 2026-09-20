import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

function getRosterFilePath(year: number, month: number, local = false): string {
  const dir = local ? LOCAL_DATA_DIR : DATA_DIR
  return path.join(dir, `hr_roster_${year}_${month}.json`)
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed !== undefined && parsed !== null) return parsed as unknown as T
    }
  } catch {}
  return fallback
}

function writeJson(file: string, data: any): void {
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error writing roster JSON:', err)
  }
}

// GET /api/hr/roster?year=2026&month=8
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()), 10)

    const primaryFile = getRosterFilePath(year, month, false)
    const localFile = getRosterFilePath(year, month, true)

    // Try persistent dir first, then local
    let roster: Record<string, Record<string, string>> = {}
    for (const f of [primaryFile, localFile]) {
      const data = readJson<Record<string, Record<string, string>>>(f, {})
      if (data && Object.keys(data).length > 0) {
        roster = data
        break
      }
    }

    return NextResponse.json({ roster, year, month })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to read roster', roster: {} }, { status: 500 })
  }
}

// POST /api/hr/roster
// Body: { year: number, month: number, roster: Record<string, Record<string, string>> }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { year, month, roster } = body

    if (typeof year !== 'number' || typeof month !== 'number' || !roster) {
      return NextResponse.json({ error: 'year, month, and roster are required' }, { status: 400 })
    }

    const primaryFile = getRosterFilePath(year, month, false)
    const localFile = getRosterFilePath(year, month, true)

    writeJson(primaryFile, roster)
    if (primaryFile !== localFile) {
      writeJson(localFile, roster)
    }

    return NextResponse.json({ success: true, message: `Roster saved for ${year}-${String(month + 1).padStart(2, '0')}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save roster' }, { status: 500 })
  }
}
