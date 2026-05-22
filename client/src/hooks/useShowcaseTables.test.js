import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { useShowcaseTables } from "./useShowcaseTables";

vi.mock("axios");

describe("useShowcaseTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inicia con showcase=null y un seed estable", () => {
    axios.get.mockReturnValue(new Promise(() => {})); // never resolves
    const { result, rerender } = renderHook(() => useShowcaseTables());
    expect(result.current.showcase).toBeNull();
    expect(typeof result.current.seed).toBe("number");
    const firstSeed = result.current.seed;
    rerender();
    expect(result.current.seed).toBe(firstSeed);
  });

  it("seedea con un entero en [0, 100)", () => {
    axios.get.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useShowcaseTables());
    expect(Number.isInteger(result.current.seed)).toBe(true);
    expect(result.current.seed).toBeGreaterThanOrEqual(0);
    expect(result.current.seed).toBeLessThan(100);
  });

  it("hace GET /api/tables/showcase y guarda data en success", async () => {
    const data = {
      total: 12,
      table: {
        boardGame: "Catan",
        host: { username: "tester" },
        location: "CABA",
        date: new Date().toISOString(),
        players: [],
        maxPlayers: 4,
      },
    };
    axios.get.mockResolvedValue({ data });
    const { result } = renderHook(() => useShowcaseTables());
    await waitFor(() => expect(result.current.showcase).toEqual(data));
    expect(axios.get).toHaveBeenCalledWith("/api/tables/showcase");
  });

  it("se mantiene en null si la API falla — sin tirar", async () => {
    axios.get.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useShowcaseTables());
    // Espera al menos un tick async para que el .catch corra.
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(result.current.showcase).toBeNull();
  });

  it("no dispara el fetch si enabled=false", async () => {
    axios.get.mockResolvedValue({ data: { total: 1, table: null } });
    const { result } = renderHook(() => useShowcaseTables({ enabled: false }));
    // Espera unos ticks para confirmar que NO se llama.
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.showcase).toBeNull();
    expect(typeof result.current.seed).toBe("number");
  });

  it("dispara cuando enabled pasa de false a true", async () => {
    axios.get.mockResolvedValue({ data: { total: 1, table: null } });
    const { result, rerender } = renderHook(
      ({ enabled }) => useShowcaseTables({ enabled }),
      { initialProps: { enabled: false } },
    );
    expect(axios.get).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(result.current.showcase).toEqual({ total: 1, table: null });
  });
});
