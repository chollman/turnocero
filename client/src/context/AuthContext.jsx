import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { API } from "../api/endpoints";
import { detectTenant } from "../utils/tenant";

// Auth es doble: token Bearer en `localStorage` (por-origin) + cookie httpOnly.
// Con el dominio propio (`turnocero.app` front + `api.turnocero.app` back) la
// cookie es first-party (mismo eTLD+1) → no la frena la ITP de Safari y viaja a
// todos los subdominios de comunidad. Eso habilita el SSO entre subdominios: en
// `<slug>.turnocero.app` el `localStorage` está vacío pero la cookie levanta la
// sesión vía `/me` (ver el efecto de boot abajo). `withCredentials` manda la
// cookie en cada request; el header Bearer sigue como fast-path en el apex.
axios.defaults.withCredentials = true;

// Safari/Firefox en modo privado tiran QuotaExceededError al escribir Storage,
// y SSR no expone `window`. Wrappear evita romper el provider entero.
const safeStorage = (getStorage) => ({
  get: (key) => {
    try {
      return getStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      getStorage()?.setItem(key, value);
    } catch {
      /* swallow */
    }
  },
  remove: (key) => {
    try {
      getStorage()?.removeItem(key);
    } catch {
      /* swallow */
    }
  },
});

const local = safeStorage(() =>
  typeof window !== "undefined" ? window.localStorage : null,
);
const session = safeStorage(() =>
  typeof window !== "undefined" ? window.sessionStorage : null,
);

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
    () => local.get(STORAGE_KEYS.VIEW_AS_USER) === "true",
  );
  const navigate = useNavigate();

  const setViewAsUser = (value) => {
    const v = !!value;
    setViewAsUserState(v);
    if (v) local.set(STORAGE_KEYS.VIEW_AS_USER, "true");
    else local.remove(STORAGE_KEYS.VIEW_AS_USER);
  };

  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const isAuthRoute = err.config?.url?.includes("/api/auth/");
        const isBan =
          status === 403 &&
          err.response?.data?.code === "banned" &&
          !isAuthRoute;
        const isUnauth = status === 401 && !isAuthRoute;
        if (isUnauth || isBan) {
          local.remove(STORAGE_KEYS.TOKEN);
          local.remove(STORAGE_KEYS.VIEW_AS_USER);
          setAuthHeader(null);
          setRealUser(null);
          setViewAsUserState(false);
          if (isBan) {
            session.set(
              STORAGE_KEYS.BANNED_MESSAGE,
              err.response?.data?.message || "Tu cuenta ha sido suspendida.",
            );
          }
          navigate("/login", { replace: true });
        }
        return Promise.reject(err);
      },
    );
    return () => axios.interceptors.response.eject(id);
  }, [navigate]);

  useEffect(() => {
    const token = local.get(STORAGE_KEYS.TOKEN);
    // En un subdominio de comunidad (`<slug>.turnocero.app`) el `localStorage`
    // está vacío — es por-origin — pero la cookie de auth httpOnly es
    // first-party bajo `turnocero.app`, así que `/me` puede levantar la sesión
    // igual (SSO entre subdominios). Por eso, aunque no haya token local,
    // intentamos `/me` cuando estamos en modo tenant. En el sitio principal sin
    // token nos quedamos anónimos sin pegar un request extra.
    const onTenant = !!detectTenant();
    if (!token && !onTenant) {
      setAuthHeader(null);
      setLoading(false);
      return;
    }
    setAuthHeader(token); // null-safe: limpia el header si no hay token
    axios
      .get(API.auth.ME)
      .then(({ data }) => setRealUser(data))
      .catch(() => {
        setRealUser(null);
        if (token) {
          local.remove(STORAGE_KEYS.TOKEN);
          setAuthHeader(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post(API.auth.LOGIN, { email, password });
    local.set(STORAGE_KEYS.TOKEN, data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  // Creates an unverified account. No session is established here — the user
  // must complete /verify-email with the code we sent to confirm ownership.
  // `extra` lleva campos opcionales del registro nuevo (displayName + color de
  // avatar elegido); el server los valida e ignora lo inválido.
  const register = async (username, email, password, extra = {}) => {
    const { displayName, avatarColor } = extra;
    const { data } = await axios.post(API.auth.REGISTER, {
      username,
      email,
      password,
      ...(displayName ? { displayName } : {}),
      ...(avatarColor ? { avatarColor } : {}),
    });
    return data; // { email, message }
  };

  // Login/registro vía OAuth. `provider` ∈ { "google", "facebook" }; el
  // payload es { credential } para Google o { accessToken } para Facebook.
  // Espeja login(): el server resuelve/crea el usuario y devuelve { user, token }.
  const oauthLogin = async (provider, payload) => {
    const url =
      provider === "google" ? API.auth.OAUTH_GOOGLE : API.auth.OAUTH_FACEBOOK;
    const { data } = await axios.post(url, payload);
    local.set(STORAGE_KEYS.TOKEN, data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  const verifyEmail = async (email, code) => {
    const { data } = await axios.post(API.auth.VERIFY_EMAIL, { email, code });
    local.set(STORAGE_KEYS.TOKEN, data.token);
    setAuthHeader(data.token);
    setRealUser(data.user);
    return data;
  };

  const requestEmailVerification = async (email) => {
    const { data } = await axios.post(API.auth.RESEND_VERIFICATION, { email });
    return data;
  };

  const requestPasswordReset = async (email) => {
    const { data } = await axios.post(API.auth.FORGOT_PASSWORD, { email });
    return data;
  };

  const resetPassword = async (email, token, password) => {
    const { data } = await axios.post(API.auth.RESET_PASSWORD, {
      email,
      token,
      password,
    });
    return data;
  };

  const logout = async () => {
    await axios.post(API.auth.LOGOUT).catch(() => {});
    local.remove(STORAGE_KEYS.TOKEN);
    local.remove(STORAGE_KEYS.VIEW_AS_USER);
    session.remove(STORAGE_KEYS.BANNED_MESSAGE);
    setAuthHeader(null);
    setRealUser(null);
    setViewAsUserState(false);
  };

  const refreshUser = async () => {
    const { data } = await axios.get(API.auth.ME);
    setRealUser(data);
    return data;
  };

  const updateProfile = async (data) => {
    const { data: updated } = await axios.put(API.auth.PROFILE, data);
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        oauthLogin,
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
