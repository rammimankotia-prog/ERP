import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import {
  getAllDataDirs,
  safeReadJsonFile,
  writeToAllTiers,
} from '@/lib/persistentVault'

export const dynamic = 'force-dynamic'

// GET /api/hr/roster?year=2026&month=8
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()), 10)

    const allDirs = getAllDataDirs()
    let roster: Record<string, Record<string, string>> = {}

    for (const dir of allDirs) {
      const rosterFile = path.join(dir, `hr_roster_${year}_${month}.json`)
      const data = safeReadJsonFile<Record<string, Record<string, string>>>(rosterFile, {})
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

    const filename = `hr_roster_${year}_${month}.json`
    writeToAllTiers(filename, roster)

    return NextResponse.json({ success: true, message: `Roster saved for ${year}-${String(month + 1).padStart(2, '0')}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save roster' }, { status: 500 })
  }
}
