import { createSlice, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import axios from "axios";
import { STORAGE_KEYS } from "../../utils/storageKeys";

// Auth es doble: token Bearer en `localStorage` (por-origin) + cookie httpOnly.
// Con el dominio propio (`turnocero.app` front + `api.turnocero.app` back) la
// cookie es first-party (mismo eTLD+1) → no la frena la ITP de Safari y viaja a
// todos los subdominios de comunidad, habilitando SSO entre subdominios (ver
// AuthContext, efecto de boot). `withCredentials` manda la cookie en cada
// request; el header Bearer sigue como fast-path en el apex.
axios.defaults.withCredentials = true;

// Safari/Firefox en modo privado tiran QuotaExceededError al escribir Storage.
const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* swallow */
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* swallow */
    }
  },
};

export const setAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

// A diferencia de theme/language (que bakean su valor inicial en
// `initialState` porque les alcanza con correr una sola vez por import), acá
// el valor inicial debe poder recomputarse por caller: cada test arranca con
// su propio `localStorage` y necesita un store fresco reflejándolo. Por eso
// esta función se expone aparte y se pasa vía `configureStore({ preloadedState
// })` en cada call site (store.js real + `makeStore()` de los tests), en vez
// de ir adentro de `createSlice()`. También sincroniza el header de axios de
// entrada, mismo trabajo que hacía el efecto de boot de la Context vieja.
export const getInitialAuthState = () => {
  const token = safeStorage.get(STORAGE_KEYS.TOKEN);
  const viewAsUser = safeStorage.get(STORAGE_KEYS.VIEW_AS_USER) === "true";
  setAuthHeader(token);
  return { token, viewAsUser };
};

const authSlice = createSlice({
  name: "auth",
  initialState: { token: null, viewAsUser: false },
  reducers: {
    setToken: (state, action) => {
      state.token = action.payload;
    },
    clearToken: (state) => {
      state.token = null;
    },
    setViewAsUser: (state, action) => {
      state.viewAsUser = !!action.payload;
    },
  },
});

export const { setToken, clearToken, setViewAsUser } = authSlice.actions;
export default authSlice.reducer;

export const authListenerMiddleware = createListenerMiddleware();

authListenerMiddleware.startListening({
  matcher: isAnyOf(setToken, clearToken),
  effect: (action, listenerApi) => {
    const token = listenerApi.getState().auth.token;
    if (token) safeStorage.set(STORAGE_KEYS.TOKEN, token);
    else safeStorage.remove(STORAGE_KEYS.TOKEN);
    setAuthHeader(token);
  },
});

authListenerMiddleware.startListening({
  actionCreator: setViewAsUser,
  effect: (action, listenerApi) => {
    if (listenerApi.getState().auth.viewAsUser) {
      safeStorage.set(STORAGE_KEYS.VIEW_AS_USER, "true");
    } else {
      safeStorage.remove(STORAGE_KEYS.VIEW_AS_USER);
    }
  },
});
