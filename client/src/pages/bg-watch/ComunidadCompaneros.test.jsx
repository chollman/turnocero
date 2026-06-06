import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import ComunidadCompaneros from "./ComunidadCompaneros";

const bob = { _id: "b", username: "bob", displayName: "Bobby", avatar: {} };

function renderComp() {
  return render(
    <MemoryRouter>
      <ComunidadCompaneros bggUsername="alice" />
    </MemoryRouter>,
  );
}

describe("<ComunidadCompaneros>", () => {
  it("lista compañeros y linkea al head-to-head", async () => {
    server.use(
      http.get("/api/bgg/comunidad/companeros/:user", () =>
        HttpResponse.json({
          coPlayers: [
            { name: "Bobby", username: "bob", numPlays: 7, user: bob },
            { name: "Invitado", username: "", numPlays: 2, user: null },
          ],
        }),
      ),
    );
    renderComp();
    expect(await screen.findByText("Bobby")).toBeInTheDocument();
    expect(screen.getByText("Invitado")).toBeInTheDocument();
    const link = screen.getByText("Bobby").closest("a");
    expect(link).toHaveAttribute("href", "/bg-watch/comunidad/h2h/alice/bob");
    // El invitado sin username no es un link.
    expect(screen.getByText("Invitado").closest("a")).toBeNull();
  });

  it("muestra el avatar curado del overlay para un compañero no-miembro", async () => {
    server.use(
      http.get("/api/bgg/comunidad/companeros/:user", () =>
        HttpResponse.json({
          coPlayers: [
            {
              name: "Juancito",
              username: "",
              numPlays: 5,
              user: null,
              avatar: { url: "http://x/a.webp", publicId: "p" },
            },
          ],
        }),
      ),
    );
    renderComp();
    expect(await screen.findByText("Juancito")).toBeInTheDocument();
    expect(document.querySelector('img[src="http://x/a.webp"]')).toBeTruthy();
  });

  it("no renderiza nada si no hay compañeros", async () => {
    server.use(
      http.get("/api/bgg/comunidad/companeros/:user", () =>
        HttpResponse.json({ coPlayers: [] }),
      ),
    );
    const { container } = renderComp();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
