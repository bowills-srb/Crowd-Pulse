import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/b2b';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Token management
let token = localStorage.getItem('dashboard_token');

export const setToken = (newToken) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('dashboard_token', newToken);
  } else {
    localStorage.removeItem('dashboard_token');
  }
};

export const getToken = () => token;

// Request interceptor
api.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Venues
export const venuesApi = {
  getMyVenues: () => api.get('/venues'),
  searchVenues: (params) => api.get('/venues/search', { params }),
  claimVenue: (venueId) => api.post('/venues/claim', { venueId }),
};

// Analytics
export const analyticsApi = {
  getAnalytics: (venueId, period = '7d') => 
    api.get(`/venues/${venueId}/analytics`, { params: { period } }),
  getLive: (venueId) => api.get(`/venues/${venueId}/live`),
};

// Promotions
export const promotionsApi = {
  getPromotions: (venueId) => api.get(`/venues/${venueId}/promotions`),
  createPromotion: (venueId, data) => api.post(`/venues/${venueId}/promotions`, data),
  deletePromotion: (venueId, promoId) => api.delete(`/venues/${venueId}/promotions/${promoId}`),
};

export default api;
