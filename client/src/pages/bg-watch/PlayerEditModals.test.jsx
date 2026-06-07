import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

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

import { EditPlayerModal } from "./PlayerEditModals";

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

beforeEach(() => {
  server.use(
    http.get("/api/bgg/jugadores/:user", () => listResponse([juan()])),
  );
});

describe("<EditPlayerModal>", () => {
  it("guardar el nombre pega al endpoint correcto", async () => {
    let body = null;
    server.use(
      http.patch("/api/bgg/jugadores/:user/nombre", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ player: juan({ name: "Juancito" }) });
      }),
    );
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={vi.fn()} />,
    );

    const input = screen.getByDisplayValue("Juan");
    fireEvent.change(input, { target: { value: "Juancito" } });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], name: "Juancito" });
    expect(await screen.findByText(/nombre guardado/i)).toBeInTheDocument();
  });

  it("vincular @BGG pega al endpoint y cierra con 'updated'", async () => {
    let body = null;
    const onClose = vi.fn();
    server.use(
      http.patch(
        "/api/bgg/jugadores/:user/bgg-username",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            merged: false,
            player: juan({ username: "juanbgg" }),
          });
        },
      ),
    );
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={onClose} />,
    );

    const bggInput = screen.getByPlaceholderText("@usuario");
    fireEvent.change(bggInput, { target: { value: "juanbgg" } });
    fireEvent.click(screen.getByRole("button", { name: /vincular/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("updated"));
  });

  it("subir avatar manda el archivo recortado al endpoint", async () => {
    let received = false;
    server.use(
      // No parseamos el multipart (request.formData() es inestable en jsdom):
      // basta con que el PUT al endpoint de avatar haya llegado.
      http.put("/api/bgg/jugadores/:user/avatar", () => {
        received = true;
        return HttpResponse.json({
          player: juan({ avatar: { url: "http://x/a.webp", publicId: "p" } }),
        });
      }),
    );
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={vi.fn()} />,
    );

    // Seleccionar un archivo abre el crop modal (stub), que emite el blob.
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    fireEvent.click(await screen.findByTestId("crop-confirm"));

    await waitFor(() => expect(received).toBe(true));
    expect(await screen.findByText(/avatar actualizado/i)).toBeInTheDocument();
  });

  it("muestra un disclaimer para un jugador vinculado a un miembro", () => {
    render(
      <EditPlayerModal
        bggUsername="alice"
        player={juan({
          username: "bob",
          name: "Bob",
          isLinked: true,
          canEditNameAvatar: false,
          linkedUser: { _id: "u1", displayName: "Bob", username: "bob" },
        })}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/reemplazan los de su perfil/i),
    ).toBeInTheDocument();
  });

  it("cerrar sin cambios devuelve false", () => {
    const onClose = vi.fn();
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={onClose} />,
    );
    // El footer "Cerrar" (texto), no el "✕" (que tiene aria-label "Cerrar").
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("cerrar después de editar el nombre devuelve 'updated'", async () => {
    const onClose = vi.fn();
    server.use(
      http.patch("/api/bgg/jugadores/:user/nombre", () =>
        HttpResponse.json({ player: juan({ name: "Juancito" }) }),
      ),
    );
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={onClose} />,
    );
    fireEvent.change(screen.getByDisplayValue("Juan"), {
      target: { value: "Juancito" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    await screen.findByText(/nombre guardado/i);
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onClose).toHaveBeenCalledWith("updated");
  });

  it("el botón 'Fusionar' abre el modal de fusión y confirma → onClose('merged')", async () => {
    let mergeBody = null;
    const onClose = vi.fn();
    server.use(
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
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={onClose} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /fusionar con otro jugador/i }),
    );

    // El modal de edición se oculta y aparece el de fusión.
    const dialog = await screen.findByRole("dialog");
    const pedro = await within(dialog).findByText("Pedro");
    fireEvent.click(pedro.closest("button"));

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
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("merged"));
  });

  it("marcar 'sos vos' desde el modal de fusión → onClose('merged')", async () => {
    let body = null;
    const onClose = vi.fn();
    server.use(
      http.post("/api/bgg/jugadores/:user/yo-mismo", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ player: juan({ isSelf: true }) });
      }),
    );
    render(
      <EditPlayerModal bggUsername="alice" player={juan()} onClose={onClose} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /fusionar con otro jugador/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /sos vos/i }));
    fireEvent.click(await screen.findByRole("button", { name: /sí, soy yo/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], value: true });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("merged"));
  });
});
