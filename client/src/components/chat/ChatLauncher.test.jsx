import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/ChatContext", () => ({ useChat: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
// ChatLauncher gates "dms" via the combined useSectionEnabled hook (global +
// per-community override).
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import ChatLauncher from "./ChatLauncher";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";

const FRIEND = (over = {}) => ({
  _id: over._id || `f${Math.random()}`,
  username: over.username || "pal",
  avatar: { url: "", publicId: "" },
  ...over,
});

function setup({
  user = { _id: "me", username: "me" },
  dmsEnabled = true,
  communityDmsEnabled = true,
  conversations = {},
  dmUnreadTotal = 0,
  openChat = vi.fn(),
  friends = [],
} = {}) {
  useAuth.mockReturnValue({ user });
  useChat.mockReturnValue({ conversations, openChat, dmUnreadTotal });
  useNotifications.mockReturnValue({ addFriendListener: () => () => {} });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => (k === "dms" ? dmsEnabled : true),
  });
  useCommunity.mockReturnValue({
    isSectionEnabledInSkin: (k) => (k === "dms" ? communityDmsEnabled : true),
  });

  server.use(http.get("/api/users", () => HttpResponse.json(friends)));

  return render(
    <MemoryRouter>
      <ChatLauncher />
    </MemoryRouter>,
  );
}

beforeEach(() => navigateMock.mockReset());

describe("<ChatLauncher>", () => {
  it("renders nothing for anonymous users", () => {
    const { container } = setup({ user: null });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the dms section is disabled", () => {
    const { container } = setup({ dmsEnabled: false });
    expect(container.firstChild).toBeNull();
  });

  // Regression: per-community override (tenant subdomain) hides the launcher
  // even when dms is globally enabled.
  it("renders nothing when the community disabled dms though globally on", () => {
    const { container } = setup({
      dmsEnabled: true,
      communityDmsEnabled: false,
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the FAB button and lists friends when opened", async () => {
    setup({
      friends: [FRIEND({ username: "alice" }), FRIEND({ username: "bob" })],
    });
    const fab = screen.getByRole("button");
    fireEvent.click(fab);

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.getByText("bob")).toBeInTheDocument();
    });
  });

  it("search input filters friends by username (case-insensitive)", async () => {
    setup({
      friends: [
        FRIEND({ username: "alice" }),
        FRIEND({ username: "bob" }),
        FRIEND({ username: "carol" }),
      ],
    });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("alice");

    const search = screen.getByRole("textbox");
    fireEvent.change(search, { target: { value: "AL" } });
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.queryByText("bob")).not.toBeInTheDocument();
    expect(screen.queryByText("carol")).not.toBeInTheDocument();
  });

  it("clicking a friend on desktop calls openChat", async () => {
    // Mock desktop width
    Object.defineProperty(window, "innerWidth", {
      value: 1200,
      configurable: true,
    });
    const openChat = vi.fn();
    const alice = FRIEND({ username: "alice" });
    setup({ friends: [alice], openChat });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("alice");
    fireEvent.click(screen.getByRole("button", { name: /alice/i }));
    expect(openChat).toHaveBeenCalledWith(
      expect.objectContaining({ username: "alice" }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("clicking a friend on mobile navigates to /mensajes/:id", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 400,
      configurable: true,
    });
    const alice = FRIEND({ username: "alice", _id: "aliceId" });
    setup({ friends: [alice] });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("alice");
    fireEvent.click(screen.getByRole("button", { name: /alice/i }));
    expect(navigateMock).toHaveBeenCalledWith("/mensajes/aliceId");
  });
});
