import { NextResponse } from 'next/server'
import { getAllEmployees } from '@/lib/employeeData'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getEmployeeRosterShift } from '@/lib/shiftStorage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const employees = await getAllEmployees()
    const allAttendance = getMergedAttendance()
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
    const dateStr = todayIST

    const activeList = employees
      .filter(e => e.status === 'ACTIVE' || !e.status)
      .map(emp => {
        const empIdNorm = (emp.employeeId || emp.id || '').trim().toUpperCase()
        const todayRecord = allAttendance.find(a => {
          const aIdNorm = (a.employeeId || '').trim().toUpperCase()
          const matchId = aIdNorm === empIdNorm || (emp.id && aIdNorm === emp.id.trim().toUpperCase())
          if (!matchId) return false
          if (a.date === dateStr) return true
          if (a.punchIn) {
            if (a.punchIn.slice(0, 10) === dateStr) return true
            try {
              if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(a.punchIn)) === dateStr) return true
            } catch {}
          }
          return false
        })

        let branchName = 'Hotel Grand Godwin'
        if (typeof emp.branch === 'object' && emp.branch?.name) {
          branchName = emp.branch.name
        } else if (typeof emp.branch === 'string' && emp.branch.trim()) {
          branchName = emp.branch.trim()
        } else if (emp.branchId === 'branch-gd' || empIdNorm.startsWith('GD-')) {
          branchName = 'Hotel Godwin Deluxe'
        } else if (emp.branchId === 'branch-ig' || empIdNorm.startsWith('IG-')) {
          branchName = 'Indian Grill'
        } else if (emp.branchId === 'branch-cb' || empIdNorm.startsWith('CB-')) {
          branchName = 'Cafe Brownie'
        }

        // Dynamically resolve today's shift from roster (including Night Shift swap: 8 PM to 8 AM)
        const rosterShift = getEmployeeRosterShift(emp, todayIST)

        return {
          id: emp.id,
          employeeId: emp.employeeId || emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          contactNo: emp.contactNo,
          designation: emp.designation || 'Staff',
          department: typeof emp.department === 'object' ? (emp.department?.name || 'General') : (emp.department || emp.departmentId || 'General'),
          branch: branchName,
          branchId: emp.branchId || (typeof emp.branch === 'object' ? emp.branch?.id : null),
          morningTime: rosterShift.startTime,
          eveningTime: rosterShift.endTime,
          shiftName: rosterShift.shiftName,
          shiftDisplay: rosterShift.formatted12H,
          isNightShift: rosterShift.isNightShift,
          isOff: rosterShift.isOff,
          isShiftSwapped: rosterShift.isShiftSwapped,
          shiftChangeNotice: rosterShift.shiftChangeNotice,
          shiftInstruction: rosterShift.shiftInstruction,
          dayShiftStart: emp.dayShiftStart || '09:00',
          dayShiftEnd: emp.dayShiftEnd || '18:00',
          nightShiftStart: emp.nightShiftStart || '20:00',
          nightShiftEnd: emp.nightShiftEnd || '08:00',
          photo: emp.photo || null,
          gender: emp.gender || 'Male',
          checkedIn: !!(todayRecord && todayRecord.punchIn),
          checkedOut: !!(todayRecord && todayRecord.punchOut),
          punchInTime: todayRecord?.punchIn || null,
          punchOutTime: todayRecord?.punchOut || null,
          punchInMode: todayRecord?.punchInMode || null,
          punchOutMode: todayRecord?.punchOutMode || null,
        }
      })

    // Sort by Duty Roster & Shift Timing:
    // 1. Working staff before Weekly Off
    // 2. Chronological shift in-time (08:00, 09:00, 09:30, 10:00, 13:00, 19:00, 20:00)
    // 3. Checked In / Active on Shift first
    // 4. Hotel branch priority (Grand Godwin, Godwin Deluxe, Indian Grill, Cafe Brownie)
    // 5. Employee ID
    const parseTimeMins = (t?: string) => {
      if (!t) return 9999
      const tr = String(t).trim()
      if (tr.toUpperCase() === 'OFF') return 9999
      const parts = tr.split(':')
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        if (!isNaN(h) && !isNaN(m)) return h * 60 + m
      }
      return 9999
    }

    const hotelPriority = (bName: string) => {
      const lower = (bName || '').toLowerCase()
      if (lower.includes('grand godwin')) return 1
      if (lower.includes('godwin deluxe')) return 2
      if (lower.includes('indian grill')) return 3
      if (lower.includes('cafe brownie') || lower.includes('brownie')) return 4
      return 10
    }

    activeList.sort((a, b) => {
      // 1. Working staff before Weekly Off
      const offA = a.isOff || a.morningTime === 'OFF' ? 1 : 0
      const offB = b.isOff || b.morningTime === 'OFF' ? 1 : 0
      if (offA !== offB) return offA - offB

      // 2. Chronological shift in-time
      const tA = parseTimeMins(a.morningTime)
      const tB = parseTimeMins(b.morningTime)
      if (tA !== tB) return tA - tB

      // 3. Checked In / Active on Shift first
      const inA = a.checkedIn && !a.checkedOut ? 0 : 1
      const inB = b.checkedIn && !b.checkedOut ? 0 : 1
      if (inA !== inB) return inA - inB

      // 4. Hotel branch priority
      const pA = hotelPriority(a.branch)
      const pB = hotelPriority(b.branch)
      if (pA !== pB) return pA - pB

      const bCompare = a.branch.localeCompare(b.branch)
      if (bCompare !== 0) return bCompare
      return (a.employeeId || '').localeCompare(b.employeeId || '')
    })

    return NextResponse.json({ success: true, employees: activeList })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch kiosk employees' }, { status: 500 })
  }
}
