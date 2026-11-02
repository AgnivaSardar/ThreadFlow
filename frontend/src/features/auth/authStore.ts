import { create } from 'zustand';
import { User, Role, AuthResponse } from '../../types';
import { apiRequest, setApiAccessToken } from '../../services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

// Retrieve cached session from localStorage on initial load
const savedUser = localStorage.getItem('threadflow_user');
const savedToken = localStorage.getItem('threadflow_token');

if (savedToken) {
  setApiAccessToken(savedToken);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  accessToken: savedToken || null,
  isAuthenticated: !!savedToken && !!savedUser,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const { accessToken, user } = response;
      setApiAccessToken(accessToken);
      localStorage.setItem('threadflow_token', accessToken);
      localStorage.setItem('threadflow_user', JSON.stringify(user));

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout request warning:', err);
    } finally {
      setApiAccessToken(null);
      localStorage.removeItem('threadflow_token');
      localStorage.removeItem('threadflow_user');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  refreshSession: async () => {
    try {
      const response = await apiRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
      });
      const { accessToken, user } = response;
      setApiAccessToken(accessToken);
      localStorage.setItem('threadflow_token', accessToken);
      localStorage.setItem('threadflow_user', JSON.stringify(user));

      set({
        user,
        accessToken,
        isAuthenticated: true,
      });
      return true;
    } catch {
      get().logout();
      return false;
    }
  },

  clearError: () => set({ error: null }),

  hasRole: (...roles: Role[]) => {
    const { user } = get();
    if (!user) return false;
    return roles.includes(user.role);
  },
}));
