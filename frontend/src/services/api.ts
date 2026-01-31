import axios from 'axios';
import type {
  DashboardStats, Department, JobPosition, Candidate,
  AgentExecution, Interview, ActivityLog, FairnessDashboard,
  PaginatedResponse,
} from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8046/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Dashboard ────────────────────────────────────────────────
export const getDashboardStats = () =>
  api.get<DashboardStats>('/dashboard/').then(r => r.data);

// ─── Departments ──────────────────────────────────────────────
export const getDepartments = () =>
  api.get<PaginatedResponse<Department>>('/departments/').then(r => r.data);

export const createDepartment = (data: Partial<Department>) =>
  api.post<Department>('/departments/', data).then(r => r.data);

// ─── Jobs ─────────────────────────────────────────────────────
export const getJobs = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<JobPosition>>('/jobs/', { params }).then(r => r.data);

export const getJob = (id: string) =>
  api.get<JobPosition>(`/jobs/${id}/`).then(r => r.data);

export const createJob = (data: Partial<JobPosition>) =>
  api.post<JobPosition>('/jobs/', data).then(r => r.data);

export const updateJob = (id: string, data: Partial<JobPosition>) =>
  api.patch<JobPosition>(`/jobs/${id}/`, data).then(r => r.data);

export const getJobPipelineStats = (id: string) =>
  api.get(`/jobs/${id}/pipeline_stats/`).then(r => r.data);

export const bulkEvaluateJob = (id: string, runBiasAudit: boolean = true) =>
  api.post(`/jobs/${id}/bulk_evaluate/`, { run_bias_audit: runBiasAudit }).then(r => r.data);

// ─── Candidates ───────────────────────────────────────────────
export const getCandidates = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<Candidate>>('/candidates/', { params }).then(r => r.data);

export const getCandidate = (id: string) =>
  api.get<Candidate>(`/candidates/${id}/`).then(r => r.data);

export const createCandidate = (data: FormData) =>
  api.post<Candidate>('/candidates/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const evaluateCandidate = (id: string, runBiasAudit: boolean = true) =>
  api.post(`/candidates/${id}/evaluate/`, { run_bias_audit: runBiasAudit }).then(r => r.data);

export const runAgent = (candidateId: string, agentType: string) =>
  api.post(`/candidates/${candidateId}/run_agent/`, { agent_type: agentType }).then(r => r.data);

export const updateCandidateStage = (id: string, stage: string) =>
  api.post(`/candidates/${id}/update_stage/`, { stage }).then(r => r.data);

export const reviewCandidate = (id: string, data: { notes: string; decision: string; stage?: string }) =>
  api.post(`/candidates/${id}/review/`, data).then(r => r.data);

export const getCandidateBiasReport = (id: string) =>
  api.get(`/candidates/${id}/bias_report/`).then(r => r.data);

// ─── Interviews ───────────────────────────────────────────────
export const getInterviews = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<Interview>>('/interviews/', { params }).then(r => r.data);

export const createInterview = (data: Partial<Interview>) =>
  api.post<Interview>('/interviews/', data).then(r => r.data);

export const generateInterviewQuestions = (interviewId: string) =>
  api.post(`/interviews/${interviewId}/generate_questions/`).then(r => r.data);

// ─── Activity ─────────────────────────────────────────────────
export const getActivity = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<ActivityLog>>('/activity/', { params }).then(r => r.data);

// ─── Executions ───────────────────────────────────────────────
export const getExecutions = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<AgentExecution>>('/executions/', { params }).then(r => r.data);

// ─── Responsible AI ───────────────────────────────────────────
export const getFairnessDashboard = (jobId?: string) =>
  api.get<FairnessDashboard>(
    '/responsible-ai/fairness-dashboard/',
    { params: jobId ? { job_position_id: jobId } : {} }
  ).then(r => r.data);

export const getAgentPerformance = () =>
  api.get('/responsible-ai/agent-performance/').then(r => r.data);

export default api;
