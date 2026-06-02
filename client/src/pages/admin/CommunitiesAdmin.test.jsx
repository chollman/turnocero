import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import CommunitiesAdmin from "./CommunitiesAdmin";

beforeEach(() => {
  vi.clearAllMocks();
  useSiteConfig.mockReturnValue({
    SECTION_KEYS: ["mesas", "torneos", "comunidades"],
  });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

describe("<CommunitiesAdmin>", () => {
  it("lists existing communities", async () => {
    server.use(
      http.get("/api/comunidades", () =>
        HttpResponse.json({
          comunidades: [
            {
              slug: "turnocero",
              name: "TurnoCero",
              isBase: true,
              memberCount: 5,
              joinPolicy: "open",
              sections: {},
            },
          ],
        }),
      ),
    );
    render(<CommunitiesAdmin />);
    expect(await screen.findByText("TurnoCero")).toBeInTheDocument();
    expect(screen.getByText("5 miembros")).toBeInTheDocument();
  });

  it("creates a community via POST", async () => {
    let posted = null;
    server.use(
      http.get("/api/comunidades", () =>
        HttpResponse.json({ comunidades: [] }),
      ),
      http.post("/api/comunidades", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ slug: "nueva", name: "Nueva" }, {
          status: 201,
        });
      }),
    );
    render(<CommunitiesAdmin />);
    await waitFor(() =>
      expect(screen.queryByText("Cargando…")).not.toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Nombre de la comunidad"), {
      target: { value: "Nueva" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear comunidad" }));
    await waitFor(() => expect(posted).toMatchObject({ name: "Nueva" }));
  });

  it("shows per-community section toggles in the editor", async () => {
    server.use(
      http.get("/api/comunidades", () =>
        HttpResponse.json({
          comunidades: [
            {
              slug: "beta",
              name: "Beta",
              isBase: false,
              memberCount: 1,
              joinPolicy: "open",
              sections: { torneos: false },
            },
          ],
        }),
      ),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    // El toggle de torneos aparece y refleja el override (desmarcado)
    const torneos = screen.getByLabelText("torneos");
    expect(torneos).not.toBeChecked();
    // La key 'comunidades' se excluye de los toggles por comunidad
    expect(screen.queryByLabelText("comunidades")).not.toBeInTheDocument();
  });
});
