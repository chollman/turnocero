import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// Mock de PlaceAutocomplete — su test propio cubre el comportamiento.
// AddressMap fue removido del form de creación (2026-05).
vi.mock("../../components/shared/PlaceAutocomplete", () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import CreateTable from "./CreateTable";
import { useAuth } from "../../context/AuthContext";

beforeEach(() => {
  navigateMock.mockReset();
  // Default: usuario sin direccion. Tests específicos sobreescriben.
  useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateTable />
    </MemoryRouter>,
  );
}

describe("<CreateTable>", () => {
  it("renders heading + form fields", () => {
    renderPage();
    expect(screen.getByText(/convoc[aá] una partida/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscá un juego/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /crear|convocar|publicar|crear mesa/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows BGG suggestions after typing ≥3 characters", async () => {
    server.use(
      http.get("/api/bgg/search", () =>
        HttpResponse.json([
          { id: 1, name: "Catan", year: 1995, thumbnail: null },
          { id: 2, name: "Carcassonne", year: 2000, thumbnail: null },
        ]),
      ),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), {
      target: { value: "cat" },
    });
    await waitFor(() => {
      expect(screen.getByText("Catan")).toBeInTheDocument();
      expect(screen.getByText("Carcassonne")).toBeInTheDocument();
    });
  });

  it('shows "Sin resultados" when BGG returns empty', async () => {
    server.use(http.get("/api/bgg/search", () => HttpResponse.json([])));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), {
      target: { value: "xyz" },
    });
    await waitFor(() => {
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
    });
  });

  it("selecting a suggestion fills the input and locks the game", async () => {
    server.use(
      http.get("/api/bgg/search", () =>
        HttpResponse.json([
          { id: 1, name: "Catan", year: 1995, thumbnail: null },
        ]),
      ),
      http.get("/api/bgg/game/:id", () =>
        HttpResponse.json({
          id: 1,
          name: "Catan (full)",
          year: 1995,
          image: null,
          thumbnail: null,
        }),
      ),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), {
      target: { value: "cat" },
    });
    const suggestion = await screen.findByText("Catan");
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscá un juego/i);
      expect(input.value).toBe("Catan (full)");
    });
  });

  it("submit without a game selected shows the validation error", () => {
    renderPage();
    const form = screen.getByPlaceholderText(/buscá un juego/i).closest("form");
    fireEvent.submit(form);
    expect(screen.getByText(/seleccion[aá] un juego/i)).toBeInTheDocument();
  });

  it("successful submit creates the table and navigates to /mesas/:id", async () => {
    server.use(
      http.get("/api/bgg/search", () =>
        HttpResponse.json([
          { id: 1, name: "Catan", year: 1995, thumbnail: null },
        ]),
      ),
      http.get("/api/bgg/game/:id", () =>
        HttpResponse.json({
          id: 1,
          name: "Catan",
          year: 1995,
          image: null,
          thumbnail: null,
        }),
      ),
      http.post("/api/tables", () =>
        HttpResponse.json(
          { _id: "newtable-id", boardGame: "Catan" },
          { status: 201 },
        ),
      ),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), {
      target: { value: "cat" },
    });
    const suggestion = await screen.findByText("Catan");
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscá un juego/i);
      expect(input.value).toBe("Catan");
    });

    const form = screen.getByPlaceholderText(/buscá un juego/i).closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/mesas/newtable-id");
    });
  });
});

describe("<CreateTable> — Ubicación (opcional, sin mapa)", () => {
  it("no renderiza un mapa en el form de creación", () => {
    renderPage();
    // AddressMap fue removido del flujo de creación.
    expect(screen.queryByTestId("address-map")).not.toBeInTheDocument();
  });

  it('muestra label "Ubicación" con el hint "(opcional)"', () => {
    renderPage();
    expect(screen.getByText("Ubicación")).toBeInTheDocument();
    expect(screen.getByText(/\(opcional\)/)).toBeInTheDocument();
  });

  it("cuando el user tiene direccion en el perfil, muestra hint de fallback con el texto", () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "Av. Corrientes 1234", lat: -34.6, lng: -58.4 },
      },
    });
    renderPage();
    expect(
      screen.getByText(/usamos la dirección de tu perfil/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
  });

  it("cuando el user NO tiene direccion, muestra link al perfil", () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    renderPage();
    expect(
      screen.getByText(/la mesa se publica sin ubicación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /agregá una dirección a tu perfil/i }),
    ).toHaveAttribute("href", "/perfil");
  });

  it("cuando hay ?evento=<id>, no renderiza la sección de Ubicación", () => {
    server.use(
      http.get("/api/eventos/:id", () =>
        HttpResponse.json({ eventDate: null }),
      ),
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    render(
      <MemoryRouter initialEntries={["/mesas/crear?evento=ev123"]}>
        <CreateTable />
      </MemoryRouter>,
    );
    // La sección entera (label + input + hint) se omite — la ubicación se
    // hereda del evento server-side, no hay nada que mostrar.
    expect(screen.queryByText("Ubicación")).not.toBeInTheDocument();
    expect(screen.queryByTestId("place-autocomplete")).not.toBeInTheDocument();
  });

  it("cuando hay ?evento= con eventDate en nav state, swap el datetime-local por un time picker", () => {
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/mesas/crear",
            search: "?evento=ev123",
            state: { eventDate: "2030-06-15T16:00:00.000Z" },
          },
        ]}
      >
        <CreateTable />
      </MemoryRouter>,
    );
    // No hay "Fecha y hora" — solo "Hora *"
    expect(screen.queryByLabelText(/fecha y hora/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Hora \*$/)).toBeInTheDocument();
  });
});

describe("<CreateTable> — Ludoteca picker (?evento=)", () => {
  function renderWithEvento() {
    return render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/mesas/crear",
            search: "?evento=ev123",
            state: { eventDate: "2030-06-15T16:00:00.000Z" },
          },
        ]}
      >
        <CreateTable />
      </MemoryRouter>,
    );
  }

  it('renderiza el grid con los juegos de la ludoteca y el label "Ludoteca del evento"', async () => {
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            {
              _id: "l1",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: null,
              image: null,
              year: 1995,
              addedBy: { _id: "u1", username: "u1" },
            },
            {
              _id: "l2",
              bggGameId: 822,
              gameName: "Carcassonne",
              thumbnail: null,
              image: null,
              year: 2000,
              addedBy: { _id: "u2", username: "u2" },
            },
          ],
        }),
      ),
    );
    renderWithEvento();
    expect(await screen.findByText(/ludoteca del evento/i)).toBeInTheDocument();
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Carcassonne")).toBeInTheDocument();
  });

  it("si la ludoteca está vacía, no renderiza el picker", async () => {
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderWithEvento();
    // Esperamos un tick para que el fetch resuelva, luego verificamos ausencia.
    await waitFor(() => {
      expect(
        screen.queryByText(/ludoteca del evento/i),
      ).not.toBeInTheDocument();
    });
  });

  it("deduplica items por bggGameId (varios users aportaron el mismo juego)", async () => {
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            {
              _id: "l1",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: null,
              image: null,
              year: 1995,
              addedBy: { _id: "u1", username: "u1" },
            },
            {
              _id: "l2",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: null,
              image: null,
              year: 1995,
              addedBy: { _id: "u2", username: "u2" },
            },
          ],
        }),
      ),
    );
    renderWithEvento();
    await screen.findByText(/ludoteca del evento/i);
    expect(screen.getAllByText("Catan")).toHaveLength(1);
  });

  it("click en un item del picker selecciona el juego sin pegarle a /api/bgg/game/:id", async () => {
    let bggGameCallCount = 0;
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            {
              _id: "l1",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: "http://x/t.png",
              image: "http://x/i.png",
              year: 1995,
              addedBy: { _id: "u1", username: "u1" },
            },
          ],
        }),
      ),
      http.get("/api/bgg/game/:id", () => {
        bggGameCallCount += 1;
        return HttpResponse.json({});
      }),
    );
    renderWithEvento();
    const item = await screen.findByRole("button", { name: /catan/i });
    fireEvent.click(item);

    // El input de búsqueda BGG debe quedar con el nombre del juego y el botón
    // aria-pressed=true.
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscá otro juego en bgg/i);
      expect(input.value).toBe("Catan");
    });
    expect(item).toHaveAttribute("aria-pressed", "true");
    expect(bggGameCallCount).toBe(0);
  });

  it("submit después de pickear del ludoteca crea la mesa con los datos del juego elegido", async () => {
    let postedBody = null;
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            {
              _id: "l1",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: "http://x/t.png",
              image: "http://x/i.png",
              year: 1995,
              addedBy: { _id: "u1", username: "u1" },
            },
          ],
        }),
      ),
      http.post("/api/tables", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({ _id: "newtable" }, { status: 201 });
      }),
    );
    renderWithEvento();
    fireEvent.click(await screen.findByRole("button", { name: /catan/i }));

    const form = screen
      .getByPlaceholderText(/buscá otro juego en bgg/i)
      .closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/mesas/newtable");
    });
    expect(postedBody).toMatchObject({
      bggId: 13,
      boardGame: "Catan",
      bggThumbnail: "http://x/t.png",
      bggImage: "http://x/i.png",
      bggYear: 1995,
      eventoId: "ev123",
    });
  });
});

describe("<CreateTable> — debounce BGG search", () => {
  it("does NOT call /api/bgg/search while typing — only after the 400ms debounce settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      let callCount = 0;
      server.use(
        http.get("/api/bgg/search", () => {
          callCount += 1;
          return HttpResponse.json([]);
        }),
      );
      renderPage();

      const input = screen.getByPlaceholderText(/buscá un juego/i);
      fireEvent.change(input, { target: { value: "cat" } });
      // Antes del delay no debe haber pegado al backend.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(callCount).toBe(0);

      // Más cambios dentro del delay → reinicia el timer.
      fireEvent.change(input, { target: { value: "catan" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(callCount).toBe(0);

      // Tras los 400ms desde el último cambio → fetch dispara una sola vez.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(callCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
