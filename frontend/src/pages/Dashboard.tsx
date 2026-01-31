import React from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { DashboardStats } from '../types';

const Dashboard: React.FC = () => {
  const { data: stats, loading, error } = useApi<DashboardStats>(() => getDashboardStats());

  if (loading) return <Loading />;
  if (error || !stats) return (
    <div className="empty-state">
      <p>Failed to load dashboard</p>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>{error}</p>}
    </div>
  );

  const stageOrder = ['new', 'parsing', 'parsed', 'guardrail_check', 'scoring', 'scored', 'summarized', 'bias_audit', 'reviewed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/candidates" className="btn btn-primary">View All Candidates</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Open Jobs</div>
          <div className="stat-value">{stats.open_jobs}</div>
          <div className="stat-sub">{stats.total_jobs} total positions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Candidates</div>
          <div className="stat-value">{stats.total_candidates}</div>
          <div className="stat-sub">{stats.candidates_reviewed} reviewed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shortlisted</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.candidates_shortlisted}</div>
          <div className="stat-sub">{stats.candidates_rejected} rejected</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">{(stats.avg_score * 100).toFixed(0)}%</div>
          <div className="stat-sub">across all candidates</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bias Flags</div>
          <div className="stat-value" style={{ color: stats.bias_flags_count > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {stats.bias_flags_count}
          </div>
          <div className="stat-sub">
            <Link to="/fairness">View fairness report</Link>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2>Pipeline Distribution</h2>
          </div>
          <div className="card-body">
            {stageOrder.map(stage => {
              const count = stats.pipeline_stages[stage] || 0;
              if (count === 0) return null;
              const pct = stats.total_candidates ? (count / stats.total_candidates) * 100 : 0;
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ width: 100, fontSize: '0.8rem', color: 'var(--gray-600)' }}>{stage.replace(/_/g, ' ')}</span>
                  <div style={{ flex: 1, height: 20, background: 'var(--gray-100)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${pct}%`,
                      background: stage === 'rejected' ? 'var(--danger)' : stage === 'hired' ? 'var(--success)' : 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '0.7rem', fontWeight: 600,
                    }}>
                      {count > 0 ? count : ''}
                    </div>
                  </div>
                  <span style={{ width: 30, textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{count}</span>
                </div>
              );
            })}
            {stats.total_candidates === 0 && <div className="empty-state"><p>No candidates yet</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="card-body">
            {stats.recent_activity.length === 0 ? (
              <div className="empty-state"><p>No recent activity</p></div>
            ) : (
              stats.recent_activity.slice(0, 10).map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" style={{
                    background: a.event_type === 'bias_flag' ? 'var(--danger)' :
                               a.event_type === 'agent_completed' ? 'var(--success)' : 'var(--primary-light)'
                  }} />
                  <div className="activity-content">
                    <div className="activity-message">{a.message}</div>
                    <div className="activity-time">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
