import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock("../../components/shared/Avatar", () => ({
  // Render only the username so it doesn't clash with the name text in queries.
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));
// react-easy-crop is heavy; stub the crop modal to immediately yield a blob.
vi.mock("../../components/shared/AvatarCropModal", () => ({
  default: ({ open, onConfirm }) =>
    open ? (
      <button
        data-testid="crop-confirm"
        onClick={() => onConfirm(new Blob(["x"], { type: "image/jpeg" }))}
      >
        crop-confirm
      </button>
    ) : null,
}));

import JugadoresPanel from "./JugadoresPanel";

function juan(extra = {}) {
  return {
    key: "k:n:juan",
    overlayId: null,
    rawKeys: ["n:juan"],
    name: "Juan",
    username: "",
    numPlays: 3,
    lastPlayedDate: "2026-01-01",
    avatar: null,
    linkedUser: null,
    isLinked: false,
    canEditNameAvatar: true,
    ...extra,
  };
}

function listResponse(items) {
  return HttpResponse.json({
    items,
    total: items.length,
    page: 1,
    pages: 1,
  });
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <JugadoresPanel bggUsername="alice" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUser = { _id: "me", username: "alice", bggUsername: "alice" };
  server.use(
    http.get("/api/bgg/jugadores/:user", () => listResponse([juan()])),
  );
});

describe("<JugadoresPanel>", () => {
  it("renderiza la lista de jugadores", async () => {
    renderPanel();
    expect(await screen.findByText("Juan")).toBeInTheDocument();
    expect(screen.getByText(/3 partidas/)).toBeInTheDocument();
  });

  it("guardar el nombre pega al endpoint correcto", async () => {
    let body = null;
    server.use(
      http.patch("/api/bgg/jugadores/:user/nombre", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ player: juan({ name: "Juancito" }) });
      }),
    );
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /editar/i }));

    const input = await screen.findByDisplayValue("Juan");
    fireEvent.change(input, { target: { value: "Juancito" } });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], name: "Juancito" });
    expect(await screen.findByText(/nombre guardado/i)).toBeInTheDocument();
  });

  it("reasignar @BGG pega al endpoint y reescribe en BGG", async () => {
    let body = null;
    server.use(
      http.patch(
        "/api/bgg/jugadores/:user/bgg-username",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            rewritten: 2,
            failed: [],
            merged: false,
            player: juan({ username: "juanbgg" }),
          });
        },
      ),
    );
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /editar/i }));

    const bggInput = await screen.findByPlaceholderText("@usuario");
    fireEvent.change(bggInput, { target: { value: "juanbgg" } });
    fireEvent.click(screen.getByRole("button", { name: /reasignar/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });
  });

  it("subir avatar manda el archivo recortado al endpoint", async () => {
    let received = false;
    server.use(
      http.put("/api/bgg/jugadores/:user/avatar", async ({ request }) => {
        const form = await request.formData();
        received = form.has("avatar") && form.get("rawKeys") === '["n:juan"]';
        return HttpResponse.json({
          player: juan({ avatar: { url: "http://x/a.webp", publicId: "p" } }),
        });
      }),
    );
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /editar/i }));

    // Selecting a file opens the (stubbed) crop modal, which yields a blob.
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    fireEvent.click(await screen.findByTestId("crop-confirm"));

    await waitFor(() => expect(received).toBe(true));
    expect(await screen.findByText(/avatar actualizado/i)).toBeInTheDocument();
  });

  it("una fila vinculada deshabilita 'Editar' y no muestra @BGG", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user", () =>
        listResponse([
          juan({
            username: "bob",
            name: "Bob",
            isLinked: true,
            canEditNameAvatar: false,
            linkedUser: { _id: "u1", displayName: "Bob", username: "bob" },
          }),
        ]),
      ),
    );
    renderPanel();
    await screen.findByText("Bob");
    expect(screen.getByText(/miembro turnocero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar/i })).toBeDisabled();
  });

  it("fusionar elige un destino y confirma", async () => {
    let mergeBody = null;
    server.use(
      // La lista trae dos jugadores para poder elegir destino.
      http.get("/api/bgg/jugadores/:user", () =>
        listResponse([
          juan(),
          juan({
            key: "k:n:pedro",
            rawKeys: ["n:pedro"],
            name: "Pedro",
            numPlays: 1,
          }),
        ]),
      ),
      http.post("/api/bgg/jugadores/:user/merge", async ({ request }) => {
        mergeBody = await request.json();
        return HttpResponse.json({ player: juan() });
      }),
    );
    renderPanel();
    // Abrir "Fusionar" en la fila de Juan (primer botón Fusionar).
    const mergeButtons = await screen.findAllByRole("button", {
      name: /fusionar/i,
    });
    fireEvent.click(mergeButtons[0]);

    // Elegir a Pedro como destino dentro del modal (scopeado al diálogo).
    const dialog = await screen.findByRole("dialog");
    const pedro = await within(dialog).findByText("Pedro");
    fireEvent.click(pedro.closest("button"));

    // Regresión: el modal de selección se oculta al abrir la confirmación,
    // para que su backdrop no tape (z-index) al ConfirmActionModal.
    await waitFor(() =>
      expect(screen.queryByText("Fusionar jugador")).toBeNull(),
    );

    // Confirmar en el ConfirmActionModal (scopeado por su título plural).
    const confirmTitle = await screen.findByText("Fusionar jugadores");
    fireEvent.click(
      within(confirmTitle.closest("div")).getByRole("button", {
        name: /^fusionar$/i,
      }),
    );

    await waitFor(() => expect(mergeBody).toBeTruthy());
    expect(mergeBody).toEqual({
      sourceRawKeys: ["n:juan"],
      targetRawKeys: ["n:pedro"],
    });
  });

  it("muestra vacío cuando no hay jugadores", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user", () => listResponse([])),
    );
    renderPanel();
    expect(await screen.findByText(/sin jugadores aún/i)).toBeInTheDocument();
  });
});
