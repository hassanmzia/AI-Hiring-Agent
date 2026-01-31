import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getMe, loginUser, logoutUser, registerUser, fetchCsrfToken,
  setAuthToken, getAuthToken,
} from '../services/api';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  is_superuser: boolean;
  is_active: boolean;
  mfa_enabled: boolean;
  profile_picture_url: string | null;
  phone: string;
  title: string;
  department: string;
  bio: string;
  linked_candidate_id: string | null;
  date_joined: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string, mfaCode?: string) => Promise<any>;
  register: (data: {
    username: string; email: string; password: string; password_confirm: string;
    first_name?: string; last_name?: string; role?: string;
  }) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isHR: boolean;
  isInterviewer: boolean;
  isCandidate: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      // Keep token fresh from server response
      if (data.token) {
        setAuthToken(data.token);
      }
      setUser(data);
    } catch {
      setUser(null);
      setAuthToken(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // Try CSRF token (for session auth fallback)
        try { await fetchCsrfToken(); } catch { /* ignore */ }
        // If we have a stored token, try to restore the session
        if (getAuthToken()) {
          await refreshUser();
        } else {
          setUser(null);
        }
      } catch { /* not logged in */ }
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = async (username: string, password: string, mfaCode?: string) => {
    try { await fetchCsrfToken(); } catch { /* ignore */ }
    const data = await loginUser({ username, password, mfa_code: mfaCode });
    if (data.mfa_required) {
      return data; // Caller handles MFA prompt
    }
    // Store auth token for persistent authentication
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data);
    return data;
  };

  const register = async (data: {
    username: string; email: string; password: string; password_confirm: string;
    first_name?: string; last_name?: string; role?: string;
  }) => {
    try { await fetchCsrfToken(); } catch { /* ignore */ }
    const result = await registerUser(data);
    if (result.token) {
      setAuthToken(result.token);
    }
    setUser(result);
    return result;
  };

  const logout = async () => {
    try { await logoutUser(); } catch { /* ignore */ }
    setAuthToken(null);
    setUser(null);
  };

  const role = user?.role || '';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAdmin: role === 'admin' || !!user?.is_superuser,
      isHR: ['admin', 'hr'].includes(role) || !!user?.is_superuser,
      isInterviewer: ['admin', 'hr', 'interviewer', 'hiring_manager'].includes(role) || !!user?.is_superuser,
      isCandidate: role === 'candidate',
    }}>
      {children}
    </AuthContext.Provider>
  );
};
