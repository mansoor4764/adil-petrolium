import axios from 'axios';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1',
  withCredentials: true,
  timeout: 15000,
});

export const API_BASE_URL = client.defaults.baseURL;

// ─── Token Storage (fallback for mobile browsers that block cookies) ───
const TOKEN_STORAGE_KEY = 'auth_tokens';

const getStoredTokens = () => {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setStoredTokens = (tokens) => {
  try {
    if (tokens) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to store tokens:', err);
  }
};

export const clearStoredTokens = () => {
  setStoredTokens(null);
};

// ─── Refresh Token State ──────────────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

export const resetInterceptorState = () => {
  isRefreshing = false;
  failedQueue  = [];
};

const processQueue = (error = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

// ─── Auth URL Guard ───────────────────────────────────────────
const isAuthUrl = (url = '') =>
  typeof url === 'string' &&
  (
    url.includes('/auth/login')         ||
    url.includes('/auth/admin/recover') ||
    url.includes('/auth/me')            ||
    url.includes('/auth/refresh')       ||
    url.includes('/auth/logout')
  );

// ─── Request Interceptor (add Authorization header if tokens in localStorage) ───
client.interceptors.request.use(
  (config) => {
    const tokens = getStoredTokens();
    if (tokens?.accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (res) => {
    // Store tokens from response if present (for mobile fallback)
    // Tokens are in _tokens field to avoid breaking existing response structure
    if (res.data?.data?._tokens) {
      setStoredTokens(res.data.data._tokens);
    }
    return res;
  },

  async (error) => {
    const original = error.config || {};
    const status   = error.response?.status;
    const url      = original.url || '';

    // ── Suppress expected 401 on /auth/me during initial app check
    if (status === 401 && url.includes('/auth/me')) {
      return Promise.reject(error);
    }

    if (status !== 401) {
      return Promise.reject(error);
    }

    // ── Prevent retry loop on already-retried or auth endpoints
    if (original._retry || isAuthUrl(url)) {
      return Promise.reject(error);
    }

    // ── Queue requests while refresh is in progress
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => client(original))
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      // Get refresh token from localStorage if available
      const tokens = getStoredTokens();
      const refreshConfig = { _retry: true };
      
      // If we have a refresh token in localStorage, send it in Authorization header
      if (tokens?.refreshToken) {
        refreshConfig.headers = {
          Authorization: `Bearer ${tokens.refreshToken}`,
        };
      }
      
      // Refresh the access token
      const refreshRes = await client.post('/auth/refresh', {}, refreshConfig);
      
      // Store new tokens if returned (in _tokens field)
      if (refreshRes.data?.data?._tokens) {
        setStoredTokens(refreshRes.data.data._tokens);
      }
      
      processQueue();
      return client(original);
    } catch (refreshErr) {
      processQueue(refreshErr);
      resetInterceptorState();
      clearStoredTokens();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;