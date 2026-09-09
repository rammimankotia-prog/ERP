'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import PermissionGuard from '@/components/PermissionGuard';

interface PermissionSet {
  hr?: {
    employees?: { view?: boolean; edit?: boolean; delete?: boolean };
    attendance?: { view?: boolean; edit?: boolean };
    shifts?: { view?: boolean; edit?: boolean };
    leave?: { view?: boolean; approve?: boolean };
    payroll?: { view?: boolean; edit?: boolean };
    reports?: { view?: boolean };
  };
  quotations?: { view?: boolean; edit?: boolean; delete?: boolean };
  fleet?: { view?: boolean; edit?: boolean };
  userAccess?: { view?: boolean; edit?: boolean };
  settings?: { view?: boolean; edit?: boolean };
}

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  permissions?: PermissionSet;
}

const EMPTY_PERMISSIONS: PermissionSet = {
  hr: {
    employees: { view: false, edit: false, delete: false },
    attendance: { view: false, edit: false },
    shifts: { view: false, edit: false },
    leave: { view: false, approve: false },
    payroll: { view: false, edit: false },
    reports: { view: false },
  },
  quotations: { view: false, edit: false, delete: false },
  fleet: { view: false, edit: false },
  userAccess: { view: false, edit: false },
  settings: { view: false, edit: false },
};

const PERMISSION_MODULES = [
  {
    label: 'HR — Employees', key: 'hr.employees',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ]
  },
  {
    label: 'HR — Attendance', key: 'hr.attendance',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
  {
    label: 'HR — Shift Manager', key: 'hr.shifts',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
  {
    label: 'HR — Leave', key: 'hr.leave',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'approve', label: 'Approve' },
    ]
  },
  {
    label: 'HR — Payroll', key: 'hr.payroll',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
  {
    label: 'HR — Reports', key: 'hr.reports',
    actions: [
      { key: 'view', label: 'View' },
    ]
  },
  {
    label: 'Quotations', key: 'quotations',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ]
  },
  {
    label: 'Fleet Manager', key: 'fleet',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
  {
    label: 'User Access', key: 'userAccess',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
  {
    label: 'Settings', key: 'settings',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ]
  },
];

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const result = JSON.parse(JSON.stringify(obj)); // deep clone
  let cur = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return result;
}

function getRoleBadgeStyle(role: string, isLight: boolean) {
  if (role === 'Master Admin') return { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' };
  if (role === 'Manager') return { bg: 'rgba(37,99,235,0.1)', color: '#2563eb' };
  if (role === 'Admin') return { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' };
  return { bg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: isLight ? '#374151' : '#94a3b8' };
}

export default function UsersManagementPage() {
  const { theme } = useTheme();
  const { user: currentUser, isMasterAdmin } = useAuth();
  const isLight = theme === 'light';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '', name: '', email: '', password: '', role: 'Staff', status: 'Active',
  });
  const [formPermissions, setFormPermissions] = useState<PermissionSet>(EMPTY_PERMISSIONS);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (res.ok && data.users) setUsers(data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditingUser(null);
    setFormData({ username: '', name: '', email: '', password: '', role: 'Staff', status: 'Active' });
    setFormPermissions(JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)));
    setFormError(''); setFormSuccess('');
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormData({ username: u.username, name: u.name, email: u.email, password: '', role: u.role, status: u.status });
    setFormPermissions(u.permissions ? JSON.parse(JSON.stringify(u.permissions)) : JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)));
    setFormError(''); setFormSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!formData.name || !formData.username || !formData.email) {
      setFormError('Name, username and email are required.');
      return;
    }
    if (!editingUser && !formData.password) {
      setFormError('Password is required for new users.');
      return;
    }
    setIsSubmitting(true);
    try {
      const body = editingUser
        ? { id: editingUser.id, ...formData, permissions: formPermissions }
        : { ...formData, permissions: formPermissions };
      const res = await fetch('/api/auth/users', {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Something went wrong.'); return; }
      setFormSuccess(editingUser ? 'User updated successfully!' : 'User created successfully!');
      fetchUsers();
      setTimeout(() => setShowModal(false), 800);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/auth/users?id=${u.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { fetchUsers(); } else { alert(data.error || 'Failed to delete.'); }
  };

  const togglePermission = (path: string, action: string) => {
    const fullPath = `${path}.${action}`;
    const current = getNestedValue(formPermissions, fullPath);
    setFormPermissions(prev => setNestedValue(prev, fullPath, !current));
  };

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter !== 'ALL') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'ALL') list = list.filter(u => u.status === statusFilter);
    list.sort((a, b) => {
      const va = (a as any)[sortBy] || '';
      const vb = (b as any)[sortBy] || '';
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [users, searchQuery, roleFilter, statusFilter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const card = { background: isLight ? '#fff' : '#1e293b', border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`, borderRadius: 16 };
  const input = {
    width: '100%', padding: '0.65rem 0.9rem', borderRadius: 10,
    border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`,
    background: isLight ? '#f8fafc' : '#0f172a',
    color: isLight ? '#1e293b' : '#f1f5f9',
    fontSize: '0.88rem', outline: 'none',
  };

  return (
    <PermissionGuard module="userAccess" action="view">
      <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: isLight ? '#1e293b' : '#f1f5f9', margin: 0 }}>
              👥 User Access
            </h1>
            <p style={{ color: isLight ? '#64748b' : '#94a3b8', marginTop: '0.25rem', fontSize: '0.92rem' }}>
              Manage login credentials and module permissions for each team member
            </p>
          </div>
          {isMasterAdmin && (
            <button onClick={openAdd} style={{
              padding: '0.7rem 1.5rem', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}>
              + Add New User
            </button>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Users', value: users.length, color: '#2563eb' },
            { label: 'Active', value: users.filter(u => u.status === 'Active').length, color: '#10b981' },
            { label: 'Inactive', value: users.filter(u => u.status !== 'Active').length, color: '#f59e0b' },
            { label: 'Master Admin', value: users.filter(u => u.role === 'Master Admin').length, color: '#7c3aed' },
          ].map(stat => (
            <div key={stat.label} style={{ ...card, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#94a3b8', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search by name, username, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...input, width: 260, flex: 'none' }}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...input, width: 150, flex: 'none' }}>
            <option value="ALL">All Roles</option>
            <option value="Master Admin">Master Admin</option>
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...input, width: 140, flex: 'none' }}>
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {(['name', 'role', 'createdAt'] as const).map(col => (
              <button key={col} onClick={() => toggleSort(col)} style={{
                padding: '0.45rem 0.85rem', borderRadius: 8, border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`,
                background: sortBy === col ? (isLight ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.15)') : 'transparent',
                color: sortBy === col ? '#2563eb' : (isLight ? '#374151' : '#94a3b8'),
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              }}>
                {col === 'createdAt' ? 'Date' : col.charAt(0).toUpperCase() + col.slice(1)}
                {sortBy === col && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>
        </div>

        {/* User Table */}
        <div style={{ ...card, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>No users found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: isLight ? '#f8fafc' : '#0f172a', borderBottom: `1px solid ${isLight ? '#e2e8f0' : '#334155'}` }}>
                  {['User', 'Role', 'Status', 'Created', 'Modules', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => {
                  const badge = getRoleBadgeStyle(u.role, isLight);
                  const isMaster = u.id === 'admin-001' || u.role === 'Master Admin';
                  const permCount = u.permissions ? countPermissions(u.permissions) : 0;
                  return (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${isLight ? '#f1f5f9' : '#1e293b'}`, background: i % 2 === 0 ? 'transparent' : (isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.015)') }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${isMaster ? '#7c3aed' : '#2563eb'}, ${isMaster ? '#2563eb' : '#10b981'})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                          }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: isLight ? '#1e293b' : '#f1f5f9', fontSize: '0.9rem' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#94a3b8' }}>@{u.username}</div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#94a3b8' : '#64748b' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                          background: u.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: u.status === 'Active' ? '#10b981' : '#ef4444',
                        }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>{u.createdAt || '—'}</td>
                      <td style={{ padding: '1rem' }}>
                        {isMaster ? (
                          <span style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>All Access ✓</span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                            {permCount} permission{permCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {isMasterAdmin && (
                            <button onClick={() => openEdit(u)} style={{
                              padding: '0.4rem 0.9rem', borderRadius: 8, border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`,
                              background: 'transparent', color: isLight ? '#2563eb' : '#93c5fd', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            }}>Edit</button>
                          )}
                          {isMasterAdmin && !isMaster && (
                            <button onClick={() => handleDelete(u)} style={{
                              padding: '0.4rem 0.9rem', borderRadius: 8, border: '1.5px solid rgba(239,68,68,0.3)',
                              background: 'rgba(239,68,68,0.05)', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            }}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
            backdropFilter: 'blur(4px)',
          }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div style={{
              ...card, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
              padding: '2rem', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: isLight ? '#1e293b' : '#f1f5f9' }}>
                  {editingUser ? '✏️ Edit User' : '➕ Create New User'}
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: isLight ? '#64748b' : '#94a3b8' }}>✕</button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>Full Name *</label>
                    <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Sharma" style={input} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>Username *</label>
                    <input value={formData.username} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} placeholder="e.g. priya.sharma" style={input} required disabled={editingUser?.id === 'admin-001'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>Email *</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@godwinhotels.com" style={input} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                    <input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={input} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>Role</label>
                    <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))} style={input} disabled={editingUser?.id === 'admin-001'}>
                      <option value="Staff">Staff</option>
                      <option value="Manager">Manager</option>
                      <option value="Master Admin">Master Admin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: isLight ? '#374151' : '#94a3b8', display: 'block', marginBottom: 5 }}>Status</label>
                    <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} style={input} disabled={editingUser?.id === 'admin-001'}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Permissions Panel */}
                {editingUser?.id !== 'admin-001' && formData.role !== 'Master Admin' && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: isLight ? '#1e293b' : '#f1f5f9' }}>
                        🔐 Module Permissions
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={() => setFormPermissions(JSON.parse(JSON.stringify(EMPTY_PERMISSIONS)))} style={{ padding: '0.3rem 0.75rem', borderRadius: 8, border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`, background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          Clear All
                        </button>
                        <button type="button" onClick={() => {
                          const full: any = {};
                          PERMISSION_MODULES.forEach(mod => {
                            const actions: any = {};
                            mod.actions.forEach(a => { actions[a.key] = true; });
                            setNestedValueInPlace(full, mod.key, actions);
                          });
                          setFormPermissions(full as PermissionSet);
                        }} style={{ padding: '0.3rem 0.75rem', borderRadius: 8, border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`, background: 'transparent', color: '#10b981', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          Grant All
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {PERMISSION_MODULES.map(mod => (
                        <div key={mod.key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.75rem 1rem', borderRadius: 10,
                          border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
                          background: isLight ? '#f8fafc' : '#0f172a',
                        }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isLight ? '#374151' : '#cbd5e1', minWidth: 160 }}>
                            {mod.label}
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {mod.actions.map(action => {
                              const val = getNestedValue(formPermissions, `${mod.key}.${action.key}`) === true;
                              return (
                                <button
                                  type="button"
                                  key={action.key}
                                  onClick={() => togglePermission(mod.key, action.key)}
                                  style={{
                                    padding: '0.3rem 0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                    border: val ? 'none' : `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`,
                                    background: val ? (action.key === 'delete' || action.key === 'approve' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)') : 'transparent',
                                    color: val ? (action.key === 'delete' || action.key === 'approve' ? '#dc2626' : '#2563eb') : (isLight ? '#94a3b8' : '#475569'),
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {val ? '✓' : '○'} {action.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editingUser?.id === 'admin-001' && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#7c3aed', fontWeight: 600 }}>
                      🛡️ Master Admin has full access to all modules by default. Permissions cannot be restricted.
                    </p>
                  </div>
                )}

                {formError && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444' }}>⚠️ {formError}</p>
                  </div>
                )}
                {formSuccess && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#10b981' }}>✓ {formSuccess}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{
                    padding: '0.65rem 1.25rem', borderRadius: 10, border: `1.5px solid ${isLight ? '#e2e8f0' : '#334155'}`,
                    background: 'transparent', color: isLight ? '#374151' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                  }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} style={{
                    padding: '0.65rem 1.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}>
                    {isSubmitting ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}

// Count total active permissions
function countPermissions(perms: PermissionSet): number {
  let count = 0;
  function recurse(obj: any) {
    if (typeof obj === 'boolean') { if (obj) count++; return; }
    if (obj && typeof obj === 'object') Object.values(obj).forEach(recurse);
  }
  recurse(perms);
  return count;
}

// Helper to set nested value in-place (for Grant All)
function setNestedValueInPlace(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
