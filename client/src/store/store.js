import { configureStore } from '@reduxjs/toolkit';
import themeReducer, { themeListenerMiddleware } from './slices/themeSlice';
import languageReducer, { languageListenerMiddleware } from './slices/languageSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    language: languageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(themeListenerMiddleware.middleware)
      .prepend(languageListenerMiddleware.middleware),
  // Vite doesn't define process.env.NODE_ENV the way RTK's default check
  // expects, so drive devtools visibility from import.meta.env explicitly.
  devTools: import.meta.env.DEV,
});
