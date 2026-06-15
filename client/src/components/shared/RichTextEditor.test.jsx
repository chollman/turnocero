import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RichTextEditor from "./RichTextEditor";

describe("<RichTextEditor>", () => {
  it("renders the formatting toolbar", () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />);
    expect(
      screen.getByRole("toolbar", { name: /formato de texto/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^título$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /negrita/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^link$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /imagen/i })).toBeInTheDocument();
  });

  it("shows the character counter", () => {
    render(<RichTextEditor value="" onChange={vi.fn()} maxLength={500} />);
    expect(screen.getByText(/\/ 500/)).toBeInTheDocument();
  });

  it("does NOT show extended controls by default (reseña mode)", () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /youtube/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /subtítulo menor/i }),
    ).not.toBeInTheDocument();
  });

  it("shows extended controls in extended mode (Noticias)", () => {
    render(<RichTextEditor value="" onChange={vi.fn()} extended />);
    expect(
      screen.getByRole("button", { name: /video de youtube/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /subtítulo menor/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /separador/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /centrar/i }),
    ).toBeInTheDocument();
  });
});
