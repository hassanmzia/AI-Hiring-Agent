import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form.username, form.password, mfaRequired ? mfaCode : undefined);
      if (result?.mfa_required) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
      <div className="card" style={{ width: 420, maxWidth: '90vw' }}>
        <div className="card-header" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>FAIRHire</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>AI-Powered Responsible Hiring</p>
        </div>
        <div className="card-body">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Sign In</h2>
          {error && <div style={{ padding: '0.75rem', background: '#fef2f2', color: 'var(--danger)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username or Email</label>
              <input className="form-control" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoFocus required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            {mfaRequired && (
              <div className="form-group">
                <label>MFA Code</label>
                <input className="form-control" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code from authenticator app" autoFocus required />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--primary)' }}>Register</Link>
          </div>
          <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--gray-400)' }}>
            Default: admin / admin
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
