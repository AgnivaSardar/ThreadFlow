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
  registerBuyer: (data: {
    companyName: string;
    name: string;
    country: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  hasRole: (...roles: Role[]) => boolean;
  updateUser: (updatedUser: User) => void;
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
      const refreshToken = (response as any).refreshToken;
      setApiAccessToken(accessToken);
      localStorage.setItem('threadflow_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('threadflow_refresh_token', refreshToken);
      }
      localStorage.setItem('threadflow_user', JSON.stringify(user));
      localStorage.setItem('threadflow_last_activity', String(Date.now()));

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

  registerBuyer: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<AuthResponse>('/auth/register-buyer', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const { accessToken, user } = response;
      const refreshToken = (response as any).refreshToken;
      setApiAccessToken(accessToken);
      localStorage.setItem('threadflow_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('threadflow_refresh_token', refreshToken);
      }
      localStorage.setItem('threadflow_user', JSON.stringify(user));
      localStorage.setItem('threadflow_last_activity', String(Date.now()));

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return user;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Registration failed' });
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
      localStorage.removeItem('threadflow_refresh_token');
      localStorage.removeItem('threadflow_user');
      localStorage.removeItem('threadflow_last_activity');
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
      const refreshToken = (response as any).refreshToken;
      setApiAccessToken(accessToken);
      localStorage.setItem('threadflow_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('threadflow_refresh_token', refreshToken);
      }
      localStorage.setItem('threadflow_user', JSON.stringify(user));
      localStorage.setItem('threadflow_last_activity', String(Date.now()));

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

  forgotPassword: async (email: string) => {
    try {
      const response = await apiRequest<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return response;
    } catch (err: any) {
      return {
        success: true,
        message: err.message || `A verification code has been dispatched to ${email}.`,
      };
    }
  },

  verifyOtp: async (email: string, otp: string) => {
    return await apiRequest<{ success: boolean; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    return await apiRequest<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },

  hasRole: (...roles: Role[]) => {
    const { user } = get();
    if (!user) return false;
    return roles.includes(user.role);
  },

  updateUser: (updatedUser: User) => {
    localStorage.setItem('threadflow_user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },
}));
