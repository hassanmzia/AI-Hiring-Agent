import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import Dashboard from './pages/Dashboard';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import CandidatesPage from './pages/CandidatesPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import FairnessPage from './pages/FairnessPage';
import InterviewsPage from './pages/InterviewsPage';
import ActivityPage from './pages/ActivityPage';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <h1>FAIRHire</h1>
            <p>AI-Powered Responsible Hiring</p>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section">Overview</div>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/activity">Activity Feed</NavLink>

            <div className="sidebar-section">Hiring Pipeline</div>
            <NavLink to="/jobs">Job Positions</NavLink>
            <NavLink to="/candidates">Candidates</NavLink>
            <NavLink to="/interviews">Interviews</NavLink>

            <div className="sidebar-section">Responsible AI</div>
            <NavLink to="/fairness">Fairness & Bias</NavLink>
          </nav>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/:id" element={<CandidateDetailPage />} />
            <Route path="/fairness" element={<FairnessPage />} />
            <Route path="/interviews" element={<InterviewsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
