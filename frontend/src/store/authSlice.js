import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginApi, logoutApi, getMeApi } from '../api/authApi';
import { resetInterceptorState, clearStoredTokens } from '../api/axiosClient';

// ─── Fetch Current User ───────────────────────────────────────
export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getMeApi();
      return res.data.data || null;
    } catch (err) {
      // 401 is expected for unauthenticated users — silently handle
      if (err?.response?.status === 401) {
        return rejectWithValue(null);
      }
      return rejectWithValue(err?.response?.data?.message || 'Failed to fetch user');
    }
  }
);

// ─── Login ────────────────────────────────────────────────────
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      resetInterceptorState();
      const res = await loginApi(credentials);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || 'Login failed');
    }
  }
);

// ─── Logout ───────────────────────────────────────────────────
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await logoutApi();
      return true;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || 'Logout failed');
    } finally {
      resetInterceptorState();
      clearStoredTokens();
    }
  }
);

// ─── Initial State ────────────────────────────────────────────
const initialState = {
  user:        null,
  loading:     true,
  error:       null,
  initialized: false,
};

// ─── Slice ───────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setLoggedOut: (state) => {
      state.user        = null;
      state.loading     = false;
      state.initialized = true;
      state.error       = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // ── fetchMe ──────────────────────────────────────────────
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user        = action.payload;
        state.loading     = false;
        state.initialized = true;
        state.error       = null;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user        = null;
        state.loading     = false;
        state.initialized = true;
        state.error       = null;
      })

      // ── loginUser ────────────────────────────────────────────
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user        = action.payload;
        state.loading     = false;
        state.initialized = true;
        state.error       = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.user        = null;
        state.loading     = false;
        state.initialized = true;
        state.error       = action.payload || 'Login failed';
      })

      // ── logoutUser ───────────────────────────────────────────
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user        = null;
        state.loading     = false;
        state.initialized = true;
        state.error       = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user        = null;
        state.loading     = false;
        state.initialized = true;
        state.error       = null;
      });
  },
});

export const { clearError, setLoggedOut } = authSlice.actions;
export default authSlice.reducer;
