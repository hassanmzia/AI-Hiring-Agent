import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getOffers, getOffer, getUsers, sendOffer, candidateRespondOffer,
  approveOffer, markHired, reviseOffer,
} from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { OfferListItem, OfferDetail, UserMinimal, PaginatedResponse } from '../types';

const OffersPage: React.FC = () => {
  const { data, loading, refetch } = useApi<PaginatedResponse<OfferListItem>>(() => getOffers());
  const { data: users } = useApi<UserMinimal[]>(() => getUsers());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OfferDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'details' | 'approvals' | 'respond' | 'revise'>('details');
  const [respondForm, setRespondForm] = useState({ response: '', notes: '' });
  const [reviseForm, setReviseForm] = useState({ salary: '', signing_bonus: '', benefits_summary: '', negotiation_notes: '' });

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await getOffer(id);
      setDetail(d);
      setReviseForm({
        salary: d.salary, signing_bonus: d.signing_bonus || '',
        benefits_summary: d.benefits_summary, negotiation_notes: d.negotiation_notes,
      });
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const handleSend = async () => {
    if (!selectedId) return;
    try {
      await sendOffer(selectedId);
      await loadDetail(selectedId);
      refetch();
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed to send'); }
  };

  const handleApprove = async (approverId: number) => {
    if (!selectedId) return;
    try {
      await approveOffer(selectedId, approverId);
      await loadDetail(selectedId);
      refetch();
    } catch { alert('Failed to approve'); }
  };

  const handleRespond = async () => {
    if (!selectedId || !respondForm.response) return;
    try {
      await candidateRespondOffer(selectedId, respondForm.response, respondForm.notes);
      await loadDetail(selectedId);
      refetch();
      setRespondForm({ response: '', notes: '' });
    } catch { alert('Failed'); }
  };

  const handleRevise = async () => {
    if (!selectedId) return;
    try {
      await reviseOffer(selectedId, reviseForm);
      await loadDetail(selectedId);
      refetch();
    } catch { alert('Failed to revise'); }
  };

  const handleMarkHired = async () => {
    if (!selectedId) return;
    try {
      await markHired(selectedId);
      await loadDetail(selectedId);
      refetch();
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
  };

  if (loading) return <Loading />;
  const offers = data?.results || [];

  const statusColor = (s: string) =>
    s === 'accepted' ? 'badge-success' : s === 'sent' ? 'badge-info' :
    s === 'approved' ? 'badge-info' : s === 'declined' ? 'badge-danger' :
    s === 'drafting' ? 'badge-gray' : s === 'negotiating' ? 'badge-warning' :
    s === 'pending_approval' ? 'badge-warning' : 'badge-gray';

  return (
    <div>
      <div className="page-header">
        <h1>Offer Management</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1.2fr' : '1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h2>All Offers ({offers.length})</h2></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {offers.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>
                    No offers yet. Create an offer from the candidate detail page after interviews.
                  </td></tr>
                )}
                {offers.map(o => (
                  <tr key={o.id} style={{ background: selectedId === o.id ? 'var(--gray-50)' : undefined, cursor: 'pointer' }}
                      onClick={() => loadDetail(o.id)}>
                    <td>
                      <Link to={`/candidates/${o.candidate}`} onClick={e => e.stopPropagation()} style={{ fontWeight: 500 }}>
                        {o.candidate_name}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{o.job_title}</td>
                    <td style={{ fontWeight: 600 }}>${Number(o.salary).toLocaleString()}</td>
                    <td><span className={`badge ${statusColor(o.status)}`}>{o.status.replace(/_/g, ' ')}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedId && (
          <div>
            {detailLoading ? <Loading /> : detail && (
              <>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <h2>Offer for {detail.candidate_name}</h2>
                    <span className={`badge ${statusColor(detail.status)}`}>{detail.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                      <div><strong>Position:</strong> {detail.job_title}</div>
                      <div><strong>Salary:</strong> ${Number(detail.salary).toLocaleString()} {detail.salary_currency}/{detail.salary_period}</div>
                      <div><strong>Type:</strong> {detail.employment_type.replace(/_/g, ' ')}</div>
                      <div><strong>Start Date:</strong> {detail.start_date || 'TBD'}</div>
                      <div><strong>Location:</strong> {detail.location || (detail.is_remote ? 'Remote' : 'TBD')}</div>
                      <div><strong>Signing Bonus:</strong> {detail.signing_bonus ? `$${Number(detail.signing_bonus).toLocaleString()}` : '-'}</div>
                      <div><strong>Reporting To:</strong> {detail.reporting_to || '-'}</div>
                      <div><strong>Revision:</strong> #{detail.revision_number}</div>
                    </div>
                    {detail.benefits_summary && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                        <strong>Benefits:</strong> {detail.benefits_summary}
                      </div>
                    )}
                    {detail.equity_details && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}><strong>Equity:</strong> {detail.equity_details}</div>
                    )}
                  </div>
                </div>

                <div className="tabs" style={{ marginBottom: '1rem' }}>
                  {(['details', 'approvals', 'respond', 'revise'] as const).map(t => (
                    <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </div>
                  ))}
                </div>

                {tab === 'details' && (
                  <div className="card">
                    <div className="card-body">
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {(detail.status === 'approved' || detail.status === 'drafting') && (
                          <button className="btn btn-primary" onClick={handleSend}>Send Offer to Candidate</button>
                        )}
                        {detail.status === 'accepted' && (
                          <button className="btn btn-success" onClick={handleMarkHired}>Finalize Hire</button>
                        )}
                      </div>
                      {detail.offer_letter_text && (
                        <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                          {detail.offer_letter_text}
                        </div>
                      )}
                      {detail.candidate_response && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#eff6ff', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                          <strong>Candidate Response:</strong> {detail.candidate_response}
                        </div>
                      )}
                      {detail.decline_reason && (
                        <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#fef2f2', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                          <strong>Decline Reason:</strong> {detail.decline_reason}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'approvals' && (
                  <div className="card">
                    <div className="card-header"><h2>Approval Chain</h2></div>
                    <div className="card-body">
                      {detail.approvals.length === 0 && (
                        <p style={{ color: 'var(--gray-400)' }}>No approval chain set up. Use "Submit for Approval" from the candidate page.</p>
                      )}
                      {detail.approvals.map(a => (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.75rem', marginBottom: '0.5rem', borderRadius: 'var(--radius)',
                          background: a.decision === 'approved' ? '#f0fdf4' : a.decision === 'rejected' ? '#fef2f2' : 'var(--gray-50)',
                          border: '1px solid var(--gray-200)',
                        }}>
                          <div>
                            <strong>{a.approver_name}</strong>
                            <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>#{a.order}</span>
                            {a.comments && <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: '0.25rem 0 0' }}>{a.comments}</p>}
                          </div>
                          <div>
                            {a.decision === 'pending' ? (
                              <button className="btn btn-success btn-sm" onClick={() => handleApprove(a.approver)}>Approve</button>
                            ) : (
                              <span className={`badge ${a.decision === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                                {a.decision}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'respond' && (
                  <div className="card">
                    <div className="card-header"><h2>Candidate Response</h2></div>
                    <div className="card-body">
                      <div className="form-group">
                        <label>Response</label>
                        <select className="form-control" value={respondForm.response}
                          onChange={e => setRespondForm({ ...respondForm, response: e.target.value })}>
                          <option value="">Select response...</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                          <option value="negotiating">Negotiating</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Notes / Reason</label>
                        <textarea className="form-control" rows={3} value={respondForm.notes}
                          onChange={e => setRespondForm({ ...respondForm, notes: e.target.value })}
                          placeholder="Candidate's response details..." />
                      </div>
                      <button className="btn btn-primary" onClick={handleRespond} disabled={!respondForm.response}>
                        Record Response
                      </button>
                    </div>
                  </div>
                )}

                {tab === 'revise' && (
                  <div className="card">
                    <div className="card-header"><h2>Revise Offer (Negotiation)</h2></div>
                    <div className="card-body">
                      <div className="form-group">
                        <label>Salary</label>
                        <input type="number" className="form-control" value={reviseForm.salary}
                          onChange={e => setReviseForm({ ...reviseForm, salary: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Signing Bonus</label>
                        <input type="number" className="form-control" value={reviseForm.signing_bonus}
                          onChange={e => setReviseForm({ ...reviseForm, signing_bonus: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Benefits Summary</label>
                        <textarea className="form-control" rows={2} value={reviseForm.benefits_summary}
                          onChange={e => setReviseForm({ ...reviseForm, benefits_summary: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Negotiation Notes</label>
                        <textarea className="form-control" rows={2} value={reviseForm.negotiation_notes}
                          onChange={e => setReviseForm({ ...reviseForm, negotiation_notes: e.target.value })} />
                      </div>
                      <button className="btn btn-primary" onClick={handleRevise}>Send Revised Offer</button>
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

export default OffersPage;
