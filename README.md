# FairHire AI — Multi-Agent AI Hiring Platform

FairHire AI is a full-stack, production-grade hiring automation platform powered by a multi-agent AI pipeline. It automates candidate evaluation, interview management, and offer workflows while enforcing responsible AI practices through built-in bias auditing and PII redaction.

The platform implements two open agent protocols — **Model Context Protocol (MCP)** and **Agent-to-Agent (A2A)** — enabling external AI systems to interact with the hiring pipeline programmatically.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Docker Services](#docker-services)
- [AI Agent Pipeline](#ai-agent-pipeline)
- [Responsible AI](#responsible-ai)
- [API Reference](#api-reference)
- [Authentication & Authorization](#authentication--authorization)
- [Interview Management](#interview-management)
- [Offer Workflow](#offer-workflow)
- [Email Notifications](#email-notifications)
- [MCP Server](#mcp-server)
- [A2A Server](#a2a-server)
- [Frontend Pages](#frontend-pages)
- [Data Models](#data-models)
- [Configuration](#configuration)
- [Development](#development)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 18 + TypeScript (Port 3047)                       │
│  Dashboard | Candidates | Jobs | Interviews | Offers | Fairness     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ REST API + Token Auth (Axios / Proxy)
┌─────────────────────────▼───────────────────────────────────────────┐
│  BACKEND API — Django 5.2 + DRF + Gunicorn (Port 8046)              │
│  Auth (Token+Session+MFA) | ViewSets | Signals | Notifications      │
└────────┬────────────────────────────────────────┬───────────────────┘
         │ Celery Tasks (Async)                   │
┌────────▼───────────────────────┐  ┌─────────────▼──────────────────┐
│  AI AGENT PIPELINE             │  │  PROTOCOL SERVERS              │
│  Orchestrator ──────────────►  │  │                                │
│  1. Resume Parser              │  │  MCP Server (Port 8146)        │
│  2. Guardrail Checker          │  │  - 8 tools exposed             │
│  3. Scoring Agent              │  │  - JSON-RPC transport          │
│  4. Summary Agent              │  │                                │
│  5. Bias Auditor               │  │  A2A Server (Port 8246)        │
│  + AI Questions + AI Letters   │  │  - 6 agent cards               │
└────────┬───────────────────────┘  │  - Agent discovery             │
         │                          └────────────────────────────────┘
┌────────▼───────────────────────────────────────────────────────────┐
│  DATA & INFRASTRUCTURE — Docker Compose                             │
│  PostgreSQL 16 | Redis 7 | Celery Workers | Media Volume | LLM API │
└─────────────────────────────────────────────────────────────────────┘
```

A draw.io diagram (`architecture.drawio`) and PowerPoint deck (`FairHire_Architecture.pptx`) are included in the repository root for presentations.

---

## Key Features

### AI-Powered Candidate Evaluation
- **Automated resume parsing** — Extracts skills, experience, education, and work history from PDF, DOCX, and TXT resumes using LLM-based structured extraction.
- **Policy guardrails** — Validates candidates against configurable hiring policies (experience thresholds, required skills, education requirements) before scoring.
- **Rubric-based scoring** — Weighted multi-component scoring (0–1 scale) with configurable rubric weights per job position.
- **AI summarization** — Generates pros/cons lists, suggested actions (Accept/Reject/Further Evaluation), risk factors, and interview recommendations.
- **Bulk evaluation** — Process all new candidates for a job position in a single action.

### Responsible AI & Bias Auditing
- **Name swap probes** — Replaces candidate names with names from different demographic groups and compares scores to detect name-based bias.
- **Proxy attribute flips** — Changes proxy attributes (schools, locations, hobbies) to detect indirect discrimination signals.
- **Adversarial testing** — Injects prompt manipulation text into resumes to verify agents resist gaming attempts.
- **PII redaction** — Automatically strips personal identifiers before scoring to enable blind evaluation.
- **Fairness dashboard** — Visual metrics showing bias probe results, score differentials, and audit history per job position.

### Interview Management
- **Auto-interview creation** — When a candidate is shortlisted (manually or by the AI pipeline), 3 default interview rounds (Phone Screen, Technical, Behavioral) are automatically created.
- **AI question generation** — Generates 5–8 tailored interview questions based on the candidate's skills, experience, job requirements, and interview type.
- **Panel management** — Assign interviewers as Lead, Member, Observer, or Shadow. The hiring manager is auto-assigned as panel lead.
- **Structured feedback** — Scorecards with technical, communication, problem-solving, culture fit, leadership, and overall scores (1–5) plus written assessments.
- **Rating computation** — Automatic aggregation of panel feedback into an overall interview rating.

### Offer Workflow
- **AI offer letter generation** — Creates professional offer letters using LLM based on compensation, role details, and candidate information.
- **Multi-step approval chain** — Submit offers for approval with ordered approver lists. All must approve before the offer can be sent.
- **Email notifications** — Automatic emails to candidates (offer sent), hiring managers (accepted/declined), and approvers (approval requested).
- **Negotiation tracking** — Revision history, counter-offer details, and negotiation notes.
- **Offer lifecycle** — Drafting → Pending Approval → Approved → Sent → Accepted/Declined/Negotiating → Hired.

### Authentication & Security
- **Dual authentication** — Token-based (localStorage, survives refreshes) + Session-based (cookies).
- **TOTP MFA** — Time-based one-time passwords with QR code setup and backup recovery codes.
- **Role-based access** — 6 roles: Admin, HR, Hiring Manager, Interviewer, Candidate, Viewer.
- **Candidate self-service portal** — Candidates can view their application status, update profiles, and upload resumes.
- **CSRF protection** — Enforced on session-authenticated requests.

### Protocol Support
- **MCP (Model Context Protocol)** — Exposes 8 tools for external AI systems to parse resumes, run evaluations, and query candidate data.
- **A2A (Agent-to-Agent)** — Publishes 6 agent cards for inter-agent discovery and communication.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React, TypeScript, React Router | 18.3, 4.9, 6.26 |
| **UI Libraries** | Recharts, Lucide React, Axios | 2.12, 0.400, 1.7 |
| **Backend** | Django, Django REST Framework | 5.2, 3.15 |
| **Database** | PostgreSQL | 16 |
| **Cache / Broker** | Redis | 7 |
| **Task Queue** | Celery, Celery Beat | 5.4 |
| **AI / LLM** | OpenAI API (gpt-4o-mini default) | 1.50+ |
| **Auth** | DRF TokenAuth, pyotp (TOTP MFA) | — |
| **Document Parsing** | PyPDF2, python-docx, Pillow | 3.0, 1.1, 10.4 |
| **Protocols** | MCP (JSON-RPC), A2A (HTTP) | Custom |
| **Container** | Docker, Docker Compose | — |
| **WSGI Server** | Gunicorn | 23.0 |

---

## Project Structure

```
AI-Hiring-Agent/
├── backend/
│   ├── fairhire/
│   │   ├── settings.py                 # Django configuration
│   │   ├── urls.py                     # Root URL routing
│   │   ├── wsgi.py                     # WSGI entry point
│   │   ├── celery.py                   # Celery app config
│   │   ├── core/
│   │   │   ├── models.py              # 14 data models
│   │   │   ├── services.py            # Shared business logic (auto-interviews)
│   │   │   ├── signals.py             # Django signals (auto-setup on shortlist)
│   │   │   ├── notifications.py       # Email notification service
│   │   │   └── apps.py                # AppConfig with signal registration
│   │   ├── api/
│   │   │   ├── views.py               # 11 ViewSets + custom actions
│   │   │   ├── serializers.py         # DRF serializers (list/detail/create)
│   │   │   ├── auth_views.py          # Auth endpoints (login/register/MFA)
│   │   │   └── urls.py                # API URL routing
│   │   ├── agents/
│   │   │   ├── orchestrator.py        # Pipeline controller
│   │   │   ├── parser_agent.py        # Resume parsing agent
│   │   │   ├── guardrail_agent.py     # Policy validation agent
│   │   │   ├── scorer_agent.py        # Rubric scoring agent
│   │   │   ├── summary_agent.py       # Summary & recommendation agent
│   │   │   ├── bias_auditor_agent.py  # Responsible AI probes
│   │   │   ├── llm_client.py          # OpenAI API client wrapper
│   │   │   └── tasks.py               # Celery async tasks
│   │   ├── mcp/
│   │   │   └── server.py              # MCP server (8 tools)
│   │   └── a2a/
│   │       └── server.py              # A2A server (6 agent cards)
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Root component + routing
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx         # Auth state management
│   │   ├── services/
│   │   │   └── api.ts                 # API client (Axios + token auth)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Pipeline stats & KPIs
│   │   │   ├── CandidatesPage.tsx     # Candidate list & upload
│   │   │   ├── CandidateDetailPage.tsx # Full candidate profile
│   │   │   ├── JobsPage.tsx           # Job positions & departments
│   │   │   ├── JobDetailPage.tsx      # Job details & bulk evaluate
│   │   │   ├── InterviewsPage.tsx     # Interview scheduling & AI questions
│   │   │   ├── OffersPage.tsx         # Offer management & AI letters
│   │   │   ├── FairnessPage.tsx       # Responsible AI dashboard
│   │   │   ├── ActivityPage.tsx       # Audit trail
│   │   │   ├── LoginPage.tsx          # Authentication
│   │   │   ├── RegisterPage.tsx       # User registration
│   │   │   ├── ProfilePage.tsx        # User settings & MFA
│   │   │   ├── UsersPage.tsx          # Admin user management
│   │   │   └── CandidatePortalPage.tsx # Candidate self-service
│   │   ├── components/
│   │   │   └── Loading.tsx            # Loading spinner
│   │   ├── hooks/
│   │   │   └── useApi.ts             # Data fetching hook
│   │   └── types/
│   │       └── index.ts              # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml                 # 8-service orchestration
├── architecture.drawio                # Draw.io architecture diagram
├── FairHire_Architecture.pptx         # PowerPoint presentation
└── README.md                          # This file
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- An OpenAI API key (or compatible endpoint)

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd AI-Hiring-Agent

# 2. Set your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# 3. Start all services
docker compose up --build

# 4. Access the application
#    Frontend:  http://localhost:3047
#    Backend:   http://localhost:8046/api/
#    MCP:       http://localhost:8146
#    A2A:       http://localhost:8246
```

### Default Credentials

On first startup, a superuser is automatically created:
- **Username:** `admin`
- **Password:** `admin` (change in production)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` | Custom LLM endpoint (Ollama, etc.) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use for AI agents |
| `DATABASE_URL` | (set in compose) | PostgreSQL connection string |
| `REDIS_URL` | (set in compose) | Redis connection string |
| `DJANGO_SECRET_KEY` | (set in compose) | Django secret key |
| `DJANGO_DEBUG` | `True` | Debug mode |
| `CORS_ALLOWED_ORIGINS` | (set in compose) | Allowed CORS origins |
| `CSRF_TRUSTED_ORIGINS` | (set in compose) | Trusted CSRF origins |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Email backend |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_HOST_USER` | (empty) | SMTP username |
| `EMAIL_HOST_PASSWORD` | (empty) | SMTP password |
| `DEFAULT_FROM_EMAIL` | `FairHire <noreply@fairhire.ai>` | Sender email |
| `FRONTEND_URL` | `http://localhost:3047` | Frontend URL for email links |

---

## Docker Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| **postgres** | `fairhire-postgres` | 5446 | PostgreSQL 16 database |
| **redis** | `fairhire-redis` | 6346 | Redis 7 (Celery broker + cache) |
| **backend** | `fairhire-backend` | 8046 | Django REST API (Gunicorn, 4 workers) |
| **celery-worker** | `fairhire-celery-worker` | — | Async agent execution (4 concurrent, 2 queues) |
| **celery-beat** | `fairhire-celery-beat` | — | Scheduled task runner |
| **mcp-server** | `fairhire-mcp-server` | 8146 | Model Context Protocol server |
| **a2a-server** | `fairhire-a2a-server` | 8246 | Agent-to-Agent Protocol server |
| **frontend** | `fairhire-frontend` | 3047 | React development server |

All services run on a shared `fairhire-net` Docker bridge network. The backend volume-mounts `./backend` for live code reloading. The frontend mounts `./frontend/src` and `./frontend/public` for hot module replacement.

---

## AI Agent Pipeline

The evaluation pipeline processes candidates through 5 specialized agents, orchestrated sequentially:

### 1. Resume Parser (`parser_agent.py`)
- **Input:** Raw resume text (extracted from PDF/DOCX/TXT)
- **Output:** Structured JSON with `first_name`, `last_name`, `email`, `phone`, `skills[]`, `experience_years`, `education[]`, `work_history[]`, `certifications[]`, `summary`
- **Method:** LLM-based structured extraction with JSON schema enforcement

### 2. Guardrail Checker (`guardrail_agent.py`)
- **Input:** Parsed candidate data + job position requirements
- **Output:** Pass/fail results for `experience_check`, `skills_check`, `education_check`, `age_check`, `overall`
- **Purpose:** Enforces mandatory hiring policies before subjective scoring. Candidates failing critical guardrails are flagged.

### 3. Scoring Agent (`scorer_agent.py`)
- **Input:** PII-redacted resume text + job requirements + rubric weights
- **Output:** Component scores (technical skills, experience relevance, education, communication, leadership), weighted overall score (0–1), confidence level, reasoning
- **Method:** Rubric-based evaluation with configurable weights per job position. PII is redacted before scoring to prevent bias.

### 4. Summary Agent (`summary_agent.py`)
- **Input:** All previous agent results (parsed data, guardrail outcomes, scores)
- **Output:** `pros[]`, `cons[]`, `suggested_action` (Accept/Reject/Further Evaluation), `detailed_reasoning`, `risk_factors[]`, `interview_recommendations[]`
- **Purpose:** Consolidates all signals into a human-readable assessment for hiring managers.

### 5. Bias Auditor (`bias_auditor_agent.py`)
- **Input:** Original resume text + scoring results
- **Output:** Name swap probe results, proxy flip probe results, adversarial test results, PII scan results
- **Purpose:** Responsible AI compliance — ensures the pipeline produces fair, unbiased evaluations.

### Orchestrator (`orchestrator.py`)
- Runs agents sequentially: Parser → PII Redact → Guardrails → Scoring → Summary → Bias Audit
- Creates `AgentExecution` records for each step (input, output, duration, tokens used)
- Auto-shortlists candidates with `suggested_action == "Accept"` and passed guardrails
- Auto-creates interview rounds on shortlisting via Django signals

### Additional AI Features
- **AI Interview Questions** — Generates 5–8 context-aware questions per interview based on candidate profile and interview type
- **AI Offer Letters** — Creates professional offer letters from compensation and role details
- **PII Redaction** — Strips names, emails, phones, and addresses before scoring

---

## Responsible AI

FairHire implements a comprehensive responsible AI framework:

### Bias Probe Types

| Probe | Method | What It Detects |
|-------|--------|-----------------|
| **Name Swap** | Replaces candidate name with names from different demographic groups | Name-based or ethnic bias in scoring |
| **Proxy Flip** | Changes school names, locations, hobbies to different demographics | Indirect discrimination through proxy attributes |
| **Adversarial** | Injects "ignore all instructions" text into resumes | Susceptibility to prompt injection attacks |
| **PII Scan** | Identifies personal identifiers in input data | Ensures PII is properly redacted before scoring |

### Fairness Dashboard
- Per-job bias statistics with visual charts
- Score differential tracking (flags >10% variation between probes)
- Agent performance metrics (execution times, token usage, error rates)
- Complete audit trail with metadata

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/csrf/` | Get CSRF token |
| POST | `/api/auth/login/` | Login (supports MFA) |
| POST | `/api/auth/logout/` | Logout |
| POST | `/api/auth/register/` | Register new user |
| GET | `/api/auth/me/` | Current user profile + token |
| PATCH | `/api/auth/profile/` | Update profile |
| POST | `/api/auth/profile/picture/` | Upload profile picture |
| POST | `/api/auth/change-password/` | Change password |
| POST | `/api/auth/mfa/setup/` | Setup TOTP MFA |
| POST | `/api/auth/mfa/verify/` | Verify MFA code |
| POST | `/api/auth/mfa/disable/` | Disable MFA |
| GET | `/api/auth/candidate/profile/` | Candidate portal profile |
| PATCH | `/api/auth/candidate/update/` | Candidate self-update |
| POST | `/api/auth/candidate/resume/` | Upload resume |
| GET | `/api/auth/users/` | List users with roles (admin) |
| PATCH | `/api/auth/users/{id}/role/` | Update user role (admin) |

### Resource Endpoints (CRUD + Custom Actions)

| Resource | Base URL | Custom Actions |
|----------|----------|----------------|
| Departments | `/api/departments/` | — |
| Jobs | `/api/jobs/` | `bulk_evaluate`, `pipeline_stats`, `setup_interview_rounds` |
| Candidates | `/api/candidates/` | `evaluate`, `run_agent`, `update_stage`, `review`, `bias_report`, `setup_interviews`, `final_evaluation`, `create_offer` |
| Interviews | `/api/interviews/` | `generate_questions`, `schedule`, `complete`, `add_panel`, `remove_panel` |
| Interview Rounds | `/api/interview-rounds/` | — |
| Interview Feedback | `/api/interview-feedback/` | `submit` |
| Offers | `/api/offers/` | `generate_letter`, `submit_for_approval`, `approve`, `reject_approval`, `send_offer`, `candidate_respond`, `revise`, `mark_hired` |
| Hiring Team | `/api/hiring-team/` | — |
| Templates | `/api/templates/` | — |
| Activity Log | `/api/activity/` | — (read-only) |
| Executions | `/api/executions/` | — (read-only) |

### Dashboard & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/` | Pipeline statistics and KPIs |
| GET | `/api/responsible-ai/fairness-dashboard/` | Bias audit statistics |
| GET | `/api/responsible-ai/agent-performance/` | Agent execution metrics |

---

## Authentication & Authorization

### Token Authentication (Primary)
The frontend stores an authentication token in `localStorage` and sends it with every request:
```
Authorization: Token <key>
```
Tokens are created on login/register and returned in the response. This method survives page refreshes and works across origins.

### Session Authentication (Secondary)
Standard Django session cookies with CSRF protection on unsafe methods. Used as a fallback when token auth is not available.

### MFA (Multi-Factor Authentication)
- TOTP-based (RFC 6238) using `pyotp`
- Setup generates a secret + QR code for authenticator apps
- 8 backup recovery codes generated on setup
- Required on login when enabled (pass `mfa_code` with credentials)

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features and user management |
| **HR** | All hiring features (candidates, interviews, offers) |
| **Hiring Manager** | Job creation, interview management, offer approval |
| **Interviewer** | Conduct interviews and submit feedback |
| **Candidate** | Self-service portal (view status, upload resume) |
| **Viewer** | Read-only access to pipeline data |

---

## Interview Management

### Automatic Interview Setup
When a candidate reaches the `SHORTLISTED` stage (either manually or via AI auto-shortlisting):
1. **3 default interview rounds** are created: Phone Screen (30 min), Technical (60 min), Behavioral (45 min)
2. **The hiring manager** (job creator) is auto-assigned as panel lead for all rounds
3. **Feedback slots** are created for each panel member

### AI Question Generation
The `AI Q` button generates 5–8 tailored questions considering:
- Job title and requirements
- Candidate skills and experience level
- Interview type (phone, technical, behavioral, panel, final)
- AI evaluation summary

### Interview Workflow
```
Draft → Scheduled → Completed → (feeds into candidate evaluation)
```

### Panel Roles
- **Lead** — Primary interviewer, manages the session
- **Member** — Active participant, submits independent feedback
- **Observer** — Watches but may not submit feedback
- **Shadow** — Learning role (new interviewers)

---

## Offer Workflow

### Lifecycle
```
Drafting → Pending Approval → Approved → Sent → Accepted/Declined/Negotiating → Hired
```

### AI Offer Letter Generation
Click "Generate Offer Letter (AI)" to create a professional letter including:
- Candidate greeting and position details
- Compensation (salary, bonuses, equity)
- Benefits summary and employment type
- Start date and location
- Warm professional closing

Letters can be downloaded as text files.

### Approval Chain
1. Submit offer with ordered list of approvers
2. Each approver receives an email notification
3. All must approve before the offer status changes to "Approved"
4. Any rejection blocks the offer

### Negotiation
- Revise salary, signing bonus, benefits, and equity
- Revision number increments automatically
- Negotiation notes preserved for audit trail

---

## Email Notifications

Emails are sent automatically at key workflow events:

| Event | Recipients | Content |
|-------|-----------|---------|
| **Offer Sent** | Candidate | Full offer details + letter text |
| **Offer Accepted** | Hiring Manager | Confirmation + next steps |
| **Offer Declined** | Hiring Manager | Decline reason |
| **Approval Requested** | Each Approver | Offer summary + approve link |
| **Interview Scheduled** | Candidate + Panel | Date, time, location, type |
| **Feedback Submitted** | Hiring Manager | Scores + recommendation |
| **Candidate Shortlisted** | Hiring Manager | AI recommendation + score |

### Configuration
By default, emails are printed to the Docker logs (console backend). For production SMTP:

```yaml
# docker-compose.yml — backend environment
- EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
- EMAIL_HOST=smtp.gmail.com
- EMAIL_PORT=587
- EMAIL_HOST_USER=your@email.com
- EMAIL_HOST_PASSWORD=your-app-password
- EMAIL_USE_TLS=True
- DEFAULT_FROM_EMAIL=FairHire <noreply@fairhire.ai>
```

---

## MCP Server

The Model Context Protocol server (port 8146) exposes hiring pipeline tools for external AI systems:

| Tool | Description |
|------|-------------|
| `parse_resume` | Parse a resume file and extract structured data |
| `check_guardrails` | Run policy validation checks on a candidate |
| `score_candidate` | Score a candidate using the rubric evaluation |
| `generate_summary` | Generate an AI summary with recommendation |
| `run_bias_audit` | Execute responsible AI bias probes |
| `run_full_pipeline` | Run the complete evaluation pipeline |
| `list_candidates` | Query candidates with optional stage filtering |
| `get_candidate_report` | Get a full evaluation report for a candidate |

### Usage
MCP-compatible clients (Claude Desktop, etc.) can connect to `http://localhost:8146` and invoke these tools using JSON-RPC.

---

## A2A Server

The Agent-to-Agent server (port 8246) publishes agent cards for inter-agent discovery:

| Agent Card ID | Capabilities |
|---------------|-------------|
| `fairhire-resume-parser` | `parse_resume`, `extract_skills`, `extract_experience` |
| `fairhire-guardrail-checker` | `check_experience`, `check_age`, `check_skills`, `check_education` |
| `fairhire-scorer` | `score_candidate`, `rubric_evaluation` |
| `fairhire-summarizer` | `generate_summary`, `recommend_action` |
| `fairhire-bias-auditor` | `name_swap_probe`, `proxy_flip_probe`, `adversarial_probe`, `pii_scan` |
| `fairhire-orchestrator` | `run_pipeline`, `bulk_evaluate` |

External agents can discover these capabilities at `http://localhost:8246/.well-known/agent.json`.

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Pipeline overview with stage distribution, recent activity, and KPIs |
| **Jobs** | `/jobs` | Create and manage job positions with department assignment |
| **Job Detail** | `/jobs/:id` | Job details, pipeline stats, bulk evaluate, candidate list |
| **Candidates** | `/candidates` | Upload resumes, filter by stage/job, view evaluation status |
| **Candidate Detail** | `/candidates/:id` | Full profile with agent results, bias report, stage management |
| **Interviews** | `/interviews` | Schedule interviews, generate AI questions, manage panels, submit feedback |
| **Offers** | `/offers` | Generate AI letters, approval workflow, send offers, track responses |
| **Fairness** | `/fairness` | Responsible AI dashboard with bias probe results and metrics |
| **Activity** | `/activity` | Searchable audit trail of all hiring events |
| **Login** | `/login` | Authentication with MFA support |
| **Register** | `/register` | Self-service registration (candidate and viewer roles) |
| **Profile** | `/profile` | User settings, password change, MFA setup/disable |
| **Users** | `/users` | Admin user management and role assignment |
| **Candidate Portal** | `/` (candidate role) | Self-service view for candidates to track their application |

---

## Data Models

### Core Models (14 total)

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **UserProfile** | role, mfa_secret, mfa_enabled, linked_candidate | User roles and MFA |
| **Department** | name, description | Organization structure |
| **JobPosition** | title, department, requirements, salary_min/max, rubric_weights | Job openings |
| **HiringTeamMember** | user, role, expertise_areas, max_interviews_per_week | Interviewer profiles |
| **Candidate** | stage (28 stages), resume data, scores, skills, bias_audit_results | Full pipeline data |
| **AgentExecution** | agent_type, status, input/output data, duration, tokens_used | Agent execution logs |
| **BiasProbe** | probe_type, original_score, probe_score, delta, flagged | Bias test results |
| **InterviewRound** | job_position, round_type, order, duration, pass_threshold | Interview templates |
| **Interview** | candidate, round, type, scheduled_at, ai_suggested_questions | Individual interviews |
| **InterviewPanel** | interview, interviewer, role (lead/member/observer/shadow) | Panel assignments |
| **InterviewFeedback** | scores (6 dimensions), recommendation, strengths, weaknesses | Scorecards |
| **Offer** | salary, benefits, offer_letter_text, status (9 stages) | Job offers |
| **OfferApproval** | approver, decision, order, comments | Approval chain |
| **ActivityLog** | event_type (11 types), candidate, message, metadata | Audit trail |
| **EvaluationTemplate** | rubric_weights, policies | Reusable scoring rubrics |

### Candidate Stage Pipeline (28 stages)

```
NEW → PARSING → PARSED → GUARDRAIL_CHECK → SCORING → SCORED →
SUMMARIZING → SUMMARIZED → BIAS_AUDIT → REVIEWED →
SHORTLISTED → INTERVIEW_SETUP → PHONE_SCREEN →
TECHNICAL_INTERVIEW → BEHAVIORAL_INTERVIEW →
PANEL_INTERVIEW → FINAL_INTERVIEW → INTERVIEW_COMPLETE →
FINAL_EVALUATION → APPROVED_FOR_OFFER → OFFER_DRAFTING →
OFFER_APPROVAL → OFFER_EXTENDED → OFFER_NEGOTIATION →
OFFER_ACCEPTED / OFFER_DECLINED → HIRED / REJECTED / WITHDRAWN / ON_HOLD
```

---

## Configuration

### Using a Custom LLM (Ollama, Azure, etc.)
Set `OPENAI_API_BASE` to your endpoint:
```bash
export OPENAI_API_BASE=http://localhost:11434/v1  # Ollama
export OPENAI_MODEL=llama3.1
```

### Production Checklist
- [ ] Change `DJANGO_SECRET_KEY` to a strong random value
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Configure real SMTP email settings
- [ ] Set `CORS_ALLOWED_ORIGINS` to your domain
- [ ] Change default admin password
- [ ] Enable HTTPS (reverse proxy)
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Configure proper PostgreSQL credentials
- [ ] Set up database backups

---

## Development

### Backend Hot Reload
The `./backend` directory is volume-mounted into the container. Gunicorn will pick up changes on restart. For live reload during development, you can use Django's dev server instead:

```bash
docker compose exec backend python manage.py runserver 0.0.0.0:8046
```

### Frontend Hot Reload
The `./frontend/src` and `./frontend/public` directories are volume-mounted. React's dev server provides instant hot module replacement.

Changes to `package.json` or `Dockerfile` require a container rebuild:
```bash
docker compose up --build frontend
```

### Running Management Commands
```bash
# Django shell
docker compose exec backend python manage.py shell

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Run migrations
docker compose exec backend python manage.py migrate

# View logs
docker compose logs -f backend celery-worker
```

### Celery Task Monitoring
```bash
# Watch Celery worker output
docker compose logs -f celery-worker

# Inspect active tasks
docker compose exec celery-worker celery -A fairhire inspect active
```

---

## License

This project is proprietary software. All rights reserved.
