'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateEmployee, deleteEmployee, toggleEmployeeStatus } from '../../actions'
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

  const initialShift = employee.morningTime === '22:00' || employee.eveningTime === '07:00'
    ? 'NIGHT'
    : employee.morningTime === '10:00' && employee.eveningTime === '22:00'
    ? 'BREAK'
    : 'MORNING'

  const [selectedShift, setSelectedShift] = useState<'MORNING' | 'BREAK' | 'NIGHT'>(initialShift)
  const [morningTime, setMorningTime] = useState(employee.morningTime || '09:00')
  const [eveningTime, setEveningTime] = useState(employee.eveningTime || '18:00')
  const [breakStart, setBreakStart] = useState('14:00')
  const [breakEnd, setBreakEnd] = useState('18:00')

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  // Filter departments by selected branch if branchId is linked
  const availableDepartments = departments.filter((d) => {
    if (!d.branchId || !selectedBranchId) return true
    return d.branchId === selectedBranchId
  })

  const formatDate = (date: any) => {
    if (!date) return ''
    try {
      return new Date(date).toISOString().split('T')[0]
    } catch {
      return String(date).split('T')[0]
    }
  }

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

      await updateEmployee(employee.id, {
        firstName,
        lastName,
        contactNo,
        branchId,
        departmentId,
        designation,
        morningTime: (formData.get('morningTime') as string) || undefined,
        eveningTime: (formData.get('eveningTime') as string) || undefined,
        doj: dojStr ? new Date(dojStr) : new Date(),
        dob: dobStr ? new Date(dobStr) : undefined,
        employmentType: (formData.get('employmentType') as EmploymentType) || 'PERMANENT',
        status,
        gender: (formData.get('gender') as string) || 'Male',
        emergencyContact: (formData.get('emergencyContact') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
      })

      setCurrentStatus(status)
      setSuccess('Employee details updated successfully!')
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
      const res = await toggleEmployeeStatus(employee.id, newStatus as any)
      if (res.success) {
        setCurrentStatus(newStatus)
        setSuccess(`Status changed to ${newStatus === 'ACTIVE' ? 'Active' : 'Deactivated'}`)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteEmployee(employee.id)
      if (res.success) {
        router.push('/hr/employees')
        router.refresh()
      } else {
        throw new Error('Could not delete record')
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
          padding: '1.5rem',
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
            padding: '1.75rem',
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
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
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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
            padding: '1.75rem',
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
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
            padding: '1.75rem',
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* Morning Shift Toggle */}
            <button
              type="button"
              onClick={() => {
                setSelectedShift('MORNING')
                setMorningTime('09:00')
                setEveningTime('18:00')
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
              <span style={{ fontSize: '1.4rem' }}>☀️</span>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'MORNING' ? '#10b981' : 'var(--text-main)' }}>
                Morning Shift
              </span>
              <span style={{ fontSize: '0.75rem', color: selectedShift === 'MORNING' ? '#10b981' : 'var(--text-muted)' }}>
                09:00 AM – 06:00 PM
              </span>
            </button>

            {/* Break Shift Toggle */}
            <button
              type="button"
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
              <span style={{ fontSize: '1.4rem' }}>☕</span>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'BREAK' ? '#38bdf8' : 'var(--text-main)' }}>
                Break Shift
              </span>
              <span style={{ fontSize: '0.75rem', color: selectedShift === 'BREAK' ? '#38bdf8' : 'var(--text-muted)' }}>
                10:00–14:00 & 18:00–22:00
              </span>
            </button>

            {/* Night Shift Toggle */}
            <button
              type="button"
              onClick={() => {
                setSelectedShift('NIGHT')
                setMorningTime('22:00')
                setEveningTime('07:00')
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
              <span style={{ fontSize: '1.4rem' }}>🌙</span>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedShift === 'NIGHT' ? '#8b5cf6' : 'var(--text-main)' }}>
                Night Shift
              </span>
              <span style={{ fontSize: '0.75rem', color: selectedShift === 'NIGHT' ? '#8b5cf6' : 'var(--text-muted)' }}>
                10:00 PM – 07:00 AM
              </span>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Part 1 (Morning) */}
                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>
                    🌅 Morning Slot (Part 1)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Morning / Start Report Time */}
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  {selectedShift === 'NIGHT' ? '🌙 Night Shift In-Time' : '☀️ Morning Shift In-Time'}
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
                  {selectedShift === 'NIGHT' ? '🌙 Night Shift Out-Time (Next Day)' : '☀️ Morning Shift Out-Time'}
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
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '0.5rem',
          }}
        >
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
              padding: '2rem',
              maxWidth: '460px',
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
