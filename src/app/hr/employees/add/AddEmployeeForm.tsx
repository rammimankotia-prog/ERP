'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEmployee } from '../../actions'
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

export default function AddEmployeeForm({
  branches,
  departments,
}: {
  branches: Branch[]
  departments: Department[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '')

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  // Filter departments by branch if departments have branchId
  const availableDepartments = departments.filter((d) => {
    if (!d.branchId || !selectedBranchId) return true
    return d.branchId === selectedBranchId
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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

      if (!firstName || !lastName || !contactNo || !branchId || !departmentId || !designation) {
        throw new Error('Please fill in all required fields.')
      }

      await createEmployee({
        firstName,
        lastName,
        contactNo,
        branchId,
        departmentId,
        designation,
        morningTime: (formData.get('morningTime') as string) || '09:00',
        eveningTime: (formData.get('eveningTime') as string) || '18:00',
        doj: dojStr ? new Date(dojStr) : new Date(),
        dob: dobStr ? new Date(dobStr) : undefined,
        employmentType: (formData.get('employmentType') as EmploymentType) || 'PERMANENT',
        status: (formData.get('status') as EmployeeStatus) || 'ACTIVE',
        gender: (formData.get('gender') as string) || 'Male',
        emergencyContact: (formData.get('emergencyContact') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
      })

      router.push('/hr/employees')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create employee record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Error Alert */}
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
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Personal Information
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Primary contact information and identification details.
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
              placeholder="e.g. Raman"
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
              placeholder="e.g. Mankotia"
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
              placeholder="e.g. 9876543210"
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
              defaultValue="Male"
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
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Employment & Role Details
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Assign hotel branch, department, designation, and employment status.
              </p>
            </div>
          </div>

          {selectedBranch && (
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
              ID Prefix: <strong>{selectedBranch.prefix}-XXXX</strong>
            </span>
          )}
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
              <option value="">-- Select Department --</option>
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
              placeholder="e.g. Front Office Manager, Chef, Concierge"
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
              defaultValue={new Date().toISOString().split('T')[0]}
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
              defaultValue="PERMANENT"
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

          {/* Initial Status */}
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Initial Employment Status <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              required
              name="status"
              defaultValue="ACTIVE"
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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Default Shift & Schedule
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Configure scheduled report and departure timings for punctuality tracking.
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
          {/* Morning Report Time */}
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Morning Report Time (In-Time)
            </label>
            <input
              name="morningTime"
              type="time"
              defaultValue="09:00"
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

          {/* Evening Report Time */}
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Evening Departure Time (Out-Time)
            </label>
            <input
              name="eveningTime"
              type="time"
              defaultValue="18:00"
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
              Registering Employee...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Save & Register Employee
            </>
          )}
        </button>
      </div>
    </form>
  )
}
