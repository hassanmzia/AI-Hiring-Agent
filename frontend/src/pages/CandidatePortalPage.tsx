import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCandidateProfile, updateCandidateProfile, uploadCandidateResume } from '../services/api';
import Loading from '../components/Loading';
import type { Candidate } from '../types';

const CandidatePortalPage: React.FC = () => {
  const { user, isCandidate } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const loadProfile = async () => {
    try {
      const data = await getCandidateProfile();
      setCandidate(data);
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
      });
    } catch {
      setError('No linked candidate record found. Contact HR to link your account.');
    }
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    setError(''); setMsg('');
    try {
      const data = await updateCandidateProfile(form);
      setCandidate(data);
      setEditMode(false);
      setMsg('Profile updated');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update');
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setMsg('');
    try {
      const data = await uploadCandidateResume(file);
      setCandidate(data.candidate);
      setMsg('Resume uploaded successfully');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed');
    }
  };

  if (!isCandidate) return <div className="empty-state"><p>This page is for candidate accounts only.</p></div>;
  if (loading) return <Loading />;
  if (error && !candidate) return <div className="empty-state"><p>{error}</p></div>;
  if (!candidate) return <div className="empty-state"><p>No candidate record found.</p></div>;

  const c = candidate;

  const statusColor = (stage: string) =>
    stage === 'hired' ? 'badge-success' : stage === 'rejected' ? 'badge-danger' :
    stage.includes('offer') ? 'badge-info' : stage.includes('interview') ? 'badge-warning' : 'badge-gray';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Application</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {c.job_title} &middot; <span className={`badge ${statusColor(c.stage)}`}>{c.stage.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </div>

      {msg && <div style={{ padding: '0.75rem', background: '#f0fdf4', color: 'var(--success)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{msg}</div>}
      {error && <div style={{ padding: '0.75rem', background: '#fef2f2', color: 'var(--danger)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Personal Info */}
        <div className="card">
          <div className="card-header">
            <h2>Personal Information</h2>
            {!editMode && <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>Edit</button>}
          </div>
          <div className="card-body">
            {editMode ? (
              <>
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
                  <label>Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <InfoRow label="Name" value={`${c.first_name} ${c.last_name}`.trim()} />
                <InfoRow label="Email" value={c.email} />
                <InfoRow label="Phone" value={c.phone} />
                <InfoRow label="Experience" value={c.experience_years ? `${c.experience_years} years` : 'N/A'} />
              </>
            )}
          </div>
        </div>

        {/* Application Status */}
        <div className="card">
          <div className="card-header"><h2>Application Status</h2></div>
          <div className="card-body">
            <InfoRow label="Position" value={c.job_title} />
            <InfoRow label="Stage" value={c.stage.replace(/_/g, ' ')} />
            {c.overall_score !== null && <InfoRow label="Score" value={`${(c.overall_score * 100).toFixed(0)}%`} />}
            {c.suggested_action && <InfoRow label="Status" value={c.suggested_action} />}
            {c.final_recommendation && <InfoRow label="Final Decision" value={c.final_recommendation} />}
            <InfoRow label="Applied" value={new Date(c.created_at).toLocaleDateString()} />
          </div>
        </div>

        {/* Resume */}
        <div className="card">
          <div className="card-header"><h2>Resume</h2></div>
          <div className="card-body">
            {c.resume_text ? (
              <div style={{ maxHeight: 300, overflow: 'auto', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.8rem', whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                {c.resume_text.substring(0, 2000)}{c.resume_text.length > 2000 ? '...' : ''}
              </div>
            ) : (
              <p style={{ color: 'var(--gray-400)', marginBottom: '1rem' }}>No resume on file.</p>
            )}
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              {c.resume_text ? 'Replace Resume' : 'Upload Resume'}
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleResumeUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Interviews */}
        <div className="card">
          <div className="card-header"><h2>My Interviews</h2></div>
          <div className="card-body">
            {(c.interviews_summary || []).length === 0 ? (
              <p style={{ color: 'var(--gray-400)' }}>No interviews scheduled yet.</p>
            ) : (
              <table>
                <thead><tr><th>Type</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {c.interviews_summary.map(i => (
                    <tr key={i.id}>
                      <td>{i.interview_type.replace(/_/g, ' ')}</td>
                      <td style={{ fontSize: '0.8rem' }}>{i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : 'TBD'}</td>
                      <td><span className={`badge ${i.status === 'completed' ? 'badge-success' : i.status === 'scheduled' ? 'badge-info' : 'badge-gray'}`}>{i.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Offers */}
        {(c.offers_summary || []).length > 0 && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><h2>My Offers</h2></div>
            <div className="card-body">
              <table>
                <thead><tr><th>Salary</th><th>Type</th><th>Status</th><th>Sent</th></tr></thead>
                <tbody>
                  {c.offers_summary.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>${Number(o.salary).toLocaleString()}</td>
                      <td>{o.employment_type.replace(/_/g, ' ')}</td>
                      <td><span className={`badge ${o.status === 'accepted' ? 'badge-success' : o.status === 'sent' ? 'badge-info' : 'badge-gray'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontSize: '0.8rem' }}>{o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
    <span style={{ width: 110, fontSize: '0.8rem', color: 'var(--gray-500)' }}>{label}</span>
    <span style={{ fontSize: '0.875rem' }}>{value || '-'}</span>
  </div>
);

export default CandidatePortalPage;
