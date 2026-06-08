import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BgWatchSessionNotice from "./BgWatchSessionNotice";

function renderNotice() {
  return render(
    <MemoryRouter>
      <BgWatchSessionNotice />
    </MemoryRouter>,
  );
}

describe("<BgWatchSessionNotice>", () => {
  it("muestra el aviso de sesión caducada", () => {
    renderNotice();
    expect(
      screen.getByText(/tu sesión con boardgamegeek caducó/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/reingresá tu password/i)).toBeInTheDocument();
  });

  it("tiene un CTA 'Reconectar' que linkea a /perfil", () => {
    renderNotice();
    const cta = screen.getByRole("link", { name: /reconectar/i });
    expect(cta).toHaveAttribute("href", "/perfil");
  });

  it("usa role=alert para que sea anunciado", () => {
    renderNotice();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
