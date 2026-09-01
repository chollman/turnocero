import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const authKeys = { me: ["auth", "me"] };

// ── Reads ──────────────────────────────────────────────────────────────

// Habilitada con token local O en subdominio de comunidad (cookie SSO — ver
// AuthContext). `retry:false`: un 401 acá es "invitado", no una falla
// transitoria — reintentar solo demora el paso a loading=false.
export function useMeQuery({ enabled }) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const { data } = await axios.get(API.auth.ME);
      return data;
    },
    enabled,
    retry: false,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — AuthContext orquesta el dispatch a
// Redux (token) y el `queryClient.setQueryData(authKeys.me, ...)` (usuario)
// alrededor de cada await, mismo criterio que el resto de la Fase 6.

export const loginRequest = (identifier, password) =>
  axios.post(API.auth.LOGIN, { identifier, password }).then((r) => r.data);

// Crea una cuenta sin verificar — no devuelve token, el flujo sigue en
// /verify-email. `extra` lleva displayName/avatarColor opcionales del
// registro nuevo; el server valida e ignora lo inválido.
export const registerRequest = (username, email, password, extra = {}) => {
  const { displayName, avatarColor } = extra;
  return axios
    .post(API.auth.REGISTER, {
      username,
      email,
      password,
      ...(displayName ? { displayName } : {}),
      ...(avatarColor ? { avatarColor } : {}),
    })
    .then((r) => r.data);
};

export const oauthLoginRequest = (provider, payload) => {
  const url =
    provider === "google" ? API.auth.OAUTH_GOOGLE : API.auth.OAUTH_FACEBOOK;
  return axios.post(url, payload).then((r) => r.data);
};

export const verifyEmailRequest = (email, code) =>
  axios.post(API.auth.VERIFY_EMAIL, { email, code }).then((r) => r.data);

export const resendVerificationRequest = (email) =>
  axios.post(API.auth.RESEND_VERIFICATION, { email }).then((r) => r.data);

export const forgotPasswordRequest = (email) =>
  axios.post(API.auth.FORGOT_PASSWORD, { email }).then((r) => r.data);

export const resetPasswordRequest = (email, token, password) =>
  axios
    .post(API.auth.RESET_PASSWORD, { email, token, password })
    .then((r) => r.data);

export const logoutRequest = () => axios.post(API.auth.LOGOUT).catch(() => {});

// A diferencia de logoutRequest, NO se swallowea el error acá — el caller
// (botón "Cerrar sesión en todos los dispositivos" en /perfil) necesita
// distinguir éxito de falla para decidir si limpia la sesión local o no.
export const logoutAllDevicesRequest = () =>
  axios.post(API.auth.LOGOUT_ALL).then((r) => r.data);

// Usado por `refreshUser()` — un GET manual fuera del ciclo de useMeQuery,
// cuyo resultado el caller siembra en la cache con setQueryData.
export const meRequest = () => axios.get(API.auth.ME).then((r) => r.data);

export const updateProfileRequest = (data) =>
  axios.put(API.auth.PROFILE, data).then((r) => r.data);
