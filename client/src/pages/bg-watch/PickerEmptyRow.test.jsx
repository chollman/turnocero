import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PickerEmptyRow from "./PickerEmptyRow";

describe("<PickerEmptyRow>", () => {
  it("renderiza el texto como status accesible", () => {
    render(<PickerEmptyRow>Sin coincidencias</PickerEmptyRow>);
    const row = screen.getByRole("status");
    expect(row).toHaveTextContent("Sin coincidencias");
  });
});
