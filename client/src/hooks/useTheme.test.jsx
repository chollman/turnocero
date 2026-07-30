import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import themeReducer, {
  themeListenerMiddleware,
} from "../store/slices/themeSlice";
import { useTheme } from "./useTheme";

const THEME_KEY = "turnocero_theme";

function buildStore(initialTheme = "dark") {
  return configureStore({
    reducer: { theme: themeReducer },
    preloadedState: { theme: { value: initialTheme } },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(themeListenerMiddleware.middleware),
  });
}

function Probe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("invalid")}>set-invalid</button>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

function renderProbe(initialTheme) {
  return render(
    <Provider store={buildStore(initialTheme)}>
      <Probe />
    </Provider>,
  );
}

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  document.documentElement.removeAttribute("data-theme");
});

describe("useTheme", () => {
  it("reads the current theme from the store", () => {
    renderProbe("light");
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("setTheme dispatches and applies data-theme to <html>", () => {
    renderProbe("dark");
    act(() => screen.getByText("set-light").click());
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("setTheme rejects invalid values", () => {
    renderProbe("dark");
    act(() => screen.getByText("set-invalid").click());
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("toggleTheme flips between dark and light", () => {
    renderProbe("dark");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByTestId("theme").textContent).toBe("light");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });
});
