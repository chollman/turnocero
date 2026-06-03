import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
// Stub el browser de miembros — sus dependencias (axios/contextos) no son el
// foco de este test; verificamos solo el gating + encabezado de ComunidadDetail.
vi.mock("../users/UsersList", () => ({
  default: ({ communityId }) => (
    <div data-testid="users-list">members:{communityId}</div>
  ),
}));

import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import ComunidadDetail from "./ComunidadDetail";

function mockDetail(community, status = 200) {
  server.use(
    http.get("/api/comunidades/:slug", () =>
      status === 200
        ? HttpResponse.json(community)
        : new HttpResponse(null, { status }),
    ),
  );
}

function renderAt(slug) {
  return render(
    <MemoryRouter initialEntries={[`/comunidades/${slug}`]}>
      <Routes>
        <Route path="/comunidades" element={<div>DIRECTORIO</div>} />
        <Route path="/comunidades/:slug" element={<ComunidadDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseCommunity = {
  _id: "c1",
  slug: "beta",
  name: "Beta",
  description: "Una comunidad de prueba",
  memberCount: 4,
  isBase: false,
  viewerStatus: "member",
  sections: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: "u1" } });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  useCommunity.mockReturnValue({ memberships: [] });
});

describe("<ComunidadDetail>", () => {
  it("renders header + member list for a member", async () => {
    mockDetail(baseCommunity);
    renderAt("beta");
    expect(await screen.findByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("Una comunidad de prueba")).toBeInTheDocument();
    expect(screen.getByText("4 miembros")).toBeInTheDocument();
    expect(screen.getByTestId("users-list")).toHaveTextContent("members:c1");
  });

  it("redirects non-members to the directory", async () => {
    mockDetail({ ...baseCommunity, viewerStatus: "none" });
    renderAt("beta");
    expect(await screen.findByText("DIRECTORIO")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Beta" })).not.toBeInTheDocument();
  });

  it("redirects when the community's `comunidad` toggle is off", async () => {
    mockDetail({ ...baseCommunity, sections: { comunidad: false } });
    renderAt("beta");
    expect(await screen.findByText("DIRECTORIO")).toBeInTheDocument();
  });

  it("redirects when `comunidad` is globally disabled", async () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => false });
    mockDetail(baseCommunity);
    renderAt("beta");
    expect(await screen.findByText("DIRECTORIO")).toBeInTheDocument();
  });

  it("redirects when the community is not found", async () => {
    mockDetail(null, 404);
    renderAt("beta");
    expect(await screen.findByText("DIRECTORIO")).toBeInTheDocument();
  });

  it("lets an admin view a community they are not a member of (all gates off)", async () => {
    useAuth.mockReturnValue({ user: { _id: "a1", isAdmin: true } });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => false });
    mockDetail({
      ...baseCommunity,
      viewerStatus: "none",
      sections: { comunidad: false },
    });
    renderAt("beta");
    expect(await screen.findByRole("heading", { name: "Beta" })).toBeInTheDocument();
  });

  it("shows a Gestionar link for a subadmin", async () => {
    useCommunity.mockReturnValue({
      memberships: [{ community: { slug: "beta" }, role: "subadmin" }],
    });
    mockDetail(baseCommunity);
    renderAt("beta");
    const link = await screen.findByRole("link", { name: "Gestionar" });
    expect(link).toHaveAttribute("href", "/comunidades/beta/gestion");
  });

  it("does not show a Gestionar link for a plain member", async () => {
    mockDetail(baseCommunity);
    renderAt("beta");
    await screen.findByRole("heading", { name: "Beta" });
    expect(
      screen.queryByRole("link", { name: "Gestionar" }),
    ).not.toBeInTheDocument();
  });
});
