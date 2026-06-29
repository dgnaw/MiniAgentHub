import axios from 'axios';
import useAuthStore from '../store/authStore';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL, 
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agentHub_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Token không hợp lệ hoặc đã hết hạn!");
      useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;