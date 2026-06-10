import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("./CompartidaCard", () => ({
  default: ({ post }) => (
    <div data-testid="compartida-card">{post.body || post.title}</div>
  ),
}));
vi.mock("./ResenaCard", () => ({
  default: ({ post }) => (
    <div data-testid="resena-card">{post.title || post.body}</div>
  ),
}));
vi.mock("./CompartidasSidebar", () => ({ default: () => null }));

import CompartidaPost from "./CompartidaPost";
import { useNotifications } from "../../context/NotificationContext";

function makePost(overrides = {}) {
  return {
    _id: "c1",
    title: "",
    body: "Hola mundo",
    images: [],
    privacy: "public",
    likes: [],
    author: { _id: "a1", username: "auth", avatar: { url: "", publicId: "" } },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupPost(post) {
  server.use(http.get("/api/compartidas/:id", () => HttpResponse.json(post)));
}

function renderPage({ id = "c1" } = {}) {
  useNotifications.mockReturnValue({ setActiveCompartida: vi.fn() });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/compartidas/${id}`]}>
        <Routes>
          <Route path="/compartidas/:id" element={<CompartidaPost />} />
          <Route path="/compartidas" element={<div>compartidas-feed</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("<CompartidaPost>", () => {
  it("renders the post via CompartidaCard once loaded", async () => {
    setupPost(makePost({ body: "Mi publicación" }));
    renderPage();
    expect(await screen.findByTestId("compartida-card")).toBeInTheDocument();
    expect(screen.getByText("Mi publicación")).toBeInTheDocument();
  });

  it("renders a reseña via ResenaCard (not CompartidaCard)", async () => {
    setupPost(
      makePost({
        category: "resena",
        title: "Mi reseña pro",
        rating: 9,
        boardGame: { bggId: 13, name: "Catan" },
        body: "<p>genial</p>",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("resena-card")).toBeInTheDocument();
    expect(screen.queryByTestId("compartida-card")).not.toBeInTheDocument();
    expect(screen.getByText("Mi reseña pro")).toBeInTheDocument();
  });

  it('shows the "Volver al feed" link', async () => {
    setupPost(makePost());
    renderPage();
    expect(
      screen.getByRole("link", { name: /volver al feed/i }),
    ).toHaveAttribute("href", "/compartidas");
  });

  it("shows 404 error when post does not exist", async () => {
    server.use(
      http.get("/api/compartidas/:id", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/no existe o fue eliminada/i),
    ).toBeInTheDocument();
  });

  it("shows 403 error when user lacks access", async () => {
    server.use(
      http.get("/api/compartidas/:id", () =>
        HttpResponse.json({}, { status: 403 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/no ten[eé]s acceso/i)).toBeInTheDocument();
  });

  it("shows a generic error on other failures", async () => {
    server.use(
      http.get("/api/compartidas/:id", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/error al cargar/i)).toBeInTheDocument();
  });

  it('"Ir al feed" button navigates back to /compartidas after an error', async () => {
    server.use(
      http.get("/api/compartidas/:id", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderPage();
    await screen.findByText(/no existe o fue eliminada/i);
    fireEvent.click(screen.getByRole("button", { name: /ir al feed/i }));
    expect(screen.getByText("compartidas-feed")).toBeInTheDocument();
  });
});
