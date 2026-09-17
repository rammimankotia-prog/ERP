import { NextResponse } from 'next/server'
import { getAllEmployees } from '@/lib/employeeData'
import { getMergedAttendance } from '@/lib/attendanceStorage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const employees = await getAllEmployees()
    const allAttendance = getMergedAttendance()
    const dateStr = new Date().toISOString().split('T')[0]

    const activeList = employees
      .filter(e => e.status === 'ACTIVE' || !e.status)
      .map(emp => {
        const empIdNorm = (emp.employeeId || emp.id || '').trim().toUpperCase()
        const todayRecord = allAttendance.find(
          a => {
            const aIdNorm = (a.employeeId || '').trim().toUpperCase()
            return (aIdNorm === empIdNorm || (emp.id && aIdNorm === emp.id.trim().toUpperCase())) && a.date === dateStr
          }
        )
        return {
          id: emp.id,
          employeeId: emp.employeeId || emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          contactNo: emp.contactNo,
          designation: emp.designation || 'Staff',
          department: emp.department?.name || emp.departmentId || 'General',
          branch: emp.branch?.name || emp.branchId || 'Hotel Grand Godwin',
          morningTime: emp.morningTime || '09:00',
          eveningTime: emp.eveningTime || '18:00',
          photo: emp.photo || null,
          gender: emp.gender || 'Male',
          checkedIn: !!(todayRecord && todayRecord.punchIn),
          checkedOut: !!(todayRecord && todayRecord.punchOut),
          punchInTime: todayRecord?.punchIn || null,
          punchOutTime: todayRecord?.punchOut || null,
        }
      })

    return NextResponse.json({ success: true, employees: activeList })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch kiosk employees' }, { status: 500 })
  }
}
