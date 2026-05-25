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

  it("posts maxPlayers as total - 1 (UI cuenta al host, server cuenta spots libres)", async () => {
    let postedBody = null;
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
      http.post("/api/tables", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({ _id: "newtable" }, { status: 201 });
      }),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), {
      target: { value: "cat" },
    });
    const suggestion = await screen.findByText("Catan");
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscá un juego/i).value).toBe(
        "Catan",
      );
    });

    // Default UI = 4 jugadores total → wire = 3
    const form = screen.getByPlaceholderText(/buscá un juego/i).closest("form");
    fireEvent.submit(form);
    await waitFor(() => {
      expect(postedBody).toBeTruthy();
    });
    expect(postedBody.maxPlayers).toBe(3);
  });

  it("muestra el label 'Jugadores' con hint '(incluyéndote)' y NO 'sin contar al host'", () => {
    renderPage();
    expect(screen.getByText(/^Jugadores$/)).toBeInTheDocument();
    expect(screen.getByText(/incluy[ée]ndote/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin contar al host/i)).not.toBeInTheDocument();
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

  // El acordeón arranca colapsado — los items no son visibles hasta que se
  // expanda. Este helper hace click en el header para abrirlo.
  async function expandPicker() {
    const header = await screen.findByRole("button", {
      name: /ludoteca del evento/i,
    });
    fireEvent.click(header);
    return header;
  }

  it('renderiza el header "Ludoteca del evento" con el conteo + caret', async () => {
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
    const header = await screen.findByRole("button", {
      name: /ludoteca del evento/i,
    });
    // El header arranca con aria-expanded="false" (colapsado por default).
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/2 juegos/i)).toBeInTheDocument();
    // Los items NO deben estar visibles hasta que se expanda.
    expect(
      screen.queryByRole("button", { name: /^catan$/i }),
    ).not.toBeInTheDocument();
  });

  it("click en el header expande el acordeón y muestra los juegos", async () => {
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
          ],
        }),
      ),
    );
    renderWithEvento();
    const header = await expandPicker();
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Catan")).toBeInTheDocument();
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

  it("ordena los juegos aportados por el propio user primero y los marca con badge 'Tuyo'", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    server.use(
      http.get("/api/eventos/:id/ludoteca", () =>
        HttpResponse.json({
          items: [
            // Llega primero un juego de otro user...
            {
              _id: "l1",
              bggGameId: 822,
              gameName: "Carcassonne",
              thumbnail: null,
              image: null,
              year: 2000,
              addedBy: { _id: "other", username: "other" },
            },
            // ...y después uno mío. El orden mostrado debe invertirse.
            {
              _id: "l2",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: null,
              image: null,
              year: 1995,
              addedBy: { _id: "me", username: "me" },
            },
          ],
        }),
      ),
    );
    renderWithEvento();
    await expandPicker();
    const buttons = await screen.findAllByRole("button", {
      name: /catan|carcassonne/i,
    });
    expect(buttons[0]).toHaveAccessibleName(/catan.*aportado por vos/i);
    expect(buttons[1]).toHaveAccessibleName(/^carcassonne$/i);
  });

  it("si el mismo bggGameId fue aportado por el user y por otros, se considera 'mío'", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
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
              addedBy: { _id: "other", username: "other" },
            },
            {
              _id: "l2",
              bggGameId: 13,
              gameName: "Catan",
              thumbnail: null,
              image: null,
              year: 1995,
              addedBy: { _id: "me", username: "me" },
            },
          ],
        }),
      ),
    );
    renderWithEvento();
    await expandPicker();
    const button = await screen.findByRole("button", { name: /catan/i });
    expect(button).toHaveAccessibleName(/catan.*aportado por vos/i);
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
    await expandPicker();
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
    await expandPicker();
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
    await expandPicker();
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

  it("muestra el hint de la ludoteca como tooltip de un icono de info, sin toggle-ar el acordeón al clickearlo", async () => {
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
          ],
        }),
      ),
    );
    renderWithEvento();
    const trigger = await screen.findByRole("button", {
      name: /cómo usar la ludoteca/i,
    });
    // Por default el tooltip NO está visible.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent(
      /Tocá un juego de la ludoteca para elegirlo, o buscá otro en BGG abajo\./i,
    );

    // El click en el icono no debe expandir el picker (stopPropagation).
    const header = screen.getByRole("button", { name: /ludoteca del evento/i });
    expect(header).toHaveAttribute("aria-expanded", "false");
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
