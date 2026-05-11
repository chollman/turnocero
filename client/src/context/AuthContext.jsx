import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setAuthHeader(token);
    axios.get('/api/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => {
        setUser(null);
        localStorage.removeItem('token');
        setAuthHeader(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (username, email, password) => {
    const { data } = await axios.post('/api/auth/register', { username, email, password });
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await axios.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    setAuthHeader(null);
    setUser(null);
  };

  const updateProfile = async (data) => {
    const { data: updated } = await axios.put('/api/auth/profile', data);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
