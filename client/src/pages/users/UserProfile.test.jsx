import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// Mocks BEFORE importing UserProfile.
// Los componentes de Google Maps se renderizan como stubs livianos — sus
// tests propios cubren el comportamiento real.
vi.mock("../../components/shared/AddressMap", () => ({
  default: ({ lat, lng }) => (
    <div data-testid="address-map" data-lat={lat ?? ""} data-lng={lng ?? ""} />
  ),
}));
vi.mock("../../components/shared/PlaceAutocomplete", () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: vi.fn() }));
vi.mock("../../hooks/useLanguage", () => ({ useLanguage: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../hooks/usePushNotifications", () => ({ default: vi.fn() }));

// AvatarCropModal: skip the real react-easy-crop flow and immediately confirm with a fake blob.
vi.mock("../../components/shared/AvatarCropModal", () => ({
  default: ({ open, onConfirm, onCancel }) => {
    if (!open) return null;
    return (
      <div role="dialog" aria-label="crop-mock">
        <button
          onClick={() => onConfirm(new Blob(["x"], { type: "image/jpeg" }))}
        >
          mock-confirm
        </button>
        <button onClick={onCancel}>mock-cancel</button>
      </div>
    );
  },
}));

// MiBgWatchCard — not relevant to avatar tests; stub.
vi.mock("./MiBgWatchCard", () => ({
  default: () => null,
}));

// CommunityPrefs — has its own test + needs CommunityContext; stub here.
vi.mock("./CommunityPrefs", () => ({
  default: () => null,
}));

import UserProfile from "./UserProfile";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useNotifications } from "../../context/NotificationContext";
import usePushNotifications from "../../hooks/usePushNotifications";

const defaultPush = () => ({
  isSupported: false,
  permission: "default",
  isSubscribed: false,
  requiresStandalone: false,
  busy: false,
  error: null,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
});

function setup({
  user = { _id: "u1", username: "cha", email: "cha@test.local" },
  refreshUser = vi.fn(),
  updateProfile = vi.fn(),
  logoutAllDevices = vi.fn(),
  sectionEnabled = () => true,
  push = defaultPush(),
  addToast = vi.fn(),
  lang = "es",
  setLang = vi.fn(),
} = {}) {
  useAuth.mockReturnValue({ user, updateProfile, refreshUser, logoutAllDevices });
  useSiteConfig.mockReturnValue({ isSectionEnabled: sectionEnabled });
  useTheme.mockReturnValue({ theme: "dark", setTheme: vi.fn() });
  useLanguage.mockReturnValue({ lang, setLang });
  useNotifications.mockReturnValue({ addToast });
  usePushNotifications.mockReturnValue(push);

  return render(
    <MemoryRouter>
      <UserProfile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  // Default MSW handler — successful avatar upload returning updated user shape.
  server.use(
    http.put("/api/auth/avatar", () =>
      HttpResponse.json({
        _id: "u1",
        username: "cha",
        avatar: {
          url: "https://mock/users/u1/avatar.webp",
          publicId: "users/u1/avatar",
        },
      }),
    ),
    http.delete("/api/auth/avatar", () =>
      HttpResponse.json({
        _id: "u1",
        username: "cha",
        avatar: { url: "", publicId: "" },
      }),
    ),
  );
});

describe("<UserProfile> — Avatar section", () => {
  it('shows "Subir avatar" when user has no avatar', () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "", publicId: "" },
      },
    });
    expect(
      screen.getByRole("button", { name: /subir avatar/i }),
    ).toBeInTheDocument();
    // No "Quitar avatar" when there is no avatar
    expect(
      screen.queryByRole("button", { name: /quitar avatar/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Cambiar avatar" + "Quitar avatar" when user has an avatar', () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "https://x/y.webp", publicId: "users/u1/avatar" },
      },
    });
    expect(
      screen.getByRole("button", { name: /cambiar avatar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quitar avatar/i }),
    ).toBeInTheDocument();
  });

  it("shows the avatar color picker when there is no uploaded photo", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "", publicId: "", color: "" },
      },
    });
    expect(screen.getByText("Color del avatar")).toBeInTheDocument();
    expect(screen.getByLabelText("Color green")).toBeInTheDocument();
    expect(screen.getByLabelText("Color automático")).toBeInTheDocument();
  });

  it("hides the color picker once an avatar photo is set", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "https://x/y.webp", publicId: "p", color: "" },
      },
    });
    expect(screen.queryByText("Color del avatar")).not.toBeInTheDocument();
  });

  it("persists the chosen avatar color via updateProfile", async () => {
    const updateProfile = vi.fn().mockResolvedValue({});
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "", publicId: "", color: "" },
      },
      updateProfile,
    });
    fireEvent.click(screen.getByLabelText("Color green"));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ avatarColor: "--green" }),
    );
  });

  it("rejects an unsupported file type before opening the crop modal", () => {
    const { container } = setup();
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByText(/Solo se permiten imágenes JPG, PNG o WEBP/i),
    ).toBeInTheDocument();
    // Crop modal should NOT open
    expect(
      screen.queryByRole("dialog", { name: "crop-mock" }),
    ).not.toBeInTheDocument();
  });

  it("rejects files over 5 MB before opening the crop modal", () => {
    const { container } = setup();
    // 6 MB blob
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/no puede superar los 5 MB/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "crop-mock" }),
    ).not.toBeInTheDocument();
  });

  it("opens the crop modal when a valid image is picked, then calls refreshUser on confirm", async () => {
    const refreshUser = vi.fn();
    const { container } = setup({ refreshUser });

    const file = new File([new Uint8Array(1024)], "a.jpg", {
      type: "image/jpeg",
    });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // Crop modal opens
    expect(
      screen.getByRole("dialog", { name: "crop-mock" }),
    ).toBeInTheDocument();

    // Confirm the crop → triggers axios.put('/api/auth/avatar', ...)
    fireEvent.click(screen.getByRole("button", { name: "mock-confirm" }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it("cancel from the crop modal clears the file without calling the API", () => {
    const refreshUser = vi.fn();
    const { container } = setup({ refreshUser });

    const file = new File([new Uint8Array(1024)], "a.jpg", {
      type: "image/jpeg",
    });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByRole("dialog", { name: "crop-mock" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "mock-cancel" }));
    expect(
      screen.queryByRole("dialog", { name: "crop-mock" }),
    ).not.toBeInTheDocument();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it("F6 — el select de recordatorios refleja user.eventoReminderHours y envía el nuevo valor en updateProfile", async () => {
    const updateProfile = vi.fn().mockResolvedValue();
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        eventoReminderHours: 2,
      },
      updateProfile,
    });
    const select = screen.getByLabelText(/avisarme/i);
    expect(select.value).toBe("2");

    fireEvent.change(select, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    const payload = updateProfile.mock.calls[0][0];
    expect(payload.eventoReminderHours).toBe(0);
  });

  it("F6 — default 24h cuando el user no tiene preferencia seteada", () => {
    setup({
      user: { _id: "u1", username: "cha", email: "a@b.com" },
    });
    const select = screen.getByLabelText(/avisarme/i);
    expect(select.value).toBe("24");
  });

  it('"Quitar avatar" calls DELETE /api/auth/avatar after window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const refreshUser = vi.fn();
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "https://x", publicId: "p" },
      },
      refreshUser,
    });

    fireEvent.click(screen.getByRole("button", { name: /quitar avatar/i }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/quitar tu avatar/i),
    );
    confirmSpy.mockRestore();
  });

  it('"Quitar avatar" canceled via confirm does nothing', () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const refreshUser = vi.fn();
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "https://x", publicId: "p" },
      },
      refreshUser,
    });

    fireEvent.click(screen.getByRole("button", { name: /quitar avatar/i }));
    expect(refreshUser).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows API error when upload fails", async () => {
    server.use(
      http.put("/api/auth/avatar", () =>
        HttpResponse.json(
          { message: "Error al subir avatar" },
          { status: 500 },
        ),
      ),
    );
    const { container } = setup();

    const file = new File([new Uint8Array(1024)], "a.jpg", {
      type: "image/jpeg",
    });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "mock-confirm" }));

    expect(
      await screen.findByText(/Error al subir avatar/i),
    ).toBeInTheDocument();
  });
});

describe("UserProfile — Reconciliar todo con BGG", () => {
  const connectedUser = {
    _id: "u1",
    username: "cha",
    email: "cha@test.local",
    bggUsername: "rahdo",
    bggConnected: true,
    bggInvalid: false,
    bggConnectedAt: "2026-05-01T00:00:00Z",
    bggSync: null,
  };

  it('shows the "Reconciliar todo con BGG" button when the user is connected', () => {
    setup({ user: connectedUser });
    expect(
      screen.getByRole("button", { name: /reconciliar todo con bgg/i }),
    ).toBeInTheDocument();
  });

  it("does NOT show the button when the user is not connected", () => {
    setup({ user: { ...connectedUser, bggConnected: false } });
    expect(
      screen.queryByRole("button", { name: /reconciliar todo con bgg/i }),
    ).not.toBeInTheDocument();
  });

  it("calls POST /api/bgg/sync on click and shows a per-bucket success breakdown", async () => {
    let calledWith = null;
    server.use(
      http.post("/api/bgg/sync", async ({ request }) => {
        calledWith = request.url;
        return HttpResponse.json({
          success: true,
          inserted: 5,
          updated: 2,
          deleted: 1,
          total: 247,
          pages: 9,
          lastFullSyncAt: "2026-05-19T12:00:00Z",
        });
      }),
    );
    const refreshUser = vi.fn();
    setup({ user: connectedUser, refreshUser });

    fireEvent.click(
      screen.getByRole("button", { name: /reconciliar todo con bgg/i }),
    );
    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalled();
    });
    expect(calledWith).toContain("/api/bgg/sync");
    expect(
      await screen.findByText(
        /reconciliadas 247 partidas \(5 nuevas, 2 actualizadas, 1 borradas\)/i,
      ),
    ).toBeInTheDocument();
  });

  it('says "sin cambios" when reconcile returned 0 inserts/updates/deletes', async () => {
    server.use(
      http.post("/api/bgg/sync", () =>
        HttpResponse.json({
          success: true,
          inserted: 0,
          updated: 0,
          deleted: 0,
          total: 247,
          pages: 9,
          lastFullSyncAt: "2026-05-19T12:00:00Z",
        }),
      ),
    );
    setup({ user: connectedUser });
    fireEvent.click(
      screen.getByRole("button", { name: /reconciliar todo con bgg/i }),
    );
    expect(
      await screen.findByText(/reconciliadas 247 partidas \(sin cambios\)/i),
    ).toBeInTheDocument();
  });

  it("shows last full reconcile time + count as relative timestamp", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: oneHourAgo,
          lastFullSyncCount: 312,
        },
      },
    });
    expect(
      screen.getByText(/última reconciliación completa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/hace 1 h · 312 partidas/i)).toBeInTheDocument();
  });

  it("shows last probe time + outcome label", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: "2026-05-01T00:00:00Z",
          lastFullSyncCount: 312,
          lastProbedAt: twoMinAgo,
          lastProbeOutcome: "no_drift",
        },
      },
    });
    expect(screen.getByText(/última verificación/i)).toBeInTheDocument();
    expect(screen.getByText(/hace 2 min · ✓ sin cambios/i)).toBeInTheDocument();
  });

  it("shows reconciled outcome label when applicable", () => {
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: new Date().toISOString(),
          lastFullSyncCount: 100,
          lastProbedAt: new Date().toISOString(),
          lastProbeOutcome: "reconciled",
        },
      },
    });
    expect(screen.getByText(/✓ reconciliado/i)).toBeInTheDocument();
  });

  it("shows a clear, reassuring error when sync fails (502 → enriched message)", async () => {
    server.use(
      http.post("/api/bgg/sync", () =>
        HttpResponse.json({ message: "ECONNRESET" }, { status: 502 }),
      ),
    );
    setup({ user: connectedUser });
    fireEvent.click(
      screen.getByRole("button", { name: /reconciliar todo con bgg/i }),
    );
    // The terse server message is replaced with an actionable one that also
    // reassures the user that already-synced plays are kept.
    expect(
      await screen.findByText(/BGG no respondió o falló a mitad de la sincronización/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/se conserva/i)).toBeInTheDocument();
  });
});

describe("UserProfile — Dirección (Google Maps)", () => {
  it("renders PlaceAutocomplete and AddressMap", () => {
    setup({ user: { _id: "u1", username: "cha", email: "a@b.com" } });
    expect(screen.getByTestId("place-autocomplete")).toBeInTheDocument();
    expect(screen.getByTestId("address-map")).toBeInTheDocument();
  });

  it("pre-loads the autocomplete with saved direccion.texto", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        direccion: {
          texto: "Av. Corrientes 1234, CABA",
          lat: -34.6,
          lng: -58.4,
        },
      },
    });
    expect(screen.getByTestId("place-autocomplete")).toHaveValue(
      "Av. Corrientes 1234, CABA",
    );
  });

  it("passes saved coords to AddressMap as data-* for inspection", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        direccion: { texto: "X", lat: -34.6, lng: -58.4 },
      },
    });
    const map = screen.getByTestId("address-map");
    expect(map).toHaveAttribute("data-lat", "-34.6");
    expect(map).toHaveAttribute("data-lng", "-58.4");
  });

  it('calls /api/geocode when "Buscar" is clicked, updates coords on success', async () => {
    server.use(
      http.get("/api/geocode", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("q")).toBe("Florida 100");
        return HttpResponse.json({
          lat: -34.6,
          lng: -58.4,
          formatted: "Florida 100, CABA",
          cached: false,
        });
      }),
    );
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        direccion: { texto: "Florida 100", lat: null, lng: null },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    // El handler vuelve y setea el form — esperamos a que el map muestre nuevas coords.
    await waitFor(() => {
      expect(screen.getByTestId("address-map")).toHaveAttribute(
        "data-lat",
        "-34.6",
      );
    });
    expect(screen.getByTestId("place-autocomplete")).toHaveValue(
      "Florida 100, CABA",
    );
  });

  it("shows a friendly error when /api/geocode returns 404", async () => {
    server.use(
      http.get("/api/geocode", () =>
        HttpResponse.json(
          { message: "No se encontró esa dirección." },
          { status: 404 },
        ),
      ),
    );
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        direccion: { texto: "asdfqwer1234", lat: null, lng: null },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(
      await screen.findByText(/no se encontró la dirección/i),
    ).toBeInTheDocument();
  });

  it("refuses to geocode if the typed text is too short", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        direccion: { texto: "ab", lat: null, lng: null },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
  });
});

describe("<UserProfile> — Notificaciones push section", () => {
  it("no renderiza la sección si el toggle push está apagado", () => {
    setup({ sectionEnabled: (k) => k !== "push" });
    expect(screen.queryByText("Notificaciones push")).not.toBeInTheDocument();
  });

  it("muestra el mensaje de no-soportado cuando el browser no soporta push", () => {
    setup({ push: { ...defaultPush(), isSupported: false } });
    expect(screen.getByText("Notificaciones push")).toBeInTheDocument();
    expect(
      screen.getByText(/no soporta notificaciones push/i),
    ).toBeInTheDocument();
  });

  it("muestra el botón Activar y llama subscribe al hacer click", async () => {
    const subscribe = vi.fn().mockResolvedValue(true);
    const addToast = vi.fn();
    setup({
      addToast,
      push: { ...defaultPush(), isSupported: true, subscribe },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /activar notificaciones/i }),
    );
    expect(subscribe).toHaveBeenCalled();
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
  });

  it("muestra Desactivar cuando ya está suscripto", () => {
    setup({
      push: { ...defaultPush(), isSupported: true, isSubscribed: true },
    });
    expect(
      screen.getByRole("button", { name: /desactivar notificaciones/i }),
    ).toBeInTheDocument();
  });

  it("guía a instalar la PWA en iOS-pestaña", () => {
    setup({
      push: { ...defaultPush(), isSupported: false, requiresStandalone: true },
    });
    expect(
      screen.getByText(/en tu pantalla de inicio/i),
    ).toBeInTheDocument();
  });

  it("avisa que el permiso está bloqueado (denied)", () => {
    setup({
      push: { ...defaultPush(), isSupported: true, permission: "denied" },
    });
    expect(screen.getByText(/Bloqueaste las notificaciones/i)).toBeInTheDocument();
  });
});

describe("<UserProfile> — selector de idioma", () => {
  it("muestra el toggle de idioma en Apariencia", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Español" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "English" }),
    ).toBeInTheDocument();
  });

  it("marca el idioma activo con aria-pressed", () => {
    setup({ lang: "en" });
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("al cambiar idioma actualiza el contexto y persiste en el server", async () => {
    const setLang = vi.fn();
    const updateProfile = vi.fn().mockResolvedValue({});
    setup({ setLang, updateProfile });
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(setLang).toHaveBeenCalledWith("en");
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ language: "en" }),
    );
  });
});

describe("<UserProfile> — índice (rail) y numeración", () => {
  it("renderiza el rail con los items de las secciones visibles", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Apariencia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "BoardGameGeek" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recordatorios" }),
    ).toBeInTheDocument();
  });

  it("numera las secciones (01 = la primera)", () => {
    setup();
    expect(screen.getByText("01")).toBeInTheDocument();
  });

  it("clickear un item del índice scrollea a esa sección", () => {
    const orig = window.HTMLElement.prototype.scrollIntoView;
    const spy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = spy;
    try {
      setup();
      fireEvent.click(screen.getByRole("button", { name: "Contacto" }));
      expect(spy).toHaveBeenCalled();
    } finally {
      window.HTMLElement.prototype.scrollIntoView = orig;
    }
  });

  it("oculta del rail la sección de push cuando está apagada", () => {
    setup({ sectionEnabled: (k) => k !== "push" });
    expect(
      screen.queryByRole("button", { name: "Notificaciones" }),
    ).toBeNull();
  });

  it("el botón Guardar (rail) arranca deshabilitado y se habilita al cambiar un campo", () => {
    const updateProfile = vi.fn().mockResolvedValue({});
    setup({ updateProfile });

    const save = screen.getByRole("button", { name: /guardar cambios/i });
    // Sin cambios → deshabilitado, y un click no dispara updateProfile.
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(updateProfile).not.toHaveBeenCalled();

    // Cambiar un campo guardable lo habilita.
    fireEvent.change(screen.getByLabelText(/avisarme/i), {
      target: { value: "2" },
    });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    expect(updateProfile).toHaveBeenCalled();
  });
});

describe("<UserProfile> — hero (identity header)", () => {
  it("muestra la foto de avatar del usuario en el tile del hero", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        avatar: { url: "https://cdn.test/me.webp", publicId: "p", color: "" },
      },
    });
    const heroImg = document.querySelector('[class*="heroAvatarImg"]');
    expect(heroImg).not.toBeNull();
    expect(heroImg.getAttribute("src")).toBe("https://cdn.test/me.webp");
  });

  it("muestra la inicial (sin img) en el hero cuando no hay foto", () => {
    setup({
      user: {
        _id: "u1",
        username: "cha",
        email: "a@b.com",
        displayName: "Cami",
        avatar: { url: "", publicId: "", color: "" },
      },
    });
    expect(document.querySelector('[class*="heroAvatarImg"]')).toBeNull();
  });
});

describe("<UserProfile> — Seguridad section", () => {
  it('"Cerrar sesión en todos los dispositivos" does nothing when the confirm is canceled', () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const logoutAllDevices = vi.fn();
    setup({ logoutAllDevices });

    fireEvent.click(
      screen.getByRole("button", {
        name: /cerrar sesión en todos los dispositivos/i,
      }),
    );

    expect(logoutAllDevices).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("invalidates every session and navigates to /login on confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const logoutAllDevices = vi.fn().mockResolvedValue();
    setup({ logoutAllDevices });

    fireEvent.click(
      screen.getByRole("button", {
        name: /cerrar sesión en todos los dispositivos/i,
      }),
    );

    await waitFor(() => expect(logoutAllDevices).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login"));
    confirmSpy.mockRestore();
  });

  it("shows an error toast and stays put when the server call fails", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const logoutAllDevices = vi
      .fn()
      .mockRejectedValue({ response: { data: { message: "Nope" } } });
    const addToast = vi.fn();
    setup({ logoutAllDevices, addToast });

    fireEvent.click(
      screen.getByRole("button", {
        name: /cerrar sesión en todos los dispositivos/i,
      }),
    );

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", message: "Nope" }),
      ),
    );
    expect(navigateMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
