import axios from 'axios';
import type {
  DashboardStats, Department, JobPosition, Candidate,
  AgentExecution, InterviewListItem, InterviewDetail, ActivityLog,
  FairnessDashboard, OfferListItem, OfferDetail, InterviewFeedback,
  UserMinimal,
  PaginatedResponse,
} from '../types';

const API_BASE = process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8046/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── CSRF Token Management ───────────────────────────────────
function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase();
  if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers['X-CSRFToken'] = getCsrfToken();
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────
export const fetchCsrfToken = () =>
  api.get('/auth/csrf/').then(r => r.data);

export const loginUser = (data: { username: string; password: string; mfa_code?: string }) =>
  api.post('/auth/login/', data).then(r => r.data);

export const logoutUser = () =>
  api.post('/auth/logout/').then(r => r.data);

export const registerUser = (data: {
  username: string; email: string; password: string; password_confirm: string;
  first_name?: string; last_name?: string; role?: string;
}) => api.post('/auth/register/', data).then(r => r.data);

export const getMe = () =>
  api.get('/auth/me/').then(r => r.data);

export const updateProfile = (data: Record<string, any>) =>
  api.patch('/auth/profile/', data).then(r => r.data);

export const uploadProfilePicture = (file: File) => {
  const formData = new FormData();
  formData.append('profile_picture', file);
  return api.post('/auth/profile/picture/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const changePassword = (data: {
  current_password: string; new_password: string; new_password_confirm: string;
}) => api.post('/auth/change-password/', data).then(r => r.data);

// ─── MFA ────────────────────────────────────────────────────
export const setupMfa = () =>
  api.post('/auth/mfa/setup/').then(r => r.data);

export const verifyMfa = (code: string) =>
  api.post('/auth/mfa/verify/', { code }).then(r => r.data);

export const disableMfa = (password: string) =>
  api.post('/auth/mfa/disable/', { password }).then(r => r.data);

// ─── Candidate Self-Service ─────────────────────────────────
export const getCandidateProfile = () =>
  api.get('/auth/candidate/profile/').then(r => r.data);

export const updateCandidateProfile = (data: Record<string, any>) =>
  api.patch('/auth/candidate/update/', data).then(r => r.data);

export const uploadCandidateResume = (file: File) => {
  const formData = new FormData();
  formData.append('resume_file', file);
  return api.post('/auth/candidate/resume/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ─── Admin User Management ──────────────────────────────────
export const getUsersWithRoles = () =>
  api.get('/auth/users/').then(r => r.data);

export const updateUserRole = (userId: number, data: { role?: string; is_active?: boolean }) =>
  api.patch(`/auth/users/${userId}/role/`, data).then(r => r.data);

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

export const setupInterviewRounds = (jobId: string) =>
  api.post(`/jobs/${jobId}/setup_interview_rounds/`).then(r => r.data);

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

export const setupCandidateInterviews = (id: string) =>
  api.post(`/candidates/${id}/setup_interviews/`).then(r => r.data);

export const submitFinalEvaluation = (id: string, data: {
  final_score: number; final_recommendation: string; final_notes: string; stage?: string;
}) => api.post(`/candidates/${id}/final_evaluation/`, data).then(r => r.data);

export const createCandidateOffer = (candidateId: string, data: Record<string, any>) =>
  api.post(`/candidates/${candidateId}/create_offer/`, data).then(r => r.data);

// ─── Interviews ───────────────────────────────────────────────
export const getInterviews = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<InterviewListItem>>('/interviews/', { params }).then(r => r.data);

export const getInterview = (id: string) =>
  api.get<InterviewDetail>(`/interviews/${id}/`).then(r => r.data);

export const createInterview = (data: Record<string, any>) =>
  api.post('/interviews/', data).then(r => r.data);

export const scheduleInterview = (id: string, data: {
  scheduled_at: string; location?: string; duration_minutes?: number;
}) => api.post(`/interviews/${id}/schedule/`, data).then(r => r.data);

export const completeInterview = (id: string, notes?: string) =>
  api.post(`/interviews/${id}/complete/`, { notes }).then(r => r.data);

export const generateInterviewQuestions = (interviewId: string) =>
  api.post(`/interviews/${interviewId}/generate_questions/`).then(r => r.data);

export const addInterviewPanel = (interviewId: string, interviewerId: number, role?: string) =>
  api.post(`/interviews/${interviewId}/add_panel/`, { interviewer_id: interviewerId, role }).then(r => r.data);

export const removeInterviewPanel = (interviewId: string, interviewerId: number) =>
  api.post(`/interviews/${interviewId}/remove_panel/`, { interviewer_id: interviewerId }).then(r => r.data);

// ─── Interview Feedback ───────────────────────────────────────
export const getInterviewFeedbacks = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<InterviewFeedback>>('/interview-feedback/', { params }).then(r => r.data);

export const submitInterviewFeedback = (feedbackId: string, data: Record<string, any>) =>
  api.post(`/interview-feedback/${feedbackId}/submit/`, data).then(r => r.data);

// ─── Offers ───────────────────────────────────────────────────
export const getOffers = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<OfferListItem>>('/offers/', { params }).then(r => r.data);

export const getOffer = (id: string) =>
  api.get<OfferDetail>(`/offers/${id}/`).then(r => r.data);

export const submitOfferForApproval = (id: string, approverIds: number[]) =>
  api.post(`/offers/${id}/submit_for_approval/`, { approver_ids: approverIds }).then(r => r.data);

export const approveOffer = (id: string, approverId: number, comments?: string) =>
  api.post(`/offers/${id}/approve/`, { approver_id: approverId, comments }).then(r => r.data);

export const sendOffer = (id: string) =>
  api.post(`/offers/${id}/send_offer/`).then(r => r.data);

export const candidateRespondOffer = (id: string, response: string, notes?: string) =>
  api.post(`/offers/${id}/candidate_respond/`, { response, notes }).then(r => r.data);

export const reviseOffer = (id: string, data: Record<string, any>) =>
  api.post(`/offers/${id}/revise/`, data).then(r => r.data);

export const markHired = (offerId: string) =>
  api.post(`/offers/${offerId}/mark_hired/`).then(r => r.data);

// ─── Users ────────────────────────────────────────────────────
export const getUsers = () =>
  api.get<UserMinimal[]>('/users/').then(r => r.data);

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
