import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AllProviders } from "../../test/wrappers/AllProviders";
import i18n from "../../i18n";
import ErrorScreen from "./ErrorScreen";

function renderScreen(props = {}) {
  return render(<ErrorScreen {...props} />, { wrapper: AllProviders });
}

describe("<ErrorScreen> — 404", () => {
  it("renders the 404 code, eyebrow and playful title", () => {
    renderScreen({ variant: "404" });
    expect(
      screen.getByRole("heading", { level: 1, name: "404" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Error 404 · página no encontrada/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/en el mazo/i)).toBeInTheDocument();
  });

  it("renders the provided quick links and hides the incident chip", () => {
    renderScreen({
      variant: "404",
      links: [
        { to: "/mesas", label: "Mesas", icon: "dice" },
        { to: "/eventos", label: "Eventos", icon: "calendar" },
      ],
    });
    expect(screen.getByRole("link", { name: /Mesas/ })).toHaveAttribute(
      "href",
      "/mesas",
    );
    expect(screen.getByRole("link", { name: /Eventos/ })).toHaveAttribute(
      "href",
      "/eventos",
    );
    expect(screen.queryByText(/Incidente/i)).not.toBeInTheDocument();
  });

  it("calls onPrimary and onSecondary when the action buttons are clicked", () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    renderScreen({ variant: "404", onPrimary, onSecondary });
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/ }));
    fireEvent.click(screen.getByRole("button", { name: /Página anterior/ }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("does not render quick links when none are provided", () => {
    renderScreen({ variant: "404", links: [] });
    expect(
      screen.queryByText(/O probá una de estas mesas/i),
    ).not.toBeInTheDocument();
  });
});

describe("<ErrorScreen> — 500", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the 500 code, orange eyebrow and incident chip", () => {
    renderScreen({ variant: "500" });
    expect(
      screen.getByRole("heading", { level: 1, name: "500" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Error 500 · algo se cayó de la mesa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/volcó el tablero/i)).toBeInTheDocument();
    expect(screen.getByText(/TC-\d{4}-[A-Z0-9]{2}/)).toBeInTheDocument();
  });

  it("does not render the 404 quick links section", () => {
    renderScreen({ variant: "500", links: [{ to: "/x", label: "X" }] });
    expect(screen.queryByRole("link", { name: /X/ })).not.toBeInTheDocument();
  });

  it("copies the incident code and shows confirmation feedback", async () => {
    renderScreen({ variant: "500" });
    const copyBtn = screen.getByRole("button", { name: "copiar" });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^TC-\d{4}-[A-Z0-9]{2}$/),
    );
    await waitFor(() =>
      expect(screen.getByText("✓ copiado")).toBeInTheDocument(),
    );
  });

  it("calls onPrimary (retry) and onSecondary (home) handlers", () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    renderScreen({ variant: "500", onPrimary, onSecondary });
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ir al inicio/ }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

describe("<ErrorScreen> — i18n English", () => {
  afterEach(() => {
    i18n.changeLanguage("es");
  });

  it("renders the 404 copy in English", () => {
    i18n.changeLanguage("en");
    renderScreen({ variant: "404" });
    expect(
      screen.getByText(/Error 404 · page not found/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/in the deck/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Back to home/ }),
    ).toBeInTheDocument();
  });

  it("renders the 500 incident chip in English", () => {
    i18n.changeLanguage("en");
    renderScreen({ variant: "500" });
    expect(screen.getByText(/knocked the board over/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "copy" })).toBeInTheDocument();
  });
});
