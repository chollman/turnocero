import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { STORAGE_KEYS } from '../utils/storageKeys';

// Note (long-term): consider migrating to a custom domain (e.g. turnocero.com +
// api.turnocero.com) so auth cookies become first-party (SameSite=lax). Safari's ITP
// blocks cross-site cookies even with SameSite=None, which requires the Bearer-token
// workaround below. See docs/safari-auth-fix.md for full context.

axios.defaults.withCredentials = true;

// Safari/Firefox en modo privado tiran QuotaExceededError al escribir Storage,
// y SSR no expone `window`. Wrappear evita romper el provider entero.
const safeStorage = (getStorage) => ({
  get: (key) => {
    try { return getStorage()?.getItem(key) ?? null; } catch { return null; }
  },
  set: (key, value) => {
    try { getStorage()?.setItem(key, value); } catch { /* swallow */ }
  },
  remove: (key) => {
    try { getStorage()?.removeItem(key); } catch { /* swallow */ }
  },
});

const local = safeStorage(() => (typeof window !== 'undefined' ? window.localStorage : null));
const session = safeStorage(() => (typeof window !== 'undefined' ? window.sessionStorage : null));

const setAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [realUser, setRealUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewAsUser, setViewAsUserState] = useState(
    () => local.get(STORAGE_KEYS.VIEW_AS_USER) === 'true'
  );
  const navigate = useNavigate();

  const setViewAsUser = (value) => {
    const v = !!value;
    setViewAsUserState(v);
    if (v) local.set(STORAGE_KEYS.VIEW_AS_USER, 'true');
    else local.remove(STORAGE_KEYS.VIEW_AS_USER);
  };

  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const isAuthRoute = err.config?.url?.includes('/api/auth/');
        const isBan = status === 403 && err.response?.data?.code === 'banned' && !isAuthRoute;
        const isUnauth = status === 401 && !isAuthRoute;
        if (isUnauth || isBan) {
          local.remove(STORAGE_KEYS.TOKEN);
          local.remove(STORAGE_KEYS.VIEW_AS_USER);
          setAuthHeader(null);
          setRealUser(null);
          setViewAsUserState(false);
          if (isBan) {
            session.set(STORAGE_KEYS.BANNED_MESSAGE, err.response?.data?.message || 'Tu cuenta ha sido suspendida.');
          }
          navigate('/login', { replace: true });
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [navigate]);

  useEffect(() => {
    const token = local.get(STORAGE_KEYS.TOKEN);
    if (!token) {
      setAuthHeader(null);
      setLoading(false);
      return;
    }
    setAuthHeader(token);
    axios.get('/api/auth/me')
      .then(({ data }) => setRealUser(data))
      .catch(() => {
        setRealUser(null);
        local.remove(STORAGE_KEYS.TOKEN);
        setAuthHeader(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    local.set(STORAGE_KEYS.TOKEN, data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  // Creates an unverified account. No session is established here — the user
  // must complete /verify-email with the code we sent to confirm ownership.
  const register = async (username, email, password) => {
    const { data } = await axios.post('/api/auth/register', { username, email, password });
    return data; // { email, message }
  };

  const verifyEmail = async (email, code) => {
    const { data } = await axios.post('/api/auth/verify-email', { email, code });
    local.set(STORAGE_KEYS.TOKEN, data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  const requestEmailVerification = async (email) => {
    const { data } = await axios.post('/api/auth/resend-verification', { email });
    return data;
  };

  const requestPasswordReset = async (email) => {
    const { data } = await axios.post('/api/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (email, token, password) => {
    const { data } = await axios.post('/api/auth/reset-password', { email, token, password });
    return data;
  };

  const logout = async () => {
    await axios.post('/api/auth/logout').catch(() => {});
    local.remove(STORAGE_KEYS.TOKEN);
    local.remove(STORAGE_KEYS.VIEW_AS_USER);
    session.remove(STORAGE_KEYS.BANNED_MESSAGE);
    setAuthHeader(null);
    setRealUser(null);
    setViewAsUserState(false);
  };

  const refreshUser = async () => {
    const { data } = await axios.get('/api/auth/me');
    setRealUser(data);
    return data;
  };

  const updateProfile = async (data) => {
    const { data: updated } = await axios.put('/api/auth/profile', data);
    setRealUser(updated);
    return updated;
  };

  const isActuallyAdmin = !!realUser?.isAdmin;

  const user = useMemo(() => {
    if (!realUser) return null;
    if (isActuallyAdmin && viewAsUser) return { ...realUser, isAdmin: false };
    return realUser;
  }, [realUser, isActuallyAdmin, viewAsUser]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      verifyEmail,
      requestEmailVerification,
      requestPasswordReset,
      resetPassword,
      logout,
      updateProfile,
      refreshUser,
      viewAsUser,
      setViewAsUser,
      isActuallyAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
