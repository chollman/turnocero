import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import BggGameSearch from "./BggGameSearch";

beforeEach(() => {
  server.use(http.get("/api/bgg/search", () => HttpResponse.json([])));
});

describe("<BggGameSearch>", () => {
  it("does not call the API until minChars is reached", async () => {
    let calls = 0;
    server.use(
      http.get("/api/bgg/search", () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );
    render(<BggGameSearch onPick={() => {}} />);
    const input = screen.getByLabelText(/buscar juego/i);
    fireEvent.change(input, { target: { value: "ca" } });
    // Wait past debounce
    await new Promise((r) => {
      setTimeout(r, 400);
    });
    expect(calls).toBe(0);
  });

  it("calls the API once with the debounced query and renders results", async () => {
    let lastQ = null;
    server.use(
      http.get("/api/bgg/search", ({ request }) => {
        const url = new URL(request.url);
        lastQ = url.searchParams.get("q");
        return HttpResponse.json([
          { id: 13, name: "Catan", thumbnail: "thumb.jpg", year: 1995 },
          { id: 24, name: "Catan: Cities", thumbnail: null, year: 1998 },
        ]);
      }),
    );
    render(<BggGameSearch onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText(/buscar juego/i), {
      target: { value: "Catan" },
    });
    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Catan: Cities")).toBeInTheDocument();
    expect(lastQ).toBe("Catan");
  });

  it("calls onPick with { id, name, thumbnail, year } when a result is clicked", async () => {
    const onPick = vi.fn();
    server.use(
      http.get("/api/bgg/search", () =>
        HttpResponse.json([
          { id: 13, name: "Catan", thumbnail: "thumb.jpg", year: 1995 },
        ]),
      ),
    );
    render(<BggGameSearch onPick={onPick} />);
    fireEvent.change(screen.getByLabelText(/buscar juego/i), {
      target: { value: "Catan" },
    });
    const item = await screen.findByRole("button", { name: /catan/i });
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledWith({
      id: 13,
      name: "Catan",
      thumbnail: "thumb.jpg",
      year: 1995,
    });
  });

  it("shows 'Sin resultados' when API returns empty for a valid query", async () => {
    render(<BggGameSearch onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText(/buscar juego/i), {
      target: { value: "asdfghjkl" },
    });
    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("respects custom minChars prop", async () => {
    let calls = 0;
    server.use(
      http.get("/api/bgg/search", () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );
    render(<BggGameSearch onPick={() => {}} minChars={2} />);
    fireEvent.change(screen.getByLabelText(/buscar juego/i), {
      target: { value: "ca" },
    });
    await waitFor(() => expect(calls).toBeGreaterThan(0));
  });
});
