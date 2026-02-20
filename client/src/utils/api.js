import axios from 'axios';

// Use relative /api so in dev all traffic goes through Vite (port 5173) and is proxied to the backend
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Log failed requests in development (full URL and status)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (import.meta.env?.DEV && err?.config) {
      const base = err.config.baseURL || '';
      const path = err.config.url || '';
      const full = path.startsWith('http') ? path : (base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path));
      console.error('API error', {
        method: err.config.method,
        url: full,
        status: err.response?.status,
        data: err.response?.data
      });
    }
    return Promise.reject(err);
  }
);

export default api;
