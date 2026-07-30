import { configureStore } from '@reduxjs/toolkit';

// Placeholder reducer so combineReducers doesn't warn on an empty store.
// Removed once Fase 1 adds the first real slice (theme/language).
const placeholderReducer = (state = {}) => state;

export const store = configureStore({
  reducer: {
    app: placeholderReducer,
  },
  // Vite doesn't define process.env.NODE_ENV the way RTK's default check
  // expects, so drive devtools visibility from import.meta.env explicitly.
  devTools: import.meta.env.DEV,
});
