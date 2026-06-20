import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));

import ResenaCard from "./ResenaCard";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

function makeResena(overrides = {}) {
  return {
    _id: "r1",
    category: "resena",
    title: overrides.title ?? "La mejor reseña",
    body: overrides.body ?? "<h2>Genial</h2><p>Muy <strong>bueno</strong></p>",
    rating: overrides.rating ?? 9,
    boardGame: overrides.boardGame ?? {
      bggId: 13,
      name: "Catan",
      thumbnail: "t.jpg",
      image: "i.jpg",
      year: 1995,
    },
    images: overrides.images || [],
    privacy: overrides.privacy || "public",
    likes: overrides.likes || [],
    commentCount: overrides.commentCount ?? 2,
    author: overrides.author || {
      _id: "a1",
      username: "cha",
      displayName: "Claudio H",
      avatar: { url: "", publicId: "" },
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(post, { user = null, clampBody } = {}) {
  useAuth.mockReturnValue({ user });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  return render(
    <MemoryRouter>
      <ResenaCard
        post={post}
        onDeleted={vi.fn()}
        onUpdated={vi.fn()}
        {...(clampBody !== undefined ? { clampBody } : {})}
      />
    </MemoryRouter>,
  );
}

const longBody = `<p>${"a".repeat(600)}</p>`;

describe("<ResenaCard>", () => {
  it("renders the game header with name and year", () => {
    renderCard(makeResena());
    expect(screen.getByText(/Catan/)).toBeInTheDocument();
    expect(screen.getByText(/1995/)).toBeInTheDocument();
    expect(screen.getByText("Reseña")).toBeInTheDocument();
  });

  it("renders the rating badge", () => {
    renderCard(makeResena({ rating: 7 }));
    expect(screen.getByLabelText(/puntuación 7 de 10/i)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders the title and the sanitized rich HTML body", () => {
    const { container } = renderCard(makeResena({ title: "Mi título" }));
    expect(screen.getByText("Mi título")).toBeInTheDocument();
    expect(container.querySelector("h2")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeInTheDocument();
  });

  it("strips script from the rendered body", () => {
    const { container } = renderCard(
      makeResena({ body: "<p>ok</p><script>evil()</script>" }),
    );
    // El cuerpo se renderiza sin un elemento <script> (sanitizado en cliente).
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders like and comment counts", () => {
    renderCard(makeResena({ likes: ["x", "y", "z"], commentCount: 2 }));
    // 3 likes + 2 comentarios.
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/comentarios/i)).toBeInTheDocument();
  });

  it("shows a 'Leer más' button for reviews longer than 500 characters", () => {
    renderCard(makeResena({ body: longBody }));
    expect(
      screen.getByRole("button", { name: /leer más/i }),
    ).toBeInTheDocument();
  });

  it("does not show 'Leer más' for short reviews", () => {
    renderCard(makeResena({ body: "<p>Cortita</p>" }));
    expect(
      screen.queryByRole("button", { name: /leer más/i }),
    ).not.toBeInTheDocument();
  });

  it("toggles between 'Leer más' and 'Leer menos' when clicked", () => {
    renderCard(makeResena({ body: longBody }));
    const btn = screen.getByRole("button", { name: /leer más/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    const collapseBtn = screen.getByRole("button", { name: /leer menos/i });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapseBtn);
    expect(
      screen.getByRole("button", { name: /leer más/i }),
    ).toBeInTheDocument();
  });

  it("does not clamp the body when clampBody is false (detail page)", () => {
    renderCard(makeResena({ body: longBody }), { clampBody: false });
    expect(
      screen.queryByRole("button", { name: /leer más/i }),
    ).not.toBeInTheDocument();
  });

  it("author sees the edit menu and can open the editor", () => {
    renderCard(makeResena(), { user: { _id: "a1", isAdmin: false } });
    fireEvent.click(screen.getByRole("button", { name: /opciones/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    expect(
      screen.getByRole("toolbar", { name: /formato de texto/i }),
    ).toBeInTheDocument();
  });

  it("a11y: el lightbox es un dialog con aria-modal y nombre accesible", () => {
    renderCard(
      makeResena({ images: [{ _id: "i1", url: "http://example.com/1.jpg" }] }),
    );
    fireEvent.click(screen.getByRole("button", { name: /ver foto 1/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(/foto ampliada/i);
  });
});
