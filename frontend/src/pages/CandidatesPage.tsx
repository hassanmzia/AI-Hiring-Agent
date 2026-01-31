import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCandidates, getJobs, createCandidate } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import StageBadge from '../components/StageBadge';
import ScoreBar from '../components/ScoreBar';
import type { Candidate, JobPosition, PaginatedResponse } from '../types';

const CandidatesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const jobFilter = searchParams.get('job_position') || '';
  const stageFilter = searchParams.get('stage') || '';

  const params: Record<string, string> = {};
  if (jobFilter) params.job_position = jobFilter;
  if (stageFilter) params.stage = stageFilter;

  const { data: candidatesData, loading, refetch } = useApi<PaginatedResponse<Candidate>>(
    () => getCandidates(params), [jobFilter, stageFilter]
  );
  const { data: jobsData } = useApi<PaginatedResponse<JobPosition>>(() => getJobs());
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ job_position: '', resume_text: '', first_name: '', last_name: '', email: '' });
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('job_position', uploadForm.job_position);
    fd.append('first_name', uploadForm.first_name);
    fd.append('last_name', uploadForm.last_name);
    fd.append('email', uploadForm.email);
    if (file) {
      fd.append('resume_file', file);
    } else if (uploadForm.resume_text) {
      fd.append('resume_text', uploadForm.resume_text);
    }
    try {
      await createCandidate(fd);
      setShowUpload(false);
      setUploadForm({ job_position: '', resume_text: '', first_name: '', last_name: '', email: '' });
      setFile(null);
      refetch();
    } catch (err) {
      alert('Failed to create candidate');
    }
  };

  if (loading) return <Loading />;

  const candidates = candidatesData?.results || [];
  const jobs = jobsData?.results || [];

  return (
    <div>
      <div className="page-header">
        <h1>Candidates</h1>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>Upload Candidate</button>
      </div>

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Candidate</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowUpload(false)}>Close</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Job Position</label>
                  <select className="form-control" value={uploadForm.job_position} onChange={e => setUploadForm({ ...uploadForm, job_position: e.target.value })} required>
                    <option value="">Select position...</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input className="form-control" value={uploadForm.first_name} onChange={e => setUploadForm({ ...uploadForm, first_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input className="form-control" value={uploadForm.last_name} onChange={e => setUploadForm({ ...uploadForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="form-control" value={uploadForm.email} onChange={e => setUploadForm({ ...uploadForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Resume File (PDF, DOCX, TXT)</label>
                  <input type="file" className="form-control" accept=".pdf,.docx,.txt,.json" onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>
                <div className="form-group">
                  <label>Or paste resume text</label>
                  <textarea className="form-control" rows={6} value={uploadForm.resume_text} onChange={e => setUploadForm({ ...uploadForm, resume_text: e.target.value })} placeholder="Paste resume content here..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Candidate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Action</th>
                <th>Guardrails</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/candidates/${c.id}`} style={{ fontWeight: 500 }}>{c.full_name || c.email || 'Unknown'}</Link></td>
                  <td>{c.job_title}</td>
                  <td><StageBadge stage={c.stage} /></td>
                  <td><ScoreBar score={c.overall_score} /></td>
                  <td>
                    {c.suggested_action ? (
                      <span className={`badge ${c.suggested_action === 'Accept' ? 'badge-success' : c.suggested_action === 'Reject' ? 'badge-danger' : 'badge-warning'}`}>
                        {c.suggested_action}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {c.guardrail_passed === true ? <span className="badge badge-success">Pass</span> :
                     c.guardrail_passed === false ? <span className="badge badge-danger">Fail</span> : '-'}
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>No candidates found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CandidatesPage;
