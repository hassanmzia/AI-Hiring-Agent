import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getJobs, getDepartments, createJob, createDepartment } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { JobPosition, Department, PaginatedResponse } from '../types';

const JobsPage: React.FC = () => {
  const { data: jobsData, loading, refetch } = useApi<PaginatedResponse<JobPosition>>(() => getJobs());
  const { data: deptsData } = useApi<PaginatedResponse<Department>>(() => getDepartments());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', department: '', description: '', requirements: '', nice_to_have: '',
    experience_level: 'mid', min_experience_years: 2, max_experience_years: 10,
    location: '', is_remote: false, salary_min: '', salary_max: '', status: 'open',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createJob({
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
      } as any);
      setShowForm(false);
      refetch();
    } catch (err) {
      alert('Failed to create job');
    }
  };

  if (loading) return <Loading />;

  const jobs = jobsData?.results || [];
  const departments = deptsData?.results || [];

  return (
    <div>
      <div className="page-header">
        <h1>Job Positions</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Position</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Job Position</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Job Title</label>
                  <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select className="form-control" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required>
                      <option value="">Select...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Experience Level</label>
                    <select className="form-control" value={form.experience_level} onChange={e => setForm({ ...form, experience_level: e.target.value })}>
                      <option value="entry">Entry</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                      <option value="principal">Principal</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Requirements (comma-separated skills)</label>
                  <textarea className="form-control" value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Min Experience (years)</label>
                    <input type="number" className="form-control" value={form.min_experience_years} onChange={e => setForm({ ...form, min_experience_years: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label>Max Experience (years)</label>
                    <input type="number" className="form-control" value={form.max_experience_years} onChange={e => setForm({ ...form, max_experience_years: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
                    <input type="checkbox" checked={form.is_remote} onChange={e => setForm({ ...form, is_remote: e.target.checked })} />
                    <label>Remote</label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Salary Min ($)</label>
                    <input type="number" className="form-control" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Salary Max ($)</label>
                    <input type="number" className="form-control" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
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
                <th>Position</th>
                <th>Department</th>
                <th>Level</th>
                <th>Status</th>
                <th>Candidates</th>
                <th>Reviewed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td><Link to={`/jobs/${job.id}`} style={{ fontWeight: 500 }}>{job.title}</Link></td>
                  <td>{job.department_name}</td>
                  <td><span className="badge badge-info">{job.experience_level}</span></td>
                  <td><span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-gray'}`}>{job.status}</span></td>
                  <td>{job.candidates_count}</td>
                  <td>{job.candidates_reviewed}</td>
                  <td>{new Date(job.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>No jobs created yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobsPage;
