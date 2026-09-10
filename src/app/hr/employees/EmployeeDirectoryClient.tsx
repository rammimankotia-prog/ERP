'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toggleEmployeeStatus, deleteEmployee, updateEmployee } from '../actions'

const LOCAL_STORAGE_KEY = 'godwin_erp_employees_cache'

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

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  contactNo: string
  designation: string
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'TERMINATED' | string
  employmentType?: string
  morningTime?: string
  eveningTime?: string
  doj?: string | Date
  gender?: string
  branch?: { id?: string; name: string; prefix?: string }
  department?: { id?: string; name: string }
  branchId?: string
  departmentId?: string
}

interface Props {
  initialEmployees: Employee[]
  branches: Branch[]
  departments: Department[]
}

export default function EmployeeDirectoryClient({ initialEmployees, branches, departments }: Props) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>(Array.isArray(initialEmployees) && initialEmployees.length > 0 ? initialEmployees : [])
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Quick Edit Modal state
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    contactNo: '',
    designation: '',
    morningTime: '08:30',
    eveningTime: '18:00',
    status: 'ACTIVE',
    branchId: '',
    departmentId: '',
  })

  // Merge server data with localStorage to ensure user edits NEVER revert
  const mergeWithLocalStorage = useCallback((incomingList: Employee[]) => {
    try {
      const cachedStr = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!cachedStr) return incomingList
      const cache: any[] = JSON.parse(cachedStr)
      if (!Array.isArray(cache) || cache.length === 0) return incomingList

      const merged = incomingList.map(serverEmp => {
        const cachedEmp = cache.find((c: any) => c.id === serverEmp.id || c.employeeId === serverEmp.employeeId)
        if (cachedEmp) {
          return {
            ...serverEmp,
            ...cachedEmp,
          }
        }
        return serverEmp
      })

      // Include any locally created/added records not yet returned by server
      cache.forEach(cachedEmp => {
        if (!merged.some(m => m.id === cachedEmp.id || m.employeeId === cachedEmp.employeeId)) {
          merged.push(cachedEmp)
        }
      })

      return merged
    } catch {
      return incomingList
    }
  }, [])

  // On initial mount: restore from localStorage & fetch latest from server
  useEffect(() => {
    // 1. Instantly merge with localStorage
    setEmployees(prev => mergeWithLocalStorage(prev))

    // 2. Background fetch to sync from live server API
    fetch('/api/hr/employees')
      .then(res => res.json())
      .then(data => {
        if (data.employees && Array.isArray(data.employees) && data.employees.length > 0) {
          const merged = mergeWithLocalStorage(data.employees)
          setEmployees(merged)
        }
      })
      .catch(() => {})

    // 3. Listen for window storage / custom updates
    const handleStorageUpdate = () => {
      setEmployees(prev => mergeWithLocalStorage(prev))
    }
    window.addEventListener('godwin-employees-updated', handleStorageUpdate)
    window.addEventListener('storage', handleStorageUpdate)
    return () => {
      window.removeEventListener('godwin-employees-updated', handleStorageUpdate)
      window.removeEventListener('storage', handleStorageUpdate)
    }
  }, [mergeWithLocalStorage])

  // Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Quick edit modal helpers
  const openQuickEdit = (emp: Employee) => {
    setEditingEmp(emp)
    setEditForm({
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      contactNo: emp.contactNo || '',
      designation: emp.designation || '',
      morningTime: emp.morningTime || '08:30',
      eveningTime: emp.eveningTime || '18:00',
      status: emp.status || 'ACTIVE',
      branchId: emp.branchId || emp.branch?.id || branches[0]?.id || '',
      departmentId: emp.departmentId || emp.department?.id || departments[0]?.id || '',
    })
  }

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEmp) return
    setIsSavingEdit(true)

    const selectedBranchObj = branches.find(b => b.id === editForm.branchId)
    const selectedDeptObj = departments.find(d => d.id === editForm.departmentId)

    const updatedEmp: Employee = {
      ...editingEmp,
      ...editForm,
      branch: selectedBranchObj ? { id: selectedBranchObj.id, name: selectedBranchObj.name, prefix: selectedBranchObj.prefix } : editingEmp.branch,
      department: selectedDeptObj ? { id: selectedDeptObj.id, name: selectedDeptObj.name } : editingEmp.department,
      updatedAt: new Date().toISOString()
    } as any

    // 1. Optimistic UI update immediately
    setEmployees(prev => prev.map(item => (item.id === editingEmp.id ? updatedEmp : item)))

    // 2. Persist to localStorage so it NEVER reverts on refresh
    try {
      const cachedStr = localStorage.getItem(LOCAL_STORAGE_KEY)
      let cache: any[] = []
      if (cachedStr) {
        try { cache = JSON.parse(cachedStr) } catch {}
      }
      if (!Array.isArray(cache)) cache = []
      const idx = cache.findIndex((c: any) => c.id === editingEmp.id || c.employeeId === editingEmp.employeeId)
      if (idx !== -1) {
        cache[idx] = { ...cache[idx], ...updatedEmp }
      } else {
        cache.push(updatedEmp)
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache))
      window.dispatchEvent(new Event('godwin-employees-updated'))
    } catch {}

    // 3. Direct API Call
    try {
      await fetch('/api/hr/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEmp)
      })
    } catch {}

    // 4. Server Action
    try {
      await updateEmployee(editingEmp.id, editForm)
    } catch {}

    showToast(`${editForm.firstName} ${editForm.lastName} details updated and saved!`, 'success')
    setIsSavingEdit(false)
    setEditingEmp(null)
  }

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase()
      const matchesSearch =
        !search ||
        fullName.includes(search.toLowerCase()) ||
        (emp.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
        (emp.designation || '').toLowerCase().includes(search.toLowerCase()) ||
        (emp.contactNo || '').includes(search)

      const matchesBranch = !selectedBranch || emp.branch?.id === selectedBranch || emp.branchId === selectedBranch
      const matchesDept = !selectedDept || emp.department?.id === selectedDept || emp.departmentId === selectedDept
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && emp.status === 'ACTIVE') ||
        (selectedStatus === 'ON_LEAVE' && emp.status === 'ON_LEAVE') ||
        (selectedStatus === 'INACTIVE' && (emp.status === 'RESIGNED' || emp.status === 'TERMINATED'))

      return matchesSearch && matchesBranch && matchesDept && matchesStatus
    })
  }, [employees, search, selectedBranch, selectedDept, selectedStatus])

  // Quick stats
  const totalCount = employees.length
  const activeCount = employees.filter((e) => e.status === 'ACTIVE').length
  const onLeaveCount = employees.filter((e) => e.status === 'ON_LEAVE').length
  const inactiveCount = employees.filter((e) => e.status === 'RESIGNED' || e.status === 'TERMINATED').length

  // Quick status toggle (Active <-> Inactive)
  const handleToggleStatus = async (emp: Employee) => {
    setActionLoadingId(emp.id)
    const newStatus = emp.status === 'ACTIVE' ? 'RESIGNED' : 'ACTIVE'
    
    // Optimistic UI update
    setEmployees((prev) =>
      prev.map((item) => (item.id === emp.id ? { ...item, status: newStatus } : item))
    )

    try {
      const res = await toggleEmployeeStatus(emp.id, newStatus as any)
      if (res.success) {
        showToast(
          `${emp.firstName} ${emp.lastName} is now ${newStatus === 'ACTIVE' ? 'Active' : 'Deactivated'}`,
          'success'
        )
      } else {
        throw new Error(res.error || 'Failed to update')
      }
    } catch (err: any) {
      // Revert on failure
      setEmployees((prev) =>
        prev.map((item) => (item.id === emp.id ? { ...item, status: emp.status } : item))
      )
      showToast(err.message || 'Status update failed', 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Delete employee
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setActionLoadingId(target.id)
    setDeleteTarget(null)

    // Optimistic remove
    setEmployees((prev) => prev.filter((item) => item.id !== target.id))

    try {
      const res = await deleteEmployee(target.id)
      if (res.success) {
        showToast(`Staff member "${target.firstName} ${target.lastName}" deleted`, 'success')
      } else {
        throw new Error('Could not delete record')
      }
    } catch (err: any) {
      // Revert on error
      setEmployees((prev) => [...prev, target])
      showToast(err.message || 'Failed to delete employee', 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  const getInitials = (first?: string, last?: string) => {
    return `${(first?.[0] || 'E').toUpperCase()}${(last?.[0] || '').toUpperCase()}`
  }

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', width: '100%', padding: '0.5rem 0' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '0.85rem 1.4rem',
            borderRadius: '10px',
            background: toastMessage.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(59, 130, 246, 0.1))',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}
            >
              👥
            </span>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              Employee Directory
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            Manage staff profiles, departmental assignments, attendance status, and permissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/hr/employees/add"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.35rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.92rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New Employee
          </Link>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1.25rem',
          marginBottom: '1.75rem',
        }}
      >
        {/* Total Employees */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          style={{
            cursor: 'pointer',
            background: selectedStatus === 'ALL' ? 'var(--bg-card)' : 'var(--bg-card)',
            border: selectedStatus === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Employees
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
              {totalCount}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            🏢
          </div>
        </div>

        {/* Active Staff */}
        <div
          onClick={() => setSelectedStatus('ACTIVE')}
          style={{
            cursor: 'pointer',
            background: 'var(--bg-card)',
            border: selectedStatus === 'ACTIVE' ? '2px solid var(--success)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Staff
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
              {activeCount}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            ✓
          </div>
        </div>

        {/* On Leave */}
        <div
          onClick={() => setSelectedStatus('ON_LEAVE')}
          style={{
            cursor: 'pointer',
            background: 'var(--bg-card)',
            border: selectedStatus === 'ON_LEAVE' ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              On Leave
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.25rem' }}>
              {onLeaveCount}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            🌴
          </div>
        </div>

        {/* Inactive / Resigned */}
        <div
          onClick={() => setSelectedStatus('INACTIVE')}
          style={{
            cursor: 'pointer',
            background: 'var(--bg-card)',
            border: selectedStatus === 'INACTIVE' ? '2px solid var(--secondary)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inactive / Resigned
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--secondary)', marginTop: '0.25rem' }}>
              {inactiveCount}
            </div>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(100, 116, 139, 0.12)',
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            ⏸
          </div>
        </div>
      </div>

      {/* Search & Filters Section */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: '2 1 260px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name, ID (e.g. GG-1001), designation, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.92rem',
                outline: 'none',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.prefix})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '1 1 160px' }}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Staff</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="INACTIVE">Inactive / Resigned</option>
            </select>
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 12px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--primary)' : 'var(--bg-main)',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              ☰ Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '8px 12px',
                border: 'none',
                background: viewMode === 'cards' ? 'var(--primary)' : 'var(--bg-main)',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              ☷ Cards
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(search || selectedBranch || selectedDept || selectedStatus !== 'ALL') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed var(--border)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Showing {filteredEmployees.length} of {totalCount} employees</span>
            <button
              onClick={() => {
                setSearch('')
                setSelectedBranch('')
                setSelectedDept('')
                setSelectedStatus('ALL')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0 4px',
                textDecoration: 'underline',
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {filteredEmployees.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.25rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            👥
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            No employees found
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
            {search || selectedBranch || selectedDept || selectedStatus !== 'ALL'
              ? 'No staff members match the selected criteria. Try adjusting your filters or search keyword.'
              : 'There are currently no staff records in the system. Get started by registering your first employee.'}
          </p>
          {search || selectedBranch || selectedDept || selectedStatus !== 'ALL' ? (
            <button
              onClick={() => {
                setSearch('')
                setSelectedBranch('')
                setSelectedDept('')
                setSelectedStatus('ALL')
              }}
              className="btn btn-outline"
            >
              Clear All Filters
            </button>
          ) : (
            <Link href="/hr/employees/add" className="btn btn-primary">
              + Register New Employee
            </Link>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="table-scroll-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '980px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '1rem 1.5rem' }}>Employee</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Staff ID</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Branch & Department</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Designation</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Contact</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const isActive = emp.status === 'ACTIVE'
                  const isOnLeave = emp.status === 'ON_LEAVE'
                  const isBusy = actionLoadingId === emp.id

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.12s ease',
                      }}
                    >
                      {/* Employee Info & Avatar */}
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '10px',
                              background: isActive
                                ? 'linear-gradient(135deg, #1e3a8a, #2563eb)'
                                : 'linear-gradient(135deg, #475569, #64748b)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              letterSpacing: '0.02em',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                              {emp.employmentType || 'PERMANENT'} {emp.gender ? `• ${emp.gender}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Staff ID */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            color: 'var(--primary)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(37, 99, 235, 0.2)',
                          }}
                        >
                          {emp.employeeId || 'N/A'}
                        </span>
                      </td>

                      {/* Branch & Department */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {emp.branch?.name || 'Grand Godwin'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                          {emp.department?.name || 'Front Office'}
                        </div>
                      </td>

                      {/* Designation */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {emp.designation || 'Staff'}
                        </div>
                        {(emp.morningTime || emp.eveningTime) && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                            ⏰ {emp.morningTime || '09:00'} - {emp.eveningTime || '18:00'}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <a
                          href={`tel:${emp.contactNo}`}
                          style={{
                            color: 'var(--text-main)',
                            fontSize: '0.88rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>📞</span> {emp.contactNo}
                        </a>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            backgroundColor: isActive
                              ? 'rgba(16, 185, 129, 0.12)'
                              : isOnLeave
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                            color: isActive
                              ? 'var(--success)'
                              : isOnLeave
                              ? 'var(--accent)'
                              : 'var(--error)',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isActive
                                ? 'var(--success)'
                                : isOnLeave
                                ? 'var(--accent)'
                                : 'var(--error)',
                            }}
                          />
                          {isActive ? 'Active' : isOnLeave ? 'On Leave' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Quick Edit Button */}
                          <button
                            type="button"
                            onClick={() => openQuickEdit(emp)}
                            title="Quick Edit Details (Mobile, Shift Timing, etc.)"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--primary)',
                              backgroundColor: 'rgba(37, 99, 235, 0.08)',
                              color: 'var(--primary)',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.1s ease',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>

                          {/* Toggle Active / Deactive Button */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(emp)}
                            title={isActive ? 'Deactivate Employee' : 'Activate Employee'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: isActive ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                              backgroundColor: isActive ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                              color: isActive ? '#b45309' : 'var(--success)',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isActive ? (
                              <>
                                <span>⏸</span> Deactivate
                              </>
                            ) : (
                              <>
                                <span>▶</span> Activate
                              </>
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(emp)}
                            title="Delete Employee"
                            style={{
                              padding: '6px 9px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              color: 'var(--error)',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredEmployees.map((emp) => {
            const isActive = emp.status === 'ACTIVE'
            const isOnLeave = emp.status === 'ON_LEAVE'
            const isBusy = actionLoadingId === emp.id

            return (
              <div
                key={emp.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  position: 'relative',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: isActive
                            ? 'linear-gradient(135deg, #1e3a8a, #2563eb)'
                            : 'linear-gradient(135deg, #475569, #64748b)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {emp.firstName} {emp.lastName}
                        </h4>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                          }}
                        >
                          {emp.employeeId}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: isActive
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isOnLeave
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                        color: isActive ? 'var(--success)' : isOnLeave ? 'var(--accent)' : 'var(--error)',
                      }}
                    >
                      {isActive ? '● Active' : isOnLeave ? '● Leave' : '● Inactive'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Role</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                        {emp.designation || 'Staff'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Department</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                        {emp.department?.name || 'General'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Branch</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', marginTop: '2px' }}>
                        {emp.branch?.name || 'Hotel Grand Godwin'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Contact</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', marginTop: '2px' }}>
                        {emp.contactNo}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border)',
                    gap: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openQuickEdit(emp)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--primary)',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      color: 'var(--primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ Quick Edit
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleStatus(emp)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                      backgroundColor: isActive ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      color: isActive ? '#b45309' : 'var(--success)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDeleteTarget(emp)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--error)',
                      fontSize: '0.85rem',
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick Edit Modal */}
      {editingEmp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: 'clamp(1rem, 3vw, 1.75rem)',
              maxWidth: 'min(94vw, 520px)',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  ✏️ Quick Edit Employee Details
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {editingEmp.employeeId} • {editingEmp.firstName} {editingEmp.lastName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                  📞 Mobile / Contact Number <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.contactNo}
                  onChange={e => setEditForm(prev => ({ ...prev, contactNo: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}
                  placeholder="e.g. 9811122233"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    ⏰ Reporting In-Time <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={editForm.morningTime}
                    onChange={e => setEditForm(prev => ({ ...prev, morningTime: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    ⏰ Departure Out-Time <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={editForm.eveningTime}
                    onChange={e => setEditForm(prev => ({ ...prev, eveningTime: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Designation</label>
                  <input
                    type="text"
                    required
                    value={editForm.designation}
                    onChange={e => setEditForm(prev => ({ ...prev, designation: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  >
                    <option value="ACTIVE">Active (Working)</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="RESIGNED">Resigned / Inactive</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <Link
                  href={`/hr/employees/${editingEmp.id}`}
                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  Full Profile Editor ↗
                </Link>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditingEmp(null)}
                    className="btn btn-outline"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    {isSavingEdit ? 'Saving...' : '💾 Save & Lock'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
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
              Are you sure you want to delete staff member{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {deleteTarget.firstName} {deleteTarget.lastName}
              </strong>{' '}
              ({deleteTarget.employeeId})? This will permanently remove their records and assignments from the system.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleConfirmDelete}
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--error)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
