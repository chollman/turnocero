import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock de useGoogleLogin: captura el onSuccess y devuelve un trigger que, al
// invocarse (click del botón), simula el callback con un access token.
let googleOnSuccess;
let googleTokenResponse = { access_token: "g-access" };
vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: (opts) => {
    googleOnSuccess = opts.onSuccess;
    return () => googleOnSuccess(googleTokenResponse);
  },
}));

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../hooks/useFacebookSdk", () => ({ useFacebookSdk: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import OAuthButtons from "./OAuthButtons";
import { useAuth } from "../../context/AuthContext";
import { useFacebookSdk } from "../../hooks/useFacebookSdk";

function renderButtons({ oauthLogin = vi.fn(), fb = {}, onError } = {}) {
  useAuth.mockReturnValue({ oauthLogin });
  useFacebookSdk.mockReturnValue({
    enabled: true,
    ready: true,
    login: vi.fn(),
    ...fb,
  });
  return render(
    <MemoryRouter>
      <OAuthButtons onError={onError} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  googleTokenResponse = { access_token: "g-access" };
  // El botón de Google sólo se monta si hay clientId configurado.
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-google-client");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuthButtons", () => {
  it("renders the divider and the Google button", () => {
    renderButtons();
    expect(screen.getByText("o continuá con")).toBeInTheDocument();
    expect(screen.getByText("Continuar con Google")).toBeInTheDocument();
  });

  // El botón de Facebook está oculto detrás del flag FACEBOOK_ENABLED (false)
  // hasta que Meta apruebe la app — ver el TODO en OAuthButtons.jsx. Cuando se
  // reactive (flag → true), restaurar las pruebas de interacción de Facebook
  // del historial de git.
  it("keeps the Facebook button hidden even when the SDK is enabled", () => {
    renderButtons({ fb: { enabled: true, ready: true } });
    expect(screen.queryByText("Continuar con Facebook")).toBeNull();
  });

  it("renders nothing when Google is not configured (Facebook is hidden)", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { container } = renderButtons({ fb: { enabled: true, ready: true } });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("o continuá con")).toBeNull();
  });

  it("calls oauthLogin('google', { accessToken }) on Google success and navigates", async () => {
    const oauthLogin = vi.fn().mockResolvedValue({});
    renderButtons({ oauthLogin });
    fireEvent.click(screen.getByText("Continuar con Google"));
    await waitFor(() =>
      expect(oauthLogin).toHaveBeenCalledWith("google", {
        accessToken: "g-access",
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("reports an error when Google login fails", async () => {
    const onError = vi.fn();
    const oauthLogin = vi.fn().mockRejectedValue(new Error("boom"));
    renderButtons({ oauthLogin, onError });
    fireEvent.click(screen.getByText("Continuar con Google"));
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
