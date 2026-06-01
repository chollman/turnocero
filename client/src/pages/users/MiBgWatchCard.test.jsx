import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import MiBgWatchCard from "./MiBgWatchCard";

function renderCard(bggUsername = "CarcaFan") {
  return render(
    <MemoryRouter>
      <MiBgWatchCard bggUsername={bggUsername} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/partidas/:bggUsername", () =>
      HttpResponse.json({
        plays: [{ id: "p1", date: "2026-05-01" }],
        total: 30,
      }),
    ),
    http.get("/api/bgg/coleccion/:bggUsername", () =>
      HttpResponse.json([
        { id: 13, name: "Catán" },
        { id: 14, name: "Azul" },
      ]),
    ),
  );
});

describe("<MiBgWatchCard>", () => {
  it("links to /bg-watch/:bggUsername", () => {
    renderCard("CarcaFan");
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/bg-watch/CarcaFan",
    );
  });

  it('renders the eyebrow "MI BG WATCH" and @username', () => {
    renderCard("CarcaFan");
    expect(screen.getByText(/MI BG WATCH/)).toBeInTheDocument();
    expect(screen.getByText("@CarcaFan")).toBeInTheDocument();
  });

  it("renders avatar letter from first char of bggUsername", () => {
    renderCard("Daniel");
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it('shows loading "…" before API resolves', () => {
    renderCard();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });

  it("renders partidas and juegos counts after load", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("renders error note when both APIs fail", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderCard();
    await waitFor(() => {
      expect(
        screen.getByText(/igual podés entrar a tu bg watch/i),
      ).toBeInTheDocument();
    });
  });

  it('renders "?" as initial when bggUsername is empty', () => {
    renderCard("");
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
