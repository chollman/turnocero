import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// ── Mocks ────────────────────────────────────────────────────────────
let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
const addToast = vi.fn();
const dismiss = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast, dismiss }),
}));

// PlayForm stub: expone onSubmit/onCancel + lo que recibió. El onSubmit ahora
// recibe (payload, { keepGoing }); el stub ofrece dos botones para cada caso.
vi.mock("./PlayForm", () => ({
  default: ({
    onSubmit,
    onCancel,
    lockedGame,
    initialValues,
    allowMultiSave,
    lastJuntada,
  }) => {
    const payload = {
      objectid: "13",
      playdate: "2026-05-01",
      location: "Casa",
      players: [
        { name: "Me", username: "meBGG" },
        { name: "Bob", username: "bob" },
      ],
    };
    return (
      <div data-testid="play-form">
        <span data-testid="locked">{String(!!lockedGame)}</span>
        <span data-testid="multi">{String(!!allowMultiSave)}</span>
        <span data-testid="game">{initialValues?.game?.name || ""}</span>
        <span data-testid="last-juntada">
          {lastJuntada ? lastJuntada.players.map((p) => p.name).join(",") : ""}
        </span>
        <span data-testid="carry-players">
          {(initialValues?.players || []).map((p) => p.name).join(",")}
        </span>
        <span data-testid="carry-loc">
          {initialValues?.details?.location || ""}
        </span>
        <button onClick={() => onSubmit(payload, { keepGoing: false })}>
          submit
        </button>
        <button onClick={() => onSubmit(payload, { keepGoing: true })}>
          submit-keep
        </button>
        <button
          onClick={() => onSubmit(payload, { keepGoing: false, share: SHARE })}
        >
          submit-share
        </button>
        <button
          onClick={() => onSubmit(payload, { keepGoing: true, share: SHARE })}
        >
          submit-keep-share
        </button>
        <button onClick={onCancel}>cancel</button>
      </div>
    );
  },
}));

// Bloque "Compartí esta partida" que el form pasaría en onSubmit cuando la
// sección 5 está activada con contenido. Sin fotos para no lidiar con FormData.
const SHARE = {
  privacy: "public",
  community: "",
  title: "Linda noche",
  body: "ganamos",
  games: [{ id: "13", name: "Catán" }],
  images: [],
  playResult: {
    mode: "versus",
    game: { name: "Catán", thumbnail: "" },
    gameId: 13,
    date: "2026-06-08",
    duration: 60,
    players: [{ name: "Me", username: "meBGG", score: "85", win: true, position: 1 }],
  },
};

import CreatePlay from "./CreatePlay";

function Echo() {
  const loc = useLocation();
  return <div data-testid="echo">{loc.pathname + loc.search}</div>;
}

// Probe persistente (sibling de Routes) para observar la URL tras un redirect
// que cae de nuevo en una ruta que renderiza CreatePlay (no un Echo).
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname + loc.search}</div>;
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/bg-watch/:bggUsername/partidas/nueva"
          element={<CreatePlay />}
        />
        <Route path="/bg-watch/:bggUsername" element={<Echo />} />
        <Route path="/bg-watch/:bggUsername/coleccion" element={<Echo />} />
        <Route path="/bg-watch/:bggUsername/juego/:gameId" element={<Echo />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWithState(entry, state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: entry, state }]}>
      <Routes>
        <Route
          path="/bg-watch/:bggUsername/partidas/nueva"
          element={<CreatePlay />}
        />
        <Route path="/bg-watch/:bggUsername" element={<Echo />} />
      </Routes>
    </MemoryRouter>,
  );
}

const clipboardWrite = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  addToast.mockClear();
  dismiss.mockClear();
  clipboardWrite.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWrite },
    configurable: true,
    writable: true,
  });
  mockUser = {
    _id: "me",
    username: "me",
    displayName: "Me",
    bggUsername: "meBGG",
    bggConnected: true,
    bggInvalid: false,
  };
});

describe("<CreatePlay>", () => {
  it("no-dueño con cuenta propia: redirige a SU carga (el link no depende del username)", async () => {
    mockUser = { ...mockUser, bggUsername: "otro" };
    render(
      <MemoryRouter
        initialEntries={[
          "/bg-watch/meBGG/partidas/nueva?volver=%2Fbg-watch%2FmeBGG%2Fcoleccion",
        ]}
      >
        <LocationProbe />
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/partidas/nueva"
            element={<CreatePlay />}
          />
          <Route path="/bg-watch/:bggUsername" element={<Echo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent(
        "/bg-watch/otro/partidas/nueva",
      ),
    );
    // conserva el ?volver al redirigir
    expect(screen.getByTestId("path")).toHaveTextContent("volver=");
  });

  it("sin cuenta de BGG redirige al hub", async () => {
    mockUser = { ...mockUser, bggUsername: "" };
    render(
      <MemoryRouter initialEntries={["/bg-watch/meBGG/partidas/nueva"]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/partidas/nueva"
            element={<CreatePlay />}
          />
          <Route path="/bg-watch" element={<Echo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe("/bg-watch"),
    );
    expect(screen.queryByTestId("play-form")).toBeNull();
  });

  it("redirige si el usuario no tiene BGG conectado", async () => {
    mockUser = { ...mockUser, bggConnected: false };
    renderAt("/bg-watch/meBGG/partidas/nueva");
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
  });

  it("el dueño ve el form (sin juego prefijado)", () => {
    renderAt("/bg-watch/meBGG/partidas/nueva");
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
    expect(screen.getByTestId("locked")).toHaveTextContent("false");
  });

  it("trae la última juntada y se la pasa al form", async () => {
    server.use(
      http.get("/api/bgg/ultima-juntada/:user", () =>
        HttpResponse.json({
          juntada: {
            location: "Club",
            players: [
              { name: "Me", username: "meBGG" },
              { name: "Bob", username: "bob" },
            ],
          },
        }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    await waitFor(() =>
      expect(screen.getByTestId("last-juntada")).toHaveTextContent("Me,Bob"),
    );
  });

  it("con ?juego prefija el juego (locked) tras traer sus datos", async () => {
    server.use(
      http.get("/api/bgg/game/:id", () =>
        HttpResponse.json({
          id: "13",
          name: "Catán",
          thumbnail: null,
          year: 1995,
        }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva?juego=13");
    await waitFor(() =>
      expect(screen.getByTestId("game")).toHaveTextContent("Catán"),
    );
    expect(screen.getByTestId("locked")).toHaveTextContent("true");
  });

  it("vuelve a la tab de origen (?volver) al guardar", async () => {
    server.use(
      http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
    );
    renderAt(
      `/bg-watch/meBGG/partidas/nueva?volver=${encodeURIComponent(
        "/bg-watch/meBGG/coleccion",
      )}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent(
        "/bg-watch/meBGG/coleccion",
      ),
    );
  });

  it("ignora un ?volver externo (solo rutas de BG Watch)", async () => {
    renderAt(
      `/bg-watch/meBGG/partidas/nueva?volver=${encodeURIComponent(
        "https://evil.example",
      )}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    // Cae al fallback (perfil), no al destino externo.
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
  });

  it("submit hace POST y navega al perfil", async () => {
    let posted = false;
    server.use(
      http.post("/api/bgg/partidas", () => {
        posted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(posted).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("con 'cargar otra' guarda, se queda y conserva roster + ubicación", async () => {
    let posts = 0;
    server.use(
      http.post("/api/bgg/partidas", () => {
        posts += 1;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit-keep" }));
    await waitFor(() => expect(posts).toBe(1));
    // No navegó: sigue el form, y remontó con el roster + ubicación.
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
    expect(screen.queryByTestId("echo")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("carry-players")).toHaveTextContent("Me,Bob"),
    );
    expect(screen.getByTestId("carry-loc")).toHaveTextContent("Casa");
  });

  it("precarga el form desde location.state.prefill (partida compartida)", () => {
    renderWithState("/bg-watch/meBGG/partidas/nueva", {
      prefill: {
        game: { id: "13", name: "Catán" },
        details: { location: "Club" },
        players: [{ name: "Ana", username: "ana" }],
      },
    });
    expect(screen.getByTestId("game")).toHaveTextContent("Catán");
    expect(screen.getByTestId("carry-players")).toHaveTextContent("Ana");
    expect(screen.getByTestId("carry-loc")).toHaveTextContent("Club");
  });

  it("manda sharedFromNotifId en el POST y descarta la notif al guardar", async () => {
    let body = null;
    server.use(
      http.post("/api/bgg/partidas", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    renderWithState("/bg-watch/meBGG/partidas/nueva", {
      prefill: { game: { id: "13", name: "Catán" }, players: [] },
      sharedFromNotifId: "notif123",
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body.sharedFromNotifId).toBe("notif123");
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith("notif123"));
  });

  // ── Sección 5: "Compartí esta partida" ──────────────────────────────
  it("submit normal (sin share) NO postea a compartidas", async () => {
    let compartidas = 0;
    server.use(
      http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
      http.post("/api/compartidas", () => {
        compartidas += 1;
        return HttpResponse.json({ _id: "j", images: [] });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(compartidas).toBe(0);
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it("con share: guarda la partida, crea la juntada y copia el deeplink", async () => {
    let comBody = null;
    server.use(
      http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
      http.post("/api/compartidas", async ({ request }) => {
        comBody = await request.json();
        return HttpResponse.json({ _id: "j1", images: [] });
      }),
      // El share copia el SHORT link de la juntada (get-or-create).
      http.post("/api/shortlinks", () =>
        HttpResponse.json({ code: "Jun7ad", path: "/x" }, { status: 201 }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit-share" }));
    await waitFor(() => expect(comBody).not.toBeNull());
    expect(comBody.category).toBe("juntada");
    expect(comBody.body).toBe("ganamos");
    expect(comBody.boardGames.map((g) => g.bggId)).toEqual(["13"]);
    // El snapshot de resultados viaja en el POST.
    expect(comBody.playResult?.players?.[0]?.name).toBe("Me");
    // Copió el short link de la juntada recién creada.
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
    expect(clipboardWrite.mock.calls[0][0]).toContain("/s/Jun7ad");
    // Navegó al perfil y mostró un toast de éxito mencionando el link.
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        message: expect.stringMatching(/link de la juntada copiado/i),
      }),
    );
  });

  it("si la juntada falla, la partida queda guardada (navega) + toast de error, sin copiar", async () => {
    server.use(
      http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
      http.post("/api/compartidas", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit-share" }));
    // La partida NO se revierte: navega igual al perfil.
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: expect.stringMatching(/no se pudo crear la compartida/i),
      }),
    );
  });

  it("con 'cargar otra' + share: crea la juntada una vez, copia y se queda en el form", async () => {
    let partidas = 0;
    let compartidas = 0;
    server.use(
      http.post("/api/bgg/partidas", () => {
        partidas += 1;
        return HttpResponse.json({ ok: true });
      }),
      http.post("/api/compartidas", () => {
        compartidas += 1;
        return HttpResponse.json({ _id: "j2", images: [] });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit-keep-share" }));
    await waitFor(() => expect(compartidas).toBe(1));
    expect(partidas).toBe(1);
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
    // No navegó: el form sigue (remontado) y conserva el roster.
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
    expect(screen.queryByTestId("echo")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("carry-players")).toHaveTextContent("Me,Bob"),
    );
  });

  it("si falla la partida, NO intenta la juntada", async () => {
    let compartidas = 0;
    server.use(
      http.post("/api/bgg/partidas", () =>
        HttpResponse.json({ message: "no" }, { status: 500 }),
      ),
      http.post("/api/compartidas", () => {
        compartidas += 1;
        return HttpResponse.json({ _id: "j", images: [] });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit-share" }));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    expect(compartidas).toBe(0);
    expect(clipboardWrite).not.toHaveBeenCalled();
    // No navegó (sigue el form).
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
  });
});
