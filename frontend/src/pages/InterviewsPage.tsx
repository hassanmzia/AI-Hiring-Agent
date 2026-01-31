import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getInterviews, getInterview, getUsers, scheduleInterview,
  completeInterview, generateInterviewQuestions, addInterviewPanel,
  removeInterviewPanel, submitInterviewFeedback,
} from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { InterviewListItem, InterviewDetail, UserMinimal, PaginatedResponse } from '../types';

const InterviewsPage: React.FC = () => {
  const { data, loading, refetch } = useApi<PaginatedResponse<InterviewListItem>>(() => getInterviews());
  const { data: users } = useApi<UserMinimal[]>(() => getUsers());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, string[]>>({});
  const [scheduleForm, setScheduleForm] = useState({ scheduled_at: '', location: '' });
  const [feedbackForm, setFeedbackForm] = useState({
    technical_score: '', communication_score: '', problem_solving_score: '',
    culture_fit_score: '', leadership_score: '', overall_score: '',
    recommendation: '', strengths: '', weaknesses: '', notes: '',
  });
  const [tab, setTab] = useState<'schedule' | 'panel' | 'feedback' | 'questions'>('schedule');
  const [addUserId, setAddUserId] = useState('');

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await getInterview(id);
      setDetail(d);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const handleSchedule = async () => {
    if (!selectedId || !scheduleForm.scheduled_at) return;
    try {
      await scheduleInterview(selectedId, {
        scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
        location: scheduleForm.location,
      });
      await loadDetail(selectedId);
      refetch();
    } catch { alert('Failed to schedule'); }
  };

  const handleComplete = async () => {
    if (!selectedId) return;
    try {
      await completeInterview(selectedId);
      await loadDetail(selectedId);
      refetch();
    } catch { alert('Failed to complete'); }
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    try {
      const result = await generateInterviewQuestions(id);
      setQuestions(prev => ({ ...prev, [id]: result.questions }));
      if (selectedId === id) await loadDetail(id);
    } catch { alert('Failed to generate questions'); }
    finally { setGenerating(null); }
  };

  const handleAddPanel = async () => {
    if (!selectedId || !addUserId) return;
    try {
      await addInterviewPanel(selectedId, parseInt(addUserId));
      setAddUserId('');
      await loadDetail(selectedId);
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
  };

  const handleRemovePanel = async (userId: number) => {
    if (!selectedId) return;
    try {
      await removeInterviewPanel(selectedId, userId);
      await loadDetail(selectedId);
    } catch { alert('Failed'); }
  };

  const handleSubmitFeedback = async (feedbackId: string) => {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(feedbackForm)) {
      if (v) payload[k] = ['recommendation', 'strengths', 'weaknesses', 'notes'].includes(k) ? v : parseFloat(v);
    }
    try {
      await submitInterviewFeedback(feedbackId, payload);
      if (selectedId) await loadDetail(selectedId);
      refetch();
      setFeedbackForm({
        technical_score: '', communication_score: '', problem_solving_score: '',
        culture_fit_score: '', leadership_score: '', overall_score: '',
        recommendation: '', strengths: '', weaknesses: '', notes: '',
      });
    } catch { alert('Failed to submit feedback'); }
  };

  if (loading) return <Loading />;
  const interviews = data?.results || [];

  const statusColor = (s: string) =>
    s === 'completed' ? 'badge-success' : s === 'scheduled' ? 'badge-info' :
    s === 'draft' ? 'badge-gray' : s === 'cancelled' ? 'badge-danger' : 'badge-warning';

  return (
    <div>
      <div className="page-header">
        <h1>Interview Management</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1.2fr' : '1fr', gap: '1.5rem' }}>
        {/* Interview List */}
        <div className="card">
          <div className="card-header"><h2>All Interviews ({interviews.length})</h2></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Type</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {interviews.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>
                    No interviews yet. Shortlist a candidate to auto-create interview rounds.
                  </td></tr>
                )}
                {interviews.map(i => (
                  <tr key={i.id} style={{ background: selectedId === i.id ? 'var(--gray-50)' : undefined, cursor: 'pointer' }}
                      onClick={() => loadDetail(i.id)}>
                    <td>
                      <Link to={`/candidates/${i.candidate}`} onClick={e => e.stopPropagation()} style={{ fontWeight: 500 }}>
                        {i.candidate_name}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{i.job_title}</div>
                    </td>
                    <td><span className="badge badge-info">{i.interview_type}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : 'Not scheduled'}</td>
                    <td><span className={`badge ${statusColor(i.status)}`}>{i.status}</span></td>
                    <td>{i.overall_rating ? `${i.overall_rating.toFixed(1)}/5` : '-'}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); handleGenerate(i.id); }}
                        disabled={generating === i.id}>
                        {generating === i.id ? '...' : 'AI Q'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedId && (
          <div>
            {detailLoading ? <Loading /> : detail && (
              <>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <h2>{detail.candidate_name} — {detail.interview_type.replace(/_/g, ' ')} Interview</h2>
                    <span className={`badge ${statusColor(detail.status)}`}>{detail.status}</span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                      <div><strong>Job:</strong> {detail.job_title}</div>
                      <div><strong>Duration:</strong> {detail.duration_minutes} min</div>
                      <div><strong>Location:</strong> {detail.location || 'TBD'}</div>
                      <div><strong>Scheduled:</strong> {detail.scheduled_at ? new Date(detail.scheduled_at).toLocaleString() : 'Not yet'}</div>
                      <div><strong>Rating:</strong> {detail.overall_rating ? `${detail.overall_rating.toFixed(1)}/5 (${detail.overall_recommendation})` : 'Pending'}</div>
                      <div><strong>Panel:</strong> {detail.panel_members.length} members, {detail.feedbacks.filter(f => f.submitted).length} feedback(s)</div>
                    </div>
                  </div>
                </div>

                <div className="tabs" style={{ marginBottom: '1rem' }}>
                  {(['schedule', 'panel', 'feedback', 'questions'] as const).map(t => (
                    <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </div>
                  ))}
                </div>

                {tab === 'schedule' && (
                  <div className="card">
                    <div className="card-body">
                      {detail.status === 'draft' || detail.status === 'rescheduled' ? (
                        <>
                          <div className="form-group">
                            <label>Date & Time</label>
                            <input type="datetime-local" className="form-control" value={scheduleForm.scheduled_at}
                              onChange={e => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label>Location / Video Link</label>
                            <input className="form-control" value={scheduleForm.location}
                              onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                              placeholder="Room 3B / https://zoom.us/..." />
                          </div>
                          <button className="btn btn-primary" onClick={handleSchedule}>Schedule Interview</button>
                        </>
                      ) : detail.status === 'scheduled' ? (
                        <div>
                          <p style={{ marginBottom: '1rem' }}>
                            Scheduled for <strong>{new Date(detail.scheduled_at!).toLocaleString()}</strong>
                            {detail.location && <> at <strong>{detail.location}</strong></>}
                          </p>
                          <button className="btn btn-success" onClick={handleComplete}>Mark as Completed</button>
                        </div>
                      ) : (
                        <p>Interview is <strong>{detail.status}</strong></p>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'panel' && (
                  <div className="card">
                    <div className="card-header"><h2>Interview Panel</h2></div>
                    <div className="card-body">
                      {detail.panel_members.length === 0 && <p style={{ color: 'var(--gray-400)', marginBottom: '1rem' }}>No panel members assigned yet.</p>}
                      {detail.panel_members.map(pm => (
                        <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                          <div>
                            <strong>{pm.interviewer_name}</strong>
                            <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>{pm.role}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: '0.5rem' }}>{pm.interviewer_email}</span>
                          </div>
                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => handleRemovePanel(pm.interviewer)}>Remove</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <select className="form-control" value={addUserId} onChange={e => setAddUserId(e.target.value)} style={{ flex: 1 }}>
                          <option value="">Select interviewer...</option>
                          {(users || []).map(u => (
                            <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                          ))}
                        </select>
                        <button className="btn btn-primary" onClick={handleAddPanel} disabled={!addUserId}>Add</button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'feedback' && (
                  <div className="card">
                    <div className="card-header"><h2>Feedback / Scorecards</h2></div>
                    <div className="card-body">
                      {detail.feedbacks.length === 0 && <p style={{ color: 'var(--gray-400)' }}>No feedback slots yet. Add panel members first.</p>}
                      {detail.feedbacks.map(fb => (
                        <div key={fb.id} style={{ padding: '1rem', marginBottom: '1rem', background: fb.submitted ? '#f0fdf4' : 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong>{fb.interviewer_name}</strong>
                            {fb.submitted ? (
                              <span className="badge badge-success">Submitted — {fb.recommendation}</span>
                            ) : (
                              <span className="badge badge-warning">Pending</span>
                            )}
                          </div>
                          {fb.submitted ? (
                            <div style={{ fontSize: '0.85rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                {[['Technical', fb.technical_score], ['Communication', fb.communication_score],
                                  ['Problem Solving', fb.problem_solving_score], ['Culture Fit', fb.culture_fit_score],
                                  ['Leadership', fb.leadership_score], ['Overall', fb.overall_score]].map(([label, val]) => (
                                  <div key={label as string}><span style={{ color: 'var(--gray-500)' }}>{label as string}:</span> <strong>{val || '-'}</strong>/5</div>
                                ))}
                              </div>
                              {fb.strengths && <p><strong>Strengths:</strong> {fb.strengths}</p>}
                              {fb.weaknesses && <p><strong>Weaknesses:</strong> {fb.weaknesses}</p>}
                              {fb.notes && <p><strong>Notes:</strong> {fb.notes}</p>}
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                {['technical_score', 'communication_score', 'problem_solving_score',
                                  'culture_fit_score', 'leadership_score', 'overall_score'].map(field => (
                                  <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.7rem' }}>{field.replace(/_/g, ' ')}</label>
                                    <input type="number" min="1" max="5" step="0.5" className="form-control"
                                      value={(feedbackForm as any)[field]}
                                      onChange={e => setFeedbackForm({ ...feedbackForm, [field]: e.target.value })} />
                                  </div>
                                ))}
                              </div>
                              <div className="form-group">
                                <label>Recommendation</label>
                                <select className="form-control" value={feedbackForm.recommendation}
                                  onChange={e => setFeedbackForm({ ...feedbackForm, recommendation: e.target.value })}>
                                  <option value="">Select...</option>
                                  <option value="strong_hire">Strong Hire</option>
                                  <option value="hire">Hire</option>
                                  <option value="no_hire">No Hire</option>
                                  <option value="strong_no_hire">Strong No Hire</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Strengths</label>
                                <textarea className="form-control" rows={2} value={feedbackForm.strengths}
                                  onChange={e => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })} />
                              </div>
                              <div className="form-group">
                                <label>Weaknesses</label>
                                <textarea className="form-control" rows={2} value={feedbackForm.weaknesses}
                                  onChange={e => setFeedbackForm({ ...feedbackForm, weaknesses: e.target.value })} />
                              </div>
                              <div className="form-group">
                                <label>Notes</label>
                                <textarea className="form-control" rows={2} value={feedbackForm.notes}
                                  onChange={e => setFeedbackForm({ ...feedbackForm, notes: e.target.value })} />
                              </div>
                              <button className="btn btn-primary" onClick={() => handleSubmitFeedback(fb.id)}>Submit Feedback</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'questions' && (
                  <div className="card">
                    <div className="card-header">
                      <h2>AI-Suggested Questions</h2>
                      <button className="btn btn-outline btn-sm" onClick={() => handleGenerate(detail.id)}
                        disabled={generating === detail.id}>
                        {generating === detail.id ? 'Generating...' : 'Regenerate'}
                      </button>
                    </div>
                    <div className="card-body">
                      {(detail.ai_suggested_questions?.length > 0 || questions[detail.id]) ? (
                        <ol style={{ paddingLeft: '1.25rem' }}>
                          {(questions[detail.id] || detail.ai_suggested_questions).map((q, i) => (
                            <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>{q}</li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ color: 'var(--gray-400)' }}>No questions generated yet. Click "Regenerate" to create AI-tailored questions.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewsPage;
