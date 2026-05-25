import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../components/shared/ModalPortal", () => ({
  default: ({ children }) => <div data-testid="modal-portal">{children}</div>,
}));

import CreatePlayModal from "./CreatePlayModal";

function makeUser(overrides = {}) {
  return {
    _id: "me",
    username: "me",
    displayName: "Me",
    bggUsername: "meBGG",
    ...overrides,
  };
}

function renderModal(props = {}) {
  return render(
    <CreatePlayModal
      user={props.user || makeUser()}
      preselectedGame={props.preselectedGame}
      editPlay={props.editPlay}
      onClose={props.onClose || vi.fn()}
      onCreated={props.onCreated || vi.fn()}
    />,
  );
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/search", () =>
      HttpResponse.json([
        {
          id: 13,
          name: "Catán",
          thumbnail: "https://cdn/catan.jpg",
          year: 1995,
        },
        { id: 14, name: "Carcassonne", thumbnail: null, year: 2000 },
      ]),
    ),
    http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
    http.put("/api/bgg/partidas/:id", () => HttpResponse.json({ ok: true })),
  );
});

describe("<CreatePlayModal>", () => {
  it("renders the create-mode title", () => {
    renderModal();
    expect(screen.getByText(/cargar partida en bgg/i)).toBeInTheDocument();
  });

  it("renders the edit-mode title and skips step 1 when editPlay is provided", () => {
    renderModal({
      editPlay: {
        id: "pl1",
        gameId: 13,
        gameName: "Catán",
        gameThumbnail: "https://cdn/c.jpg",
        date: "2026-05-01",
        players: [],
      },
    });
    expect(screen.getByText(/editar partida/i)).toBeInTheDocument();
    // Step 1 hidden (locked game). Step "1. Datos" visible.
    expect(screen.getByText(/1\. datos/i)).toBeInTheDocument();
  });

  it("skips step 1 when preselectedGame is provided", () => {
    renderModal({ preselectedGame: { id: 13, name: "Catán" } });
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText(/1\. datos/i)).toBeInTheDocument();
  });

  it("calls onClose when clicking close icon", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("searches games when query is ≥3 chars and renders results", async () => {
    renderModal();
    const input = screen.getByPlaceholderText(/buscá un juego en bgg/i);
    fireEvent.change(input, { target: { value: "Cat" } });
    await waitFor(
      () => {
        expect(screen.getByText("Catán")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByText("Carcassonne")).toBeInTheDocument();
  });

  it("picking a game advances to step 2 (datos)", async () => {
    renderModal();
    const input = screen.getByPlaceholderText(/buscá un juego en bgg/i);
    fireEvent.change(input, { target: { value: "Cat" } });
    await waitFor(
      () => {
        expect(screen.getByText("Catán")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByText("Catán").closest("button"));
    // Step 2 datos fields appear
    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.getByText("Duración (min)")).toBeInTheDocument();
  });

  it("does NOT submit when going forward; only on the final submit button", async () => {
    const onCreated = vi.fn();
    renderModal({ preselectedGame: { id: 13, name: "Catán" }, onCreated });
    // step 2 → step 3 ("Siguiente" button)
    const nextBtn = screen.getByRole("button", { name: /siguiente/i });
    fireEvent.click(nextBtn);
    // No POST yet
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("prefills player 1 with the user displayName and bggUsername", () => {
    renderModal({
      preselectedGame: { id: 13, name: "Catán" },
      user: makeUser({ displayName: "Daniel", bggUsername: "DanBGG" }),
    });
    // Step 2 → step 3
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(screen.getByDisplayValue("Daniel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DanBGG")).toBeInTheDocument();
  });

  it("adding a player extends the editable list", () => {
    renderModal({ preselectedGame: { id: 13, name: "Catán" } });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    // Two "Nombre" placeholders now
    expect(screen.getAllByPlaceholderText("Nombre").length).toBe(2);
  });

  it("submits a create and calls onCreated + onClose", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal({
      preselectedGame: { id: 13, name: "Catán" },
      onCreated,
      onClose,
    });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("submits an edit (PUT) when editPlay is provided", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/bgg/partidas/:id", () => {
        putCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const onCreated = vi.fn();
    renderModal({
      editPlay: {
        id: "pl1",
        gameId: 13,
        gameName: "Catán",
        date: "2026-05-01",
        players: [
          {
            name: "X",
            username: "",
            color: "",
            score: "",
            win: false,
            new: false,
          },
        ],
      },
      onCreated,
    });
    // edit mode: starts at step 2 (locked game). Click siguiente → step 3.
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    // Click "Guardar cambios" (edit mode label)
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => {
      expect(putCalled).toBe(true);
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("shows API error message when submit fails", async () => {
    server.use(
      http.post("/api/bgg/partidas", () =>
        HttpResponse.json({ message: "BGG offline" }, { status: 500 }),
      ),
    );
    renderModal({ preselectedGame: { id: 13, name: "Catán" } });
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    expect(await screen.findByText("BGG offline")).toBeInTheDocument();
  });
});
