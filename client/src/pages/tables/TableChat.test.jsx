import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// Mock socket.io-client globally — TableChat's `io(...)` connection has
// to be inert in tests.
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: mockOn,
    emit: mockEmit,
    disconnect: mockDisconnect,
  }),
}));

import TableChat from "./TableChat";

const user = {
  _id: "user1",
  username: "tester",
  avatar: { url: "", publicId: "" },
};

function setupMessages(messages = []) {
  server.use(
    http.get("/api/tables/:id/messages", () => HttpResponse.json(messages)),
  );
}

function renderChat(props = {}) {
  return render(
    <TableChat tableId="t1" user={user} isViewingAsAdmin={false} {...props} />,
  );
}

beforeEach(() => {
  setupMessages([]);
  mockEmit.mockClear();
  mockOn.mockClear();
  mockDisconnect.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("<TableChat>", () => {
  it("muestra mensaje de empty state cuando no hay mensajes", async () => {
    renderChat();
    await waitFor(() => {
      expect(screen.getByText(/Sin mensajes todavía/)).toBeInTheDocument();
    });
  });

  it("renderiza los mensajes que vienen del fetch inicial", async () => {
    setupMessages([
      {
        _id: "m1",
        content: "Hola che",
        sender: { _id: "other", username: "amigo" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderChat();
    await waitFor(() => {
      expect(screen.getByText("Hola che")).toBeInTheDocument();
      expect(screen.getByText("amigo")).toBeInTheDocument();
    });
  });

  it("oculta el form de envío cuando isViewingAsAdmin es true", () => {
    renderChat({ isViewingAsAdmin: true });
    expect(
      screen.queryByPlaceholderText(/Escribí un mensaje/),
    ).not.toBeInTheDocument();
  });

  it("envía un mensaje vía POST y lo agrega al listado", async () => {
    server.use(
      http.post("/api/tables/:id/messages", async () =>
        HttpResponse.json({
          _id: "m-new",
          content: "Hola",
          sender: user,
          createdAt: new Date().toISOString(),
        }),
      ),
    );

    renderChat();
    const input = await screen.findByPlaceholderText(/Escribí un mensaje/);
    fireEvent.change(input, { target: { value: "Hola" } });

    const form = input.closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Hola")).toBeInTheDocument();
    });
  });

  it("registra el listener chat:message ANTES de emit join:table", () => {
    // Memory: socket-handler-race — el .on debe llamarse antes que .emit
    // de join, sino los emits del cliente durante connect se descartan.
    renderChat();
    const callOrder = [
      ...mockOn.mock.invocationCallOrder,
      ...mockEmit.mock.invocationCallOrder,
    ];
    const onIdx = mockOn.mock.invocationCallOrder[0];
    const emitIdx = mockEmit.mock.invocationCallOrder[0];
    expect(callOrder.length).toBeGreaterThan(0);
    expect(onIdx).toBeLessThan(emitIdx);
  });

  it("hace cleanup del socket al desmontar (leave + disconnect)", () => {
    const { unmount } = renderChat();
    mockEmit.mockClear();
    unmount();
    // Buscamos que entre los emits post-unmount esté el leave:table.
    const emitArgs = mockEmit.mock.calls.map((c) => c[0]);
    expect(emitArgs).toContain("leave:table");
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("muestra error si el POST de mensaje falla y restaura el input", async () => {
    server.use(
      http.post("/api/tables/:id/messages", () =>
        HttpResponse.json({ message: "Mesa llena" }, { status: 400 }),
      ),
    );
    renderChat();
    const input = await screen.findByPlaceholderText(/Escribí un mensaje/);
    fireEvent.change(input, { target: { value: "Hola" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(screen.getByText("Mesa llena")).toBeInTheDocument();
    });
    expect(input.value).toBe("Hola"); // restaurado para reintentar
  });
});
