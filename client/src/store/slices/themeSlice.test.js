import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import themeReducer, {
  getInitialTheme,
  setTheme,
  toggleTheme,
  themeListenerMiddleware,
} from "./themeSlice";

const THEME_KEY = "turnocero_theme";

function buildStore() {
  return configureStore({
    reducer: { theme: themeReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(themeListenerMiddleware.middleware),
  });
}

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  document.documentElement.removeAttribute("data-theme");
});

describe("getInitialTheme", () => {
  it('defaults to "dark" when localStorage has no preference', () => {
    expect(getInitialTheme()).toBe("dark");
  });

  it("reads the saved theme from localStorage", () => {
    localStorage.setItem(THEME_KEY, "light");
    expect(getInitialTheme()).toBe("light");
  });

  it('ignores invalid stored values and falls back to "dark"', () => {
    localStorage.setItem(THEME_KEY, "rainbow");
    expect(getInitialTheme()).toBe("dark");
  });
});

describe("themeSlice reducer", () => {
  it("setTheme updates to a valid theme", () => {
    const state = themeReducer({ value: "dark" }, setTheme("light"));
    expect(state.value).toBe("light");
  });

  it("setTheme rejects invalid values", () => {
    const state = themeReducer({ value: "dark" }, setTheme("invalid"));
    expect(state.value).toBe("dark");
  });

  it("toggleTheme flips between dark and light", () => {
    let state = themeReducer({ value: "dark" }, toggleTheme());
    expect(state.value).toBe("light");
    state = themeReducer(state, toggleTheme());
    expect(state.value).toBe("dark");
  });
});

describe("theme listener middleware", () => {
  it("applies data-theme to <html> and persists to localStorage on dispatch", () => {
    const store = buildStore();
    store.dispatch(setTheme("light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("reacts to toggleTheme the same way", () => {
    const store = buildStore();
    store.dispatch(toggleTheme());
    const theme = store.getState().theme.value;
    expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
    expect(localStorage.getItem(THEME_KEY)).toBe(theme);
  });
});
