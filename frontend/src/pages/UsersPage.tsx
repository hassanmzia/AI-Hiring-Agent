import React, { useState, useEffect } from 'react';
import { getUsersWithRoles, updateUserRole } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Loading from '../components/Loading';

interface UserWithRole {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  is_active: boolean;
  mfa_enabled: boolean;
  profile_picture_url: string | null;
  date_joined: string;
}

const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'hr', label: 'HR Official' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'interviewer', label: 'Interviewer' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'viewer', label: 'Viewer' },
];

const UsersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const loadUsers = async () => {
    try {
      const data = await getUsersWithRoles();
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await updateUserRole(userId, { role });
      setMsg(`Role updated`);
      loadUsers();
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Failed to update role'); }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await updateUserRole(userId, { is_active: !isActive });
      loadUsers();
    } catch { /* ignore */ }
  };

  if (!isAdmin) return <div className="empty-state"><p>Access denied. Admin only.</p></div>;
  if (loading) return <Loading />;

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'badge-danger', hr: 'badge-info', interviewer: 'badge-warning',
      hiring_manager: 'badge-warning', candidate: 'badge-success', viewer: 'badge-gray',
    };
    return colors[role] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <span className="badge badge-info">{users.length} users</span>
      </div>

      {msg && <div style={{ padding: '0.75rem', background: '#f0fdf4', color: 'var(--success)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{msg}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>MFA</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-200)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', overflow: 'hidden',
                      }}>
                        {u.profile_picture_url ? (
                          <img src={u.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{u.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                  <td>
                    <select className="form-control" value={u.role} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto' }}
                      onChange={e => handleRoleChange(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.mfa_enabled ? 'badge-success' : 'badge-gray'}`}>
                      {u.mfa_enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(u.date_joined).toLocaleDateString()}</td>
                  <td>
                    <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => handleToggleActive(u.id, u.is_active)} style={{ fontSize: '0.75rem' }}>
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
