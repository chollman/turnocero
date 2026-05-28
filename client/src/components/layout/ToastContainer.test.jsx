import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const useNotificationsMock = vi.fn();
const useChatMock = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => useNotificationsMock(),
}));
vi.mock("../../context/ChatContext", () => ({ useChat: () => useChatMock() }));

import ToastContainer from "./ToastContainer";

function defaultNotificationsValue(toasts = []) {
  return {
    toasts,
    dismissToast: vi.fn(),
    markRead: vi.fn(),
    markReadFriend: vi.fn(),
    markReadTorneo: vi.fn(),
    markReadCompartida: vi.fn(),
    markReadEvento: vi.fn(),
  };
}

beforeEach(() => {
  navigateMock.mockReset();
  useChatMock.mockReturnValue({ openChat: vi.fn(), conversations: {} });
});

function renderToasts(toasts) {
  useNotificationsMock.mockReturnValue(defaultNotificationsValue(toasts));
  return render(
    <MemoryRouter>
      <ToastContainer />
    </MemoryRouter>,
  );
}

describe("<ToastContainer>", () => {
  it("renders nothing when toasts is empty", () => {
    const { container } = renderToasts([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast with title + body and icon", () => {
    renderToasts([{ id: "t1", type: "join_accepted", tableName: "Catán" }]);
    expect(screen.getByText("¡Fuiste aceptado!")).toBeInTheDocument();
    expect(
      screen.getByText(/ya sos parte de la mesa de catán/i),
    ).toBeInTheDocument();
    expect(screen.getByText("✅")).toBeInTheDocument();
  });

  it("renders friend_request toast with friend username as title", () => {
    renderToasts([
      {
        id: "t1",
        type: "friend_request",
        fromUsername: "alice",
        fromUserId: "u1",
      },
    ]);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/solicitud de amistad/i)).toBeInTheDocument();
  });

  it("navigates to /usuarios/:id when friend_request toast clicked", () => {
    renderToasts([
      {
        id: "t1",
        type: "friend_request",
        fromUsername: "alice",
        fromUserId: "u1",
      },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/usuarios/u1");
  });

  it("navigates to /torneos/:id when tournament_accepted toast clicked", () => {
    renderToasts([
      {
        id: "t1",
        type: "tournament_accepted",
        torneoTitle: "Liga 26",
        torneoId: "tn1",
      },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/torneos/tn1");
  });

  it("navigates to /compartidas/:id when compartida_like toast clicked", () => {
    renderToasts([
      {
        id: "t1",
        type: "compartida_like",
        fromUsername: "alice",
        compartidaId: "c1",
      },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/compartidas/c1");
  });

  it("navigates to /noticias/:id when noticia toast clicked", () => {
    renderToasts([
      { id: "t1", type: "noticia", noticiaId: "n1", title: "Nueva noticia!" },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/noticias/n1");
  });

  it("navigates to /mesas/:id by default for table-related toasts", () => {
    renderToasts([
      { id: "t1", type: "spot_opened", tableName: "Catán", tableId: "m1" },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/mesas/m1");
  });

  it("renders player_joined toast with joiner username + tableName", () => {
    renderToasts([
      {
        id: "t1",
        type: "player_joined",
        tableName: "Wingspan",
        joinerUsername: "ana",
        tableId: "m1",
      },
    ]);
    expect(screen.getByText("¡Nuevo jugador!")).toBeInTheDocument();
    expect(screen.getByText(/ana se unió a wingspan/i)).toBeInTheDocument();
    expect(screen.getByText("🙌")).toBeInTheDocument();
  });

  it("Cerrar button dismisses the toast without navigating", () => {
    const dismissToast = vi.fn();
    useNotificationsMock.mockReturnValue({
      ...defaultNotificationsValue(),
      toasts: [{ id: "t1", type: "join_accepted", tableName: "Catán" }],
      dismissToast,
    });
    render(
      <MemoryRouter>
        <ToastContainer />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(dismissToast).toHaveBeenCalledWith("t1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("renders multiple toasts", () => {
    renderToasts([
      { id: "t1", type: "noticia", noticiaId: "n1", title: "Uno" },
      {
        id: "t2",
        type: "tournament_finished",
        torneoTitle: "Liga",
        torneoId: "tn1",
      },
    ]);
    expect(screen.getAllByRole("alert").length).toBe(2);
  });

  // ── Evento toasts ──
  it("renders evento_confirmed toast with title and eventoTitle in body", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_confirmed",
        eventoId: "ev1",
        eventoTitle: "Torneo Otoño",
      },
    ]);
    expect(screen.getByText("¡Inscripción confirmada!")).toBeInTheDocument();
    expect(
      screen.getByText(/torneo otoño · estás dentro/i),
    ).toBeInTheDocument();
    expect(screen.getByText("🎉")).toBeInTheDocument();
  });

  it("evento_rejected with permanentlyRejected shows permanent text", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_rejected",
        eventoId: "ev1",
        eventoTitle: "X",
        permanentlyRejected: true,
      },
    ]);
    expect(screen.getByText(/rechazada \(permanente\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no podrás volver a inscribirte a x/i),
    ).toBeInTheDocument();
    expect(screen.getByText("🚫")).toBeInTheDocument();
  });

  it("evento_rejected (single-time) shows non-permanent text + 🥲", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_rejected",
        eventoId: "ev1",
        eventoTitle: "X",
        permanentlyRejected: false,
      },
    ]);
    expect(screen.getByText("Inscripción rechazada")).toBeInTheDocument();
    expect(screen.getByText("🥲")).toBeInTheDocument();
  });

  it("evento_cancelled shows correct title and body", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_cancelled",
        eventoId: "ev1",
        eventoTitle: "Festa",
      },
    ]);
    expect(screen.getByText("Evento cancelado")).toBeInTheDocument();
    expect(screen.getByText(/se canceló festa/i)).toBeInTheDocument();
  });

  it("evento_updated joins changedFields in body", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_updated",
        eventoId: "ev1",
        eventoTitle: "X",
        changedFields: ["eventDate", "location"],
      },
    ]);
    expect(screen.getByText("Cambios en el evento")).toBeInTheDocument();
    expect(
      screen.getByText(/x: nueva fecha \+ nueva ubicación/i),
    ).toBeInTheDocument();
  });

  it("evento_reminder shows reminder text", () => {
    renderToasts([
      {
        id: "t1",
        type: "evento_reminder",
        eventoId: "ev1",
        eventoTitle: "Big Game",
      },
    ]);
    expect(screen.getByText("¡Mañana!")).toBeInTheDocument();
    expect(
      screen.getByText(/recordatorio: big game es mañana/i),
    ).toBeInTheDocument();
  });

  it("clicking an evento toast navigates to /eventos/:eventoId", () => {
    renderToasts([
      { id: "t1", type: "evento_confirmed", eventoId: "ev1", eventoTitle: "X" },
    ]);
    fireEvent.click(screen.getByRole("alert"));
    expect(navigateMock).toHaveBeenCalledWith("/eventos/ev1");
  });
});
