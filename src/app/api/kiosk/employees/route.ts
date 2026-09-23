import { NextResponse } from 'next/server'
import { getAllEmployees } from '@/lib/employeeData'
import { getMergedAttendance } from '@/lib/attendanceStorage'

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
          morningTime: emp.morningTime || '09:00',
          eveningTime: emp.eveningTime || '18:00',
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

    // Sort by Hotel Name:
    // 1. Hotel Grand Godwin
    // 2. Hotel Godwin Deluxe
    // 3. Indian Grill
    // 4. Cafe Brownie
    // Secondary sort: Employee ID / Name
    const hotelPriority = (bName: string) => {
      const lower = (bName || '').toLowerCase()
      if (lower.includes('grand godwin')) return 1
      if (lower.includes('godwin deluxe')) return 2
      if (lower.includes('indian grill')) return 3
      if (lower.includes('cafe brownie') || lower.includes('brownie')) return 4
      return 10
    }

    activeList.sort((a, b) => {
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
