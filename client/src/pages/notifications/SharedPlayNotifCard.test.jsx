import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
const dismiss = vi.fn();
const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ dismiss, addToast }),
}));

import SharedPlayNotifCard from "./SharedPlayNotifCard";

function Echo() {
  const loc = useLocation();
  return (
    <div data-testid="echo">
      {loc.pathname}|{loc.state?.sharedFromNotifId || ""}|
      {loc.state?.prefill?.game?.name || ""}
    </div>
  );
}

const baseNotif = {
  notifId: "n1",
  type: "bgg_play_shared",
  fromUserId: "u-alice",
  fromUsername: "alice",
  gameName: "Catán",
  read: false,
  updatedAt: "2026-06-06T10:00:00Z",
  playSnapshot: {
    gameId: "13",
    gameName: "Catán",
    gameImage: "i.jpg",
    date: "2026-05-20",
    duration: 90,
    location: "Club",
    players: [
      { name: "Alice", username: "alice", score: "42", win: true },
      { name: "Bob", username: "bob", score: "30", win: false },
    ],
  },
};

function renderCard(notif = baseNotif) {
  return render(
    <MemoryRouter initialEntries={["/notificaciones"]}>
      <Routes>
        <Route
          path="/notificaciones"
          element={
            <ul>
              <SharedPlayNotifCard notif={notif} />
            </ul>
          }
        />
        <Route
          path="/bg-watch/:bggUsername/partidas/nueva"
          element={<Echo />}
        />
        <Route path="/perfil" element={<Echo />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  dismiss.mockClear();
  addToast.mockClear();
  mockUser = {
    _id: "me",
    username: "bob_tc",
    bggUsername: "bob",
    bggConnected: true,
    bggInvalid: false,
  };
});

describe("<SharedPlayNotifCard>", () => {
  it("muestra juego y jugadores con scores, pero NO la ubicación", () => {
    renderCard();
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    // La ubicación es un dato privado del autor: no se muestra en la notif.
    expect(screen.queryByText(/Club/)).toBeNull();
  });

  it("conectado: muestra los dos botones de carga", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /como aparece/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /con correcciones/i }),
    ).toBeInTheDocument();
  });

  it("sin BGG conectado: muestra el CTA de conexión, no los botones", () => {
    mockUser = { ...mockUser, bggConnected: false };
    renderCard();
    expect(screen.queryByRole("button", { name: /como aparece/i })).toBeNull();
    const link = screen.getByRole("link", {
      name: /conectá tu cuenta de bgg/i,
    });
    expect(link).toHaveAttribute("href", "/perfil");
  });

  it("'como aparece' confirma, postea y descarta la notif", async () => {
    let posted = false;
    server.use(
      http.post("/api/bgg/partidas/compartida/:id", ({ params }) => {
        posted = params.id === "n1";
        return HttpResponse.json({ success: true, playid: "888" });
      }),
    );
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /como aparece/i }));
    // Modal de confirmación.
    const confirm = await screen.findByRole("button", { name: /sí, cargar/i });
    fireEvent.click(confirm);
    await waitFor(() => expect(posted).toBe(true));
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith("n1"));
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("error al cargar como aparece → toast de error, no descarta", async () => {
    server.use(
      http.post("/api/bgg/partidas/compartida/:id", () =>
        HttpResponse.json({ message: "boom" }, { status: 502 }),
      ),
    );
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /como aparece/i }));
    fireEvent.click(await screen.findByRole("button", { name: /sí, cargar/i }));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("'con correcciones' navega al form con prefill + sharedFromNotifId", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /con correcciones/i }));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent(
        "/bg-watch/bob/partidas/nueva|n1|Catán",
      ),
    );
  });

  it("la X descarta la notif", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(dismiss).toHaveBeenCalledWith("n1");
  });
});
