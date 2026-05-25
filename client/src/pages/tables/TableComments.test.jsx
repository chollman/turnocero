import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import TableComments from "./TableComments";

const user = {
  _id: "user1",
  username: "tester",
  avatar: { url: "", publicId: "" },
};

const otherUser = {
  _id: "u2",
  username: "amigo",
  avatar: { url: "", publicId: "" },
};

function setupComments(comments = []) {
  server.use(
    http.get("/api/tables/:id/comments", () => HttpResponse.json(comments)),
  );
}

function renderTableComments(props = {}) {
  return render(
    <TableComments
      tableId="t1"
      user={user}
      isHost={false}
      isAnon={false}
      onRequireLogin={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  setupComments([]);
});

describe("<TableComments>", () => {
  it("muestra empty state cuando no hay comentarios", async () => {
    renderTableComments();
    await waitFor(() => {
      expect(screen.getByText(/Nadie comentó todavía/i)).toBeInTheDocument();
    });
  });

  it("renderiza los comentarios del fetch inicial con badge contador", async () => {
    setupComments([
      {
        _id: "c1",
        content: "Buen aporte",
        author: otherUser,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderTableComments();
    await waitFor(() => {
      expect(screen.getByText("Buen aporte")).toBeInTheDocument();
      expect(screen.getByText("amigo")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument(); // badge
    });
  });

  it("envía un comentario nuevo y lo agrega al listado", async () => {
    server.use(
      http.post("/api/tables/:id/comments", () =>
        HttpResponse.json({
          _id: "c-new",
          content: "Nuevo",
          author: user,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    renderTableComments();
    const textarea = await screen.findByPlaceholderText(
      /Escribí un comentario/,
    );
    fireEvent.change(textarea, { target: { value: "Nuevo" } });
    fireEvent.submit(textarea.closest("form"));
    await waitFor(() => {
      expect(screen.getByText("Nuevo")).toBeInTheDocument();
    });
  });

  it("permite editar un comentario propio", async () => {
    setupComments([
      {
        _id: "c1",
        content: "Original",
        author: user,
        createdAt: new Date().toISOString(),
      },
    ]);
    server.use(
      http.put("/api/tables/:id/comments/:cid", () =>
        HttpResponse.json({
          _id: "c1",
          content: "Editado",
          author: user,
          createdAt: new Date().toISOString(),
          editedAt: new Date().toISOString(),
        }),
      ),
    );
    renderTableComments();
    await screen.findByText("Original");
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    const editArea = screen.getByDisplayValue("Original");
    fireEvent.change(editArea, { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText("Editado")).toBeInTheDocument();
    });
  });

  it("permite borrar un comentario propio (con confirm)", async () => {
    setupComments([
      {
        _id: "c1",
        content: "A borrar",
        author: user,
        createdAt: new Date().toISOString(),
      },
    ]);
    server.use(
      http.delete("/api/tables/:id/comments/:cid", () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderTableComments();
    await screen.findByText("A borrar");
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => {
      expect(screen.queryByText("A borrar")).not.toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  it("muestra el botón de login si isAnon=true en vez del form", () => {
    renderTableComments({ isAnon: true, user: null });
    expect(
      screen.getByRole("button", { name: /iniciá sesión para comentar/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Escribí un comentario/),
    ).not.toBeInTheDocument();
  });

  it("llama onRequireLogin al click cuando isAnon=true", () => {
    const onRequireLogin = vi.fn();
    renderTableComments({ isAnon: true, user: null, onRequireLogin });
    fireEvent.click(
      screen.getByRole("button", { name: /iniciá sesión para comentar/i }),
    );
    expect(onRequireLogin).toHaveBeenCalledWith(
      expect.stringMatching(/Iniciá sesión/),
    );
  });

  it("host puede borrar comentarios ajenos", async () => {
    setupComments([
      {
        _id: "c1",
        content: "De otro",
        author: otherUser,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderTableComments({ isHost: true });
    await screen.findByText("De otro");
    // Botón "Eliminar" aparece para host aunque no sea autor.
    expect(
      screen.getByRole("button", { name: /eliminar/i }),
    ).toBeInTheDocument();
    // Pero NO el botón "Editar" (solo para autor propio).
    expect(
      screen.queryByRole("button", { name: /editar/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra error en el POST y mantiene el input para reintentar", async () => {
    server.use(
      http.post("/api/tables/:id/comments", () =>
        HttpResponse.json({ message: "Comentario muy largo" }, { status: 400 }),
      ),
    );
    renderTableComments();
    const textarea = await screen.findByPlaceholderText(
      /Escribí un comentario/,
    );
    fireEvent.change(textarea, { target: { value: "Algo" } });
    fireEvent.submit(textarea.closest("form"));
    await waitFor(() => {
      expect(screen.getByText("Comentario muy largo")).toBeInTheDocument();
    });
  });
});
