import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('sr_token')) {
      localStorage.removeItem('sr_token');
      localStorage.removeItem('sr_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
};

export const requestsApi = {
  list: (params) => api.get('/requests', { params }),
  get: (id) => api.get(`/requests/${id}`),
  create: (payload) => api.post('/requests', payload),
  update: (id, payload) => api.patch(`/requests/${id}`, payload),
  addComment: (id, body) => api.post(`/requests/${id}/comments`, { body }),
};

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  create: (payload) => api.post('/users', payload),
  setActive: (id, is_active) => api.patch(`/users/${id}/active`, { is_active }),
};

export default api;
