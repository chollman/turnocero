import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import Comunidades from "./Comunidades";

function mockDirectory(list) {
  server.use(
    http.get("/api/comunidades", () =>
      HttpResponse.json({ comunidades: list }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: "u1" } });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

describe("<Comunidades> directory", () => {
  it("renders community cards from the directory", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        description: "Una comunidad",
        memberCount: 3,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    render(<Comunidades />);
    expect(await screen.findByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Una comunidad")).toBeInTheDocument();
    expect(screen.getByText("3 miembros")).toBeInTheDocument();
  });

  it("joins an open community via the context action", async () => {
    const joinCommunity = vi.fn().mockResolvedValue({ status: "joined" });
    useCommunity.mockReturnValue({ joinCommunity, leaveCommunity: vi.fn() });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 0,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    render(<Comunidades />);
    fireEvent.click(await screen.findByRole("button", { name: "Unirme" }));
    await waitFor(() =>
      expect(joinCommunity).toHaveBeenCalledWith("beta", undefined),
    );
  });

  it("shows a code input for code-gated communities", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn().mockResolvedValue({ status: "joined" }),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "cerrada",
        name: "Cerrada",
        memberCount: 1,
        joinPolicy: "code",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    render(<Comunidades />);
    expect(await screen.findByLabelText("Código para Cerrada")).toBeInTheDocument();
  });

  it("shows the pending state instead of a join button", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "aprob",
        name: "Aprob",
        memberCount: 2,
        joinPolicy: "approval",
        isBase: false,
        viewerStatus: "pending",
      },
    ]);
    render(<Comunidades />);
    expect(await screen.findByText("Solicitud pendiente")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unirme|solicitar/i }),
    ).not.toBeInTheDocument();
  });
});
