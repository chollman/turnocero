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
      HttpResponse.json({ played: true, numPlays: 3 }),
    ),
  );
});

describe("<PlayForm>", () => {
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
    expect(screen.getByDisplayValue("Me")).toBeInTheDocument();
    expect(screen.getByDisplayValue("meBGG")).toBeInTheDocument();
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
      expect(screen.getByDisplayValue("Bob")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/nuevo/i)).toBeNull();
  });

  it("sugiere la duración promedio y la aplica al click (#5b)", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", () =>
        HttpResponse.json({
          played: true,
          numPlays: 4,
          known: true,
          avgDuration: 75,
        }),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const suggest = await screen.findByRole("button", {
      name: /tu promedio: 75 min/i,
    });
    fireEvent.click(suggest);
    expect(screen.getByDisplayValue("75")).toBeInTheDocument();
    // Una vez cargada la duración, la sugerencia desaparece.
    expect(
      screen.queryByRole("button", { name: /tu promedio/i }),
    ).toBeNull();
  });

  it("agregar jugador abre el picker y suma una fila", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(2);
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
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
    // Bob (10) pasa a la primera fila.
    const names = screen.getAllByPlaceholderText("Nombre");
    expect(names[0].value).toBe("Bob");
    expect(names[1].value).toBe("Me");
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
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /usar última juntada/i }));
    expect(
      screen.getAllByPlaceholderText("Nombre").map((n) => n.value),
    ).toEqual(["Ana", "Beto"]);
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
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
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
