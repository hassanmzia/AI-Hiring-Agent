import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJob, getCandidates, getJobPipelineStats, bulkEvaluateJob } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import StageBadge from '../components/StageBadge';
import ScoreBar from '../components/ScoreBar';
import type { JobPosition, Candidate, PaginatedResponse } from '../types';

const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: job, loading } = useApi<JobPosition>(() => getJob(id!), [id]);
  const { data: candidatesData, refetch: refetchCandidates } = useApi<PaginatedResponse<Candidate>>(
    () => getCandidates({ job_position: id! }), [id]
  );
  const { data: pipelineStats, refetch: refetchStats } = useApi(() => getJobPipelineStats(id!), [id]);
  const [evaluating, setEvaluating] = useState(false);

  const handleBulkEvaluate = async () => {
    setEvaluating(true);
    try {
      await bulkEvaluateJob(id!);
      alert('Evaluation pipeline started for all new candidates. Refresh to see progress.');
      setTimeout(() => { refetchCandidates(); refetchStats(); }, 3000);
    } catch (err) {
      alert('Failed to start evaluation');
    } finally {
      setEvaluating(false);
    }
  };

  if (loading || !job) return <Loading />;

  const candidates = candidatesData?.results || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/jobs" style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Jobs</Link>
          <h1>{job.title}</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {job.department_name} · {job.experience_level} · {job.location || 'Remote'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={handleBulkEvaluate} disabled={evaluating}>
            {evaluating ? 'Starting...' : 'Evaluate All New'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Candidates</div>
          <div className="stat-value">{candidates.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">{pipelineStats ? `${(pipelineStats.average_score * 100).toFixed(0)}%` : 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Salary Range</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            {job.salary_min && job.salary_max ? `$${(job.salary_min / 1000).toFixed(0)}k - $${(job.salary_max / 1000).toFixed(0)}k` : 'Not set'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value">
            <span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-gray'}`}>{job.status}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h2>Description</h2></div>
          <div className="card-body"><p>{job.description}</p></div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Requirements</h2></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {job.requirements.split(',').map((r, i) => (
                <span key={i} className="badge badge-info">{r.trim()}</span>
              ))}
            </div>
            {job.nice_to_have && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Nice to have:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                  {job.nice_to_have.split(',').map((r, i) => (
                    <span key={i} className="badge badge-gray">{r.trim()}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Candidates ({candidates.length})</h2>
          <Link to={`/candidates?job_position=${id}`} className="btn btn-outline btn-sm">View All</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Action</th>
                <th>Guardrails</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/candidates/${c.id}`} style={{ fontWeight: 500 }}>{c.full_name || 'Unknown'}</Link></td>
                  <td><StageBadge stage={c.stage} /></td>
                  <td><ScoreBar score={c.overall_score} /></td>
                  <td>{c.confidence !== null ? `${(c.confidence * 100).toFixed(0)}%` : '-'}</td>
                  <td>
                    {c.suggested_action ? (
                      <span className={`badge ${c.suggested_action === 'Accept' ? 'badge-success' : c.suggested_action === 'Reject' ? 'badge-danger' : 'badge-warning'}`}>
                        {c.suggested_action}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {c.guardrail_passed === true ? <span className="badge badge-success">Passed</span> :
                     c.guardrail_passed === false ? <span className="badge badge-danger">Failed</span> : '-'}
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>No candidates yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;
