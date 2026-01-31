import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCandidate, evaluateCandidate, runAgent, reviewCandidate, updateCandidateStage } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import StageBadge from '../components/StageBadge';
import ScoreBar from '../components/ScoreBar';
import type { Candidate } from '../types';

const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: candidate, loading, refetch } = useApi<Candidate>(() => getCandidate(id!), [id]);
  const [activeTab, setActiveTab] = useState('overview');
  const [running, setRunning] = useState('');
  const [reviewForm, setReviewForm] = useState({ notes: '', decision: '' });

  const handleRunPipeline = async () => {
    setRunning('pipeline');
    try {
      await evaluateCandidate(id!);
      alert('Evaluation pipeline started. Refresh to see progress.');
      setTimeout(refetch, 5000);
    } catch (err) { alert('Failed to start pipeline'); }
    finally { setRunning(''); }
  };

  const handleRunAgent = async (agentType: string) => {
    setRunning(agentType);
    try {
      await runAgent(id!, agentType);
      alert(`${agentType} agent started. Refresh to see results.`);
      setTimeout(refetch, 3000);
    } catch (err) { alert(`Failed to run ${agentType}`); }
    finally { setRunning(''); }
  };

  const handleReview = async (decision: string, stage: string) => {
    try {
      await reviewCandidate(id!, { notes: reviewForm.notes, decision, stage });
      refetch();
    } catch (err) { alert('Failed to submit review'); }
  };

  if (loading || !candidate) return <Loading />;

  const c = candidate;
  const summary = c.summary_results || {};
  const scoring = c.scoring_results || {};
  const guardrails = c.guardrail_results || {};
  const biasAudit = c.bias_audit_results || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/candidates" style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Candidates</Link>
          <h1>{c.full_name || 'Unknown Candidate'}</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {c.job_title} · <StageBadge stage={c.stage} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleRunPipeline} disabled={!!running}>
            {running === 'pipeline' ? 'Starting...' : 'Run Full Pipeline'}
          </button>
          <button className="btn btn-outline" onClick={() => handleRunAgent('parser')} disabled={!!running}>Parse</button>
          <button className="btn btn-outline" onClick={() => handleRunAgent('guardrail')} disabled={!!running}>Guardrails</button>
          <button className="btn btn-outline" onClick={() => handleRunAgent('scorer')} disabled={!!running}>Score</button>
          <button className="btn btn-outline" onClick={() => handleRunAgent('summarizer')} disabled={!!running}>Summarize</button>
          <button className="btn btn-outline" onClick={() => handleRunAgent('bias_auditor')} disabled={!!running}>Bias Audit</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Overall Score</div>
          <div className="stat-value">{c.overall_score !== null ? `${(c.overall_score * 100).toFixed(0)}%` : 'N/A'}</div>
          <ScoreBar score={c.overall_score} />
        </div>
        <div className="stat-card">
          <div className="stat-label">Confidence</div>
          <div className="stat-value">{c.confidence !== null ? `${(c.confidence * 100).toFixed(0)}%` : 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Suggested Action</div>
          <div className="stat-value">
            {c.suggested_action ? (
              <span className={`badge ${c.suggested_action === 'Accept' ? 'badge-success' : c.suggested_action === 'Reject' ? 'badge-danger' : 'badge-warning'}`}>
                {c.suggested_action}
              </span>
            ) : 'Pending'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Guardrails</div>
          <div className="stat-value">
            {c.guardrail_passed === true ? <span className="badge badge-success">Passed</span> :
             c.guardrail_passed === false ? <span className="badge badge-danger">Failed</span> : 'Pending'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bias Flags</div>
          <div className="stat-value" style={{ color: c.bias_flags?.length ? 'var(--danger)' : 'var(--success)' }}>
            {c.bias_flags?.length || 0}
          </div>
        </div>
      </div>

      <div className="tabs">
        {['overview', 'scoring', 'guardrails', 'bias_audit', 'summary', 'agents', 'review'].map(tab => (
          <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header"><h2>Candidate Info</h2></div>
            <div className="card-body">
              <InfoRow label="Name" value={c.full_name} />
              <InfoRow label="Email" value={c.email} />
              <InfoRow label="Phone" value={c.phone} />
              <InfoRow label="Experience" value={c.experience_years ? `${c.experience_years} years` : 'N/A'} />
              <InfoRow label="Age" value={c.age ? String(c.age) : 'Not specified'} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Skills</h2></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {(c.skills || []).map((s, i) => <span key={i} className="badge badge-info">{s}</span>)}
                {(!c.skills || c.skills.length === 0) && <p style={{ color: 'var(--gray-400)' }}>Not parsed yet</p>}
              </div>
            </div>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><h2>Education</h2></div>
            <div className="card-body">
              {(c.education || []).map((edu: any, i: number) => (
                <div key={i} style={{ marginBottom: '0.75rem' }}>
                  <strong>{edu.degree}</strong> in {edu.field} — {edu.institution}
                  {edu.gpa && <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>GPA: {edu.gpa}</span>}
                </div>
              ))}
              {(!c.education || c.education.length === 0) && <p style={{ color: 'var(--gray-400)' }}>Not parsed yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scoring' && (
        <div className="card">
          <div className="card-header"><h2>Rubric Scoring Components</h2></div>
          <div className="card-body">
            {scoring.components ? (
              Object.entries(scoring.components as Record<string, number>).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <span style={{ width: 180, fontSize: '0.875rem', color: 'var(--gray-600)' }}>{key.replace(/_/g, ' ')}</span>
                  <ScoreBar score={val} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{(val * 100).toFixed(0)}%</span>
                </div>
              ))
            ) : <p style={{ color: 'var(--gray-400)' }}>Not scored yet. Run the scoring agent.</p>}
            {scoring.notes && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                <strong>Notes:</strong>
                <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(scoring.notes, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'guardrails' && (
        <div className="card">
          <div className="card-header"><h2>Guardrail Check Results</h2></div>
          <div className="card-body">
            {Object.keys(guardrails).length > 0 ? (
              Object.entries(guardrails).filter(([k]) => k !== 'overall').map(([key, val]: [string, any]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', padding: '0.75rem', background: val.pass ? '#f0fdf4' : '#fef2f2', borderRadius: 'var(--radius)' }}>
                  <span className={`badge ${val.pass ? 'badge-success' : 'badge-danger'}`}>{val.pass ? 'PASS' : 'FAIL'}</span>
                  <div>
                    <strong>{key.replace(/_/g, ' ')}</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0 }}>{val.reason}</p>
                  </div>
                </div>
              ))
            ) : <p style={{ color: 'var(--gray-400)' }}>Not checked yet. Run the guardrail agent.</p>}
          </div>
        </div>
      )}

      {activeTab === 'bias_audit' && (
        <div className="card">
          <div className="card-header"><h2>Bias Audit — Responsible AI Probes</h2></div>
          <div className="card-body">
            {biasAudit.probes ? (
              <>
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Total Probes</div>
                    <div className="stat-value">{biasAudit.total_probes}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Flagged</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{biasAudit.flagged_probes}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Risk Level</div>
                    <div className="stat-value">
                      <span className={`badge ${biasAudit.overall_risk === 'high' ? 'badge-danger' : biasAudit.overall_risk === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                        {biasAudit.overall_risk}
                      </span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">PII Detected</div>
                    <div className="stat-value">{biasAudit.pii_scan?.count || 0}</div>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr><th>Scenario</th><th>Score</th><th>Delta</th><th>Flagged</th></tr>
                  </thead>
                  <tbody>
                    {(biasAudit.probes || []).map((p: any, i: number) => (
                      <tr key={i} style={{ background: p.flagged ? '#fef2f2' : 'inherit' }}>
                        <td style={{ fontSize: '0.8rem' }}>{p.scenario}</td>
                        <td>{(p.score * 100).toFixed(1)}%</td>
                        <td style={{ color: Math.abs(p.delta) > 0.15 ? 'var(--danger)' : 'var(--gray-600)', fontWeight: 600 }}>
                          {p.delta > 0 ? '+' : ''}{(p.delta * 100).toFixed(1)}%
                        </td>
                        <td>{p.flagged ? <span className="badge badge-danger">FLAG</span> : <span className="badge badge-success">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : <p style={{ color: 'var(--gray-400)' }}>Not audited yet. Run the bias audit agent.</p>}
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="card">
          <div className="card-header"><h2>AI Evaluation Summary</h2></div>
          <div className="card-body">
            {Object.keys(summary).length > 0 ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>Overall Assessment</h3>
                  <p>{summary.overall_assessment}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: 'var(--radius)' }}>
                    <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Strengths</h4>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                      {(Array.isArray(summary.pros) ? summary.pros : [summary.pros]).map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: 'var(--radius)' }}>
                    <h4 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Weaknesses</h4>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                      {(Array.isArray(summary.cons) ? summary.cons : [summary.cons]).map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Detailed Reasoning</h4>
                  <p style={{ fontSize: '0.875rem' }}>{summary.detailed_reasoning}</p>
                </div>
                {summary.interview_recommendations && (
                  <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: 'var(--radius)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Interview Topics</h4>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                      {summary.interview_recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : <p style={{ color: 'var(--gray-400)' }}>Not summarized yet. Run the summary agent.</p>}
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div className="card-header"><h2>Agent Execution History</h2></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Agent</th><th>Status</th><th>Duration</th><th>Ran At</th></tr></thead>
              <tbody>
                {(c.agent_executions || []).map(exec => (
                  <tr key={exec.id}>
                    <td><span className="badge badge-info">{exec.agent_type}</span></td>
                    <td><span className={`badge ${exec.status === 'completed' ? 'badge-success' : exec.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{exec.status}</span></td>
                    <td>{exec.duration_seconds ? `${exec.duration_seconds}s` : '-'}</td>
                    <td>{new Date(exec.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(!c.agent_executions || c.agent_executions.length === 0) && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>No executions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="card">
          <div className="card-header"><h2>Human Review</h2></div>
          <div className="card-body">
            {c.reviewer_decision && (
              <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
                <strong>Previous Decision:</strong> {c.reviewer_decision}
                {c.reviewer_notes && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{c.reviewer_notes}</p>}
              </div>
            )}
            <div className="form-group">
              <label>Review Notes</label>
              <textarea className="form-control" rows={4} value={reviewForm.notes} onChange={e => setReviewForm({ ...reviewForm, notes: e.target.value })} placeholder="Add your review notes..." />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-success" onClick={() => handleReview('Shortlisted', 'shortlisted')}>Shortlist</button>
              <button className="btn btn-warning" onClick={() => handleReview('Further Review', 'reviewed')}>Further Review</button>
              <button className="btn btn-danger" onClick={() => handleReview('Rejected', 'rejected')}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
    <span style={{ width: 120, fontSize: '0.8rem', color: 'var(--gray-500)' }}>{label}</span>
    <span style={{ fontSize: '0.875rem' }}>{value || '-'}</span>
  </div>
);

export default CandidateDetailPage;
