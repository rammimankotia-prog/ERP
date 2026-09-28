'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmploymentType, EmployeeStatus } from '@prisma/client'

interface Branch {
  id: string
  name: string
  prefix: string
}

interface Department {
  id: string
  name: string
  branchId?: string
}

export default function EditEmployeeForm({
  branches,
  departments,
  employee,
}: {
  branches: Branch[]
  departments: Department[]
  employee: any
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(employee.branchId || branches[0]?.id || '')
  const [currentStatus, setCurrentStatus] = useState<EmployeeStatus>(employee.status || 'ACTIVE')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const initialShift = employee.morningTime === '20:00' || employee.eveningTime === '08:00' || employee.morningTime === '22:00' || employee.eveningTime === '07:00'
    ? 'NIGHT'
    : employee.morningTime === '13:00' || employee.eveningTime === '23:00'
    ? 'AFTERNOON'
    : employee.morningTime === '10:00' && employee.eveningTime === '22:00'
    ? 'BREAK'
    : 'MORNING'

  const [selectedShift, setSelectedShift] = useState<'MORNING' | 'AFTERNOON' | 'BREAK' | 'NIGHT'>(initialShift)
  const [swapShiftEligible, setSwapShiftEligible] = useState<boolean>(employee.swapShiftEligible === true)
  const [dayShiftStart, setDayShiftStart] = useState(employee.dayShiftStart || employee.morningTime || '09:00')
  const [dayShiftEnd, setDayShiftEnd] = useState(employee.dayShiftEnd || employee.eveningTime || '18:00')
  const [nightShiftStart, setNightShiftStart] = useState(employee.nightShiftStart || '20:00')
  const [nightShiftEnd, setNightShiftEnd] = useState(employee.nightShiftEnd || '08:00')
  const [morningTime, setMorningTime] = useState(employee.morningTime || '09:00')
  const [eveningTime, setEveningTime] = useState(employee.eveningTime || '18:00')
  const [breakStart, setBreakStart] = useState('14:00')
  const [breakEnd, setBreakEnd] = useState('18:00')
  const [offDays, setOffDays] = useState<string[]>(() => {
    if (Array.isArray((employee as any).offDays) && (employee as any).offDays.length > 0) {
      return (employee as any).offDays
    }
    return ['Sunday']
  })

  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const toggleOffDay = (day: string) => {
    setOffDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  // Filter departments by selected branch if branchId is linked, and deduplicate by name
  const availableDepartments = departments
    .filter((d) => {
      if (!d.branchId || !selectedBranchId) return true
      return d.branchId === selectedBranchId
    })
    .filter((d, idx, arr) => {
      return arr.findIndex((item) => item.name.trim().toLowerCase() === d.name.trim().toLowerCase()) === idx
    })

  const formatDate = (date: any) => {
    if (!date) return ''
    try {
      return new Date(date).toISOString().split('T')[0]
    } catch {
      return String(date).split('T')[0]
    }
  }

  // Check localStorage for any cached edits for this employee on mount
  useEffect(() => {
    try {
      const cachedStr = localStorage.getItem('godwin_erp_employees_v2')
      if (cachedStr) {
        const cache = JSON.parse(cachedStr)
        const match = Array.isArray(cache)
          ? cache.find((e: any) => e.id === employee.id || e.employeeId === employee.employeeId)
          : cache[employee.id] || cache[employee.employeeId]

        if (match) {
          if (match.morningTime) setMorningTime(match.morningTime)
          if (match.eveningTime) setEveningTime(match.eveningTime)
          if (match.status) setCurrentStatus(match.status)
          if (Array.isArray(match.offDays) && match.offDays.length > 0) setOffDays(match.offDays)
        }
      }
    } catch {}
  }, [employee.id, employee.employeeId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)

    try {
      const branchId = formData.get('branchId') as string
      const departmentId = formData.get('departmentId') as string
      const firstName = (formData.get('firstName') as string)?.trim()
      const lastName = (formData.get('lastName') as string)?.trim()
      const contactNo = (formData.get('contactNo') as string)?.trim()
      const designation = (formData.get('designation') as string)?.trim()
      const dojStr = formData.get('doj') as string
      const dobStr = formData.get('dob') as string
      const status = (formData.get('status') as EmployeeStatus) || currentStatus

      if (!firstName || !lastName || !contactNo || !branchId || !departmentId || !designation) {
        throw new Error('Please fill in all required fields.')
      }

      const isNight = selectedShift === 'NIGHT' || (morningTime || '').startsWith('2') || (eveningTime || '') === '08:00' || (nightShiftStart && morningTime === nightShiftStart)
      const updatePayload = {
        id: employee.id,
        employeeId: employee.employeeId,
        firstName,
        lastName,
        contactNo,
        branchId,
        departmentId,
        designation,
        selectedShift,
        shiftName: selectedShift === 'NIGHT' || isNight ? 'Night Shift' : selectedShift === 'AFTERNOON' ? 'Afternoon Shift' : selectedShift === 'BREAK' ? 'Break Shift' : 'Morning Shift',
        shiftType: selectedShift,
        isNightShift: isNight,
        morningTime: (selectedShift === 'NIGHT' && (!morningTime || morningTime === '09:00')) ? (nightShiftStart || '20:00') : (morningTime || (formData.get('morningTime') as string) || '09:00'),
        eveningTime: (selectedShift === 'NIGHT' && (!eveningTime || eveningTime === '18:00')) ? (nightShiftEnd || '08:00') : (eveningTime || (formData.get('eveningTime') as string) || '18:00'),
        swapShiftEligible,
        dayShiftStart: swapShiftEligible ? dayShiftStart : (selectedShift === 'NIGHT' ? '09:00' : (morningTime || '09:00')),
        dayShiftEnd: swapShiftEligible ? dayShiftEnd : (selectedShift === 'NIGHT' ? '18:00' : (eveningTime || '18:00')),
        nightShiftStart: selectedShift === 'NIGHT' ? (morningTime || nightShiftStart || '20:00') : (nightShiftStart || '20:00'),
        nightShiftEnd: selectedShift === 'NIGHT' ? (eveningTime || nightShiftEnd || '08:00') : (nightShiftEnd || '08:00'),
        offDays: offDays.length > 0 ? offDays : ['Sunday'],
        doj: dojStr ? new Date(dojStr).toISOString() : new Date().toISOString(),
        dob: dobStr ? new Date(dobStr).toISOString() : undefined,
        employmentType: (formData.get('employmentType') as EmploymentType) || 'PERMANENT',
        status,
        gender: (formData.get('gender') as string) || 'Male',
        emergencyContact: (formData.get('emergencyContact') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
      }

      // 1. Immediately persist to localStorage so it NEVER reverts on refresh
      try {
        const cachedStr = localStorage.getItem('godwin_erp_employees_v2')
        let cache: any[] = []
        if (cachedStr) {
          try { cache = JSON.parse(cachedStr) } catch {}
        }
        if (!Array.isArray(cache)) cache = []
        const idx = cache.findIndex((c: any) => c.id === employee.id || c.employeeId === employee.employeeId)
        if (idx !== -1) {
          cache[idx] = { ...cache[idx], ...updatePayload, updatedAt: new Date().toISOString() }
        } else {
          cache.push({ ...employee, ...updatePayload, updatedAt: new Date().toISOString() })
        }
        localStorage.setItem('godwin_erp_employees_v2', JSON.stringify(cache))
        window.dispatchEvent(new Event('godwin-employees-updated'))
      } catch {}

      // 2. Direct HTTP API call to update employee in persistent storage
      const res = await fetch('/api/hr/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update employee details')
      }

      // 3. If status is deactivated, force instant logout across platforms
      if (status !== 'ACTIVE') {
        try {
          await fetch('/api/auth/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: employee.id,
              username: employee.employeeId,
              email: employee.contactNo || (employee as any).email,
              reason: 'Employee set to inactive in Edit form',
            }),
          })
          const channel = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
          channel.postMessage({
            type: 'FORCE_LOGOUT_USER',
            payload: { employeeId: employee.id, username: employee.employeeId, email: employee.contactNo || (employee as any).email },
          })
          channel.close()
          localStorage.setItem(
            'GODWIN_DEACTIVATED_USER',
            JSON.stringify({
              employeeId: employee.id,
              username: employee.employeeId,
              email: employee.contactNo || (employee as any).email,
              timestamp: Date.now(),
            })
          )
        } catch {}
      } else {
        try {
          localStorage.removeItem('GODWIN_DEACTIVATED_USER')
        } catch {}
      }

      setCurrentStatus(status)
      setSuccess('Employee details updated successfully and locked!')
      setTimeout(() => {
        router.push('/hr/employees')
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to update employee details')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickStatusToggle = async () => {
    setLoading(true)
    const newStatus = currentStatus === 'ACTIVE' ? 'RESIGNED' : 'ACTIVE'
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: employee.id,
          employeeId: employee.employeeId || employee.id,
          status: newStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle status')
      }

      if (newStatus === 'RESIGNED') {
        try {
          await fetch('/api/auth/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: employee.id,
              username: employee.employeeId,
              email: employee.contactNo || (employee as any).email,
              reason: 'Employee deactivated via quick status toggle',
            }),
          })
          const channel = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
          channel.postMessage({
            type: 'FORCE_LOGOUT_USER',
            payload: { employeeId: employee.id, username: employee.employeeId, email: employee.contactNo || (employee as any).email },
          })
          channel.close()
          localStorage.setItem(
            'GODWIN_DEACTIVATED_USER',
            JSON.stringify({
              employeeId: employee.id,
              username: employee.employeeId,
              email: employee.contactNo || (employee as any).email,
              timestamp: Date.now(),
            })
          )
        } catch {}
      } else {
        try {
          localStorage.removeItem('GODWIN_DEACTIVATED_USER')
        } catch {}
      }
      setCurrentStatus(newStatus)
      setSuccess(`Status changed to ${newStatus === 'ACTIVE' ? 'Active' : 'Deactivated'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // Trigger deactivation & force logout
      try {
        await fetch('/api/auth/deactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.id,
            username: employee.employeeId,
            email: (employee as any).email || '',
            reason: 'Employee deleted',
          }),
        })
        const channel = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
        channel.postMessage({
          type: 'FORCE_LOGOUT_USER',
          payload: { employeeId: employee.id, username: employee.employeeId, email: (employee as any).email || '' },
        })
        channel.close()
      } catch {}

      const res = await fetch(`/api/hr/employees?id=${encodeURIComponent(employee.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/hr/employees')
        router.refresh()
      } else {
        throw new Error(data.error || 'Could not delete record')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee')
      setShowDeleteModal(false)
      setIsDeleting(false)
    }
  }

  const getInitials = (first?: string, last?: string) => {
    return `${(first?.[0] || 'E').toUpperCase()}${(last?.[0] || '').toUpperCase()}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Employee Quick Summary Header Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: 'clamp(1rem, 2.5vw, 1.5rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: currentStatus === 'ACTIVE'
                ? 'linear-gradient(135deg, #1e3a8a, #2563eb)'
                : 'linear-gradient(135deg, #475569, #64748b)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {getInitials(employee.firstName, employee.lastName)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {employee.firstName} {employee.lastName}
              </h2>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--primary)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                {employee.employeeId}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
              {employee.designation} • {employee.department?.name || 'General Department'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleQuickStatusToggle}
            disabled={loading}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: currentStatus === 'ACTIVE' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
              backgroundColor: currentStatus === 'ACTIVE' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              color: currentStatus === 'ACTIVE' ? '#b45309' : 'var(--success)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {currentStatus === 'ACTIVE' ? (
              <>
                <span>⏸</span> Mark as Deactivated
              </>
            ) : (
              <>
                <span>▶</span> Mark as Active
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.92rem',
            fontWeight: 500,
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.92rem',
            fontWeight: 500,
          }}
        >
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SECTION 1: PERSONAL INFORMATION */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: 'clamp(1rem, 3vw, 1.75rem)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1.5rem',
              paddingBottom: '0.85rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              👤
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Personal Information
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Staff member full identity and contact details.
              </p>
            </div>
          </div>

          <div className="responsive-form-grid">
            {/* First Name */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                First Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                name="firstName"
                type="text"
                defaultValue={employee.firstName}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Last Name */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Last Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                name="lastName"
                type="text"
                defaultValue={employee.lastName}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Contact Number */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Primary Contact Number <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                name="contactNo"
                type="tel"
                defaultValue={employee.contactNo}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Gender */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Gender
              </label>
              <select
                name="gender"
                defaultValue={employee.gender || 'Male'}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Date of Birth
              </label>
              <input
                name="dob"
                type="date"
                defaultValue={formatDate(employee.dob)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Emergency Contact */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Emergency Contact (Name & Phone)
              </label>
              <input
                name="emergencyContact"
                type="text"
                defaultValue={employee.emergencyContact || ''}
                placeholder="e.g. S. Mankotia (9811122233)"
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Address */}
            <div className="form-group col-span-full">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Residential Address
              </label>
              <input
                name="address"
                type="text"
                defaultValue={employee.address || ''}
                placeholder="e.g. House No., Street, City, State, PIN"
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: HOTEL & EMPLOYMENT DETAILS */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: 'clamp(1rem, 3vw, 1.75rem)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '0.85rem',
              borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                🏨
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Employment & Role Details
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Branch assignment, department role, and current work status.
                </p>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--primary)',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(37, 99, 235, 0.2)',
              }}
            >
              Staff ID: <strong>{employee.employeeId}</strong>
            </span>
          </div>

          <div className="responsive-form-grid">
            {/* Branch */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Branch / Property <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select
                required
                name="branchId"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.prefix})
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Department <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select
                required
                name="departmentId"
                defaultValue={employee.departmentId}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Designation / Title <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                name="designation"
                type="text"
                defaultValue={employee.designation}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Date of Joining */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Date of Joining <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                name="doj"
                type="date"
                defaultValue={formatDate(employee.doj)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Employment Type */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Employment Type <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select
                required
                name="employmentType"
                defaultValue={employee.employmentType || 'PERMANENT'}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="PERMANENT">Permanent (Full Time)</option>
                <option value="CONTRACT">Contract Staff</option>
                <option value="TRAINEE">Apprentice / Trainee</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Employment Status <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select
                required
                name="status"
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as EmployeeStatus)}
                className="form-input"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ACTIVE">Active (Working)</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="RESIGNED">Resigned / Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: SHIFT & WORKING TIMINGS */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: 'clamp(1rem, 3vw, 1.75rem)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1.5rem',
              paddingBottom: '0.85rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              ⏰
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Default Shift & Schedule
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Configure report and departure timings for attendance automation.
              </p>
            </div>
          </div>

          {/* Shift Toggle Buttons */}
          <div className="shift-selector-grid" style={{ marginBottom: '1.25rem' }}>
            {/* Morning Shift Toggle */}
            <button
              type="button"
              className="shift-card-btn"
              onClick={() => {
                setSelectedShift('MORNING')
                setMorningTime('08:00')
                setEveningTime('20:00')
              }}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: selectedShift === 'MORNING' ? '2px solid #10b981' : '1px solid var(--border)',
                backgroundColor: selectedShift === 'MORNING' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
                textAlign: 'center',
              }}
            >
              <span className="shift-card-icon" style={{ fontSize: '1.4rem' }}>☀️</span>
              <div className="shift-card-body">
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'MORNING' ? '#10b981' : 'var(--text-main)' }}>
                  Morning Shift
                </span>
                <span style={{ fontSize: '0.75rem', color: selectedShift === 'MORNING' ? '#10b981' : 'var(--text-muted)' }}>
                  08:00 AM – 08:00 PM
                </span>
              </div>
            </button>

            {/* Afternoon Shift Toggle */}
            <button
              type="button"
              className="shift-card-btn"
              onClick={() => {
                setSelectedShift('AFTERNOON')
                setMorningTime('13:00')
                setEveningTime('23:00')
              }}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: selectedShift === 'AFTERNOON' ? '2px solid #f59e0b' : '1px solid var(--border)',
                backgroundColor: selectedShift === 'AFTERNOON' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-main)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
                textAlign: 'center',
              }}
            >
              <span className="shift-card-icon" style={{ fontSize: '1.4rem' }}>🌆</span>
              <div className="shift-card-body">
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'AFTERNOON' ? '#f59e0b' : 'var(--text-main)' }}>
                  Afternoon Shift
                </span>
                <span style={{ fontSize: '0.75rem', color: selectedShift === 'AFTERNOON' ? '#f59e0b' : 'var(--text-muted)' }}>
                  01:00 PM – 11:00 PM
                </span>
              </div>
            </button>

            {/* Break Shift Toggle */}
            <button
              type="button"
              className="shift-card-btn"
              onClick={() => {
                setSelectedShift('BREAK')
                setMorningTime('10:00')
                setEveningTime('22:00')
                setBreakStart('14:00')
                setBreakEnd('18:00')
              }}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: selectedShift === 'BREAK' ? '2px solid #0ea5e9' : '1px solid var(--border)',
                backgroundColor: selectedShift === 'BREAK' ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-main)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
                textAlign: 'center',
              }}
            >
              <span className="shift-card-icon" style={{ fontSize: '1.4rem' }}>☕</span>
              <div className="shift-card-body">
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'BREAK' ? '#38bdf8' : 'var(--text-main)' }}>
                  Break Shift
                </span>
                <span style={{ fontSize: '0.75rem', color: selectedShift === 'BREAK' ? '#38bdf8' : 'var(--text-muted)' }}>
                  10:00–14:00 & 18:00–22:00
                </span>
              </div>
            </button>

            {/* Night Shift Toggle */}
            <button
              type="button"
              className="shift-card-btn"
              onClick={() => {
                setSelectedShift('NIGHT')
                setMorningTime('20:00')
                setEveningTime('08:00')
              }}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: selectedShift === 'NIGHT' ? '2px solid #8b5cf6' : '1px solid var(--border)',
                backgroundColor: selectedShift === 'NIGHT' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-main)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
                textAlign: 'center',
              }}
            >
              <span className="shift-card-icon" style={{ fontSize: '1.4rem' }}>🌙</span>
              <div className="shift-card-body">
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'NIGHT' ? '#8b5cf6' : 'var(--text-main)' }}>
                  Night Shift
                </span>
                <span style={{ fontSize: '0.75rem', color: selectedShift === 'NIGHT' ? '#8b5cf6' : 'var(--text-muted)' }}>
                  08:00 PM – 08:00 AM
                </span>
              </div>
            </button>
          </div>

          {/* Selected Shift Timing Detail Card */}
          {selectedShift === 'BREAK' ? (
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(14, 165, 233, 0.05)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                  ☕ Break Shift Timing Setup
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  4 hrs Morning Duty + 4 hrs Afternoon Break + 4 hrs Evening Duty
                </span>
              </div>

              <div className="responsive-form-grid" style={{ gap: '1rem' }}>
                {/* Part 1 (Morning) */}
                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>
                    🌅 Morning Slot (Part 1)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-Time</label>
                      <input
                        name="morningTime"
                        type="time"
                        value={morningTime}
                        onChange={e => setMorningTime(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Out-Time</label>
                      <input
                        type="time"
                        value={breakStart}
                        onChange={e => setBreakStart(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Part 2 (Evening) */}
                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.5rem' }}>
                    🌆 Evening Slot (Part 2)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-Time</label>
                      <input
                        type="time"
                        value={breakEnd}
                        onChange={e => setBreakEnd(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Out-Time</label>
                      <input
                        name="eveningTime"
                        type="time"
                        value={eveningTime}
                        onChange={e => setEveningTime(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <span>☕ <b>Afternoon Break Window:</b> {breakStart} – {breakEnd}</span>
                <span>⏱ <b>Total Working Hours:</b> 8 Hours Duty</span>
              </div>
            </div>
          ) : (
            <div className="responsive-form-grid">
              {/* Morning / Start Report Time */}
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  {selectedShift === 'NIGHT' ? '🌙 Night Shift In-Time' : selectedShift === 'AFTERNOON' ? '🌆 Afternoon Shift In-Time' : '☀️ Morning Shift In-Time'}
                </label>
                <input
                  name="morningTime"
                  type="time"
                  value={morningTime}
                  onChange={e => setMorningTime(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Evening / End Departure Time */}
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  {selectedShift === 'NIGHT' ? '🌙 Night Shift Out-Time (Next Day)' : selectedShift === 'AFTERNOON' ? '🌆 Afternoon Shift Out-Time' : '☀️ Morning Shift Out-Time'}
                </label>
                <input
                  name="eveningTime"
                  type="time"
                  value={eveningTime}
                  onChange={e => setEveningTime(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Weekly Off Days Selection */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', margin: 0 }}>
                  🏖️ Weekly Off Days (साप्ताहिक अवकाश)
                </label>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Configure weekly off days for this employee. Roster and attendance calculations will automatically apply these off days.
                </p>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(37,99,235,0.1)', padding: '3px 9px', borderRadius: '6px' }}>
                {offDays.length} Off Day{offDays.length !== 1 ? 's' : ''} Configured
              </span>
            </div>

            <div className="weekly-off-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginTop: '0.75rem' }}>
              {DAYS_OF_WEEK.map(day => {
                const isChecked = offDays.includes(day)
                const isDefaultSunday = day === 'Sunday'
                return (
                  <label
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.75rem',
                      minHeight: '52px',
                      borderRadius: '8px',
                      border: isChecked
                        ? (isDefaultSunday ? '2px solid #ef4444' : '2px solid var(--primary)')
                        : '1px solid var(--border)',
                      backgroundColor: isChecked
                        ? (isDefaultSunday ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)')
                        : 'var(--bg-main)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOffDay(day)}
                      style={{ width: '16px', height: '16px', accentColor: isDefaultSunday ? '#ef4444' : 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isChecked ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {day}
                      </div>
                      <div style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        lineHeight: '14px',
                        color: isDefaultSunday ? '#ef4444' : (isChecked ? 'var(--primary)' : 'transparent'),
                        whiteSpace: 'nowrap'
                      }}>
                        {isDefaultSunday ? 'Default Off' : (isChecked ? 'Scheduled Off' : '\u00A0')}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* Section 5: Shift Eligibility & Roster Rotation */}
        <div className="form-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔄</span>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Section 5: Shift Eligibility & Rotation
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Define whether this employee can be rostered for both Day and Night shifts (Swap Shift).
              </p>
            </div>
          </div>

          {/* Swap Shift Toggle Card */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1.1rem 1.25rem',
              borderRadius: '12px',
              border: swapShiftEligible
                ? '2px solid #8b5cf6'
                : '1px solid var(--border)',
              backgroundColor: swapShiftEligible
                ? 'rgba(139, 92, 246, 0.08)'
                : 'var(--bg-main)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={swapShiftEligible}
              onChange={(e) => setSwapShiftEligible(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                marginTop: '2px',
                accentColor: '#8b5cf6',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.1rem' }}>☀️🌙</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: swapShiftEligible ? '#8b5cf6' : 'var(--text-main)' }}>
                  Swap Shift Eligible
                </span>
                {swapShiftEligible && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: '#8b5cf6',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '20px',
                    }}
                  >
                    ENABLED
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {swapShiftEligible
                  ? '✅ This employee can be assigned to both Day Shift and Night Shift in the Duty Roster. Shift Manager will allow full shift rotation for this employee.'
                  : "🔒 This employee is locked to a single default shift. Shift Manager will restrict this employee's roster cell to their assigned shift only (no swap allowed)."}
              </p>
            </div>
          </label>

          {/* Dual Shift Hours Configuration (When Swap Shift is Enabled) */}
          {swapShiftEligible && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#8b5cf6', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>⚙️</span>
                <span>Dual Shift Rotational Timings (दोनों शिफ्ट का समय सेट करें)</span>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Set customized working hours for both shifts. When rotated in the duty roster, the security kiosk will automatically adjust reporting times and notify guards.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* ☀️ Day Shift Configuration */}
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>☀️ Day Shift (दिन की शिफ्ट)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        Arrival (In-Time)
                      </label>
                      <input
                        type="time"
                        value={dayShiftStart}
                        onChange={e => setDayShiftStart(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        Departure (Out-Time)
                      </label>
                      <input
                        type="time"
                        value={dayShiftEnd}
                        onChange={e => setDayShiftEnd(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                    Standard Day Shift: 08:00 or 09:00 to 18:00 / 20:00
                  </span>
                </div>

                {/* 🌙 Night Shift Configuration */}
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#8b5cf6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>🌙 Night Shift (रात की शिफ्ट)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        Evening Arrival (In-Time)
                      </label>
                      <input
                        type="time"
                        value={nightShiftStart}
                        onChange={e => setNightShiftStart(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        Morning Departure (Out)
                      </label>
                      <input
                        type="time"
                        value={nightShiftEnd}
                        onChange={e => setNightShiftEnd(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.5rem', display: 'block', fontWeight: 600 }}>
                    Standard Night Shift: 08:00 PM to 08:00 AM (20:00 – 08:00)
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  fontSize: '0.76rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span>🔔</span>
                <span>
                  <strong>Kiosk Instruction:</strong> Duty roster mein swap karte hi security kiosk par automated instruction dispatch hogi aur arrival time updated show hoga.
                </span>
              </div>
            </div>
          )}

          {/* Info note */}
          {!swapShiftEligible && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#d97706',
              }}
            >
              <span>🔒</span>
              <span>
                <strong>Single Shift Mode:</strong> Shift Manager mein yeh employee lock rahega aur swap nahi hoga jab tak yeh option enable nahi kiya jaata.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="form-actions-bar">
          <Link
            href="/hr/employees"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '0.92rem',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
              opacity: loading ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Updating Profile...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* DANGER ZONE: DELETE EMPLOYEE */}
      <div
        style={{
          marginTop: '1.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '14px',
          padding: '1.5rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h4 style={{ color: 'var(--error)', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Danger Zone
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Permanently delete this employee profile, biometric credentials, and shift assignments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid var(--error)',
            backgroundColor: 'transparent',
            color: 'var(--error)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          🗑 Delete Employee
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: 'clamp(1.25rem, 4vw, 2rem)',
              maxWidth: 'min(92vw, 460px)',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              animation: 'scaleUp 0.15s ease-out',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '1.25rem',
              }}
            >
              ⚠️
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
              Delete Employee Record?
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {employee.firstName} {employee.lastName}
              </strong>{' '}
              ({employee.employeeId})? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--error)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
