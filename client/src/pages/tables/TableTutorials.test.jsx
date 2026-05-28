import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import TableTutorials from "./TableTutorials";

function setupYoutube(items) {
  server.use(
    http.get("/api/youtube/como-se-juega", () => HttpResponse.json({ items })),
  );
}

const sample = [
  {
    videoId: "abc1",
    title: "Cómo se juega Catan paso a paso",
    channel: "Mesa de Juegos",
    thumbnail: "https://i.ytimg.com/vi/abc1/mqdefault.jpg",
    duration: "12:34",
  },
  {
    videoId: "abc2",
    title: "Reglas básicas de Catan",
    channel: "BoardgameAR",
    thumbnail: "https://i.ytimg.com/vi/abc2/mqdefault.jpg",
    duration: "8:45",
  },
  {
    videoId: "abc3",
    title: "Tutorial completo en español",
    channel: "Tablerito",
    thumbnail: "https://i.ytimg.com/vi/abc3/mqdefault.jpg",
    duration: "1:02:03",
  },
];

beforeEach(() => {
  setupYoutube([]);
});

describe("<TableTutorials>", () => {
  it("no renderiza nada cuando boardGame está vacío o ausente", () => {
    const { container: c1 } = render(<TableTutorials boardGame="" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<TableTutorials boardGame={undefined} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<TableTutorials boardGame="   " />);
    expect(c3.firstChild).toBeNull();
  });

  it("muestra skeletons mientras carga", () => {
    // Handler que nunca resuelve para mantener loading.
    server.use(
      http.get("/api/youtube/como-se-juega", () => new Promise(() => {})),
    );
    const { container } = render(<TableTutorials boardGame="Catan" />);
    // 3 skeletons + el header de sección visible inmediato.
    expect(screen.getByText(/Andá preparado/i)).toBeInTheDocument();
    expect(screen.getByText(/Aprendé cómo se juega/i)).toBeInTheDocument();
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // El SVG del play overlay también tiene aria-hidden, pero solo aparece
    // en cards reales — durante loading no hay cards. Filtramos por clase.
    const cardSkeletons = Array.from(skeletons).filter((el) =>
      (el.getAttribute("class") || "").includes("Skeleton"),
    );
    expect(cardSkeletons).toHaveLength(3);
  });

  it("renderiza 3 cards con links correctos a YouTube", async () => {
    setupYoutube(sample);
    render(<TableTutorials boardGame="Catan" />);

    await waitFor(() => {
      expect(
        screen.getByText("Cómo se juega Catan paso a paso"),
      ).toBeInTheDocument();
    });

    const link1 = screen.getByText("Cómo se juega Catan paso a paso").closest("a");
    expect(link1).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc1",
    );
    expect(link1).toHaveAttribute("target", "_blank");
    expect(link1).toHaveAttribute("rel", "noopener noreferrer");

    // Channels y duraciones visibles.
    expect(screen.getByText("Mesa de Juegos")).toBeInTheDocument();
    expect(screen.getByText("12:34")).toBeInTheDocument();
    expect(screen.getByText("1:02:03")).toBeInTheDocument();

    // Tagline interpola el boardGame en el <strong>.
    const taglineGame = screen
      .getAllByText("Catan", { selector: "strong" });
    expect(taglineGame.length).toBeGreaterThan(0);
  });

  it("escapea videoIds raros en el href", async () => {
    setupYoutube([
      {
        videoId: "a?b&c=d",
        title: "Edge case",
        channel: "C",
        thumbnail: "t",
        duration: "1:00",
      },
    ]);
    render(<TableTutorials boardGame="Whatever" />);
    await waitFor(() => {
      expect(screen.getByText("Edge case")).toBeInTheDocument();
    });
    const link = screen.getByText("Edge case").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=a%3Fb%26c%3Dd",
    );
  });

  it("no renderiza nada cuando el server devuelve items vacíos", async () => {
    setupYoutube([]);
    const { container } = render(<TableTutorials boardGame="Catan" />);
    // Inicialmente loading (renderiza section).
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("no renderiza nada cuando el fetch falla", async () => {
    server.use(
      http.get("/api/youtube/como-se-juega", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { container } = render(<TableTutorials boardGame="Catan" />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("manda el boardGame como query param 'juego'", async () => {
    let received = null;
    server.use(
      http.get("/api/youtube/como-se-juega", ({ request }) => {
        const url = new URL(request.url);
        received = url.searchParams.get("juego");
        return HttpResponse.json({ items: [] });
      }),
    );
    render(<TableTutorials boardGame="Wingspan: European Expansion" />);
    await waitFor(() => {
      expect(received).toBe("Wingspan: European Expansion");
    });
  });

  it("oculta el badge de duración cuando viene vacío", async () => {
    setupYoutube([
      {
        videoId: "v1",
        title: "Sin duración",
        channel: "C",
        thumbnail: "t",
        duration: "",
      },
    ]);
    const { container } = render(<TableTutorials boardGame="Catan" />);
    await waitFor(() => {
      expect(screen.getByText("Sin duración")).toBeInTheDocument();
    });
    // No hay ningún elemento con texto "" como badge — buscamos por la clase
    // del duration badge (no debería existir).
    expect(
      Array.from(container.querySelectorAll("span")).find((s) =>
        (s.getAttribute("class") || "").includes("duration"),
      ),
    ).toBeUndefined();
  });
});
