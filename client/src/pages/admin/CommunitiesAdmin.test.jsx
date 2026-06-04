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
        return HttpResponse.json(
          { slug: "nueva", name: "Nueva" },
          {
            status: 201,
          },
        );
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

  it("toggles subdomainEnabled and saves it via PUT", async () => {
    let putBody = null;
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
              sections: {},
              subdomainEnabled: false,
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(
      screen.getByLabelText("Activar single-tenant en este subdominio"),
    );
    await waitFor(() =>
      expect(putBody).toMatchObject({ subdomainEnabled: true }),
    );
  });

  it("edits the slug and includes it in the Guardar datos PUT", async () => {
    let putBody = null;
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
              sections: {},
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "betagamers", name: "Beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Slug (subdominio / URL)"), {
      target: { value: "betagamers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(putBody).toMatchObject({ slug: "betagamers" }));
  });

  it("hides the slug field for the base community", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect(
      screen.queryByLabelText("Slug (subdominio / URL)"),
    ).not.toBeInTheDocument();
  });

  it("hides the subdomain toggle for the base community", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect(
      screen.queryByLabelText("Activar single-tenant en este subdominio"),
    ).not.toBeInTheDocument();
  });

  it("saves the skin (accents) via PUT /skin", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Color amber"), {
      target: { value: "#e63946" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() => expect(putBody?.accents?.amber).toBe("#e63946"));
    // el payload también incluye los neutros por tema (defaults si no se tocan)
    expect(putBody?.neutralsDark).toBeTruthy();
    expect(putBody?.neutralsLight).toBeTruthy();
  });

  it("sends a per-theme neutral override in the skin save", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Fondo oscuro"), {
      target: { value: "#1a0e12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() => expect(putBody?.neutralsDark?.bgDark).toBe("#1a0e12"));
  });

  it("saves the text-on-primary color (onAmber) inside accents", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Texto sobre botones primarios"), {
      target: { value: "#101010" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() => expect(putBody?.accents?.onAmber).toBe("#101010"));
  });

  it("saves a secondary accent shade (amberLight) inside accents", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Color amberLight"), {
      target: { value: "#00ffcc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() => expect(putBody?.accents?.amberLight).toBe("#00ffcc"));
  });

  it("saves an alpha accent token (amberGlow, rgba) via the text input", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Color amberGlow"), {
      target: { value: "rgba(255, 0, 0, 0.2)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() =>
      expect(putBody?.accents?.amberGlow).toBe("rgba(255, 0, 0, 0.2)"),
    );
  });

  it("saves new neutral + overlay tokens per theme (bgElevated + overlaySoft dark)", async () => {
    let putBody = null;
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
      http.put("/api/comunidades/beta/skin", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ slug: "beta" });
      }),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Elevado oscuro"), {
      target: { value: "#1b2230" },
    });
    fireEvent.change(screen.getByLabelText("Overlay suave oscuro"), {
      target: { value: "rgba(255, 255, 255, 0.1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar skin" }));
    await waitFor(() =>
      expect(putBody?.neutralsDark?.bgElevated).toBe("#1b2230"),
    );
    expect(putBody?.neutralsDark?.overlaySoft).toBe("rgba(255, 255, 255, 0.1)");
  });

  it("flags an invalid alpha token value (aria-invalid)", async () => {
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
              sections: {},
              skin: { accents: {} },
            },
          ],
        }),
      ),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const glow = screen.getByLabelText("Color amberGlow");
    // Default is valid rgba.
    expect(glow).toHaveAttribute("aria-invalid", "false");
    fireEvent.change(glow, { target: { value: "not a color" } });
    expect(glow).toHaveAttribute("aria-invalid", "true");
  });

  it("hides skin editing for the base community (code-only)", async () => {
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
              skin: { accents: {} },
            },
          ],
        }),
      ),
    );
    render(<CommunitiesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    // Nota explicativa en lugar de los controles de skin.
    expect(screen.getByText(/se define por código/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Color amber")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar skin" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre de marca")).not.toBeInTheDocument();
  });
});
