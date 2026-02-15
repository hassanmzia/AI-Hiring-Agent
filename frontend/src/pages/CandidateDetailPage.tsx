import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getCandidate, evaluateCandidate, runAgent, reviewCandidate,
  updateCandidateStage, setupCandidateInterviews, submitFinalEvaluation,
  createCandidateOffer,
} from '../services/api';
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
  const [finalForm, setFinalForm] = useState({ final_score: '', final_recommendation: '', final_notes: '' });
  const [offerForm, setOfferForm] = useState({ salary: '', signing_bonus: '', start_date: '', employment_type: 'full_time', benefits_summary: '', location: '' });

  const handleRunPipeline = async () => {
    setRunning('pipeline');
    try {
      await evaluateCandidate(id!);
      alert('Evaluation pipeline started. Refresh to see progress.');
      setTimeout(refetch, 5000);
    } catch { alert('Failed to start pipeline'); }
    finally { setRunning(''); }
  };

  const handleRunAgent = async (agentType: string) => {
    setRunning(agentType);
    try {
      await runAgent(id!, agentType);
      alert(`${agentType} agent started. Refresh to see results.`);
      setTimeout(refetch, 3000);
    } catch { alert(`Failed to run ${agentType}`); }
    finally { setRunning(''); }
  };

  const handleReview = async (decision: string, stage: string) => {
    try {
      await reviewCandidate(id!, { notes: reviewForm.notes, decision, stage });
      refetch();
    } catch { alert('Failed to submit review'); }
  };

  const handleSetupInterviews = async () => {
    try {
      await setupCandidateInterviews(id!);
      refetch();
    } catch { alert('Failed to setup interviews'); }
  };

  const handleFinalEvaluation = async () => {
    try {
      await submitFinalEvaluation(id!, {
        final_score: parseFloat(finalForm.final_score),
        final_recommendation: finalForm.final_recommendation,
        final_notes: finalForm.final_notes,
        stage: finalForm.final_recommendation === 'hire' ? 'approved_for_offer' : 'rejected',
      });
      refetch();
    } catch { alert('Failed'); }
  };

  const handleCreateOffer = async () => {
    if (!offerForm.salary) { alert('Salary is required'); return; }
    try {
      await createCandidateOffer(id!, offerForm);
      refetch();
    } catch { alert('Failed to create offer'); }
  };

  if (loading || !candidate) return <Loading />;

  const c = candidate;
  const summary = c.summary_results || {};
  const scoring = c.scoring_results || {};
  const guardrails = c.guardrail_results || {};
  const biasAudit = c.bias_audit_results || {};

  const tabs = ['overview', 'scoring', 'guardrails', 'bias_audit', 'summary', 'interviews', 'offer', 'agents', 'review'];

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/candidates" style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Candidates</Link>
          <h1>{c.full_name || 'Unknown Candidate'}</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {c.job_title} &middot; <StageBadge stage={c.stage} />
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
        {tabs.map(tab => (
          <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h2>Candidate Info</h2></div>
            <div className="card-body">
              <InfoRow label="Name" value={c.full_name} />
              <InfoRow label="Email" value={c.email} />
              <InfoRow label="Phone" value={c.phone} />
              <InfoRow label="Experience" value={c.experience_years ? `${c.experience_years} years` : 'N/A'} />
              <InfoRow label="Age" value={c.age ? String(c.age) : 'Not specified'} />
              {c.final_score !== null && <InfoRow label="Final Score" value={`${c.final_score}`} />}
              {c.final_recommendation && <InfoRow label="Final Rec." value={c.final_recommendation} />}
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
                  <strong>{edu.degree}</strong> in {edu.field} &mdash; {edu.institution}
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
                  <span style={{ minWidth: 100, maxWidth: 180, fontSize: '0.875rem', color: 'var(--gray-600)' }}>{key.replace(/_/g, ' ')}</span>
                  <ScoreBar score={val} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{(val * 100).toFixed(0)}%</span>
                </div>
              ))
            ) : <p style={{ color: 'var(--gray-400)' }}>Not scored yet. Run the scoring agent.</p>}
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
          <div className="card-header"><h2>Bias Audit &mdash; Responsible AI Probes</h2></div>
          <div className="card-body">
            {biasAudit.probes ? (
              <>
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card"><div className="stat-label">Total Probes</div><div className="stat-value">{biasAudit.total_probes}</div></div>
                  <div className="stat-card"><div className="stat-label">Flagged</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{biasAudit.flagged_probes}</div></div>
                  <div className="stat-card"><div className="stat-label">Risk Level</div><div className="stat-value">
                    <span className={`badge ${biasAudit.overall_risk === 'high' ? 'badge-danger' : biasAudit.overall_risk === 'medium' ? 'badge-warning' : 'badge-success'}`}>{biasAudit.overall_risk}</span>
                  </div></div>
                  <div className="stat-card"><div className="stat-label">PII Detected</div><div className="stat-value">{biasAudit.pii_scan?.count || 0}</div></div>
                </div>
                <table>
                  <thead><tr><th>Scenario</th><th>Score</th><th>Delta</th><th>Flagged</th></tr></thead>
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
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
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
                {summary.detailed_reasoning && (
                  <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Detailed Reasoning</h4>
                    <p style={{ fontSize: '0.875rem' }}>{summary.detailed_reasoning}</p>
                  </div>
                )}
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

      {activeTab === 'interviews' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header">
              <h2>Interview Rounds</h2>
              <button className="btn btn-outline btn-sm" onClick={handleSetupInterviews}>Setup Interviews</button>
            </div>
            <div className="card-body">
              {(c.interviews_summary || []).length === 0 ? (
                <p style={{ color: 'var(--gray-400)' }}>
                  No interviews set up yet. Shortlist the candidate or click "Setup Interviews" to create interview rounds.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Type</th><th>Scheduled</th><th>Status</th><th>Rating</th><th>Panel</th><th>Feedback</th></tr>
                  </thead>
                  <tbody>
                    {c.interviews_summary.map(i => (
                      <tr key={i.id}>
                        <td><span className="badge badge-info">{i.interview_type}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : 'Not scheduled'}</td>
                        <td><span className={`badge ${i.status === 'completed' ? 'badge-success' : i.status === 'scheduled' ? 'badge-info' : 'badge-gray'}`}>{i.status}</span></td>
                        <td>{i.overall_rating ? `${i.overall_rating.toFixed(1)}/5` : '-'}</td>
                        <td>{i.panel_count}</td>
                        <td>{i.feedback_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: '1rem' }}>
                <Link to="/interviews" className="btn btn-outline btn-sm">Go to Interview Management</Link>
              </div>
            </div>
          </div>

          {/* Final Evaluation */}
          <div className="card">
            <div className="card-header"><h2>Final Evaluation</h2></div>
            <div className="card-body">
              {c.final_score !== null ? (
                <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong>Final Score:</strong> {c.final_score} &middot;
                    <strong> Recommendation:</strong> <span className={`badge ${c.final_recommendation === 'hire' ? 'badge-success' : 'badge-danger'}`}>{c.final_recommendation}</span>
                  </div>
                  {c.final_notes && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{c.final_notes}</p>}
                </div>
              ) : (
                <>
                  <div className="flex-form-row">
                    <div className="form-group">
                      <label>Final Score (0-5)</label>
                      <input type="number" min="0" max="5" step="0.1" className="form-control" value={finalForm.final_score}
                        onChange={e => setFinalForm({ ...finalForm, final_score: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Recommendation</label>
                      <select className="form-control" value={finalForm.final_recommendation}
                        onChange={e => setFinalForm({ ...finalForm, final_recommendation: e.target.value })}>
                        <option value="">Select...</option>
                        <option value="hire">Hire</option>
                        <option value="no_hire">No Hire</option>
                        <option value="strong_hire">Strong Hire</option>
                        <option value="strong_no_hire">Strong No Hire</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Final Notes</label>
                    <textarea className="form-control" rows={3} value={finalForm.final_notes}
                      onChange={e => setFinalForm({ ...finalForm, final_notes: e.target.value })}
                      placeholder="Summary of interview performance and final decision rationale..." />
                  </div>
                  <button className="btn btn-primary" onClick={handleFinalEvaluation}
                    disabled={!finalForm.final_score || !finalForm.final_recommendation}>Submit Final Evaluation</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'offer' && (
        <div>
          {(c.offers_summary || []).length > 0 ? (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header"><h2>Existing Offers</h2></div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Salary</th><th>Status</th><th>Sent</th><th>Rev</th></tr></thead>
                  <tbody>
                    {c.offers_summary.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>${Number(o.salary).toLocaleString()}</td>
                        <td><span className={`badge ${o.status === 'accepted' ? 'badge-success' : o.status === 'declined' ? 'badge-danger' : 'badge-info'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '-'}</td>
                        <td>#{o.revision_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-body">
                <Link to="/offers" className="btn btn-outline btn-sm">Manage Offers</Link>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-header"><h2>Create New Offer</h2></div>
            <div className="card-body">
              <div className="flex-form-row">
                <div className="form-group">
                  <label>Annual Salary *</label>
                  <input type="number" className="form-control" value={offerForm.salary}
                    onChange={e => setOfferForm({ ...offerForm, salary: e.target.value })} placeholder="120000" />
                </div>
                <div className="form-group">
                  <label>Signing Bonus</label>
                  <input type="number" className="form-control" value={offerForm.signing_bonus}
                    onChange={e => setOfferForm({ ...offerForm, signing_bonus: e.target.value })} placeholder="10000" />
                </div>
              </div>
              <div className="flex-form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" className="form-control" value={offerForm.start_date}
                    onChange={e => setOfferForm({ ...offerForm, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Employment Type</label>
                  <select className="form-control" value={offerForm.employment_type}
                    onChange={e => setOfferForm({ ...offerForm, employment_type: e.target.value })}>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input className="form-control" value={offerForm.location}
                  onChange={e => setOfferForm({ ...offerForm, location: e.target.value })} placeholder="San Francisco, CA / Remote" />
              </div>
              <div className="form-group">
                <label>Benefits Summary</label>
                <textarea className="form-control" rows={2} value={offerForm.benefits_summary}
                  onChange={e => setOfferForm({ ...offerForm, benefits_summary: e.target.value })}
                  placeholder="Health, dental, vision, 401k match, equity..." />
              </div>
              <button className="btn btn-primary" onClick={handleCreateOffer} disabled={!offerForm.salary}>Create Offer</button>
            </div>
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-success" onClick={() => handleReview('Shortlisted', 'shortlisted')}>Shortlist</button>
              <button className="btn btn-warning" onClick={() => handleReview('Further Review', 'reviewed')}>Further Review</button>
              <button className="btn btn-danger" onClick={() => handleReview('Rejected', 'rejected')}>Reject</button>
              <button className="btn btn-outline" onClick={() => handleReview('On Hold', 'on_hold')}>Put on Hold</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="info-row">
    <span className="info-row-label">{label}</span>
    <span className="info-row-value">{value || '-'}</span>
  </div>
);

export default CandidateDetailPage;
