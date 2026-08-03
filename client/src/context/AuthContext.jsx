import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { detectTenant } from "../utils/tenant";
import { unsubscribeThisDevice } from "../utils/pushDevice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setToken,
  clearToken,
  setViewAsUser as setViewAsUserAction,
} from "../store/slices/authSlice";
import {
  authKeys,
  useMeQuery,
  loginRequest,
  registerRequest,
  oauthLoginRequest,
  verifyEmailRequest,
  resendVerificationRequest,
  forgotPasswordRequest,
  resetPasswordRequest,
  logoutRequest,
  meRequest,
  updateProfileRequest,
} from "../queries/auth";

// Safari/Firefox en modo privado tiran QuotaExceededError al escribir
// sessionStorage; wrappear evita romper el provider entero.
const session = {
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* swallow */
    }
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* swallow */
    }
  },
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const viewAsUser = useAppSelector((s) => s.auth.viewAsUser);

  // En un subdominio de comunidad (`<slug>.turnocero.app`) el `localStorage`
  // está vacío — es por-origin — pero la cookie de auth httpOnly es
  // first-party bajo `turnocero.app`, así que `/me` puede levantar la sesión
  // igual (SSO entre subdominios). Por eso pegamos `/me` en modo tenant aunque
  // no haya token local; en el sitio principal sin token nos quedamos
  // anónimos sin request extra.
  const onTenant = !!detectTenant();
  const meEnabled = !!token || onTenant;
  const {
    data: realUser,
    isPending: meIsPending,
    isError: meIsError,
  } = useMeQuery({ enabled: meEnabled });
  // enabled:false deja isPending en true para siempre — hay que gatear con
  // la misma condición que habilita la query (mismo patrón que SiteConfig).
  const loading = meEnabled && meIsPending;

  // Token guardado que ya no es válido AL BOOTEAR (mismo comportamiento que
  // el catch del efecto de boot original: se descarta y queda anónimo). Se
  // captura el token de entrada una sola vez — a diferencia del boot
  // original, acá `useMeQuery` sigue viva durante toda la sesión, así que un
  // 401 posterior (p. ej. la query se re-habilita recién cuando `login()`
  // setea el token, y en ese instante todavía no hay datos frescos en el
  // handler mockeado/backend) NO debe volver a disparar esta limpieza.
  const bootTokenRef = useRef(token);
  useEffect(() => {
    if (meIsError && bootTokenRef.current) {
      dispatch(clearToken());
      bootTokenRef.current = null;
    }
  }, [meIsError, dispatch]);

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
          dispatch(clearToken());
          dispatch(setViewAsUserAction(false));
          queryClient.setQueryData(authKeys.me, null);
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
  }, [navigate, dispatch, queryClient]);

  // `identifier` puede ser el email o el username del usuario — el server
  // resuelve cualquiera de los dos (ver POST /api/auth/login).
  const login = async (identifier, password) => {
    const data = await loginRequest(identifier, password);
    dispatch(setToken(data.token));
    queryClient.setQueryData(authKeys.me, data.user);
    return data;
  };

  // Creates an unverified account. No session is established here — the user
  // must complete /verify-email with the code we sent to confirm ownership.
  const register = (username, email, password, extra = {}) =>
    registerRequest(username, email, password, extra);

  // Login/registro vía OAuth. `provider` ∈ { "google", "facebook" }; el
  // payload es { credential } para Google o { accessToken } para Facebook.
  // Espeja login(): el server resuelve/crea el usuario y devuelve { user, token }.
  const oauthLogin = async (provider, payload) => {
    const data = await oauthLoginRequest(provider, payload);
    dispatch(setToken(data.token));
    queryClient.setQueryData(authKeys.me, data.user);
    return data;
  };

  const verifyEmail = async (email, code) => {
    const data = await verifyEmailRequest(email, code);
    dispatch(setToken(data.token));
    queryClient.setQueryData(authKeys.me, data.user);
    return data;
  };

  const requestEmailVerification = (email) => resendVerificationRequest(email);

  const requestPasswordReset = (email) => forgotPasswordRequest(email);

  const resetPassword = (email, resetToken, password) =>
    resetPasswordRequest(email, resetToken, password);

  const logout = async () => {
    // Des-suscribir este device de push ANTES de tirar la sesión (best-effort,
    // nunca bloquea). En un device compartido evita que sigan llegando pushes
    // del usuario que se va. Solo en el logout EXPLÍCITO — no en el auto-logout
    // por 401/ban (que podría ser un 401 transitorio).
    await unsubscribeThisDevice();
    await logoutRequest();
    dispatch(clearToken());
    dispatch(setViewAsUserAction(false));
    session.remove(STORAGE_KEYS.BANNED_MESSAGE);
    queryClient.setQueryData(authKeys.me, null);
  };

  const refreshUser = async () => {
    const data = await meRequest();
    queryClient.setQueryData(authKeys.me, data);
    return data;
  };

  const updateProfile = async (data) => {
    const updated = await updateProfileRequest(data);
    queryClient.setQueryData(authKeys.me, updated);
    return updated;
  };

  const setViewAsUser = (value) => dispatch(setViewAsUserAction(!!value));

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
