import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import NoticiaDetail from "./NoticiaDetail";
import { useAuth } from "../../context/AuthContext";

function setupNoticia(noticia) {
  server.use(http.get("/api/noticias/:id", () => HttpResponse.json(noticia)));
}

function renderDetail({ user = null, id = "n1" } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/noticias/${id}`]}>
        <Routes>
          <Route path="/noticias/:id" element={<NoticiaDetail />} />
          <Route path="/noticias" element={<div>noticias-list</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makeNoticia(overrides = {}) {
  return {
    _id: "n1",
    title: "Título de la noticia",
    body: "Cuerpo extenso de la noticia con texto interesante.",
    link: overrides.link || "",
    linkLabel: overrides.linkLabel || "",
    image: overrides.image || null,
    author: { _id: "a1", username: "admin", avatar: { url: "", publicId: "" } },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("<NoticiaDetail>", () => {
  it("renders the title + body once loaded", async () => {
    setupNoticia(makeNoticia());
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Título de la noticia" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cuerpo extenso/i)).toBeInTheDocument();
  });

  it("renders the external link when provided", async () => {
    setupNoticia(
      makeNoticia({ link: "https://x.com/y", linkLabel: "Leer más" }),
    );
    renderDetail();
    await screen.findByRole("heading", { name: "Título de la noticia" });
    const link = screen.getByRole("link", { name: /leer más/i });
    expect(link).toHaveAttribute("href", "https://x.com/y");
  });

  it("shows admin actions (Editar/Eliminar) only for admins", async () => {
    setupNoticia(makeNoticia());
    renderDetail({ user: { _id: "admin", isAdmin: true } });
    await screen.findByRole("heading", { name: "Título de la noticia" });
    expect(
      screen.queryByRole("button", { name: /eliminar/i }),
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
