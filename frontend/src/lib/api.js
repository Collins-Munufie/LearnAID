import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Default to relative path on HTTPS to avoid Mixed Content, but default to localhost on HTTP
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '';
  }
  return 'http://127.0.0.1:8000';
};

const API_BASE_URL = getApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 15000;
const LONG_TIMEOUT_MS = 120000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers.Authorization) {
    delete config.headers.Authorization;
  }

  if (config.longRunning) {
    config.timeout = LONG_TIMEOUT_MS;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const method = config?.method?.toUpperCase();
    const canRetry = method === 'GET' || method === 'HEAD';
    // Handle 401 Unauthorized explicitly
    if (error.response && error.response.status === 401) {
        // Do not redirect if the error is from the login endpoint itself
        if (config.url && !config.url.includes('/api/auth/login')) {
            localStorage.removeItem('token');
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                 window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }

    if (!config || !canRetry || config.__retryCount >= 2) {
      return Promise.reject(error);
    }

    const retryableStatus = !error.response || [408, 429, 500, 502, 503, 504].includes(error.response.status);
    if (!retryableStatus) {
      return Promise.reject(error);
    }

    config.__retryCount = (config.__retryCount || 0) + 1;
    await sleep(400 * config.__retryCount);
    return api(config);
  },
);

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;

  // Handle routing / static page fallback issues (404/405) in production
  const isRelativeApi = !import.meta.env.VITE_API_BASE_URL || API_BASE_URL === '';
  const isRoutingError = error.response && (error.response.status === 404 || error.response.status === 405);
  
  if (isRoutingError && isRelativeApi && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const endpoint = error.config?.url ? ` (endpoint: ${error.config.url})` : '';
    return `Connection Failed${endpoint} (Status ${error.response.status}): The backend API is not configured on this domain. (Missing Configuration: The VITE_API_BASE_URL environment variable is not defined. Secure HTTPS pages require a secure backend API endpoint.)`;
  }

  // Handle request timeout
  if (error.code === 'ECONNABORTED') {
    return 'The request took too long. Please check your network connection and try again.';
  }

  // Handle network connectivity or CORS errors
  const isNetworkError = 
    error.message === 'Network Error' || 
    error.code === 'ERR_NETWORK' ||
    (error.request && !error.response);

  if (isNetworkError) {
    const endpoint = error.config?.url ? ` (endpoint: ${error.config.url})` : '';
    let msg = `Connection Failed${endpoint}: Unable to reach the server. Please ensure the backend service is running  and your API URL is correctly configured.`;
    
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (!import.meta.env.VITE_API_BASE_URL) {
        msg += ` (Missing Configuration: The VITE_API_BASE_URL environment variable is not defined. Secure HTTPS pages require a secure backend API endpoint.)`;
      } else if (API_BASE_URL.startsWith('http:')) {
        msg += ` (Mixed Content Block: Your website is loaded over HTTPS, but trying to access an insecure HTTP API at ${API_BASE_URL}. Secure pages cannot access insecure APIs unless run locally.)`;
      }
    }
    
    return msg;
  }

  // Handle backend error details
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      // Parse FastAPI Pydantic validation errors
      return detail.map(err => `${err.loc?.slice(1).join('.') || 'input'}: ${err.msg}`).join(', ');
    }
    return JSON.stringify(detail);
  }

  return error.message || fallback;
};

export default api;
