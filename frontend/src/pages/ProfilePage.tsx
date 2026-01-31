import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  updateProfile, uploadProfilePicture, changePassword,
  setupMfa, verifyMfa, disableMfa,
} from '../services/api';

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<'profile' | 'password' | 'mfa'>('profile');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Profile form
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '',
    email: user?.email || '', phone: user?.phone || '',
    title: user?.title || '', department: user?.department || '', bio: user?.bio || '',
  });

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', new_password_confirm: '' });

  // MFA
  const [mfaData, setMfaData] = useState<{ secret?: string; qr_code?: string; backup_codes?: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  if (!user) return null;

  const handleProfileSave = async () => {
    setError(''); setMsg('');
    try {
      await updateProfile(profileForm);
      await refreshUser();
      setMsg('Profile updated');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update');
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setMsg('');
    try {
      await uploadProfilePicture(file);
      await refreshUser();
      setMsg('Profile picture updated');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to upload');
    }
  };

  const handlePasswordChange = async () => {
    setError(''); setMsg('');
    try {
      await changePassword(pwForm);
      setPwForm({ current_password: '', new_password: '', new_password_confirm: '' });
      setMsg('Password changed successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed');
    }
  };

  const handleMfaSetup = async () => {
    setError(''); setMsg('');
    try {
      const data = await setupMfa();
      setMfaData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'MFA setup failed');
    }
  };

  const handleMfaVerify = async () => {
    setError(''); setMsg('');
    try {
      const data = await verifyMfa(mfaCode);
      setMfaData({ ...mfaData, backup_codes: data.backup_codes });
      await refreshUser();
      setMsg('MFA enabled! Save your backup codes.');
      setMfaCode('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid code');
    }
  };

  const handleMfaDisable = async () => {
    setError(''); setMsg('');
    try {
      await disableMfa(disablePassword);
      setMfaData(null);
      setDisablePassword('');
      await refreshUser();
      setMsg('MFA disabled');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed');
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'badge-danger', hr: 'badge-info', interviewer: 'badge-warning',
      hiring_manager: 'badge-warning', candidate: 'badge-success', viewer: 'badge-gray',
    };
    return <span className={`badge ${colors[role] || 'badge-gray'}`}>{user.role_display}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {user.full_name} &middot; {roleBadge(user.role)}
          </p>
        </div>
      </div>

      {msg && <div style={{ padding: '0.75rem', background: '#f0fdf4', color: 'var(--success)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{msg}</div>}
      {error && <div style={{ padding: '0.75rem', background: '#fef2f2', color: 'var(--danger)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {(['profile', 'password', 'mfa'] as const).map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setMsg(''); setError(''); }}>
            {t === 'profile' ? 'Profile' : t === 'password' ? 'Change Password' : 'MFA Security'}
          </div>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%', margin: '0 auto 1rem',
                background: 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', fontSize: '2.5rem', color: 'var(--gray-500)',
              }}>
                {user.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                Upload Photo
                <input type="file" accept="image/*" onChange={handlePictureUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Personal Information</h2></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>First Name</label>
                  <input className="form-control" value={profileForm.first_name} onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Last Name</label>
                  <input className="form-control" value={profileForm.last_name} onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-control" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Title</label>
                  <input className="form-control" value={profileForm.title} onChange={e => setProfileForm({ ...profileForm, title: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Department</label>
                  <input className="form-control" value={profileForm.department} onChange={e => setProfileForm({ ...profileForm, department: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea className="form-control" rows={3} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={handleProfileSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div className="card-header"><h2>Change Password</h2></div>
          <div className="card-body">
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" className="form-control" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-control" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" className="form-control" value={pwForm.new_password_confirm} onChange={e => setPwForm({ ...pwForm, new_password_confirm: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={handlePasswordChange}
              disabled={!pwForm.current_password || !pwForm.new_password}>Change Password</button>
          </div>
        </div>
      )}

      {tab === 'mfa' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header">
            <h2>Multi-Factor Authentication (MFA)</h2>
            <span className={`badge ${user.mfa_enabled ? 'badge-success' : 'badge-gray'}`}>
              {user.mfa_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="card-body">
            {!user.mfa_enabled && !mfaData && (
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                  Add an extra layer of security with a TOTP authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <button className="btn btn-primary" onClick={handleMfaSetup}>Setup MFA</button>
              </div>
            )}

            {!user.mfa_enabled && mfaData && !mfaData.backup_codes && (
              <div>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Scan this QR code with your authenticator app:</p>
                {mfaData.qr_code && <img src={mfaData.qr_code} alt="MFA QR" style={{ margin: '1rem 0', maxWidth: 250 }} />}
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                  Or manually enter: <code style={{ background: 'var(--gray-100)', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{mfaData.secret}</code>
                </p>
                <div className="form-group">
                  <label>Enter the 6-digit code from your app to verify:</label>
                  <input className="form-control" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                    placeholder="123456" maxLength={6} style={{ maxWidth: 200 }} />
                </div>
                <button className="btn btn-primary" onClick={handleMfaVerify} disabled={mfaCode.length < 6}>Verify & Enable</button>
              </div>
            )}

            {mfaData?.backup_codes && (
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  MFA enabled successfully!
                </p>
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Save these backup codes in a safe place. Each code can only be used once:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                  {mfaData.backup_codes.map((code, i) => (
                    <code key={i} style={{ background: 'var(--gray-100)', padding: '0.5rem', textAlign: 'center', borderRadius: 4, fontSize: '0.85rem' }}>{code}</code>
                  ))}
                </div>
              </div>
            )}

            {user.mfa_enabled && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Disable MFA</h3>
                <div className="form-group">
                  <label>Enter your password to disable MFA:</label>
                  <input type="password" className="form-control" value={disablePassword}
                    onChange={e => setDisablePassword(e.target.value)} style={{ maxWidth: 300 }} />
                </div>
                <button className="btn btn-danger" onClick={handleMfaDisable} disabled={!disablePassword}>Disable MFA</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
