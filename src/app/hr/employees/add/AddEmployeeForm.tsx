'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmployee } from '../../actions'
import { EmploymentType } from '@prisma/client'

export default function AddEmployeeForm({ branches, departments }: { branches: any[], departments: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      await createEmployee({
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        contactNo: formData.get('contactNo') as string,
        branchId: formData.get('branchId') as string,
        departmentId: formData.get('departmentId') as string,
        designation: formData.get('designation') as string,
        doj: new Date(formData.get('doj') as string),
        employmentType: formData.get('employmentType') as EmploymentType,
      })
      
      router.push('/hr/employees')
    } catch (err: any) {
      setError(err.message || 'Failed to create employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      
      <div>
        <h2 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Personal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input required name="firstName" type="text" className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input required name="lastName" type="text" className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
            <input required name="contactNo" type="text" className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select name="gender" className="w-full border rounded-md px-3 py-2">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Employment Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
            <select required name="branchId" className="w-full border rounded-md px-3 py-2">
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
            <select required name="departmentId" className="w-full border rounded-md px-3 py-2">
              <option value="">Select Department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
            <input required name="designation" type="text" className="w-full border rounded-md px-3 py-2" placeholder="e.g. Front Desk Manager" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
            <input required name="doj" type="date" className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type *</label>
            <select required name="employmentType" className="w-full border rounded-md px-3 py-2">
              <option value="PERMANENT">Permanent</option>
              <option value="CONTRACT">Contract</option>
              <option value="TRAINEE">Trainee</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Employee'}
        </button>
      </div>
    </form>
  )
}
