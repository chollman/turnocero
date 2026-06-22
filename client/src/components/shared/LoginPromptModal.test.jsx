import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPromptModal from "./LoginPromptModal";
import i18n from "../../i18n";
import { RouterOnly } from "../../test/wrappers/AllProviders";

describe("<LoginPromptModal>", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <LoginPromptModal isOpen={false} onClose={() => {}} message="hello" />,
      { wrapper: RouterOnly },
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the default message when none is given", () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, {
      wrapper: RouterOnly,
    });
    expect(
      screen.getByText("Iniciá sesión para continuar."),
    ).toBeInTheDocument();
  });

  it("renders the custom message when provided", () => {
    render(
      <LoginPromptModal
        isOpen
        onClose={() => {}}
        message="Login pro joinear"
      />,
      {
        wrapper: RouterOnly,
      },
    );
    expect(screen.getByText("Login pro joinear")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<LoginPromptModal isOpen onClose={onClose} />, {
      wrapper: RouterOnly,
    });
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the overlay is clicked (but not the modal body)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <LoginPromptModal isOpen onClose={onClose} />,
      { wrapper: RouterOnly },
    );
    // Overlay is the outermost div
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clicking inside the modal body should NOT trigger onClose
    onClose.mockClear();
    fireEvent.click(screen.getByText("¡Sumate a la partida!"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders both CTAs to login and register", () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, {
      wrapper: RouterOnly,
    });
    expect(
      screen.getByRole("button", { name: /sesi[oó]n/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /registrate/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Iniciá sesión" navigates (no crash)', () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, {
      wrapper: RouterOnly,
    });
    fireEvent.click(screen.getByRole("button", { name: /sesi[oó]n/i }));
    // navigate is called — just verify it completes without throwing
  });

  it('clicking "Registrate gratis" navigates (no crash)', () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, {
      wrapper: RouterOnly,
    });
    fireEvent.click(screen.getByRole("button", { name: /registrate/i }));
  });

  describe("in English", () => {
    afterEach(() => {
      i18n.changeLanguage("es");
    });

    it("renders the English copy when the language is en", () => {
      i18n.changeLanguage("en");
      render(<LoginPromptModal isOpen onClose={() => {}} />, {
        wrapper: RouterOnly,
      });
      expect(screen.getByText("Join the game!")).toBeInTheDocument();
      expect(screen.getByText("Log in to continue.")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Log in" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Sign up free" }),
      ).toBeInTheDocument();
    });
  });
});
