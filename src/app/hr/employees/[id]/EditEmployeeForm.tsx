'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEmployee } from '../../actions'
import { EmploymentType, EmployeeStatus } from '@prisma/client'

export default function EditEmployeeForm({ branches, departments, employee }: { branches: any[], departments: any[], employee: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      await updateEmployee(employee.id, {
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        contactNo: formData.get('contactNo') as string,
        branchId: formData.get('branchId') as string,
        departmentId: formData.get('departmentId') as string,
        designation: formData.get('designation') as string,
        morningTime: formData.get('morningTime') as string || undefined,
        eveningTime: formData.get('eveningTime') as string || undefined,
        doj: new Date(formData.get('doj') as string),
        employmentType: formData.get('employmentType') as EmploymentType,
        status: formData.get('status') as EmployeeStatus,
        gender: formData.get('gender') as string,
      })
      
      router.push('/hr/employees')
    } catch (err: any) {
      setError(err.message || 'Failed to update employee')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return date.toString().split('T')[0];
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--error)' }}>
          {error}
        </div>
      )}
      
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
          Personal Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div className="form-group">
            <label>First Name *</label>
            <input required name="firstName" type="text" className="form-input" defaultValue={employee.firstName} />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input required name="lastName" type="text" className="form-input" defaultValue={employee.lastName} />
          </div>
          <div className="form-group">
            <label>Contact Number *</label>
            <input required name="contactNo" type="text" className="form-input" defaultValue={employee.contactNo} />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select name="gender" className="form-input" defaultValue={employee.gender || 'Male'}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
          Employment Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div className="form-group">
            <label>Branch *</label>
            <select required name="branchId" className="form-input" defaultValue={employee.branchId}>
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Department *</label>
            <select required name="departmentId" className="form-input" defaultValue={employee.departmentId}>
              <option value="">Select Department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Designation *</label>
            <input required name="designation" type="text" className="form-input" defaultValue={employee.designation} />
          </div>
          <div className="form-group">
            <label>Date of Joining *</label>
            <input required name="doj" type="date" className="form-input" defaultValue={formatDate(employee.doj)} />
          </div>
          <div className="form-group">
            <label>Morning Report Time</label>
            <input name="morningTime" type="time" className="form-input" defaultValue={employee.morningTime} />
          </div>
          <div className="form-group">
            <label>Evening Report Time</label>
            <input name="eveningTime" type="time" className="form-input" defaultValue={employee.eveningTime} />
          </div>
          <div className="form-group">
            <label>Employment Type *</label>
            <select required name="employmentType" className="form-input" defaultValue={employee.employmentType}>
              <option value="PERMANENT">Permanent</option>
              <option value="CONTRACT">Contract</option>
              <option value="TRAINEE">Trainee</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status *</label>
            <select required name="status" className="form-input" defaultValue={employee.status}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <button 
          type="button" 
          onClick={() => router.back()}
          className="btn btn-outline"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="btn btn-primary"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Updating...' : 'Update Employee'}
        </button>
      </div>
    </form>
  )
}
