import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import CreatePlayRedirect from "./CreatePlayRedirect";

function Probe() {
  const loc = useLocation();
  return (
    <div data-testid="loc" data-state={loc.state ? "yes" : "no"}>
      {loc.pathname + loc.search}
    </div>
  );
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/bg-watch/partidas/nueva"
          element={<CreatePlayRedirect />}
        />
        <Route
          path="/bg-watch/:bggUsername/partidas/nueva"
          element={<Probe />}
        />
        <Route path="/bg-watch" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUser = { _id: "me", bggUsername: "meBGG" };
});

describe("<CreatePlayRedirect>", () => {
  it("redirige a la carga del usuario autenticado (no depende del link)", () => {
    renderAt("/bg-watch/partidas/nueva");
    expect(screen.getByTestId("loc")).toHaveTextContent(
      "/bg-watch/meBGG/partidas/nueva",
    );
  });

  it("preserva el query string (?juego / ?volver)", () => {
    renderAt(
      "/bg-watch/partidas/nueva?juego=13&volver=%2Fbg-watch%2FmeBGG%2Fcoleccion",
    );
    const loc = screen.getByTestId("loc");
    expect(loc).toHaveTextContent("/bg-watch/meBGG/partidas/nueva");
    expect(loc).toHaveTextContent("juego=13");
    expect(loc).toHaveTextContent("volver=");
  });

  it("preserva el location.state (prefill de partida compartida)", () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/bg-watch/partidas/nueva", state: { prefill: { x: 1 } } },
        ]}
      >
        <Routes>
          <Route
            path="/bg-watch/partidas/nueva"
            element={<CreatePlayRedirect />}
          />
          <Route
            path="/bg-watch/:bggUsername/partidas/nueva"
            element={<Probe />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("loc")).toHaveAttribute("data-state", "yes");
  });

  it("sin cuenta de BGG manda al hub", () => {
    mockUser = { _id: "me", bggUsername: "" };
    renderAt("/bg-watch/partidas/nueva");
    expect(screen.getByTestId("loc").textContent).toBe("/bg-watch");
  });
});
