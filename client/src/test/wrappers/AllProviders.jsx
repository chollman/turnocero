import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "../../store/store";
import i18n from "../../i18n";

/**
 * Lightweight wrapper for component tests that mounts theme/language (Redux) +
 * a query client + router + helmet only. Use this for components that don't
 * need axios/socket-backed contexts (Auth/SiteConfig/Notification/Chat).
 * Those are stubbed via MSW or per-test mocks.
 *
 * Usage:
 *   render(<MyComponent />, { wrapper: AllProviders });
 *   render(<MyComponent />, { wrapper: (props) => <AllProviders initialEntries={['/perfil']} {...props} /> });
 */
export function AllProviders({ children, initialEntries = ["/"] }) {
  // Fresh QueryClient per render so tests don't leak cache/retries into each
  // other — retry disabled so an MSW error mock doesn't hang a test in backoff.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <HelmetProvider>
            <MemoryRouter initialEntries={initialEntries}>
              {children}
            </MemoryRouter>
          </HelmetProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </ReduxProvider>
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
