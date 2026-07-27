'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  password?: string;
}

export default function UsersManagementPage() {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    status: 'Active'
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddOpen = () => {
    setFormData({
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'Staff',
      status: 'Active'
    });
    setFormError('');
    setFormSuccess('');
    setShowAddModal(true);
  };

  const handleEditOpen = (u: User) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      name: u.name,
      email: u.email,
      password: '', // blank unless changing
      role: u.role,
      status: u.status
    });
    setFormError('');
    setFormSuccess('');
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setFormSuccess('User account created successfully!');
        fetchUsers();
        setTimeout(() => {
          setShowAddModal(false);
          setFormSuccess('');
        }, 1500);
      } else {
        setFormError(data.error || 'Failed to create user account.');
      }
    } catch (err) {
      setFormError('Network communication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          ...formData
        })
      });
      const data = await res.json();

      if (res.ok) {
        setFormSuccess('User profile updated successfully!');
        fetchUsers();
        setTimeout(() => {
          setShowEditModal(false);
          setEditingUser(null);
          setFormSuccess('');
        }, 1500);
      } else {
        setFormError(data.error || 'Failed to update user account.');
      }
    } catch (err) {
      setFormError('Network communication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.id === 'admin-001' || u.username.toLowerCase() === 'godwinhotels') {
      alert('🚫 Security Restriction: Cannot delete the primary system administrator account (Godwinhotels).');
      return;
    }
    if (!confirm(`🗑️ Are you certain you want to delete account "${u.name}" (${u.username})? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/auth/users?id=${u.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        alert('✅ User deleted successfully.');
        fetchUsers();
      } else {
        alert(`❌ Error: ${data.error || 'Could not delete user.'}`);
      }
    } catch (err) {
      alert('❌ Network error while deleting user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role.toUpperCase() === roleFilter.toUpperCase();
    return matchesSearch && matchesRole;
  });

  const totalAdmins = users.filter(u => u.role === 'Admin').length;
  const activeUsers = users.filter(u => u.status === 'Active').length;
  const inactiveUsers = users.length - activeUsers;

  return (
    <main className="main-content" style={{ background: theme === 'light' ? '#f8fafc' : '#020617', minHeight: '100vh', padding: '2rem', transition: 'background 0.3s ease' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', paddingBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: theme === 'light' ? '#fffbeb' : 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', padding: '0.3rem 0.8rem', borderRadius: '20px', color: '#d97706', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            <span>👥</span> ACCESS CONTROL &amp; SECURITY
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
            User Management Portal
          </h1>
          <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Configure executive permissions, add staff logins, and manage ERP security roles.
          </p>
        </div>

        <button
          onClick={handleAddOpen}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            padding: '0.85rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          <span>➕</span> Create New User
        </button>
      </header>

      {/* Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '1.5rem', borderRadius: '18px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Registered Users</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', margin: '0.5rem 0 0 0' }}>{users.length}</h3>
        </div>

        <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '1.5rem', borderRadius: '18px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Executive Administrators</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', margin: '0.5rem 0 0 0' }}>{totalAdmins}</h3>
        </div>

        <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '1.5rem', borderRadius: '18px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Active Logins</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981', margin: '0.5rem 0 0 0' }}>{activeUsers}</h3>
        </div>

        <div style={{ background: theme === 'light' ? 'white' : '#0f172a', padding: '1.5rem', borderRadius: '18px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Suspended Accounts</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ef4444', margin: '0.5rem 0 0 0' }}>{inactiveUsers}</h3>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', background: theme === 'light' ? 'white' : '#0f172a', padding: '1rem', borderRadius: '16px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
        <div style={{ flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: theme === 'light' ? '#f1f5f9' : '#1e293b', padding: '0.65rem 1rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '1.1rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: theme === 'light' ? '#0f172a' : '#f8fafc', fontSize: '0.9rem', fontWeight: 600 }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155',
            background: theme === 'light' ? 'white' : '#1e293b',
            color: theme === 'light' ? '#0f172a' : '#f8fafc',
            fontWeight: 700,
            fontSize: '0.85rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="ALL">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="TOUR MANAGER">Tour Manager</option>
          <option value="STAFF">Staff</option>
          <option value="AGENT">Agent</option>
          <option value="RECEPTION">Reception</option>
        </select>
      </div>

      {/* Users Table */}
      <div style={{ background: theme === 'light' ? 'white' : '#0f172a', borderRadius: '20px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
            ⏳ Loading User Accounts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🙅‍♂️</div>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>No matching user accounts found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b', borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '1.25rem 1.5rem' }}>User Profile</th>
                <th style={{ padding: '1.25rem 1.5rem' }}>Login Username</th>
                <th style={{ padding: '1.25rem 1.5rem' }}>Role Permission</th>
                <th style={{ padding: '1.25rem 1.5rem' }}>Account Status</th>
                <th style={{ padding: '1.25rem 1.5rem' }}>Created On</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => {
                const isAdmin = u.role === 'Admin' || u.username.toLowerCase() === 'godwinhotels';
                return (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: idx === filteredUsers.length - 1 ? 'none' : theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          background: isAdmin ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0
                        }}>
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: theme === 'light' ? '#0f172a' : '#f8fafc' }}>{u.name}</p>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ background: theme === 'light' ? '#f1f5f9' : '#1e293b', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: theme === 'light' ? '#334155' : '#e2e8f0', fontFamily: 'monospace' }}>
                        @{u.username}
                      </span>
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{
                        padding: '0.35rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isAdmin ? '#d97706' : '#3b82f6',
                        border: isAdmin ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                      }}>
                        {isAdmin ? '👑 ADMIN' : u.role.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: u.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: u.status === 'Active' ? '#10b981' : '#ef4444'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.status === 'Active' ? '#10b981' : '#ef4444' }} />
                        {u.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                      {u.createdAt || '2026-07-27'}
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEditOpen(u)}
                          title="Edit User Profile & Permissions"
                          style={{
                            background: theme === 'light' ? '#eff6ff' : 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.5rem 0.8rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span>✏️</span> Edit
                        </button>

                        {u.id !== 'admin-001' && u.username.toLowerCase() !== 'godwinhotels' && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User Account"
                            style={{
                              background: theme === 'light' ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '0.5rem 0.8rem',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span>🗑️</span> Delete
                          </button>
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

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: theme === 'light' ? 'white' : '#0f172a', width: '100%', maxWidth: '520px', borderRadius: '24px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>➕ Add New User Account</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>Grant executive or operational permissions</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem' }}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {formError && <div style={{ background: 'rgba(239, 68, 68, 0.15)', borderLeft: '4px solid #ef4444', padding: '0.75rem', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>⚠️ {formError}</div>}
              {formSuccess && <div style={{ background: 'rgba(16, 185, 129, 0.15)', borderLeft: '4px solid #10b981', padding: '0.75rem', borderRadius: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>✅ {formSuccess}</div>}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Full Name *</label>
                <input
                  type="text" required placeholder="e.g. Rahul Sharma"
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Username *</label>
                  <input
                    type="text" required placeholder="rahul.godwin"
                    value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Email Address *</label>
                  <input
                    type="email" required placeholder="rahul@godwinhotels.com"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Login Password *</label>
                <input
                  type="password" required placeholder="Enter secure password"
                  value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Role Permission *</label>
                  <select
                    value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Tour Manager">Tour Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Agent">Agent</option>
                    <option value="Reception">Reception</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Status *</label>
                  <select
                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.8rem 2rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.3)' }}>
                  {isSubmitting ? 'Creating Account...' : '✔️ Save & Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: theme === 'light' ? 'white' : '#0f172a', width: '100%', maxWidth: '520px', borderRadius: '24px', border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>✏️ Edit Account: {editingUser.name}</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>Update role permissions or reset credentials</p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {formError && <div style={{ background: 'rgba(239, 68, 68, 0.15)', borderLeft: '4px solid #ef4444', padding: '0.75rem', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>⚠️ {formError}</div>}
              {formSuccess && <div style={{ background: 'rgba(16, 185, 129, 0.15)', borderLeft: '4px solid #10b981', padding: '0.75rem', borderRadius: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>✅ {formSuccess}</div>}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Full Name *</label>
                <input
                  type="text" required placeholder="e.g. Rahul Sharma"
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Username *</label>
                  <input
                    type="text" required placeholder="rahul.godwin"
                    value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Email Address *</label>
                  <input
                    type="email" required placeholder="rahul@godwinhotels.com"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>New Password <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>(Leave blank to keep existing)</span></label>
                <input
                  type="password" placeholder="Enter new password if resetting"
                  value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Role Permission *</label>
                  <select
                    value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Tour Manager">Tour Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Agent">Agent</option>
                    <option value="Reception">Reception</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Status *</label>
                  <select
                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: theme === 'light' ? '#f8fafc' : '#1e293b', color: theme === 'light' ? '#0f172a' : 'white', fontSize: '0.95rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.8rem 2rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}>
                  {isSubmitting ? 'Saving Changes...' : '✔️ Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
