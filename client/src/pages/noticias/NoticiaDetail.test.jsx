import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { AllProviders } from "../../test/wrappers/AllProviders";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import NoticiaDetail from "./NoticiaDetail";
import { useAuth } from "../../context/AuthContext";

function makeNoticia(overrides = {}) {
  return {
    _id: "n1",
    title: "Título de la noticia",
    dek: overrides.dek || "",
    body: "Cuerpo extenso de la noticia con texto interesante.",
    category: overrides.category || "general",
    kicker: overrides.kicker || "",
    link: overrides.link || "",
    linkLabel: overrides.linkLabel || "",
    image: overrides.image || null,
    status: overrides.status || "published",
    tags: overrides.tags || [],
    author: { _id: "a1", username: "admin", avatar: { url: "", publicId: "" } },
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupNoticia(noticia, { related = [] } = {}) {
  server.use(
    http.get("/api/noticias/:id", () => HttpResponse.json(noticia)),
    http.get("/api/noticias", () =>
      HttpResponse.json({ noticias: related, page: 1, pages: 1, total: 0 }),
    ),
  );
}

function renderDetail({ user = null, id = "n1" } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <AllProviders initialEntries={[`/noticias/${id}`]}>
      <Routes>
        <Route path="/noticias/:id" element={<NoticiaDetail />} />
        <Route path="/noticias" element={<div>noticias-list</div>} />
      </Routes>
    </AllProviders>,
  );
}

describe("<NoticiaDetail>", () => {
  beforeEach(() => useAuth.mockReturnValue({ user: null }));

  it("renders the headline, dek and body once loaded", async () => {
    setupNoticia(makeNoticia({ dek: "Una bajada editorial" }));
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Título de la noticia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Una bajada editorial")).toBeInTheDocument();
    expect(screen.getByText(/cuerpo extenso/i)).toBeInTheDocument();
  });

  it("renders rich HTML bodies (sanitized)", async () => {
    setupNoticia(
      makeNoticia({
        body: "<p>Primer párrafo</p><h2>Sección</h2><p>Más texto</p>",
      }),
    );
    renderDetail();
    expect(await screen.findByText("Primer párrafo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sección", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders tags as chips", async () => {
    setupNoticia(makeNoticia({ tags: ["torneo", "wingspan"] }));
    renderDetail();
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(screen.getByText("#torneo")).toBeInTheDocument();
    expect(screen.getByText("#wingspan")).toBeInTheDocument();
  });

  it("renders the external link when provided", async () => {
    setupNoticia(
      makeNoticia({ link: "https://x.com/y", linkLabel: "Leer más" }),
    );
    renderDetail();
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(screen.getByRole("link", { name: /leer más/i })).toHaveAttribute(
      "href",
      "https://x.com/y",
    );
  });

  it("shows the related 'Seguí leyendo' cards", async () => {
    setupNoticia(makeNoticia(), {
      related: [makeNoticia({ _id: "r1", title: "Nota relacionada" })],
    });
    renderDetail();
    expect(await screen.findByText("Nota relacionada")).toBeInTheDocument();
  });

  it("shows admin actions only for admins", async () => {
    setupNoticia(makeNoticia());
    renderDetail({ user: { _id: "admin", isAdmin: true } });
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(
      screen.getByRole("button", { name: /eliminar/i }),
    ).toBeInTheDocument();
  });

  it("regular users do not see admin actions", async () => {
    setupNoticia(makeNoticia());
    renderDetail({ user: { _id: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(
      screen.queryByRole("button", { name: /eliminar/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a draft banner for draft noticias", async () => {
    setupNoticia(makeNoticia({ status: "draft" }));
    renderDetail({ user: { _id: "admin", isAdmin: true } });
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(screen.getByText(/borrador/i)).toBeInTheDocument();
  });

  it("renders share buttons", async () => {
    setupNoticia(makeNoticia());
    renderDetail();
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(
      screen.getByRole("link", { name: /compartir en whatsapp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copiar link/i }),
    ).toBeInTheDocument();
  });

  it("falls back to the first body image for og:image when there's no cover", async () => {
    setupNoticia(
      makeNoticia({
        image: null,
        body: '<p>Intro</p><img src="https://cdn.example/foto.jpg"><p>más</p>',
      }),
    );
    renderDetail();
    await screen.findByRole("heading", { name: "Título de la noticia" });
    await waitFor(() => {
      const og = document.head.querySelector('meta[property="og:image"]');
      expect(og?.getAttribute("content")).toContain("cdn.example/foto.jpg");
    });
  });

  it("shows the not-found state on 404", async () => {
    server.use(
      http.get("/api/noticias/:id", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByText(/noticia no encontrada/i),
    ).toBeInTheDocument();
  });
});
