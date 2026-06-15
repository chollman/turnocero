import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import Noticias from "./Noticias";
import { useAuth } from "../../context/AuthContext";

let idc = 0;
function makeNoticia(overrides = {}) {
  return {
    _id: overrides._id || `n${idc++}`,
    title: overrides.title || "Noticia",
    dek: overrides.dek || "",
    body: overrides.body || "Cuerpo de la noticia",
    category: overrides.category || "general",
    kicker: overrides.kicker || "",
    image: overrides.image || null,
    featured: overrides.featured || false,
    isBrief: overrides.isBrief || false,
    author: { _id: "a1", username: "admin", avatar: { url: "", publicId: "" } },
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Noticias />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function jsonList(noticias, { pages = 1 } = {}) {
  return HttpResponse.json({
    noticias,
    page: 1,
    pages,
    total: noticias.length,
  });
}

describe("<Noticias> (portada editorial)", () => {
  beforeEach(() => {
    idc = 0;
    useAuth.mockReturnValue({ user: null });
  });

  it("renders the masthead and section tabs", async () => {
    server.use(
      http.get("/api/noticias", () =>
        jsonList([makeNoticia({ title: "Primera" })]),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Noticiero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Portada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reseñas" })).toBeInTheDocument();
  });

  it("renders the lead and the secondary stories", async () => {
    server.use(
      http.get("/api/noticias", () =>
        jsonList([
          makeNoticia({ title: "Nota principal", featured: true }),
          makeNoticia({ title: "Nota secundaria" }),
        ]),
      ),
    );
    renderPage();
    expect(await screen.findByText("Nota principal")).toBeInTheDocument();
    expect(screen.getByText("Nota secundaria")).toBeInTheDocument();
  });

  it("puts isBrief noticias in the Breves column", async () => {
    server.use(
      http.get("/api/noticias", () =>
        jsonList([
          makeNoticia({ title: "Lead", featured: true }),
          makeNoticia({ title: "Un breve", isBrief: true }),
        ]),
      ),
    );
    renderPage();
    expect(await screen.findByText("Breves")).toBeInTheDocument();
    expect(screen.getByText("Un breve")).toBeInTheDocument();
  });

  it("shows the first-time empty state", async () => {
    server.use(http.get("/api/noticias", () => jsonList([])));
    renderPage();
    expect(await screen.findByText(/sin novedades/i)).toBeInTheDocument();
  });

  it("admin sees the '+ Nueva noticia' control (inline + mobile FAB)", async () => {
    server.use(http.get("/api/noticias", () => jsonList([makeNoticia()])));
    useAuth.mockReturnValue({ user: { _id: "admin", isAdmin: true } });
    renderPage();
    await screen.findByText(/Noticiero/i);
    // Inline button (desktop) + FAB (mobile) both render; CSS hides one per viewport.
    expect(
      screen.getAllByRole("button", { name: /nueva noticia/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("regular users do not see the create button", async () => {
    server.use(http.get("/api/noticias", () => jsonList([makeNoticia()])));
    useAuth.mockReturnValue({ user: { _id: "me", isAdmin: false } });
    renderPage();
    await screen.findByText(/Noticiero/i);
    expect(
      screen.queryByRole("button", { name: /nueva noticia/i }),
    ).not.toBeInTheDocument();
  });

  it("filters by category tab (sends ?category=)", async () => {
    const seen = [];
    server.use(
      http.get("/api/noticias", ({ request }) => {
        const cat = new URL(request.url).searchParams.get("category");
        seen.push(cat);
        return jsonList([
          makeNoticia({
            title: cat === "resena" ? "Una reseña" : "Portada nota",
            category: cat === "resena" ? "resena" : "general",
          }),
        ]);
      }),
    );
    renderPage();
    await screen.findByText("Portada nota");
    fireEvent.click(screen.getByRole("button", { name: "Reseñas" }));
    await waitFor(() => expect(seen).toContain("resena"));
    expect(await screen.findByText("Una reseña")).toBeInTheDocument();
  });

  it("filters via the mobile section dropdown", async () => {
    const seen = [];
    server.use(
      http.get("/api/noticias", ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("category"));
        return jsonList([makeNoticia({ title: "Algo" })]);
      }),
    );
    renderPage();
    await screen.findByText("Algo");
    fireEvent.change(screen.getByLabelText("Sección"), {
      target: { value: "evento" },
    });
    await waitFor(() => expect(seen).toContain("evento"));
  });

  it("shows the filtered empty state when a search returns nothing", async () => {
    server.use(
      http.get("/api/noticias", ({ request }) => {
        const q = new URL(request.url).searchParams.get("search");
        return jsonList(q ? [] : [makeNoticia({ title: "Algo" })]);
      }),
    );
    renderPage();
    await screen.findByText("Algo");
    fireEvent.change(screen.getByPlaceholderText(/buscar nota/i), {
      target: { value: "zzz" },
    });
    expect(await screen.findByText(/ese filtro/i)).toBeInTheDocument();
  });

  it("'Ver más noticias' loads the next page", async () => {
    server.use(
      http.get("/api/noticias", ({ request }) => {
        const page = parseInt(
          new URL(request.url).searchParams.get("page") || "1",
        );
        return page === 2
          ? jsonList([makeNoticia({ _id: "p2", title: "De la página 2" })], {
              pages: 2,
            })
          : jsonList([makeNoticia({ _id: "p1", title: "De la página 1" })], {
              pages: 2,
            });
      }),
    );
    renderPage();
    await screen.findByText("De la página 1");
    fireEvent.click(screen.getByRole("button", { name: /ver más noticias/i }));
    expect(await screen.findByText("De la página 2")).toBeInTheDocument();
  });
});
