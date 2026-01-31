export interface Department {
  id: string;
  name: string;
  description: string;
  positions_count: number;
}

export interface JobPosition {
  id: string;
  title: string;
  department: string;
  department_name: string;
  description: string;
  requirements: string;
  nice_to_have: string;
  experience_level: string;
  min_experience_years: number;
  max_experience_years: number;
  location: string;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  rubric_weights: Record<string, any>;
  candidates_count: number;
  candidates_reviewed: number;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_position: string;
  job_title: string;
  stage: string;
  resume_text: string;
  resume_redacted: string;
  parsed_data: Record<string, any>;
  skills: string[];
  experience_years: number | null;
  education: any[];
  age: number | null;
  guardrail_results: Record<string, any>;
  guardrail_passed: boolean | null;
  scoring_results: Record<string, any>;
  overall_score: number | null;
  confidence: number | null;
  summary_results: Record<string, any>;
  suggested_action: string;
  bias_audit_results: Record<string, any>;
  bias_flags: string[];
  bias_probes: BiasProbe[];
  agent_executions: AgentExecution[];
  reviewer_notes: string;
  reviewer_decision: string;
  final_score: number | null;
  final_recommendation: string;
  final_notes: string;
  interviews_summary: InterviewListItem[];
  offers_summary: OfferListItem[];
  created_at: string;
  updated_at: string;
}

export interface AgentExecution {
  id: string;
  candidate: string;
  agent_type: string;
  status: string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  error_message: string;
  duration_seconds: number | null;
  llm_tokens_used: number;
  created_at: string;
}

export interface BiasProbe {
  id: string;
  candidate: string;
  probe_type: string;
  scenario: string;
  original_score: number;
  probe_score: number;
  delta: number;
  components: Record<string, any>;
  explanation: string;
  flagged: boolean;
}

export interface InterviewRound {
  id: string;
  job_position: string;
  job_title: string;
  round_type: string;
  name: string;
  description: string;
  order: number;
  duration_minutes: number;
  is_required: boolean;
  pass_threshold: number;
  evaluation_criteria: string[];
}

export interface InterviewListItem {
  id: string;
  candidate: string;
  candidate_name: string;
  job_title: string;
  interview_type: string;
  interview_round: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  status: string;
  location: string;
  overall_rating: number | null;
  overall_recommendation: string;
  panel_count: number;
  feedback_count: number;
  created_at: string;
}

export interface InterviewPanel {
  id: string;
  interview: string;
  interviewer: number;
  interviewer_name: string;
  interviewer_email: string;
  role: string;
  confirmed: boolean;
  declined: boolean;
}

export interface InterviewFeedback {
  id: string;
  interview: string;
  interviewer: number;
  interviewer_name: string;
  submitted: boolean;
  submitted_at: string | null;
  technical_score: number | null;
  communication_score: number | null;
  problem_solving_score: number | null;
  culture_fit_score: number | null;
  leadership_score: number | null;
  overall_score: number | null;
  recommendation: string;
  strengths: string;
  weaknesses: string;
  notes: string;
  detailed_scores: Record<string, any>;
}

export interface InterviewDetail {
  id: string;
  candidate: string;
  candidate_name: string;
  job_title: string;
  interview_type: string;
  interview_round: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  status: string;
  location: string;
  notes: string;
  overall_rating: number | null;
  overall_recommendation: string;
  ai_suggested_questions: string[];
  panel_members: InterviewPanel[];
  feedbacks: InterviewFeedback[];
  interviewer_name: string | null;
  created_at: string;
}

// Legacy compatibility
export interface Interview {
  id: string;
  candidate: string;
  candidate_name: string;
  interview_type: string;
  interviewer: string;
  interviewer_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string;
  rating: number | null;
  ai_suggested_questions: string[];
}

export interface OfferListItem {
  id: string;
  candidate: string;
  candidate_name: string;
  job_position: string;
  job_title: string;
  status: string;
  salary: string;
  salary_currency: string;
  employment_type: string;
  start_date: string | null;
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  revision_number: number;
  approvals_count: number;
  approvals_pending: number;
  created_at: string;
  updated_at: string;
}

export interface OfferApproval {
  id: string;
  offer: string;
  approver: number;
  approver_name: string;
  order: number;
  decision: string;
  comments: string;
  decided_at: string | null;
}

export interface OfferDetail {
  id: string;
  candidate: string;
  candidate_name: string;
  job_position: string;
  job_title: string;
  created_by: number | null;
  created_by_name: string | null;
  status: string;
  salary: string;
  salary_currency: string;
  salary_period: string;
  signing_bonus: string | null;
  equity_details: string;
  bonus_structure: string;
  employment_type: string;
  start_date: string | null;
  location: string;
  is_remote: boolean;
  reporting_to: string;
  benefits_summary: string;
  offer_letter_text: string;
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  negotiation_notes: string;
  counter_offer_details: Record<string, any>;
  revision_number: number;
  candidate_response: string;
  decline_reason: string;
  approvals: OfferApproval[];
  created_at: string;
  updated_at: string;
}

export interface UserMinimal {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  candidate: string | null;
  candidate_name: string | null;
  job_position: string | null;
  message: string;
  created_at: string;
}

export interface DashboardStats {
  total_jobs: number;
  open_jobs: number;
  total_candidates: number;
  candidates_reviewed: number;
  candidates_shortlisted: number;
  candidates_rejected: number;
  avg_score: number;
  bias_flags_count: number;
  pipeline_stages: Record<string, number>;
  recent_activity: ActivityLog[];
  interviews_scheduled: number;
  interviews_completed: number;
  offers_pending: number;
  offers_sent: number;
  offers_accepted: number;
  offers_declined: number;
  total_hired: number;
}

export interface FairnessDashboard {
  total_candidates_audited: number;
  total_probes: number;
  total_flags: number;
  flag_rate: number;
  probe_stats: Array<{
    probe_type: string;
    total: number;
    flagged: number;
    avg_delta: number;
  }>;
  score_distribution: Record<string, number>;
  top_flagged_scenarios: Array<{
    scenario: string;
    count: number;
    avg_delta: number;
  }>;
  pii_detected_count: number;
  adversarial_test_results: {
    total: number;
    flagged: number;
    pass_rate: number;
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
