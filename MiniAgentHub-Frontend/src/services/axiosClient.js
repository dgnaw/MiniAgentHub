import axios from 'axios';

// File gửi/nhân dữ liệu với backend (xử lý Token)
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
      localStorage.removeItem('agentHub_token');
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;