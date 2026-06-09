import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackButton from "./BackButton";
import { RouterOnly } from "../../test/wrappers/AllProviders";

describe("<BackButton>", () => {
  it("renders a <Link> with the given href when `to` is set", () => {
    render(<BackButton to="/eventos">Volver a eventos</BackButton>, {
      wrapper: RouterOnly,
    });
    const link = screen.getByRole("link", { name: /volver a eventos/i });
    expect(link).toHaveAttribute("href", "/eventos");
  });

  it("renders a <button> (not a link) when `to` is omitted", () => {
    render(<BackButton onClick={() => {}}>Volver al listado</BackButton>, {
      wrapper: RouterOnly,
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /volver al listado/i });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("fires onClick when the button is clicked", async () => {
    const onClick = vi.fn();
    render(<BackButton onClick={onClick}>Volver</BackButton>, {
      wrapper: RouterOnly,
    });
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <BackButton onClick={onClick} disabled>
        Volver
      </BackButton>,
      { wrapper: RouterOnly },
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders the back arrow as decorative (aria-hidden)", () => {
    render(<BackButton onClick={() => {}}>Volver</BackButton>, {
      wrapper: RouterOnly,
    });
    const arrow = screen.getByText("←");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults the label to 'Volver' when no children are given", () => {
    render(<BackButton onClick={() => {}} />, { wrapper: RouterOnly });
    expect(
      screen.getByRole("button", { name: /volver/i }),
    ).toBeInTheDocument();
  });

  it("forwards extra props (e.g. aria-label) to the element", () => {
    render(
      <BackButton to="/x" aria-label="Volver atrás">
        ←
      </BackButton>,
      { wrapper: RouterOnly },
    );
    expect(
      screen.getByRole("link", { name: "Volver atrás" }),
    ).toBeInTheDocument();
  });
});
