import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GameTile from "./GameTile";

// GameTile genera 6 patterns SVG deterministas a partir del nombre del juego.
// Renderiza:
//   - <img> cuando se pasa imageUrl
//   - <svg> con pattern + iniciales overlay cuando no hay imageUrl
// El color y pattern son hash-based: el mismo nombre + seed siempre da el
// mismo render.

describe("<GameTile>", () => {
  it("renderiza un <img> cuando se pasa imageUrl", () => {
    const { container } = render(
      <GameTile game="Catan" imageUrl="https://example.com/catan.jpg" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://example.com/catan.jpg");
    expect(img.getAttribute("alt")).toBe("Catan");
    // No debería renderizar el SVG fallback si hay imagen
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renderiza SVG + iniciales cuando NO hay imageUrl", () => {
    const { container, getByText } = render(<GameTile game="Catan" />);
    expect(container.querySelector("svg")).not.toBeNull();
    // Iniciales: primeras letras de cada palabra, máx 2, uppercase
    expect(getByText("C")).toBeInTheDocument();
  });

  it("iniciales: dos palabras → dos letras", () => {
    const { getByText } = render(<GameTile game="ticket ride" />);
    expect(getByText("TR")).toBeInTheDocument();
  });

  it("iniciales: trunca a máximo 2 letras", () => {
    const { getByText } = render(<GameTile game="one two three four" />);
    expect(getByText("OT")).toBeInTheDocument();
  });

  it("mismo `game` + `seed` produce mismo render (determinístico)", () => {
    const { container: a } = render(<GameTile game="Catan" seed={3} />);
    const { container: b } = render(<GameTile game="Catan" seed={3} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });

  it("distintos `game` pueden producir distinto pattern/color", () => {
    // Buscamos dos nombres cuyos hash caigan en buckets distintos del módulo
    // 6. Probamos varios pares; con 6 buckets de 26+ nombres, casi siempre
    // hay diferencia entre al menos dos.
    const renders = ["Catan", "Risk", "Monopoly", "Uno", "Chess"].map(
      (g) => render(<GameTile game={g} />).container.innerHTML,
    );
    const unique = new Set(renders);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("aplica el size en pixels al wrapper", () => {
    const { container } = render(<GameTile game="X" size={120} />);
    const wrapper = container.firstChild;
    expect(wrapper.style.width).toBe("120px");
    expect(wrapper.style.height).toBe("120px");
  });

  it("size como string ('100%') usa percent en height (responsive)", () => {
    const { container } = render(<GameTile game="X" size="100%" />);
    const wrapper = container.firstChild;
    expect(wrapper.style.width).toBe("100%");
    expect(wrapper.style.height).toBe("100%");
  });
});
