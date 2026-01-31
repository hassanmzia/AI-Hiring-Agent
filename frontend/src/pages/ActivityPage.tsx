import React from 'react';
import { Link } from 'react-router-dom';
import { getActivity } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { ActivityLog, PaginatedResponse } from '../types';

const EVENT_COLORS: Record<string, string> = {
  candidate_created: 'var(--primary-light)',
  stage_changed: 'var(--warning)',
  agent_completed: 'var(--success)',
  bias_flag: 'var(--danger)',
  interview_scheduled: '#8b5cf6',
  decision_made: 'var(--primary-dark)',
};

const ActivityPage: React.FC = () => {
  const { data, loading } = useApi<PaginatedResponse<ActivityLog>>(() => getActivity());

  if (loading) return <Loading />;

  const activities = data?.results || [];

  return (
    <div>
      <div className="page-header">
        <h1>Activity Feed</h1>
      </div>

      <div className="card">
        <div className="card-body">
          {activities.length === 0 ? (
            <div className="empty-state"><p>No activity yet</p></div>
          ) : (
            activities.map(a => (
              <div key={a.id} className="activity-item">
                <div className="activity-dot" style={{ background: EVENT_COLORS[a.event_type] || 'var(--gray-400)' }} />
                <div className="activity-content">
                  <div className="activity-message">
                    <span className="badge badge-gray" style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}>
                      {a.event_type.replace(/_/g, ' ')}
                    </span>
                    {a.message}
                    {a.candidate && (
                      <Link to={`/candidates/${a.candidate}`} style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        {a.candidate_name || 'View'}
                      </Link>
                    )}
                  </div>
                  <div className="activity-time">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
