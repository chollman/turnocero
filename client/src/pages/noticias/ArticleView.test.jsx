import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArticleView from "./ArticleView";

const author = {
  _id: "a1",
  displayName: "Cami Rossi",
  username: "cami",
  avatar: { url: "", publicId: "" },
};

function renderView(noticia, props = {}) {
  return render(
    <MemoryRouter>
      <ArticleView noticia={{ author, ...noticia }} {...props} />
    </MemoryRouter>,
  );
}

describe("<ArticleView>", () => {
  it("renders headline, dek and kicker", () => {
    renderView({
      title: "Gran nota",
      dek: "La bajada",
      category: "evento",
      kicker: "Cobertura",
      body: "Texto.",
    });
    expect(
      screen.getByRole("heading", { name: "Gran nota" }),
    ).toBeInTheDocument();
    expect(screen.getByText("La bajada")).toBeInTheDocument();
    expect(screen.getByText(/Cobertura/)).toBeInTheDocument();
  });

  it("renders a plain-text body as paragraphs", () => {
    renderView({ title: "T", body: "Primero.\n\nSegundo." });
    expect(screen.getByText("Primero.")).toBeInTheDocument();
    expect(screen.getByText("Segundo.")).toBeInTheDocument();
  });

  it("renders and sanitizes an HTML body", () => {
    renderView({
      title: "T",
      body: "<p>Hola</p><script>alert(1)</script>",
    });
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders the breakout quote", () => {
    renderView({
      title: "T",
      body: "x",
      quote: { text: "Una cita memorable", author: "Vale" },
    });
    expect(screen.getByText("Una cita memorable")).toBeInTheDocument();
    expect(screen.getByText(/Vale/)).toBeInTheDocument();
  });

  it("renders tags", () => {
    renderView({ title: "T", body: "x", tags: ["torneo"] });
    expect(screen.getByText("#torneo")).toBeInTheDocument();
  });

  it("renders related cards as links", () => {
    renderView(
      { title: "T", body: "x" },
      { related: [{ _id: "r1", title: "Relacionada", category: "resena" }] },
    );
    const link = screen.getByRole("link", { name: /Relacionada/ });
    expect(link).toHaveAttribute("href", "/noticias/r1");
  });

  it("hides related in preview mode", () => {
    renderView(
      { title: "T", body: "x" },
      { preview: true, related: [{ _id: "r1", title: "Relacionada" }] },
    );
    expect(screen.queryByText("Relacionada")).not.toBeInTheDocument();
  });
});
