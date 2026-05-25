import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "../../context/ThemeContext";

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
    <HelmetProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    </HelmetProvider>
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
