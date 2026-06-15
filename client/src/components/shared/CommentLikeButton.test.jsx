import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommentLikeButton from "./CommentLikeButton";

describe("<CommentLikeButton>", () => {
  it("dispara onToggle al clickear el corazón", () => {
    const onToggle = vi.fn();
    render(<CommentLikeButton liked={false} count={0} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /me gusta/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("no muestra el número cuando count es 0", () => {
    render(<CommentLikeButton liked={false} count={0} onToggle={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /ver a quién le gustó/i }),
    ).not.toBeInTheDocument();
  });

  it("el número es clickeable y dispara onShowLikers cuando count > 0", () => {
    const onShowLikers = vi.fn();
    render(
      <CommentLikeButton
        liked
        count={3}
        onToggle={vi.fn()}
        onShowLikers={onShowLikers}
      />,
    );
    const countBtn = screen.getByRole("button", {
      name: /ver a quién le gustó/i,
    });
    expect(countBtn).toHaveTextContent("3");
    fireEvent.click(countBtn);
    expect(onShowLikers).toHaveBeenCalledTimes(1);
  });

  it("muestra el número como texto no clickeable si no hay onShowLikers", () => {
    render(<CommentLikeButton liked count={2} onToggle={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ver a quién le gustó/i }),
    ).not.toBeInTheDocument();
  });

  it("refleja el estado liked en aria-pressed", () => {
    const { rerender } = render(
      <CommentLikeButton liked={false} count={0} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /me gusta/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    rerender(<CommentLikeButton liked count={1} onToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /quitar me gusta/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("deshabilita el toggle cuando disabled", () => {
    const onToggle = vi.fn();
    render(
      <CommentLikeButton
        liked={false}
        count={0}
        onToggle={onToggle}
        disabled
      />,
    );
    const btn = screen.getByRole("button", { name: /me gusta/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
