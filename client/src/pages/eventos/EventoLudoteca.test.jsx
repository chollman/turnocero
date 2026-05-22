import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import EventoLudoteca from "./EventoLudoteca";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

function setUser(u = { _id: "me", username: "me" }) {
  useAuth.mockReturnValue({ user: u });
}

function setNotifs() {
  useNotifications.mockReturnValue({ addToast: vi.fn() });
}

function renderIt({ items, evento, canAdd = false } = {}) {
  return render(
    <MemoryRouter>
      <EventoLudoteca
        eventoId="ev1"
        evento={evento || { _id: "ev1", author: { _id: "host1" } }}
        items={items}
        setItems={() => {}}
        canAdd={canAdd}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setUser();
  setNotifs();
  server.use(
    http.get("/api/eventos/:id/ludoteca", () =>
      HttpResponse.json({ items: [] }),
    ),
  );
});

describe("<EventoLudoteca>", () => {
  it("shows empty state when there are no items", async () => {
    renderIt({ items: [] });
    expect(await screen.findByText(/todav.a no hay juegos/i)).toBeInTheDocument();
  });

  it("renders item cards with game name + addedBy + notes", () => {
    const items = [
      {
        _id: "i1",
        bggGameId: 13,
        gameName: "Catan",
        thumbnail: "",
        year: 1995,
        minPlayers: 3,
        maxPlayers: 4,
        notes: "Llevo la mía",
        addedBy: { _id: "u1", username: "alice", displayName: "Alice" },
      },
    ];
    renderIt({ items });
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText(/llevo la m.a/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/3-4 jug/)).toBeInTheDocument();
  });

  it("hides the 'Agregar juego' button when canAdd=false", () => {
    renderIt({ items: [], canAdd: false });
    expect(
      screen.queryByRole("button", { name: /agregar juego/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the 'Agregar juego' button when canAdd=true", () => {
    renderIt({ items: [], canAdd: true });
    expect(
      screen.getByRole("button", { name: /agregar juego/i }),
    ).toBeInTheDocument();
  });

  it("shows the delete button only on items the user can delete (own item)", () => {
    setUser({ _id: "u1", username: "alice", isAdmin: false });
    const items = [
      {
        _id: "i1",
        gameName: "Mío",
        addedBy: { _id: "u1", username: "alice" },
      },
      {
        _id: "i2",
        gameName: "Ajeno",
        addedBy: { _id: "u2", username: "bob" },
      },
    ];
    renderIt({ items });
    expect(
      screen.getByRole("button", { name: /quitar m.o/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quitar ajeno/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the delete button on every item for admins", () => {
    setUser({ _id: "admin1", username: "admin", isAdmin: true });
    const items = [
      { _id: "i1", gameName: "A", addedBy: { _id: "u1", username: "a" } },
      { _id: "i2", gameName: "B", addedBy: { _id: "u2", username: "b" } },
    ];
    renderIt({ items });
    expect(screen.getByRole("button", { name: /quitar a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quitar b/i })).toBeInTheDocument();
  });

  it("shows the delete button on every item for the event author", () => {
    setUser({ _id: "host1", username: "host", isAdmin: false });
    const items = [
      { _id: "i1", gameName: "X", addedBy: { _id: "u1", username: "a" } },
    ];
    renderIt({
      items,
      evento: { _id: "ev1", author: { _id: "host1" } },
    });
    expect(screen.getByRole("button", { name: /quitar x/i })).toBeInTheDocument();
  });

  it("fetches items when 'items' prop is not provided", async () => {
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            { _id: "i1", gameName: "Wingspan", addedBy: { _id: "u1", username: "alice" } },
          ],
        }),
      ),
    );
    render(
      <MemoryRouter>
        <EventoLudoteca eventoId="ev1" evento={{ _id: "ev1", author: { _id: "host1" } }} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Wingspan")).toBeInTheDocument();
  });
});
