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
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
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

  it("autodetecta 'Nuevo' para el dueño si nunca jugó el juego", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", () =>
        HttpResponse.json({ played: false, numPlays: 0 }),
      ),
    );
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
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
});
