import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/ChatContext", () => ({ useChat: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Messages from "./Messages";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";

function setup({
  user = { _id: "me", username: "me", friends: ["f1", "f2"] },
  conversations = {},
  openChat = vi.fn(),
  friends = [
    { _id: "f1", username: "alice", avatar: { url: "", publicId: "" } },
    { _id: "f2", username: "bob", avatar: { url: "", publicId: "" } },
  ],
} = {}) {
  useAuth.mockReturnValue({ user });
  useChat.mockReturnValue({ conversations, openChat });
  server.use(http.get("/api/users", () => HttpResponse.json(friends)));
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<Messages>", () => {
  it("renders the page heading + empty state when there are no conversations", async () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Mensajes" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /no hay conversaciones|sin conversaciones|empez[aá]/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders the conversation list when ChatContext has conversations", async () => {
    setup({
      conversations: {
        f1: {
          user: {
            _id: "f1",
            username: "alice",
            avatar: { url: "", publicId: "" },
          },
          messages: [
            {
              _id: "m1",
              content: "last msg",
              createdAt: new Date().toISOString(),
            },
          ],
          unread: 0,
        },
      },
    });
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/last msg/i)).toBeInTheDocument();
  });

  it('"new chat" button toggles the friend picker open', async () => {
    setup();
    fireEvent.click(screen.getByRole("button")); // the "+" button is the only button at this point
    await screen.findByText("alice");
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("search filters the friend picker", async () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("alice");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "al" } });
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.queryByText("bob")).not.toBeInTheDocument();
  });

  it("selecting a friend on mobile navigates to /mensajes/:id", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 400,
      configurable: true,
    });
    setup();
    fireEvent.click(screen.getByRole("button")); // new chat
    await screen.findByText("alice");
    fireEvent.click(screen.getByText("alice"));
    expect(navigateMock).toHaveBeenCalledWith("/mensajes/f1");
  });

  it("selecting a friend on desktop calls openChat (no navigate)", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1200,
      configurable: true,
    });
    const openChat = vi.fn();
    setup({ openChat });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("alice");
    fireEvent.click(screen.getByText("alice"));
    expect(openChat).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "f1", username: "alice" }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
