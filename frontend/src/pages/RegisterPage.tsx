import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', password: '', password_confirm: '',
    first_name: '', last_name: '', role: 'candidate',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
      <div className="card" style={{ width: 480, maxWidth: '90vw' }}>
        <div className="card-header" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>FAIRHire</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Create your account</p>
        </div>
        <div className="card-body">
          {error && <div style={{ padding: '0.75rem', background: '#fef2f2', color: 'var(--danger)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>First Name</label>
                <input className="form-control" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Last Name</label>
                <input className="form-control" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input className="form-control" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Password *</label>
                <input type="password" className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Confirm Password *</label>
                <input type="password" className="form-control" value={form.password_confirm} onChange={e => setForm({ ...form, password_confirm: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="candidate">Candidate</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: '0.25rem 0 0' }}>
                HR, Interviewer, and Admin roles must be assigned by an administrator.
              </p>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
