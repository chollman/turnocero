import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import useBggUserMap, { extractBggUsernames } from "./useBggUserMap";

describe("extractBggUsernames", () => {
  it("returns [] for non-array input", () => {
    expect(extractBggUsernames(null)).toEqual([]);
    expect(extractBggUsernames(undefined)).toEqual([]);
  });

  it("returns [] for empty array", () => {
    expect(extractBggUsernames([])).toEqual([]);
  });

  it("collects unique lowercase usernames from plays", () => {
    const plays = [
      { players: [{ username: "Alice" }, { username: "BOB" }] },
      { players: [{ username: "alice" }, { username: "Carol" }] },
    ];
    const out = extractBggUsernames(plays).sort();
    expect(out).toEqual(["alice", "bob", "carol"]);
  });

  it("ignores players without username", () => {
    const plays = [{ players: [{ name: "Alice" }, { username: "bob" }] }];
    expect(extractBggUsernames(plays)).toEqual(["bob"]);
  });

  it("handles plays without a players array", () => {
    const plays = [{}, { players: null }, { players: [{ username: "bob" }] }];
    expect(extractBggUsernames(plays)).toEqual(["bob"]);
  });
});

describe("useBggUserMap", () => {
  beforeEach(() => {
    server.use(
      http.post("/api/users/by-bgg-usernames", async ({ request }) => {
        const body = await request.json();
        const usernames = body.usernames || [];
        return HttpResponse.json(
          usernames.map((u) => ({
            _id: `id-${u}`,
            username: u,
            bggUsername: u,
          })),
        );
      }),
    );
  });

  it("returns empty map when plays is empty", async () => {
    const { result } = renderHook(() => useBggUserMap([]));
    expect(result.current).toEqual({});
  });

  it("returns a map keyed by lowercased bggUsername when plays have players", async () => {
    const plays = [{ players: [{ username: "Alice" }, { username: "Bob" }] }];
    const { result } = renderHook(() => useBggUserMap(plays));
    await waitFor(() => {
      expect(Object.keys(result.current).length).toBe(2);
    });
    expect(result.current.alice).toBeDefined();
    expect(result.current.bob).toBeDefined();
  });

  it("returns empty map when the API fails", async () => {
    server.use(
      http.post("/api/users/by-bgg-usernames", () =>
        HttpResponse.json({ message: "Error" }, { status: 500 }),
      ),
    );
    const plays = [{ players: [{ username: "alice" }] }];
    const { result } = renderHook(() => useBggUserMap(plays));
    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });
});
