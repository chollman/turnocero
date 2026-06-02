import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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
import ComunidadGestion from "./ComunidadGestion";

function renderGestion() {
  return render(
    <MemoryRouter initialEntries={["/comunidades/beta/gestion"]}>
      <Routes>
        <Route
          path="/comunidades/:slug/gestion"
          element={<ComunidadGestion />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

describe("<ComunidadGestion>", () => {
  it("shows a no-access message for a non-subadmin member", () => {
    useAuth.mockReturnValue({ user: { _id: "u1", isAdmin: false } });
    useCommunity.mockReturnValue({
      memberships: [{ community: { slug: "beta" }, role: "member" }],
    });
    renderGestion();
    expect(screen.getByText(/No tenés permisos/i)).toBeInTheDocument();
  });

  it("loads join requests and accepts one (subadmin)", async () => {
    useAuth.mockReturnValue({ user: { _id: "sub1", isAdmin: false } });
    useCommunity.mockReturnValue({
      memberships: [{ community: { slug: "beta" }, role: "subadmin" }],
    });
    let accepted = null;
    server.use(
      http.get("/api/comunidades/beta/solicitudes", () =>
        HttpResponse.json({
          solicitudes: [
            { user: { _id: "appl1", username: "applicant" }, requestedAt: "" },
          ],
        }),
      ),
      http.get("/api/comunidades/beta/miembros", () =>
        HttpResponse.json({ miembros: [] }),
      ),
      http.post("/api/comunidades/beta/solicitudes/appl1/aceptar", () => {
        accepted = "appl1";
        return HttpResponse.json({ ok: true });
      }),
    );
    renderGestion();
    expect(await screen.findByText("applicant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(accepted).toBe("appl1"));
  });

  it("lists members and expels one (admin, miembros tab)", async () => {
    useAuth.mockReturnValue({ user: { _id: "admin1", isAdmin: true } });
    useCommunity.mockReturnValue({ memberships: [] });
    let expelled = null;
    server.use(
      http.get("/api/comunidades/beta/solicitudes", () =>
        HttpResponse.json({ solicitudes: [] }),
      ),
      http.get("/api/comunidades/beta/miembros", () =>
        HttpResponse.json({
          miembros: [{ _id: "m1", username: "memberone", role: "member" }],
        }),
      ),
      http.delete("/api/comunidades/beta/miembros/m1", () => {
        expelled = "m1";
        return HttpResponse.json({ ok: true });
      }),
    );
    renderGestion();
    fireEvent.click(await screen.findByRole("tab", { name: /Miembros/ }));
    expect(await screen.findByText("memberone")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expulsar" }));
    await waitFor(() => expect(expelled).toBe("m1"));
  });
});
