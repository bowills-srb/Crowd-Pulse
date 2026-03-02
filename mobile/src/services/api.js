import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api')
  : 'https://api.crowdpulse.app/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken = null;
let refreshToken = null;

export const setTokens = async (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  await AsyncStorage.setItem('accessToken', access);
  await AsyncStorage.setItem('refreshToken', refresh);
};

export const loadTokens = async () => {
  accessToken = await AsyncStorage.getItem('accessToken');
  refreshToken = await AsyncStorage.getItem('refreshToken');
  return { accessToken, refreshToken };
};

export const clearTokens = async () => {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.removeItem('accessToken');
  await AsyncStorage.removeItem('refreshToken');
};

export const getAccessToken = () => accessToken;

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccess, refreshToken: newRefresh } = response.data;
        await setTokens(newAccess, newRefresh);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        // Navigate to login - handled by auth context
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// =====================
// AUTH API
// =====================
export const authApi = {
  sendCode: (phone) => api.post('/auth/send-code', { phone }),
  verify: (phone, code, displayName) => 
    api.post('/auth/verify', { phone, code, displayName }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// =====================
// USERS API
// =====================
export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  updateSettings: (settings) => api.put('/users/me/settings', settings),
  getUser: (userId) => api.get(`/users/${userId}`),
};

// =====================
// VENUES API
// =====================
export const venuesApi = {
  getNearby: (latitude, longitude, options = {}) =>
    api.get('/venues/nearby', {
      params: { latitude, longitude, ...options },
    }),
  search: (query, options = {}) =>
    api.get('/venues/search', {
      params: { q: query, ...options },
    }),
  getVenue: (venueId) => api.get(`/venues/${venueId}`),
  getTrending: (latitude, longitude, radius) =>
    api.get('/venues/discover/trending', {
      params: { latitude, longitude, radius },
    }),
  getQuiet: (latitude, longitude, radius) =>
    api.get('/venues/discover/quiet', {
      params: { latitude, longitude, radius },
    }),
  getCategories: () => api.get('/venues/meta/categories'),
};

// =====================
// FRIENDS API
// =====================
export const friendsApi = {
  getFriends: () => api.get('/friends'),
  searchUsers: (query) => api.get('/friends/search', { params: { q: query } }),
  getRequests: () => api.get('/friends/requests'),
  getSentRequests: () => api.get('/friends/requests/sent'),
  sendRequest: (userId) => api.post(`/friends/request/${userId}`),
  acceptRequest: (friendshipId) => api.post(`/friends/accept/${friendshipId}`),
  declineRequest: (friendshipId) => api.post(`/friends/decline/${friendshipId}`),
  removeFriend: (friendshipId) => api.delete(`/friends/${friendshipId}`),
  getMutualFriends: (userId) => api.get(`/friends/mutual/${userId}`),
  blockUser: (userId) => api.post(`/friends/block/${userId}`),
};

// =====================
// GROUPS API
// =====================
export const groupsApi = {
  getGroups: () => api.get('/groups'),
  createGroup: (name, emoji) => api.post('/groups', { name, emoji }),
  getGroup: (groupId) => api.get(`/groups/${groupId}`),
  updateGroup: (groupId, data) => api.put(`/groups/${groupId}`, data),
  deleteGroup: (groupId) => api.delete(`/groups/${groupId}`),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members/${userId}`),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
  getActiveMembers: (groupId) => api.get(`/groups/${groupId}/active`),
};

// =====================
// PRESENCE API
// =====================
export const presenceApi = {
  goingOut: (sharingMode = 'all_friends', sharingWith = []) =>
    api.post('/presence/going-out', { sharingMode, sharingWith }),
  checkIn: (venueId, sharingMode = 'all_friends', sharingWith = []) =>
    api.post('/presence/check-in', { venueId, sharingMode, sharingWith }),
  updateLocation: (latitude, longitude, venueId) =>
    api.put('/presence/location', { latitude, longitude, venueId }),
  stop: () => api.post('/presence/stop'),
  getMyPresence: () => api.get('/presence/me'),
  getFriendsPresence: () => api.get('/presence/friends'),
};

// =====================
// PINGS API
// =====================
export const pingsApi = {
  create: (venueId, targetType, targetId, message) =>
    api.post('/pings', { venueId, targetType, targetId, message }),
  getReceived: () => api.get('/pings/received'),
  getSent: () => api.get('/pings/sent'),
  getPing: (pingId) => api.get(`/pings/${pingId}`),
  respond: (pingId, response) => api.post(`/pings/${pingId}/respond`, { response }),
  delete: (pingId) => api.delete(`/pings/${pingId}`),
};

export default api;
