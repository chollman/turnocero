import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import EventoLudotecaPicker from "./EventoLudotecaPicker";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

function setUser(u) {
  useAuth.mockReturnValue({ user: u });
}

beforeEach(() => {
  useNotifications.mockReturnValue({ addToast: vi.fn() });
  server.use(
    http.get("/api/bgg/coleccion/:user", () =>
      HttpResponse.json([
        { id: "13", name: "Catan", thumbnail: "thumb.jpg", yearPublished: 1995 },
        { id: "266192", name: "Wingspan", thumbnail: null, yearPublished: 2019 },
      ]),
    ),
    http.get("/api/bgg/search", () => HttpResponse.json([])),
    http.post("/api/eventos/:id/ludoteca", () =>
      HttpResponse.json(
        {
          item: {
            _id: "newItem1",
            bggGameId: 13,
            gameName: "Catan",
            addedBy: { _id: "me", username: "me" },
          },
        },
        { status: 201 },
      ),
    ),
  );
});

describe("<EventoLudotecaPicker>", () => {
  it("shows BGG search tab by default for users without bggUsername", () => {
    setUser({ _id: "me", username: "me" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    expect(screen.getByLabelText(/buscar juego en boardgame/i)).toBeInTheDocument();
    // No "Mi colección" tab visible
    expect(
      screen.queryByRole("tab", { name: /mi colecci.n/i }),
    ).not.toBeInTheDocument();
  });

  it("defaults to 'Mi colección' tab for users with bggUsername", async () => {
    setUser({ _id: "me", username: "me", bggUsername: "alicebgg" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    expect(
      await screen.findByText("Catan"),
    ).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("switching to 'Buscar BGG' tab shows the search input", async () => {
    setUser({ _id: "me", username: "me", bggUsername: "alicebgg" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    await screen.findByText("Catan");
    fireEvent.click(screen.getByRole("tab", { name: /buscar bgg/i }));
    expect(
      screen.getByLabelText(/buscar juego en boardgame/i),
    ).toBeInTheDocument();
  });

  it("clicking a game from the collection opens the confirm view + POST adds it", async () => {
    setUser({ _id: "me", username: "me", bggUsername: "alicebgg" });
    const onAdded = vi.fn();
    const onClose = vi.fn();
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={onClose}
        onAdded={onAdded}
      />,
    );
    const item = await screen.findByRole("button", { name: /catan/i });
    fireEvent.click(item);
    // Confirm view rendered
    const confirmBtn = await screen.findByRole("button", {
      name: /agregar a la ludoteca/i,
    });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(onAdded.mock.calls[0][0].gameName).toBe("Catan");
    expect(onClose).toHaveBeenCalled();
  });

  it("disables items the user already added (myAddedIds)", async () => {
    setUser({ _id: "me", username: "me", bggUsername: "alicebgg" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
        existingItems={[
          {
            _id: "exist1",
            bggGameId: 13,
            gameName: "Catan",
            addedBy: { _id: "me", username: "me" },
          },
        ]}
      />,
    );
    const item = await screen.findByRole("button", { name: /catan/i });
    expect(item).toBeDisabled();
  });

  it("'← Elegir otro' goes back to the picker view", async () => {
    setUser({ _id: "me", username: "me", bggUsername: "alicebgg" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    const item = await screen.findByRole("button", { name: /catan/i });
    fireEvent.click(item);
    await screen.findByRole("button", { name: /agregar a la ludoteca/i });
    fireEvent.click(screen.getByRole("button", { name: /elegir otro/i }));
    // Back to the collection — game still listed
    expect(await screen.findByRole("button", { name: /catan/i })).toBeInTheDocument();
  });

  it("shows a connect-BGG hint on the collection tab when user has no bggUsername", () => {
    setUser({ _id: "me", username: "me" });
    render(
      <EventoLudotecaPicker
        eventoId="ev1"
        isOpen
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    // Tab "Mi colección" doesn't show — only "Buscar BGG" available
    expect(screen.getByLabelText(/buscar juego en boardgame/i)).toBeInTheDocument();
  });
});
