import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchRowSkeleton from "./SearchRowSkeleton";

describe("<SearchRowSkeleton>", () => {
  it("renderiza la cantidad de filas pedida", () => {
    render(<SearchRowSkeleton rows={3} />);
    expect(screen.getByTestId("search-skeleton").children).toHaveLength(3);
  });

  it("usa 4 filas por defecto", () => {
    render(<SearchRowSkeleton />);
    expect(screen.getByTestId("search-skeleton").children).toHaveLength(4);
  });
});
