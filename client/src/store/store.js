import { configureStore } from '@reduxjs/toolkit';
import themeReducer, { themeListenerMiddleware } from './slices/themeSlice';
import languageReducer, { languageListenerMiddleware } from './slices/languageSlice';
import authReducer, {
  authListenerMiddleware,
  getInitialAuthState,
} from './slices/authSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    language: languageReducer,
    auth: authReducer,
  },
  // auth es el único slice cuyo valor inicial depende de localStorage por
  // caller (ver el comentario de getInitialAuthState en authSlice.js) — se
  // pasa explícito acá en vez de bakearlo en createSlice().
  preloadedState: {
    auth: getInitialAuthState(),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(themeListenerMiddleware.middleware)
      .prepend(languageListenerMiddleware.middleware)
      .prepend(authListenerMiddleware.middleware),
  // Vite doesn't define process.env.NODE_ENV the way RTK's default check
  // expects, so drive devtools visibility from import.meta.env explicitly.
  devTools: import.meta.env.DEV,
});
