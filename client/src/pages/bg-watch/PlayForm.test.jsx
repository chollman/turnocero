import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
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
        keepGoing={props.keepGoing}
        onKeepGoingChange={props.onKeepGoingChange}
        lastJuntada={props.lastJuntada}
      />
    </MemoryRouter>,
  );
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
    http.get("/api/bgg/jugado/:user/:gameId", () =>
      HttpResponse.json({ played: true, numPlays: 3, known: true }),
    ),
    // Detalle del juego — alimenta la sugerencia de duración (tiempo de caja).
    // Default sin playingTime → sin sugerencia (tests específicos overridean).
    http.get("/api/bgg/game/:id", ({ params }) =>
      HttpResponse.json({ id: Number(params.id), playingTime: null }),
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

  it("renderiza las tres secciones", () => {
    renderForm();
    // "El juego" es el título de sección; "Jugadores"/"Extras" aparecen también
    // en el stepper, por eso van con getAllByText.
    expect(screen.getByText("El juego")).toBeInTheDocument();
    expect(screen.getAllByText("Jugadores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Extras").length).toBeGreaterThan(0);
  });

  it("con lockedGame muestra el juego sin el selector", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByText("Catán").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/filtrá tus juegos/i)).toBeNull();
  });

  it("prefilla el jugador 1 con el usuario", () => {
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    // El nombre ya no es input editable: se muestra como texto + handle @BGG.
    expect(screen.queryByPlaceholderText("Nombre")).toBeNull();
    expect(screen.getAllByText("Me").length).toBeGreaterThan(0);
    expect(screen.getByText("@meBGG")).toBeInTheDocument();
  });

  it("el nombre del jugador es texto, no un input editable", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByPlaceholderText("Nombre")).toBeNull();
    expect(screen.getByText("@meBGG")).toBeInTheDocument();
  });

  it("no muestra el campo @BGG por jugador", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.queryByPlaceholderText(/@BGG/i)).toBeNull();
  });

  it("al guardar igual envía el username del jugador (elegido en el picker)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.objectid).toBe("13");
    expect(payload.players[0]).toMatchObject({ name: "Me", position: 1 });
  });

  it("muestra el check 'Cargar otra' sólo si onKeepGoingChange está presente", () => {
    const { unmount } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
    });
    // Sin onKeepGoingChange → no aparece.
    expect(screen.queryByText(/cargar otra partida después/i)).toBeNull();
    unmount();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      onKeepGoingChange: vi.fn(),
    });
    expect(
      screen.getByText(/cargar otra partida después/i),
    ).toBeInTheDocument();
  });

  it("togglear 'Cargar otra' llama onKeepGoingChange y cambia el CTA", () => {
    const onKeepGoingChange = vi.fn();
    const { rerender } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      keepGoing: false,
      onKeepGoingChange,
    });
    expect(
      screen.getByRole("button", { name: /guardar en bgg/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /cargar otra/i }));
    expect(onKeepGoingChange).toHaveBeenCalledWith(true);
    // Con keepGoing=true el CTA cambia.
    rerender(
      <MemoryRouter>
        <PlayForm
          user={makeUser()}
          initialValues={{ game: { id: "13", name: "Catán" } }}
          lockedGame
          keepGoing
          onKeepGoingChange={onKeepGoingChange}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /guardar y cargar otra/i }),
    ).toBeInTheDocument();
  });

  it("autodetecta 'Nuevo' para el dueño si nunca jugó el juego (known:true)", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", () =>
        HttpResponse.json({ played: false, numPlays: 0, known: true }),
      ),
    );
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
  });

  it("autodetecta 'Nuevo' para un invitado conocido (known:true, !played)", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", ({ params }) =>
        // El dueño (meBGG) ya jugó; Bob es conocido y no jugó → Nuevo.
        HttpResponse.json(
          params.user.toLowerCase() === "bob"
            ? { played: false, numPlays: 0, known: true }
            : { played: true, numPlays: 3, known: true },
        ),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    // Bob queda marcado "Nuevo"; el dueño no.
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
  });

  it("NO marca 'Nuevo' a un invitado desconocido (known:false)", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", ({ params }) =>
        HttpResponse.json(
          params.user.toLowerCase() === "bob"
            ? { played: false, numPlays: 0, known: false }
            : { played: true, numPlays: 3, known: true },
        ),
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
    // Una vez cargada la duración, la sugerencia desaparece.
    expect(
      screen.queryByRole("button", { name: /tiempo de caja/i }),
    ).toBeNull();
  });

  it("usa game.playingTime sin re-fetchear el detalle si ya viene", async () => {
    let fetched = false;
    server.use(
      http.get("/api/bgg/game/:id", ({ params }) => {
        fetched = true;
        return HttpResponse.json({ id: Number(params.id), playingTime: 99 });
      }),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán", playingTime: 45 } },
      lockedGame: true,
    });
    expect(
      await screen.findByRole("button", { name: /tiempo de caja: 45 min/i }),
    ).toBeInTheDocument();
    expect(fetched).toBe(false);
  });

  it("agregar jugador abre el picker y suma una fila", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByPlaceholderText("Score")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(screen.getAllByPlaceholderText("Score")).toHaveLength(2);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
  });

  it("en modo edición muestra título y CTA de edición + danger zone", () => {
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
    expect(screen.getByText("Editar partida")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar cambios/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /eliminar partida/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("muestra el serverError", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      serverError: "Algo falló",
    });
    expect(screen.getByText("Algo falló")).toBeInTheDocument();
  });

  it("deriva la posición del puntaje (mayor score = 1°)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    // Agregar a Bob como 2º jugador.
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    const scores = screen.getAllByPlaceholderText("Score");
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me (fila 0)
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob (fila 1)
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
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
    const scores = screen.getAllByPlaceholderText("Score");
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob (más alto)
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.find((p) => p.name === "Bob").win).toBe(true);
    expect(players.find((p) => p.name === "Me").win).toBe(false);
  });

  it("los atajos +/- cambian el puntaje", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const score = screen.getByPlaceholderText("Score");
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
    // Sin scores el botón no se muestra.
    expect(
      screen.queryByRole("button", { name: /ordenar por puntaje/i }),
    ).toBeNull();
    const scores = screen.getAllByPlaceholderText("Score");
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob
    fireEvent.click(
      screen.getByRole("button", { name: /ordenar por puntaje/i }),
    );
    // Bob (10) pasa a la primera fila → su score queda primero.
    const scoresAfter = screen.getAllByPlaceholderText("Score");
    expect(scoresAfter[0].value).toBe("10");
    expect(scoresAfter[1].value).toBe("5");
  });

  it("una fecha futura (backstop) muestra error y deshabilita el submit", () => {
    // El picker bloquea elegir futuro; este caso cubre un value futuro que
    // llegue por initialValues / borrador restaurado.
    renderForm({
      initialValues: {
        game: { id: "13", name: "Catán" },
        details: { playdate: "2099-12-31" },
      },
      lockedGame: true,
    });
    expect(screen.getByText(/no puede ser futura/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar en bgg/i }),
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
    // Arranca solo con el dueño "Me".
    expect(screen.getAllByPlaceholderText("Score")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /usar última juntada/i }));
    expect(screen.getAllByPlaceholderText("Score")).toHaveLength(2);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beto").length).toBeGreaterThan(0);
    // La ubicación viajó al payload.
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
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
      lastJuntada: { location: "Club", players: [{ name: "Ana", username: "anabgg" }] },
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
    // El jugador 1 ("Me", @meBGG) se resuelve a su user de TurnoCero en el
    // preview → el Avatar (mockeado) muestra su username.
    expect(await screen.findByTestId("avatar")).toHaveTextContent("meuser");
  });

  // ── Borrador local (#4) ───────────────────────────────────────────────
  const DRAFT_KEY = "turnocero_play_draft:mebgg";

  it("persiste el borrador al editar un form en blanco", async () => {
    renderForm(); // create en blanco
    fireEvent.change(
      screen.getByPlaceholderText(/cómo estuvo la partida/i),
      { target: { value: "Gran partida" } },
    );
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
          { name: "Ana", username: "anabgg", score: "", win: false, new: false },
        ],
      }),
    );
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /retomar/i }));
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Borrador previo")).toBeInTheDocument();
    // El banner desaparece tras retomar.
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
