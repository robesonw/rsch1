// services/api.ts — Axios instance with auth headers
import axios from 'axios';
import type { ApiResponse } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('piq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('piq_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export type { ApiResponse };
