import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

// Sección 5 ("Compartí esta partida"): CommunitySelect usa CommunityContext y
// BggGameSearch debouncea/fetchea; los stubeamos (el form de partida usa
// MyGamesPicker para su propio juego, así que esto solo afecta la sección 5).
vi.mock("../../components/shared/CommunitySelect", () => ({
  default: () => null,
}));
vi.mock("../../components/shared/BggGameSearch", () => ({
  default: ({ onPick }) => (
    <button
      type="button"
      onClick={() =>
        onPick({ id: 7, name: "Azul", thumbnail: "a.jpg", year: 2017 })
      }
    >
      mock-pick-share-game
    </button>
  ),
}));

import PlayForm from "./PlayForm";

function makeUser(overrides = {}) {
  return {
    _id: "me",
    username: "me",
    displayName: "Me",
    bggUsername: "meBGG",
    bggConnected: true,
    ...overrides,
  };
}

function renderForm(props = {}) {
  return render(
    <MemoryRouter>
      <PlayForm
        user={props.user || makeUser()}
        initialValues={props.initialValues}
        editMode={props.editMode}
        lockedGame={props.lockedGame}
        submitting={props.submitting}
        serverError={props.serverError}
        onSubmit={props.onSubmit || vi.fn()}
        onCancel={props.onCancel || vi.fn()}
        onDelete={props.onDelete}
        allowMultiSave={props.allowMultiSave}
        lastJuntada={props.lastJuntada}
      />
    </MemoryRouter>,
  );
}

const scoreInputs = () => screen.queryAllByLabelText(/^puntaje de/i);
// Con sólo "vos", el paso de jugadores requiere tildar "Jugué en solitario".
const checkSolo = () =>
  fireEvent.click(screen.getByLabelText(/jugué en solitario/i));
// El picker queda abierto tras elegir (permite agregar varios); se cierra con
// su ✕ (aria-label "Cancelar", distinto del "Cancelar" del footer).
const closePicker = () => {
  const x = screen
    .getAllByRole("button", { name: /^cancelar$/i })
    .find((b) => b.textContent === "✕");
  fireEvent.click(x);
};

function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  localStorage.clear(); // evita que un borrador (#4) contamine otros tests
  server.use(
    http.get("/api/bgg/mis-juegos/:user", () =>
      HttpResponse.json({
        items: [
          { id: "13", name: "Catán", thumbnail: null, year: 1995, numPlays: 5 },
        ],
        total: 1,
        page: 1,
        pages: 1,
      }),
    ),
    http.get("/api/bgg/mis-ubicaciones/:user", () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pages: 0 }),
    ),
    http.get("/api/bgg/mis-jugadores/:user", () =>
      HttpResponse.json({
        items: [
          {
            name: "Bob",
            username: "bob",
            numPlays: 2,
            lastPlayedDate: "2026-01-01",
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
      }),
    ),
    http.get("/api/users/jugadores", () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pages: 0 }),
    ),
    http.post("/api/users/by-bgg-usernames", () => HttpResponse.json([])),
    http.get("/api/bgg/jugado/:user/:gameId", () =>
      HttpResponse.json({ played: true, numPlays: 3, known: true }),
    ),
    // Autodetección "Nuevo" batch — por defecto nadie es nuevo.
    http.post("/api/bgg/nuevos/:user/:gameId", () =>
      HttpResponse.json({ flags: {} }),
    ),
    http.get("/api/bgg/game/:id", ({ params }) =>
      HttpResponse.json({ id: Number(params.id), playingTime: null }),
    ),
    http.get("/api/bgg/game/:id/expansiones", () =>
      HttpResponse.json({
        items: [
          { id: 300580, name: "Wingspan: Oceania" },
          { id: 266524, name: "European Expansion" },
        ],
      }),
    ),
    http.get("/api/bgg/variantes/:user/:gameId", () =>
      HttpResponse.json({ items: ["Escenario 1", "Mapa Norte"] }),
    ),
  );
});

describe("<PlayForm>", () => {
  it("ya no muestra el campo 'Cantidad'", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByText("Cantidad")).toBeNull();
  });

  it("preserva quantity al editar aunque no haya campo (no lo pisa a 1)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        details: { quantity: 3 },
        players: [{ name: "Me", username: "meBGG" }],
      },
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].quantity).toBe(3);
  });

  it("cada paso tiene un info con tooltip que explica qué hacer", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const helps = screen.getAllByRole("button", { name: /^ayuda:/i });
    // 4 pasos del scoresheet (la sección 5 es una tarjeta clicable sin tooltip).
    expect(helps).toHaveLength(4);
    // Abrir el del primer paso muestra su explicación.
    fireEvent.click(helps[0]);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /elegí el juego/i,
    );
  });

  it("renderiza las cuatro secciones del scoresheet", () => {
    renderForm();
    expect(screen.getByText("¿Qué jugaron?")).toBeInTheDocument();
    expect(screen.getByText("¿Cuándo y dónde?")).toBeInTheDocument();
    expect(screen.getByText("¿Quiénes jugaron?")).toBeInTheDocument();
    expect(screen.getByText("Notas")).toBeInTheDocument();
  });

  it("el título usa la voz del handoff (crear)", () => {
    renderForm();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /anotá la partida/i,
    );
  });

  it("el header tiene subtítulo (hero editorial, como el resto de secciones)", () => {
    const { unmount } = renderForm();
    expect(
      screen.getByText(/queda en tu almanaque de bg watch/i),
    ).toBeInTheDocument();
    unmount();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "Me", username: "meBGG" }],
      },
    });
    expect(
      screen.getByText(/se actualiza también en boardgamegeek/i),
    ).toBeInTheDocument();
  });

  it("con lockedGame muestra el juego sin el selector", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByText("Catán").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/filtrá tus juegos/i)).toBeNull();
  });

  it("prefilla el jugador 1 con el usuario (texto + handle @BGG, no input)", () => {
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(screen.queryByPlaceholderText("Nombre")).toBeNull();
    expect(screen.getAllByText("Me").length).toBeGreaterThan(0);
    expect(screen.getByText("@meBGG")).toBeInTheDocument();
  });

  it("no muestra el campo @BGG editable por jugador", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByPlaceholderText(/@BGG/i)).toBeNull();
  });

  it("al guardar envía el username del jugador (elegido en el picker)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].players[0].username).toBe("meBGG");
  });

  it("submit arma el payload esperado", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.objectid).toBe("13");
    expect(payload.players[0]).toMatchObject({ name: "Me", position: 1 });
  });

  // ── Multi-partida ("Guardar y cargar otra") ───────────────────────────
  it("muestra 'Guardar y cargar otra' sólo con allowMultiSave (no en edición)", () => {
    const { unmount } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(
      screen.queryByRole("button", { name: /guardar y cargar otra/i }),
    ).toBeNull();
    unmount();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      allowMultiSave: true,
    });
    expect(
      screen.getByRole("button", { name: /guardar y cargar otra/i }),
    ).toBeInTheDocument();
  });

  it("'Guardar y cargar otra' llama onSubmit con keepGoing:true", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      allowMultiSave: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(
      screen.getByRole("button", { name: /guardar y cargar otra/i }),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toEqual({ keepGoing: true, share: null });
  });

  it("'Guardar partida' llama onSubmit con keepGoing:false", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      allowMultiSave: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /^guardar partida$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toEqual({
      keepGoing: false,
      share: null,
    });
  });

  // ── Sección 5: "Compartí esta partida" (tarjeta clicable) ───────────
  const openShare = () =>
    fireEvent.click(screen.getByRole("button", { name: /compartí esta partida/i }));

  it("la sección 5 no aparece en modo edición", () => {
    renderForm({
      editMode: true,
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByText(/compartí esta partida/i)).not.toBeInTheDocument();
  });

  it("con la sección 5 colapsada (sin abrir), onSubmit recibe share: null", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /^guardar partida$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1].share).toBeNull();
  });

  it("al abrir la sección 5 se pre-carga el juego (el cuerpo NO se pre-puebla)", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    checkSolo();
    openShare();
    // El juego de la partida se pre-carga en la juntada (chip removible).
    expect(
      screen.getByRole("button", { name: /quitar catán/i }),
    ).toBeInTheDocument();
    // El cuerpo arranca vacío (los resultados van en el widget, no en el texto).
    expect(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i).value,
    ).toBe("");
  });

  it("con la sección 5 abierta, onSubmit recibe share con playResult (aunque no haya texto)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    openShare();
    fireEvent.click(screen.getByRole("button", { name: /^guardar partida$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const share = onSubmit.mock.calls[0][1].share;
    expect(share).toBeTruthy();
    expect(share.body).toBe(""); // ya no se pre-puebla
    expect(share.games.map((g) => g.id)).toEqual(["13"]);
    // El snapshot de resultados se arma del scorecard (incluye al dueño).
    expect(share.playResult).toBeTruthy();
    expect(
      share.playResult.players.some((p) => /me/i.test(p.name || p.username)),
    ).toBe(true);
  });

  it("el cuerpo escrito por el usuario se respeta en el share", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    openShare();
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "Gané por un pelo" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^guardar partida$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1].share.body).toBe("Gané por un pelo");
  });

  // ── Autodetección "Nuevo" ─────────────────────────────────────────────
  it("autodetecta 'Nuevo' para el dueño si nunca jugó el juego", async () => {
    server.use(
      http.post("/api/bgg/nuevos/:user/:gameId", () =>
        HttpResponse.json({ flags: { "u:mebgg": true } }),
      ),
    );
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
  });

  it("autodetecta 'Nuevo' para un invitado que el server marca nuevo", async () => {
    server.use(
      http.post("/api/bgg/nuevos/:user/:gameId", () =>
        HttpResponse.json({ flags: { "u:bob": true, "u:mebgg": false } }),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
  });

  it("NO marca 'Nuevo' cuando el server no lo flaggea", async () => {
    server.use(
      http.post("/api/bgg/nuevos/:user/:gameId", () =>
        HttpResponse.json({ flags: { "u:bob": false, "u:mebgg": false } }),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    await waitFor(() =>
      expect(screen.getAllByText("Bob").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/nuevo/i)).toBeNull();
  });

  it("marca 'Nuevo' a un invitado SIN @BGG (sin sync), matcheado por nombre", async () => {
    // El caso "Nico del Dot": co-jugador sin username, el server lo marca nuevo
    // por su clave de nombre. El cliente la deriva igual (`n:<nombre>`).
    let received = null;
    server.use(
      http.get("/api/bgg/mis-jugadores/:user", () =>
        HttpResponse.json({
          items: [
            { name: "Nico del Dot", username: "", numPlays: 0, lastPlayedDate: null },
          ],
          total: 1,
          page: 1,
          pages: 1,
        }),
      ),
      http.post("/api/bgg/nuevos/:user/:gameId", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ flags: { "n:nico del dot": true } });
      }),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Nico del Dot")).closest("button"));
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
    // El roster enviado al server incluye al invitado con su nombre.
    await waitFor(() =>
      expect(
        received?.players?.some((p) => p.name === "Nico del Dot"),
      ).toBe(true),
    );
  });

  // ── Duración ──────────────────────────────────────────────────────────
  it("sugiere el tiempo de caja de BGG y lo aplica al click", async () => {
    server.use(
      http.get("/api/bgg/game/:id", ({ params }) =>
        HttpResponse.json({ id: Number(params.id), playingTime: 75 }),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const suggest = await screen.findByRole("button", {
      name: /tiempo de caja: 75 min/i,
    });
    fireEvent.click(suggest);
    expect(screen.getByDisplayValue("75")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /tiempo de caja/i }),
    ).toBeNull();
  });

  it("los presets de duración cargan el valor", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /^60min$/i }));
    expect(screen.getByRole("spinbutton")).toHaveValue(60);
  });

  // ── Fecha ─────────────────────────────────────────────────────────────
  it("el chip 'Ayer' carga la fecha de ayer en el payload", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /^ayer$/i }));
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].playdate).toBe(isoOffset(-1));
  });

  // ── Picker / scoring ──────────────────────────────────────────────────
  it("agregar jugador abre el picker y suma una fila", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(scoreInputs()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(scoreInputs()).toHaveLength(2);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
  });

  it("no permite quitar a 'Vos' (el usuario), sí al resto", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    // Sólo el dueño → nadie tiene botón de quitar.
    expect(
      screen.queryByRole("button", { name: /quitar jugador/i }),
    ).toBeNull();
    // Con un 2º jugador, sólo ese tiene quitar (el dueño "vos" no).
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(
      screen.getAllByRole("button", { name: /quitar jugador/i }),
    ).toHaveLength(1);
  });

  it("el picker queda abierto tras elegir un jugador (agregar varios)", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    // Sigue abierto: el buscador del picker permanece; se cierra con su ✕.
    expect(screen.getByPlaceholderText(/buscá o escribí/i)).toBeInTheDocument();
    closePicker();
    expect(screen.queryByPlaceholderText(/buscá o escribí/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /agregar jugador/i }),
    ).toBeInTheDocument();
  });

  it("el picker se cierra al clickear fuera", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    await screen.findByText("Bob");
    expect(screen.getByPlaceholderText(/buscá o escribí/i)).toBeInTheDocument();
    // mousedown fuera del picker (el título de la sección) → se cierra.
    fireEvent.mouseDown(screen.getByText("¿Quiénes jugaron?"));
    expect(screen.queryByPlaceholderText(/buscá o escribí/i)).toBeNull();
  });

  it("deriva la posición del puntaje (mayor score = 1°)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    const scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "5" } });
    fireEvent.change(scores[1], { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.find((p) => p.name === "Bob").position).toBe(1);
    expect(players.find((p) => p.name === "Me").position).toBe(2);
  });

  it("autoasigna 'Ganó' al puntaje más alto (#1)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    const scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "5" } });
    fireEvent.change(scores[1], { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.find((p) => p.name === "Bob").win).toBe(true);
    expect(players.find((p) => p.name === "Me").win).toBe(false);
  });

  it("respeta el ganador elegido a mano al editar un puntaje después (#2)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    closePicker();
    let scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob → auto-gana

    // Tomamos control manual: Bob deja de ganar, Me gana (juego donde no gana
    // el mayor puntaje).
    const trophies = screen.getAllByRole("button", { name: /^ganó$/i });
    fireEvent.click(trophies[1]); // Bob off
    fireEvent.click(trophies[0]); // Me on

    // Editar un puntaje ya NO debe reasignar el ganador al score más alto.
    scores = scoreInputs();
    fireEvent.change(scores[1], { target: { value: "20" } }); // Bob ahora 20

    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.find((p) => p.name === "Me").win).toBe(true);
    expect(players.find((p) => p.name === "Bob").win).toBe(false);
  });

  it("los atajos +/- cambian el puntaje", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const [score] = scoreInputs();
    expect(score.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /subir puntaje/i }));
    expect(score.value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /subir puntaje/i }));
    expect(score.value).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: /bajar puntaje/i }));
    expect(score.value).toBe("1");
  });

  it("'Ordenar por puntaje' aparece con scores y reordena por score desc", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    closePicker();
    expect(
      screen.queryByRole("button", { name: /ordenar por puntaje/i }),
    ).toBeNull();
    const scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "5" } });
    fireEvent.change(scores[1], { target: { value: "10" } });
    fireEvent.click(
      screen.getByRole("button", { name: /ordenar por puntaje/i }),
    );
    const scoresAfter = scoreInputs();
    expect(scoresAfter[0].value).toBe("10");
    expect(scoresAfter[1].value).toBe("5");
  });

  // ── Jugador anónimo ───────────────────────────────────────────────────
  it("'+ Jugador anónimo' agrega asientos numerados, sin @handle", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const anonBtn = screen.getByRole("button", { name: /jugador anónimo/i });
    fireEvent.click(anonBtn);
    // Aparece en la fila del form y en el scorecard en vivo.
    expect(screen.getAllByText("Jugador anónimo 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("anónimo").length).toBeGreaterThan(0);
    fireEvent.click(anonBtn);
    expect(screen.getAllByText("Jugador anónimo 2").length).toBeGreaterThan(0);
    // No tiene handle @ (sólo el dueño @meBGG).
    expect(screen.queryByText("@")).toBeNull();
  });

  it("el anónimo viaja al payload con name reservado y username vacío", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /jugador anónimo/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const anon = onSubmit.mock.calls[0][0].players.find((p) =>
      /jugador anónimo/i.test(p.name),
    );
    expect(anon).toMatchObject({ name: "Jugador anónimo 1", username: "" });
  });

  it("al quitar un anónimo, renumera los restantes", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const anonBtn = screen.getByRole("button", { name: /jugador anónimo/i });
    fireEvent.click(anonBtn);
    fireEvent.click(anonBtn);
    expect(screen.getAllByText("Jugador anónimo 2").length).toBeGreaterThan(0);
    // Quitar el primer anónimo (fila 1; la 0 es el dueño) → el segundo pasa a 1.
    const removeBtns = screen.getAllByRole("button", {
      name: /quitar jugador/i,
    });
    fireEvent.click(removeBtns[1]);
    expect(screen.getAllByText("Jugador anónimo 1").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Jugador anónimo 2")).toHaveLength(0);
  });

  // ── Modo cooperativo ──────────────────────────────────────────────────
  it("en cooperativa se ocultan los puntajes y se elige Ganamos/Perdimos", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(scoreInputs()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /cooperativa/i }));
    expect(scoreInputs()).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /ganamos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /perdimos/i }),
    ).toBeInTheDocument();
  });

  it("coop 'Ganamos' marca win en todos y manda score vacío", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /cooperativa/i }));
    checkSolo();
    // "Ganamos" es el default activo; submit directo.
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.every((p) => p.win === true)).toBe(true);
    expect(players.every((p) => p.score === "")).toBe(true);
  });

  it("coop 'Perdimos' deja win en false para todos", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /cooperativa/i }));
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /perdimos/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.every((p) => p.win === false)).toBe(true);
  });

  // ── Modo equipos ──────────────────────────────────────────────────────
  async function renderTeams(onSubmit) {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    closePicker();
    fireEvent.click(screen.getByRole("button", { name: /equipos/i }));
  }

  it("en equipos hay puntaje por jugador y aparece '¿Qué equipo ganó?'", async () => {
    await renderTeams(vi.fn());
    expect(scoreInputs()).toHaveLength(2);
    expect(screen.getByText(/¿qué equipo ganó\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^equipo a$/i }),
    ).toBeInTheDocument();
  });

  it("en equipos el puntaje NO reasigna el ganador (gana el equipo)", async () => {
    const onSubmit = vi.fn();
    await renderTeams(onSubmit);
    // Bob (equipo B) tiene el score más alto, pero gana el equipo A.
    const scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "10" } }); // Me (A)
    fireEvent.change(scores[1], { target: { value: "99" } }); // Bob (B)
    fireEvent.click(screen.getByRole("button", { name: /^equipo a$/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    const me = players.find((p) => p.name === "Me");
    const bob = players.find((p) => p.name === "Bob");
    expect(me.score).toBe("10");
    expect(bob.score).toBe("99");
    expect(me.win).toBe(true); // ganó por equipo, no por score
    expect(bob.win).toBe(false);
  });

  it("asigna A/B y manda color por equipo + win al equipo ganador", async () => {
    const onSubmit = vi.fn();
    await renderTeams(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: /^equipo a$/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    const me = players.find((p) => p.name === "Me");
    const bob = players.find((p) => p.name === "Bob");
    expect(me.color).toBe("Equipo A");
    expect(bob.color).toBe("Equipo B");
    expect(me.win).toBe(true); // su equipo (A) ganó
    expect(bob.win).toBe(false);
  });

  it("en equipos también aparece 'Ordenar por puntaje' al cargar scores", async () => {
    await renderTeams(vi.fn());
    expect(
      screen.queryByRole("button", { name: /ordenar por puntaje/i }),
    ).toBeNull();
    const scores = scoreInputs();
    fireEvent.change(scores[0], { target: { value: "5" } });
    fireEvent.change(scores[1], { target: { value: "10" } });
    expect(
      screen.getByRole("button", { name: /ordenar por puntaje/i }),
    ).toBeInTheDocument();
  });

  it("'+ Equipo' habilita un tercer equipo (C)", async () => {
    await renderTeams(vi.fn());
    expect(screen.queryByRole("button", { name: /^equipo c$/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /\+ equipo/i }));
    expect(
      screen.getByRole("button", { name: /^equipo c$/i }),
    ).toBeInTheDocument();
  });

  it("'− Equipo' reduce la cantidad de equipos (no aparece con 2)", async () => {
    await renderTeams(vi.fn());
    // Con 2 equipos no hay botón de quitar.
    expect(screen.queryByRole("button", { name: /−\s*equipo/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /\+ equipo/i })); // → 3
    expect(
      screen.getByRole("button", { name: /^equipo c$/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /−\s*equipo/i })); // → 2
    expect(screen.queryByRole("button", { name: /^equipo c$/i })).toBeNull();
  });

  it("al editar una partida por equipos, abre en modo equipos", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [
          { name: "Me", username: "meBGG", color: "Equipo A", win: true },
          { name: "Bob", username: "bob", color: "Equipo B", win: false },
        ],
      },
    });
    expect(screen.getByText(/¿qué equipo ganó\?/i)).toBeInTheDocument();
    // El equipo ganador (A) queda preseleccionado.
    expect(screen.getByRole("button", { name: /^equipo a$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^equipo b$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // ── "Jugué en solitario" ──────────────────────────────────────────────
  it("con sólo 'vos' el paso de jugadores no se completa y el submit queda off", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getByLabelText(/jugué en solitario/i)).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /guardar partida/i }),
    ).toBeDisabled();
  });

  it("tildar 'Jugué en solitario' completa el paso y habilita guardar", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    checkSolo();
    expect(
      screen.getByRole("button", { name: /guardar partida/i }),
    ).toBeEnabled();
  });

  it("agregar un segundo jugador completa el paso (y oculta el check solo)", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(screen.queryByLabelText(/jugué en solitario/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /guardar partida/i }),
    ).toBeEnabled();
  });

  it("al editar una partida en solitario, el paso ya está completo", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "Me", username: "meBGG", win: true }],
      },
    });
    expect(screen.getByLabelText(/jugué en solitario/i)).toBeChecked();
    expect(
      screen.getByRole("button", { name: /guardar cambios/i }),
    ).toBeEnabled();
  });

  // ── Edición / errores ─────────────────────────────────────────────────
  it("en edición muestra título y CTA de edición + danger zone", () => {
    const onDelete = vi.fn();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "X", username: "", win: false, new: false }],
      },
      onDelete,
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /editá la partida/i,
    );
    expect(
      screen.getByRole("button", { name: /guardar cambios/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /eliminar partida/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("al editar, detecta el asiento anónimo por el nombre reservado", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [
          { name: "X", username: "xbgg" },
          { name: "Jugador anónimo 1", username: "" },
        ],
      },
    });
    expect(screen.getAllByText("Jugador anónimo 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("anónimo").length).toBeGreaterThan(0);
  });

  it("muestra el serverError", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      serverError: "Algo falló",
    });
    expect(screen.getByText("Algo falló")).toBeInTheDocument();
  });

  it("una fecha futura (backstop) muestra error y deshabilita el submit", () => {
    renderForm({
      initialValues: {
        game: { id: "13", name: "Catán" },
        details: { playdate: "2099-12-31" },
      },
      lockedGame: true,
    });
    expect(screen.getByText(/no puede ser futura/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar partida/i }),
    ).toBeDisabled();
  });

  it("'Usar última juntada' precarga jugadores + ubicación", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
      lastJuntada: {
        location: "Club de Mesa",
        players: [
          { name: "Ana", username: "anabgg" },
          { name: "Beto", username: "" },
        ],
      },
    });
    expect(scoreInputs()).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: /usar última juntada/i }),
    );
    expect(scoreInputs()).toHaveLength(2);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beto").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.location).toBe("Club de Mesa");
    expect(payload.players.map((p) => p.name)).toEqual(["Ana", "Beto"]);
  });

  it("no muestra 'Usar última juntada' en modo edición", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "X", username: "" }],
      },
      lastJuntada: {
        location: "Club",
        players: [{ name: "Ana", username: "anabgg" }],
      },
    });
    expect(
      screen.queryByRole("button", { name: /usar última juntada/i }),
    ).toBeNull();
  });

  it("el preview resuelve avatares de jugadores miembros (useBggUserMap)", async () => {
    server.use(
      http.post("/api/users/by-bgg-usernames", () =>
        HttpResponse.json([
          {
            _id: "u9",
            username: "meuser",
            displayName: "Me User",
            avatar: { url: "", publicId: "" },
            bggUsername: "meBGG",
          },
        ]),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const avatars = await screen.findAllByTestId("avatar");
    await waitFor(() =>
      expect(avatars.some((a) => a.textContent === "meuser")).toBe(true),
    );
  });

  // ── Expansiones / variante / firma ────────────────────────────────────
  it("agregar una expansión la muestra como chip y la manda en comments", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Wingspan" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(
      screen.getByRole("button", { name: /expansiones jugadas/i }),
    );
    fireEvent.click(await screen.findByText("Wingspan: Oceania"));
    // Chip visible.
    expect(screen.getAllByText("Wingspan: Oceania").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { comments } = onSubmit.mock.calls[0][0];
    expect(comments).toContain("Played with expansions:");
    expect(comments).toContain("[thing=300580]Wingspan: Oceania[/thing]");
  });

  it("elegir variante la manda en comments + variant en el payload", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Wingspan" } },
      lockedGame: true,
      onSubmit,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /variante\/tablero/i }));
    fireEvent.click(await screen.findByText("Mapa Norte"));
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.comments).toContain("Variante/Tablero: Mapa Norte");
    expect(payload.variant).toBe("Mapa Norte");
  });

  it("agrega la firma @turnocero0 al crear, no al editar", async () => {
    const onCreate = vi.fn();
    const { unmount } = renderForm({
      initialValues: { game: { id: "13", name: "Wingspan" } },
      lockedGame: true,
      onSubmit: onCreate,
    });
    checkSolo();
    fireEvent.click(screen.getByRole("button", { name: /guardar partida/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0].comments).toContain("@turnocero0");
    unmount();

    const onEdit = vi.fn();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Wingspan" },
        players: [{ name: "Me", username: "meBGG" }],
        details: { comments: "Comentario sin firma" },
      },
      onSubmit: onEdit,
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(onEdit).toHaveBeenCalled());
    expect(onEdit.mock.calls[0][0].comments).not.toContain("@turnocero0");
  });

  it("al editar separa notas / expansiones / variante del comentario", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Wingspan" },
        players: [{ name: "Me", username: "meBGG" }],
        details: {
          comments:
            "Mis notas\n\nPlayed with expansions:\n- [thing=300580]Wingspan: Oceania[/thing]\n\nVariante/Tablero: Mapa Norte\n\n@turnocero0",
        },
      },
    });
    // El textarea muestra sólo las notas.
    expect(screen.getByDisplayValue("Mis notas")).toBeInTheDocument();
    // La expansión y la variante aparecen como chips.
    expect(screen.getByText("Wingspan: Oceania")).toBeInTheDocument();
    expect(screen.getByText(/Mapa Norte/)).toBeInTheDocument();
    // La firma no se ve.
    expect(screen.queryByText(/@turnocero0/)).toBeNull();
  });

  // ── Borrador local (#4) ───────────────────────────────────────────────
  const DRAFT_KEY = "turnocero_play_draft:mebgg";

  it("persiste el borrador al editar un form en blanco", async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/combo de la ronda/i), {
      target: { value: "Gran partida" },
    });
    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw).details.comments).toBe("Gran partida");
    });
  });

  it("ofrece retomar un borrador guardado y lo restaura", async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        game: { id: "13", name: "Catán" },
        details: { comments: "Borrador previo" },
        players: [
          { name: "Me", username: "meBGG", score: "", win: false, new: false },
          {
            name: "Ana",
            username: "anabgg",
            score: "",
            win: false,
            new: false,
          },
        ],
      }),
    );
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /retomar/i }));
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Borrador previo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar/i })).toBeNull();
  });

  it("'Descartar' limpia el borrador y oculta el banner", async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ game: { id: "13" }, details: {}, players: [] }),
    );
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /descartar/i }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: /retomar/i })).toBeNull();
  });

  it("cancelar limpia el borrador", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ game: { id: "13" }, details: {}, players: [] }),
    );
    renderForm({ onCancel: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("no ofrece borrador con juego prefijado (?juego) ni en edición", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ game: { id: "99" }, details: {}, players: [] }),
    );
    const { unmount } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByRole("button", { name: /retomar/i })).toBeNull();
    unmount();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "X", username: "" }],
      },
    });
    expect(screen.queryByRole("button", { name: /retomar/i })).toBeNull();
  });
});
