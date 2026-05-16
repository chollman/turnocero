import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const VIEW_AS_USER_KEY = 'viewAsUser';

// TODO (long-term): migrate to a custom domain (e.g. turnocero.com + api.turnocero.com)
// so auth cookies become first-party (SameSite=lax). Safari's ITP blocks cross-site
// cookies even with SameSite=None, which requires the Bearer-token workaround below.
// See docs/safari-auth-fix.md for full context.

axios.defaults.withCredentials = true;

const setAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [realUser, setRealUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewAsUser, setViewAsUserState] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(VIEW_AS_USER_KEY) === 'true'
  );
  const navigate = useNavigate();

  const setViewAsUser = (value) => {
    const v = !!value;
    setViewAsUserState(v);
    if (v) localStorage.setItem(VIEW_AS_USER_KEY, 'true');
    else localStorage.removeItem(VIEW_AS_USER_KEY);
  };

  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const isBan = status === 403 && err.response?.data?.code === 'banned';
        const isUnauth = status === 401 && !err.config?.url?.includes('/api/auth/');
        if (isUnauth || isBan) {
          localStorage.removeItem('token');
          localStorage.removeItem(VIEW_AS_USER_KEY);
          setAuthHeader(null);
          setRealUser(null);
          setViewAsUserState(false);
          if (isBan) {
            sessionStorage.setItem('bannedMessage', err.response?.data?.message || 'Tu cuenta ha sido suspendida.');
          }
          navigate('/login', { replace: true });
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setAuthHeader(token);
    axios.get('/api/auth/me')
      .then(({ data }) => setRealUser(data))
      .catch(() => {
        setRealUser(null);
        localStorage.removeItem('token');
        setAuthHeader(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  const register = async (username, email, password) => {
    const { data } = await axios.post('/api/auth/register', { username, email, password });
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  const logout = async () => {
    await axios.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem(VIEW_AS_USER_KEY);
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
