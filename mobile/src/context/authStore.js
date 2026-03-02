import { create } from 'zustand';
import { authApi, setTokens, loadTokens, clearTokens } from '../services/api';
import socketService from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // Initialize auth state from stored tokens
  initialize: async () => {
    try {
      const { accessToken } = await loadTokens();
      if (accessToken) {
        const response = await authApi.getMe();
        set({ user: response.data, isAuthenticated: true, isLoading: false });
        socketService.connect();
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      await clearTokens();
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // Send OTP code
  sendCode: async (phone) => {
    set({ error: null });
    try {
      const response = await authApi.sendCode(phone);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send code';
      set({ error: message });
      throw new Error(message);
    }
  },

  // Verify OTP and login/register
  verify: async (phone, code, displayName = null) => {
    set({ error: null });
    try {
      const response = await authApi.verify(phone, code, displayName);
      const { user, accessToken, refreshToken } = response.data;
      
      await setTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true });
      socketService.connect();
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Verification failed';
      set({ error: message });
      throw new Error(message);
    }
  },

  // Logout
  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      socketService.disconnect();
      await clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  },

  // Update user in store
  setUser: (user) => set({ user }),

  // Clear error
  clearError: () => set({ error: null }),
}));
