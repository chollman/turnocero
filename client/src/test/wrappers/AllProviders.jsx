import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "../../context/ThemeContext";
import i18n from "../../i18n";

/**
 * Lightweight wrapper for component tests that mounts theme + router + helmet only.
 * Use this for components that don't need axios/socket-backed contexts
 * (Auth/SiteConfig/Notification/Chat). Those are stubbed via MSW or per-test mocks.
 *
 * Usage:
 *   render(<MyComponent />, { wrapper: AllProviders });
 *   render(<MyComponent />, { wrapper: (props) => <AllProviders initialEntries={['/perfil']} {...props} /> });
 */
export function AllProviders({ children, initialEntries = ["/"] }) {
  return (
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </HelmetProvider>
    </I18nextProvider>
  );
}

/**
 * Minimal wrapper for pure presentational components that only need react-router (e.g. `<Link>`).
 */
export function RouterOnly({ children, initialEntries = ["/"] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}
