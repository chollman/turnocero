import { describe, it, expect, vi, beforeEach } from "vitest";
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
});

describe("OAuthButtons", () => {
  it("renders the divider and both provider buttons", () => {
    renderButtons();
    expect(screen.getByText("o continuá con")).toBeInTheDocument();
    expect(screen.getByText("Continuar con Google")).toBeInTheDocument();
    expect(screen.getByText("Continuar con Facebook")).toBeInTheDocument();
  });

  it("hides the Facebook button when the SDK is not enabled", () => {
    renderButtons({ fb: { enabled: false, ready: false } });
    expect(screen.queryByText("Continuar con Facebook")).toBeNull();
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

  it("calls oauthLogin('facebook', { accessToken }) on Facebook success", async () => {
    const oauthLogin = vi.fn().mockResolvedValue({});
    const fbLogin = vi.fn().mockResolvedValue("fb-access");
    renderButtons({ oauthLogin, fb: { login: fbLogin } });
    fireEvent.click(screen.getByText("Continuar con Facebook"));
    await waitFor(() =>
      expect(oauthLogin).toHaveBeenCalledWith("facebook", {
        accessToken: "fb-access",
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("does not report an error when the user cancels the Facebook popup", async () => {
    const onError = vi.fn();
    const fbLogin = vi
      .fn()
      .mockRejectedValue(new Error("Login con Facebook cancelado"));
    renderButtons({ onError, fb: { login: fbLogin } });
    fireEvent.click(screen.getByText("Continuar con Facebook"));
    await waitFor(() => expect(fbLogin).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });

  it("disables the Facebook button until the SDK is ready", () => {
    renderButtons({ fb: { ready: false } });
    expect(
      screen.getByText("Continuar con Facebook").closest("button"),
    ).toBeDisabled();
  });
});
