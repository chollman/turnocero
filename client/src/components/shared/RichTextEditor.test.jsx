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
});
