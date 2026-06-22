import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import i18n from "../../i18n";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import Comunidades from "./Comunidades";

function mockDirectory(list) {
  server.use(
    http.get("/api/comunidades", () =>
      HttpResponse.json({ comunidades: list }),
    ),
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Comunidades />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: "u1" } });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
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
    renderPage();
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
    renderPage();
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
    renderPage();
    expect(
      await screen.findByLabelText("Código para Cerrada"),
    ).toBeInTheDocument();
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
    renderPage();
    expect(await screen.findByText("Solicitud pendiente")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unirme|solicitar/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a Gestionar link for a community the user is subadmin of", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
      memberships: [{ community: { slug: "beta" }, role: "subadmin" }],
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 2,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "member",
      },
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "Gestionar" });
    expect(link).toHaveAttribute("href", "/comunidades/beta/gestion");
  });
});

describe("<Comunidades> Ver miembros link", () => {
  it("shows 'Ver miembros' for a community the user is a member of", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 5,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "member",
      },
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "Ver miembros" });
    expect(link).toHaveAttribute("href", "/comunidades/beta");
  });

  it("hides 'Ver miembros' for non-members", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 5,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    renderPage();
    await screen.findByText("Beta");
    expect(
      screen.queryByRole("link", { name: "Ver miembros" }),
    ).not.toBeInTheDocument();
  });

  it("hides 'Ver miembros' when the community's `comunidad` toggle is off", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 5,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "member",
        sections: { comunidad: false },
      },
    ]);
    renderPage();
    await screen.findByText("Beta");
    expect(
      screen.queryByRole("link", { name: "Ver miembros" }),
    ).not.toBeInTheDocument();
  });

  it("hides 'Ver miembros' when `comunidad` is globally disabled", async () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => false });
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 5,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "member",
      },
    ]);
    renderPage();
    await screen.findByText("Beta");
    expect(
      screen.queryByRole("link", { name: "Ver miembros" }),
    ).not.toBeInTheDocument();
  });

  it("admin sees 'Ver miembros' even when not a member", async () => {
    useAuth.mockReturnValue({ user: { _id: "admin1", isAdmin: true } });
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 5,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "Ver miembros" });
    expect(link).toHaveAttribute("href", "/comunidades/beta");
  });
});

describe("<Comunidades> mine-first ordering", () => {
  it("orders member communities before pending before the rest", async () => {
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "zeta-none",
        name: "Zeta None",
        memberCount: 1,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
      {
        slug: "beta-pending",
        name: "Beta Pending",
        memberCount: 1,
        joinPolicy: "approval",
        isBase: false,
        viewerStatus: "pending",
      },
      {
        slug: "alpha-member",
        name: "Alpha Member",
        memberCount: 1,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "member",
      },
    ]);
    renderPage();
    await screen.findByText("Alpha Member");
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Alpha Member", "Beta Pending", "Zeta None"]);
  });
});

describe("<Comunidades> i18n (English)", () => {
  afterEach(() => {
    i18n.changeLanguage("es");
  });

  it("renders English copy when the language is en", async () => {
    i18n.changeLanguage("en");
    useCommunity.mockReturnValue({
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    mockDirectory([
      {
        slug: "beta",
        name: "Beta",
        memberCount: 3,
        joinPolicy: "open",
        isBase: false,
        viewerStatus: "none",
      },
    ]);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "My Communities", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join" }),
    ).toBeInTheDocument();
  });
});

describe("<Comunidades> leave confirmation", () => {
  const memberCard = {
    slug: "beta",
    name: "Beta",
    memberCount: 3,
    joinPolicy: "open",
    isBase: false,
    viewerStatus: "member",
  };

  it("asks for confirmation before leaving, then calls leaveCommunity", async () => {
    const leaveCommunity = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({ joinCommunity: vi.fn(), leaveCommunity });
    mockDirectory([memberCard]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Salir" }));
    expect(leaveCommunity).not.toHaveBeenCalled();
    expect(screen.getByText("Salir de la comunidad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, salir" }));
    await waitFor(() => expect(leaveCommunity).toHaveBeenCalledWith("beta"));
  });

  it("cancelling the modal does not call leaveCommunity", async () => {
    const leaveCommunity = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({ joinCommunity: vi.fn(), leaveCommunity });
    mockDirectory([memberCard]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Salir" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(leaveCommunity).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Salir de la comunidad"),
    ).not.toBeInTheDocument();
  });
});
