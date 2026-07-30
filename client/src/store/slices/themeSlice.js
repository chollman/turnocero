import { createSlice, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "../../utils/storageKeys";

const VALID_THEMES = ["dark", "light"];

export const getInitialTheme = () => {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    return VALID_THEMES.includes(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
};

const themeSlice = createSlice({
  name: "theme",
  initialState: { value: getInitialTheme() },
  reducers: {
    setTheme: (state, action) => {
      if (VALID_THEMES.includes(action.payload)) state.value = action.payload;
    },
    toggleTheme: (state) => {
      state.value = state.value === "dark" ? "light" : "dark";
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;

// Applies the theme to <html data-theme> + persists it, mirroring what the old
// ThemeContext did in a useEffect([theme]). Also runs once at import time so
// the store's initial state stays in sync even outside the index.html
// pre-hydration script (e.g. in tests, where that inline script never runs).
export const themeListenerMiddleware = createListenerMiddleware();

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    /* ignore quota errors */
  }
};

themeListenerMiddleware.startListening({
  matcher: isAnyOf(setTheme, toggleTheme),
  effect: (action, listenerApi) => {
    applyTheme(listenerApi.getState().theme.value);
  },
});

if (typeof document !== "undefined") {
  applyTheme(getInitialTheme());
}
