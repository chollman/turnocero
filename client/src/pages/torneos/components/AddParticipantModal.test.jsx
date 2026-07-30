import { describe, it, expect, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

import AddParticipantModal from "./AddParticipantModal";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const USERS = [
  {
    _id: "u1",
    username: "alice",
    displayName: "Alice",
    avatar: { url: "", publicId: "" },
  },
  {
    _id: "u2",
    username: "bob",
    displayName: "Bob",
    avatar: { url: "", publicId: "" },
  },
  {
    _id: "u3",
    username: "carol",
    displayName: "Carol",
    avatar: { url: "", publicId: "" },
  },
];

function setupSearch(users = USERS) {
  server.use(http.get("/api/users", () => HttpResponse.json(users)));
}

function renderModal({
  torneo = {
    _id: "t1",
    participants: [],
    pendingRegistrations: [],
    maxParticipants: null,
  },
  onClose = vi.fn(),
  onChange = vi.fn(),
} = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <AddParticipantModal
          torneo={torneo}
          onClose={onClose}
          onChange={onChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("<AddParticipantModal>", () => {
  it("renders search input and modal heading", () => {
    setupSearch();
    renderModal();
    expect(screen.getByText("Agregar participantes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar usuario/i)).toBeInTheDocument();
  });

  it('loads users from /api/users and shows them with "+ Agregar"', async () => {
    setupSearch();
    renderModal();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /\+ agregar/i }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('marks users who are already participants with "Inscripto"', async () => {
    setupSearch();
    renderModal({
      torneo: {
        _id: "t1",
        participants: [{ _id: "u1" }],
        pendingRegistrations: [],
        maxParticipants: null,
      },
    });
    await screen.findByText("Alice");
    expect(screen.getByText(/inscripto/i)).toBeInTheDocument();
  });

  it('shows "Aprobar y agregar" for pending registrations', async () => {
    setupSearch();
    renderModal({
      torneo: {
        _id: "t1",
        participants: [],
        pendingRegistrations: [{ user: { _id: "u2" } }],
        maxParticipants: null,
      },
    });
    await screen.findByText("Bob");
    expect(
      screen.getByRole("button", { name: /aprobar y agregar/i }),
    ).toBeInTheDocument();
  });

  it("clicking + Agregar POSTs to /participants/:userId + calls onChange", async () => {
    setupSearch();
    const onChange = vi.fn();
    server.use(
      http.post("/api/torneos/:id/participants/:userId", () =>
        HttpResponse.json({ participants: [{ _id: "u1" }] }),
      ),
    );
    renderModal({ onChange });
    await screen.findByText("Alice");
    fireEvent.click(screen.getAllByRole("button", { name: /\+ agregar/i })[0]);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('shows "El torneo alcanzó el cupo máximo" warning when maxed', async () => {
    setupSearch();
    renderModal({
      torneo: {
        _id: "t1",
        participants: [{ _id: "u1" }, { _id: "u2" }],
        pendingRegistrations: [],
        maxParticipants: 2,
      },
    });
    expect(screen.getByText(/cupo máximo/i)).toBeInTheDocument();
  });

  it("Cerrar button calls onClose", () => {
    setupSearch();
    const onClose = vi.fn();
    renderModal({ onClose });
    // There's both a "Cerrar" close-icon button (aria-label) and a "Cerrar" footer button — get the footer one (the second match).
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("debounce", () => {
    it("does NOT call /api/users while typing — only after the 250ms debounce settles", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false });
      try {
        let callCount = 0;
        server.use(
          http.get("/api/users", () => {
            callCount += 1;
            return HttpResponse.json([]);
          }),
        );
        renderModal();

        // Mount: el primer fetch (debouncedSearch === '') sale enseguida.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        const baseline = callCount;
        expect(baseline).toBeGreaterThanOrEqual(1);

        const input = screen.getByPlaceholderText(/buscar usuario/i);
        fireEvent.change(input, { target: { value: "al" } });
        // Antes del delay → sin nuevo fetch.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(150);
        });
        expect(callCount).toBe(baseline);

        // Pasados los 250ms → dispara el fetch con el query.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
        expect(callCount).toBe(baseline + 1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
