import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import i18n from "../../i18n";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

// BgWatchUserCard depends on BGG state; stub for focus.
vi.mock("./BgWatchUserCard", () => ({ default: () => null }));

import UserProfilePublic from "./UserProfilePublic";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";

function makeProfile(overrides = {}) {
  return {
    _id: "u1",
    username: "theuser",
    displayName: overrides.displayName ?? "The User",
    nombre: "",
    apellido: "",
    avatar: { url: "", publicId: "" },
    bggUsername: "",
    createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
    friends: [],
    friendRequests: [],
    isBanned: false,
    isAdmin: false,
    stats: {
      totalGamesPlayed: 17,
      tablesHosted: { total: 5, active: 4, cancelled: 1 },
      tablesAsPlayer: { total: 12, active: 10 },
      compartidas: 3,
      favoriteGames: [],
    },
    hostedTables: [],
    playedTables: [],
    ...overrides,
  };
}

function setup({ profile = makeProfile(), currentUser = null } = {}) {
  useAuth.mockReturnValue({ user: currentUser, refreshUser: vi.fn() });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  useNotifications.mockReturnValue({ notifyFriendAdded: vi.fn() });
  server.use(http.get("/api/users/:id", () => HttpResponse.json(profile)));
  return render(
    <MemoryRouter initialEntries={[`/usuarios/${profile._id}`]}>
      <Routes>
        <Route path="/usuarios/:id" element={<UserProfilePublic />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("<UserProfilePublic>", () => {
  it("renders the user display name + @username", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("The User")).toBeInTheDocument();
    });
    expect(screen.getByText("@theuser")).toBeInTheDocument();
  });

  it("falls back to username when displayName is empty", async () => {
    setup({ profile: makeProfile({ displayName: "" }) });
    await waitFor(() => {
      // No displayName → "theuser" stays as the prominent name + @theuser handle.
      expect(screen.getAllByText(/theuser/i).length).toBeGreaterThan(0);
    });
  });

  it('shows a "Volver" / back link', async () => {
    setup();
    await screen.findByText("@theuser");
    expect(screen.getByText(/comunidades|volver/i)).toBeInTheDocument();
  });

  it("non-banned user shows the regular profile (no banned indicator)", async () => {
    setup();
    await screen.findByText("@theuser");
    expect(screen.queryByText(/suspendid[oa]/i)).not.toBeInTheDocument();
  });

  it("renders favorite games when present", async () => {
    const profile = makeProfile();
    profile.stats.favoriteGames = [
      { game: "Catán", count: 5 },
      { game: "Wingspan", count: 3 },
    ];
    setup({ profile });
    await screen.findByText("@theuser");
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("renders English labels when the language is set to en", async () => {
    i18n.changeLanguage("en");
    const profile = makeProfile();
    profile.stats.favoriteGames = [{ game: "Catán", count: 5 }];
    setup({ profile });
    await screen.findByText("@theuser");
    // Stat labels migrated to the usuarios namespace render in English.
    expect(screen.getByText("Games played")).toBeInTheDocument();
    expect(screen.getByText("FAVORITE GAMES")).toBeInTheDocument();
  });

  it("handles a 404 (rendering error / fallback) without crashing", async () => {
    server.use(
      http.get("/api/users/:id", () => HttpResponse.json({}, { status: 404 })),
    );
    const { container } = setup();
    // After load, we don't crash; either an error state or empty render is acceptable.
    await waitFor(() => {
      // No exception thrown means setup succeeded; the component should not show the heading.
      expect(screen.queryByText("@theuser")).not.toBeInTheDocument();
    });
    expect(container).toBeTruthy();
  });
});
