import React from 'react';
import { getFairnessDashboard, getAgentPerformance } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { FairnessDashboard } from '../types';

const FairnessPage: React.FC = () => {
  const { data: fairness, loading } = useApi<FairnessDashboard>(() => getFairnessDashboard());
  const { data: agentPerf } = useApi(() => getAgentPerformance());

  if (loading) return <Loading />;
  if (!fairness) return <div className="empty-state"><p>No data available</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Responsible AI — Fairness & Bias</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Candidates Audited</div>
          <div className="stat-value">{fairness.total_candidates_audited}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Probes Run</div>
          <div className="stat-value">{fairness.total_probes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bias Flags</div>
          <div className="stat-value" style={{ color: fairness.total_flags > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {fairness.total_flags}
          </div>
          <div className="stat-sub">Flag rate: {(fairness.flag_rate * 100).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PII Detected</div>
          <div className="stat-value">{fairness.pii_detected_count}</div>
          <div className="stat-sub">candidates with PII</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Adversarial Injection</div>
          <div className="stat-value" style={{ color: fairness.adversarial_test_results.pass_rate >= 0.9 ? 'var(--success)' : 'var(--danger)' }}>
            {(fairness.adversarial_test_results.pass_rate * 100).toFixed(0)}%
          </div>
          <div className="stat-sub">pass rate ({fairness.adversarial_test_results.total} tests)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h2>Probe Statistics by Type</h2></div>
          <div className="card-body">
            {fairness.probe_stats.length > 0 ? (
              <table>
                <thead><tr><th>Probe Type</th><th>Total</th><th>Flagged</th><th>Avg Delta</th></tr></thead>
                <tbody>
                  {fairness.probe_stats.map((ps, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-info">{ps.probe_type.replace(/_/g, ' ')}</span></td>
                      <td>{ps.total}</td>
                      <td style={{ color: ps.flagged > 0 ? 'var(--danger)' : 'inherit', fontWeight: ps.flagged > 0 ? 600 : 400 }}>{ps.flagged}</td>
                      <td>{ps.avg_delta !== null ? `${(ps.avg_delta * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: 'var(--gray-400)' }}>No probes run yet</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Score Distribution</h2></div>
          <div className="card-body">
            {Object.entries(fairness.score_distribution).map(([range, count]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ width: 60, fontSize: '0.8rem' }}>{range}</span>
                <div style={{ flex: 1, height: 24, background: 'var(--gray-100)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 4, minWidth: count > 0 ? 30 : 0,
                    width: `${Math.min(100, count * 20)}%`,
                    background: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {count > 0 ? count : ''}
                  </div>
                </div>
                <span style={{ width: 30, fontWeight: 600, fontSize: '0.875rem' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Top Flagged Scenarios</h2></div>
          <div className="card-body">
            {fairness.top_flagged_scenarios.length > 0 ? (
              <table>
                <thead><tr><th>Scenario</th><th>Occurrences</th><th>Avg Delta</th></tr></thead>
                <tbody>
                  {fairness.top_flagged_scenarios.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.8rem' }}>{s.scenario}</td>
                      <td>{s.count}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{(s.avg_delta * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: 'var(--gray-400)' }}>No flags yet — great!</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Agent Performance</h2></div>
          <div className="card-body">
            {agentPerf?.agents?.length > 0 ? (
              <table>
                <thead><tr><th>Agent</th><th>Runs</th><th>Success</th><th>Failed</th><th>Avg Duration</th></tr></thead>
                <tbody>
                  {agentPerf.agents.map((a: any, i: number) => (
                    <tr key={i}>
                      <td><span className="badge badge-info">{a.agent_type}</span></td>
                      <td>{a.total}</td>
                      <td style={{ color: 'var(--success)' }}>{a.completed}</td>
                      <td style={{ color: a.failed > 0 ? 'var(--danger)' : 'inherit' }}>{a.failed}</td>
                      <td>{a.avg_duration ? `${a.avg_duration.toFixed(1)}s` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: 'var(--gray-400)' }}>No agent executions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FairnessPage;
