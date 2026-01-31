import React, { useState } from 'react';
import { getInterviews, generateInterviewQuestions } from '../services/api';
import { useApi } from '../hooks/useApi';
import Loading from '../components/Loading';
import type { Interview, PaginatedResponse } from '../types';

const InterviewsPage: React.FC = () => {
  const { data, loading, refetch } = useApi<PaginatedResponse<Interview>>(() => getInterviews());
  const [generating, setGenerating] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, string[]>>({});

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    try {
      const result = await generateInterviewQuestions(id);
      setQuestions(prev => ({ ...prev, [id]: result.questions }));
    } catch (err) {
      alert('Failed to generate questions');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <Loading />;

  const interviews = data?.results || [];

  return (
    <div>
      <div className="page-header">
        <h1>Interviews</h1>
      </div>

      {interviews.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <p>No interviews scheduled yet.</p>
              <p>Schedule interviews from the candidate detail page after evaluation.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Type</th>
                  <th>Interviewer</th>
                  <th>Scheduled</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>AI Questions</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map(interview => (
                  <React.Fragment key={interview.id}>
                    <tr>
                      <td style={{ fontWeight: 500 }}>{interview.candidate_name}</td>
                      <td><span className="badge badge-info">{interview.interview_type}</span></td>
                      <td>{interview.interviewer_name || 'TBD'}</td>
                      <td>{new Date(interview.scheduled_at).toLocaleString()}</td>
                      <td>{interview.duration_minutes} min</td>
                      <td><span className={`badge ${interview.status === 'completed' ? 'badge-success' : interview.status === 'scheduled' ? 'badge-info' : 'badge-gray'}`}>{interview.status}</span></td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleGenerate(interview.id)}
                          disabled={generating === interview.id}
                        >
                          {generating === interview.id ? 'Generating...' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                    {questions[interview.id] && (
                      <tr>
                        <td colSpan={7} style={{ background: '#eff6ff', padding: '1rem' }}>
                          <strong style={{ fontSize: '0.8rem' }}>AI-Suggested Questions:</strong>
                          <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                            {questions[interview.id].map((q, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{q}</li>)}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewsPage;
