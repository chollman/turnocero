import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasswordInput from "./PasswordInput";

describe("<PasswordInput>", () => {
  it("renders as password type by default", () => {
    render(
      <PasswordInput
        name="pass"
        value=""
        onChange={vi.fn()}
        placeholder="Contraseña"
      />,
    );
    expect(screen.getByPlaceholderText("Contraseña")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it('shows toggle button with "Mostrar contraseña" aria-label', () => {
    render(<PasswordInput name="pass" value="" onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /mostrar contraseña/i }),
    ).toBeInTheDocument();
  });

  it("clicking toggle switches to text type and shows EyeOff icon", () => {
    render(<PasswordInput name="pass" value="secret" onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /mostrar contraseña/i });
    fireEvent.click(toggle);
    // Input becomes text type
    const inputs = document.querySelectorAll("input");
    expect(inputs[0].type).toBe("text");
    // Toggle label changes to "Ocultar"
    expect(
      screen.getByRole("button", { name: /ocultar contraseña/i }),
    ).toBeInTheDocument();
  });

  it("clicking toggle again reverts to password type", () => {
    render(<PasswordInput name="pass" value="secret" onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /mostrar contraseña/i });
    fireEvent.click(toggle);
    fireEvent.click(
      screen.getByRole("button", { name: /ocultar contraseña/i }),
    );
    const inputs = document.querySelectorAll("input");
    expect(inputs[0].type).toBe("password");
  });
});
