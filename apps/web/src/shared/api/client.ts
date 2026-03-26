import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.dorify.uz/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    config.headers['X-Telegram-InitData'] = tg.initData;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? 'Something went wrong';
    console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, message);
    return Promise.reject(error);
  },
);
