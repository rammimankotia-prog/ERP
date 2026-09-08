/**
 * Attendance System Unit & Integration Tests
 * Run: npx jest src/__tests__/attendance.test.ts
 */

// ── Pure utility functions extracted for testing ──────────────────────────────

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const HOTEL_LOCATIONS: Record<string, { lat: number; lng: number; radiusMeters: number }> = {
  'GG': { lat: 28.6448, lng: 77.2167, radiusMeters: 500 },
  'GD': { lat: 28.6528, lng: 77.2195, radiusMeters: 500 },
}

function isWithinGeoFence(branchPrefix: string, lat: number, lng: number): boolean {
  const location = HOTEL_LOCATIONS[branchPrefix]
  if (!location) return true
  return getDistanceMeters(lat, lng, location.lat, location.lng) <= location.radiusMeters
}

function getAttendanceStatus(punchInTime: Date, shiftStartTime: string, graceMinutes: number): string {
  const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number)
  const shiftStart = new Date(punchInTime)
  shiftStart.setHours(shiftHour, shiftMin, 0, 0)
  const diffMinutes = (punchInTime.getTime() - shiftStart.getTime()) / 60000
  return diffMinutes > graceMinutes ? 'LATE' : 'PRESENT'
}

function hasLeaveOverlap(
  existingFrom: Date, existingTo: Date,
  newFrom: Date, newTo: Date
): boolean {
  return existingFrom <= newTo && existingTo >= newFrom
}

function computeOvertimeMinutes(totalMinutes: number, standardMinutes = 480): number {
  return Math.max(0, totalMinutes - standardMinutes)
}

function computeDeductions(absentDays: number, lateDays: number, lateDeductionThreshold = 3): number {
  const lateDeductions = Math.floor(lateDays / lateDeductionThreshold)
  return absentDays + lateDeductions
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Geo-Fence Validation', () => {
  test('✅ PASS: Employee at hotel location should be within geo-fence', () => {
    // Grand Godwin exact coordinates
    expect(isWithinGeoFence('GG', 28.6448, 77.2167)).toBe(true)
  })

  test('✅ PASS: Employee 200m from hotel should be within 500m radius', () => {
    // ~200m north of Grand Godwin
    expect(isWithinGeoFence('GG', 28.6466, 77.2167)).toBe(true)
  })

  test('❌ FAIL: Employee >500m from hotel should be REJECTED', () => {
    // ~1km away — should fail
    expect(isWithinGeoFence('GG', 28.6540, 77.2167)).toBe(false)
  })

  test('❌ FAIL: Employee at completely different location should be REJECTED', () => {
    // Mumbai coordinates
    expect(isWithinGeoFence('GG', 19.0760, 72.8777)).toBe(false)
  })

  test('✅ PASS: Unknown branch prefix should allow punch-in (permissive fallback)', () => {
    expect(isWithinGeoFence('UNKNOWN', 0, 0)).toBe(true)
  })
})

describe('Late Arrival Detection', () => {
  test('✅ PASS: On-time punch-in (exactly at shift start) should be PRESENT', () => {
    const shiftStart = '09:00'
    const punchIn = new Date()
    punchIn.setHours(9, 0, 0, 0)
    expect(getAttendanceStatus(punchIn, shiftStart, 15)).toBe('PRESENT')
  })

  test('✅ PASS: Punch-in within grace period (5 mins late) should be PRESENT', () => {
    const shiftStart = '09:00'
    const punchIn = new Date()
    punchIn.setHours(9, 5, 0, 0) // 5 mins late, grace = 15
    expect(getAttendanceStatus(punchIn, shiftStart, 15)).toBe('PRESENT')
  })

  test('✅ PASS: Punch-in exactly at grace boundary (15 mins) should be PRESENT', () => {
    const shiftStart = '09:00'
    const punchIn = new Date()
    punchIn.setHours(9, 15, 0, 0)
    expect(getAttendanceStatus(punchIn, shiftStart, 15)).toBe('PRESENT')
  })

  test('❌ FAIL: Punch-in past grace period (16 mins late) should be LATE', () => {
    const shiftStart = '09:00'
    const punchIn = new Date()
    punchIn.setHours(9, 16, 0, 0)
    expect(getAttendanceStatus(punchIn, shiftStart, 15)).toBe('LATE')
  })

  test('❌ FAIL: Very late punch-in (2 hours late) should be LATE', () => {
    const shiftStart = '09:00'
    const punchIn = new Date()
    punchIn.setHours(11, 0, 0, 0)
    expect(getAttendanceStatus(punchIn, shiftStart, 15)).toBe('LATE')
  })

  test('✅ PASS: Night shift employee at 22:05 with 10 min grace should be PRESENT', () => {
    const shiftStart = '22:00'
    const punchIn = new Date()
    punchIn.setHours(22, 5, 0, 0)
    expect(getAttendanceStatus(punchIn, shiftStart, 10)).toBe('PRESENT')
  })
})

describe('Leave Overlap Detection', () => {
  test('✅ PASS: Non-overlapping dates should be allowed', () => {
    const existingFrom = new Date('2026-09-01')
    const existingTo = new Date('2026-09-03')
    const newFrom = new Date('2026-09-05')
    const newTo = new Date('2026-09-07')
    expect(hasLeaveOverlap(existingFrom, existingTo, newFrom, newTo)).toBe(false)
  })

  test('❌ FAIL: Same exact date range should be rejected (OVERLAP)', () => {
    const existingFrom = new Date('2026-09-10')
    const existingTo = new Date('2026-09-12')
    const newFrom = new Date('2026-09-10')
    const newTo = new Date('2026-09-12')
    expect(hasLeaveOverlap(existingFrom, existingTo, newFrom, newTo)).toBe(true)
  })

  test('❌ FAIL: Partially overlapping dates should be rejected', () => {
    const existingFrom = new Date('2026-09-10')
    const existingTo = new Date('2026-09-15')
    const newFrom = new Date('2026-09-13')
    const newTo = new Date('2026-09-18')
    expect(hasLeaveOverlap(existingFrom, existingTo, newFrom, newTo)).toBe(true)
  })

  test('❌ FAIL: New request entirely inside existing leave should be rejected', () => {
    const existingFrom = new Date('2026-09-01')
    const existingTo = new Date('2026-09-30')
    const newFrom = new Date('2026-09-10')
    const newTo = new Date('2026-09-15')
    expect(hasLeaveOverlap(existingFrom, existingTo, newFrom, newTo)).toBe(true)
  })

  test('✅ PASS: Adjacent date (day after) should NOT overlap', () => {
    const existingFrom = new Date('2026-09-01')
    const existingTo = new Date('2026-09-05')
    const newFrom = new Date('2026-09-06')
    const newTo = new Date('2026-09-08')
    expect(hasLeaveOverlap(existingFrom, existingTo, newFrom, newTo)).toBe(false)
  })
})

describe('Overtime & Payroll Calculation', () => {
  test('✅ PASS: 8-hour shift should have 0 overtime', () => {
    expect(computeOvertimeMinutes(480)).toBe(0)
  })

  test('✅ PASS: 10-hour shift should have 2 hours overtime', () => {
    expect(computeOvertimeMinutes(600)).toBe(120)
  })

  test('✅ PASS: 6-hour shift (half day) should have 0 overtime', () => {
    expect(computeOvertimeMinutes(360)).toBe(0)
  })

  test('✅ PASS: 12-hour shift should have 4 hours overtime', () => {
    expect(computeOvertimeMinutes(720)).toBe(240)
  })

  test('✅ PASS: Deductions — 0 absences, 2 late should have 0 deductions (under threshold)', () => {
    expect(computeDeductions(0, 2, 3)).toBe(0)
  })

  test('✅ PASS: Deductions — 1 absent, 0 late should have 1 deduction day', () => {
    expect(computeDeductions(1, 0, 3)).toBe(1)
  })

  test('✅ PASS: Deductions — 0 absent, 6 late should have 2 deduction days (6/3 = 2)', () => {
    expect(computeDeductions(0, 6, 3)).toBe(2)
  })

  test('✅ PASS: Deductions — 2 absent, 3 late should have 3 deduction days', () => {
    expect(computeDeductions(2, 3, 3)).toBe(3) // 2 + floor(3/3)=1 = 3
  })

  test('✅ PASS: Monthly payroll summary totals should aggregate correctly', () => {
    const employees = [
      { presentDays: 22, absentDays: 1, lateDays: 2, totalMinutes: 10560, overtimeMinutes: 480 },
      { presentDays: 20, absentDays: 2, lateDays: 3, totalMinutes: 9600, overtimeMinutes: 0 },
    ]
    const totals = employees.reduce((acc, e) => ({
      present: acc.present + e.presentDays,
      absent: acc.absent + e.absentDays,
      totalMins: acc.totalMins + e.totalMinutes,
      otMins: acc.otMins + e.overtimeMinutes
    }), { present: 0, absent: 0, totalMins: 0, otMins: 0 })

    expect(totals.present).toBe(42)
    expect(totals.absent).toBe(3)
    expect(totals.totalMins).toBe(20160)
    expect(totals.otMins).toBe(480)
  })
})

describe('RBAC Access Control', () => {
  // Simulate the role-checking logic used in API routes
  function checkAccess(role: string, allowedRoles: string[]): number {
    return allowedRoles.includes(role) ? 200 : 403
  }

  test('✅ PASS: ADMIN can create shifts', () => {
    expect(checkAccess('ADMIN', ['ADMIN', 'HR_MANAGER'])).toBe(200)
  })

  test('✅ PASS: HR_MANAGER can approve leaves', () => {
    expect(checkAccess('HR_MANAGER', ['ADMIN', 'HR_MANAGER', 'HOD'])).toBe(200)
  })

  test('❌ FAIL: EMPLOYEE cannot create shifts — returns 403', () => {
    expect(checkAccess('EMPLOYEE', ['ADMIN', 'HR_MANAGER'])).toBe(403)
  })

  test('❌ FAIL: EMPLOYEE cannot approve/reject leaves — returns 403', () => {
    expect(checkAccess('EMPLOYEE', ['ADMIN', 'HR_MANAGER', 'HOD'])).toBe(403)
  })

  test('❌ FAIL: STAFF cannot perform manual attendance overrides — returns 403', () => {
    expect(checkAccess('STAFF', ['ADMIN', 'HR_MANAGER'])).toBe(403)
  })

  test('✅ PASS: HOD can approve leave for subordinates', () => {
    expect(checkAccess('HOD', ['ADMIN', 'HR_MANAGER', 'HOD'])).toBe(200)
  })
})
