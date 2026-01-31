import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, loginUser, logoutUser, registerUser, fetchCsrfToken } from '../services/api';

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
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken();
        await refreshUser();
      } catch { /* not logged in */ }
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = async (username: string, password: string, mfaCode?: string) => {
    await fetchCsrfToken();
    const data = await loginUser({ username, password, mfa_code: mfaCode });
    if (data.mfa_required) {
      return data; // Caller handles MFA prompt
    }
    setUser(data);
    return data;
  };

  const register = async (data: {
    username: string; email: string; password: string; password_confirm: string;
    first_name?: string; last_name?: string; role?: string;
  }) => {
    await fetchCsrfToken();
    const result = await registerUser(data);
    setUser(result);
    return result;
  };

  const logout = async () => {
    try { await logoutUser(); } catch { /* ignore */ }
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
