import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Loading from './components/Loading';
import Dashboard from './pages/Dashboard';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import CandidatesPage from './pages/CandidatesPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import FairnessPage from './pages/FairnessPage';
import InterviewsPage from './pages/InterviewsPage';
import OffersPage from './pages/OffersPage';
import ActivityPage from './pages/ActivityPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import CandidatePortalPage from './pages/CandidatePortalPage';

const SidebarNav: React.FC<{ closeSidebar: () => void }> = ({ closeSidebar }) => {
  const { isCandidate, isAdmin } = useAuth();

  return (
    <nav className="sidebar-nav">
      {isCandidate ? (
        <>
          <div className="sidebar-section">My Portal</div>
          <NavLink to="/" end onClick={closeSidebar}>My Application</NavLink>
          <NavLink to="/profile" onClick={closeSidebar}>My Profile</NavLink>
        </>
      ) : (
        <>
          <div className="sidebar-section">Overview</div>
          <NavLink to="/" end onClick={closeSidebar}>Dashboard</NavLink>
          <NavLink to="/activity" onClick={closeSidebar}>Activity Feed</NavLink>

          <div className="sidebar-section">Hiring Pipeline</div>
          <NavLink to="/jobs" onClick={closeSidebar}>Job Positions</NavLink>
          <NavLink to="/candidates" onClick={closeSidebar}>Candidates</NavLink>
          <NavLink to="/interviews" onClick={closeSidebar}>Interviews</NavLink>
          <NavLink to="/offers" onClick={closeSidebar}>Offers</NavLink>

          <div className="sidebar-section">Responsible AI</div>
          <NavLink to="/fairness" onClick={closeSidebar}>Fairness & Bias</NavLink>

          {isAdmin && (
            <>
              <div className="sidebar-section">Administration</div>
              <NavLink to="/users" onClick={closeSidebar}>User Management</NavLink>
            </>
          )}

          <div className="sidebar-section">Account</div>
          <NavLink to="/profile" onClick={closeSidebar}>My Profile</NavLink>
        </>
      )}
    </nav>
  );
};

const AppContent: React.FC = () => {
  const { user, loading, logout, isCandidate, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>

      {/* Overlay for closing sidebar on mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>FAIRHire</h1>
          <p>AI-Powered Responsible Hiring</p>
        </div>
        <SidebarNav closeSidebar={closeSidebar} />

        {/* User info at bottom */}
        <div style={{
          padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)',
          marginTop: 'auto', fontSize: '0.8rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', color: '#fff', overflow: 'hidden', flexShrink: 0,
            }}>
              {user.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.full_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>{user.role_display}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius)',
              color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.75rem',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          {isCandidate ? (
            <>
              <Route path="/" element={<CandidatePortalPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/candidates" element={<CandidatesPage />} />
              <Route path="/candidates/:id" element={<CandidateDetailPage />} />
              <Route path="/fairness" element={<FairnessPage />} />
              <Route path="/interviews" element={<InterviewsPage />} />
              <Route path="/offers" element={<OffersPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;
