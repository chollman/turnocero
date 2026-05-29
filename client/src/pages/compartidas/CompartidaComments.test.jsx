import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import CompartidaComments from "./CompartidaComments";

const user = {
  _id: "user1",
  username: "tester",
  avatar: { url: "", publicId: "" },
};
const other = {
  _id: "u2",
  username: "amigo",
  avatar: { url: "", publicId: "" },
};

function setupComments(payload = []) {
  server.use(
    http.get("/api/compartidas/:id/comments", () => HttpResponse.json(payload)),
  );
}

function renderComponent(props = {}) {
  const defaults = {
    compartidaId: "c1",
    user,
    canDeleteOthers: false,
    onRequireLogin: vi.fn(),
    onCountChange: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <CompartidaComments {...defaults} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setupComments([]);
});

describe("<CompartidaComments>", () => {
  it("muestra loader mientras fetchea y luego empty state", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Sin comentarios aún/i)).toBeInTheDocument();
    });
  });

  it("renderiza los comentarios del fetch inicial", async () => {
    setupComments([
      {
        _id: "c1",
        content: "Muy bueno",
        author: other,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Muy bueno")).toBeInTheDocument();
      expect(screen.getByText("amigo")).toBeInTheDocument();
    });
  });

  it("muestra fecha y hora del comentario en formato dd/MM/aa HH:mm", async () => {
    // 5 de enero de 2026, 14:30 hora local.
    const d = new Date(2026, 0, 5, 14, 30);
    setupComments([
      {
        _id: "c1",
        content: "Con fecha",
        author: other,
        createdAt: d.toISOString(),
      },
    ]);
    renderComponent();
    await waitFor(() =>
      expect(screen.getByText("05/01/26 14:30")).toBeInTheDocument(),
    );
  });

  it("enlaza el nombre del autor del comentario a su perfil público", async () => {
    setupComments([
      {
        _id: "c1",
        content: "Muy bueno",
        author: other,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent();
    await waitFor(() => expect(screen.getByText("amigo")).toBeInTheDocument());
    expect(screen.getByText("amigo").closest("a")).toHaveAttribute(
      "href",
      "/usuarios/u2",
    );
  });

  it("no enlaza a un perfil cuando el autor del comentario fue eliminado", async () => {
    setupComments([
      {
        _id: "c1",
        content: "Comentario huérfano",
        author: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent();
    await waitFor(() =>
      expect(screen.getByText("Comentario huérfano")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: /ver perfil de/i }),
    ).not.toBeInTheDocument();
  });

  it("dispara onCountChange después del fetch inicial", async () => {
    const onCountChange = vi.fn();
    setupComments([
      {
        _id: "c1",
        content: "x",
        author: other,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "c2",
        content: "y",
        author: other,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent({ onCountChange });
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it("envía un comentario y dispara onCountChange con el count actualizado", async () => {
    server.use(
      http.post("/api/compartidas/:id/comments", () =>
        HttpResponse.json({
          _id: "cn",
          content: "Hola",
          author: user,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const onCountChange = vi.fn();
    renderComponent({ onCountChange });
    const input = await screen.findByPlaceholderText(/Escribí un comentario/i);
    fireEvent.change(input, { target: { value: "Hola" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() => {
      expect(screen.getByText("Hola")).toBeInTheDocument();
    });
    // Última invocación es count=1 (luego del POST).
    expect(onCountChange.mock.calls.at(-1)).toEqual([1]);
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
      http.put("/api/compartidas/:id/comments/:cid", () =>
        HttpResponse.json({
          _id: "c1",
          content: "Editado",
          author: user,
          createdAt: new Date().toISOString(),
          editedAt: new Date().toISOString(),
        }),
      ),
    );
    renderComponent();
    await screen.findByText("Original");
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    const editArea = screen.getByDisplayValue("Original");
    fireEvent.change(editArea, { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText("Editado")).toBeInTheDocument();
    });
  });

  it("borra un comentario propio y actualiza onCountChange", async () => {
    setupComments([
      {
        _id: "c1",
        content: "A borrar",
        author: user,
        createdAt: new Date().toISOString(),
      },
    ]);
    server.use(
      http.delete("/api/compartidas/:id/comments/:cid", () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );
    const onCountChange = vi.fn();
    renderComponent({ onCountChange });
    await screen.findByText("A borrar");
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await waitFor(() => {
      expect(screen.queryByText("A borrar")).not.toBeInTheDocument();
    });
    expect(onCountChange.mock.calls.at(-1)).toEqual([0]);
  });

  it("muestra botón delete a usuarios con canDeleteOthers=true", async () => {
    setupComments([
      {
        _id: "c1",
        content: "De otro",
        author: other,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent({ canDeleteOthers: true });
    await screen.findByText("De otro");
    expect(
      screen.getByRole("button", { name: /eliminar/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editar/i }),
    ).not.toBeInTheDocument();
  });

  it("anon ve un CTA en vez del form", async () => {
    renderComponent({ user: null });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /iniciá sesión para comentar/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByPlaceholderText(/Escribí un comentario/i),
    ).not.toBeInTheDocument();
  });

  it("anon clickea el CTA y dispara onRequireLogin", async () => {
    const onRequireLogin = vi.fn();
    renderComponent({ user: null, onRequireLogin });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /iniciá sesión para comentar/i,
      }),
    );
    expect(onRequireLogin).toHaveBeenCalledWith(
      expect.stringMatching(/Iniciá sesión/),
    );
  });

  it("muestra error si el POST falla", async () => {
    server.use(
      http.post("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ message: "Mucho texto" }, { status: 400 }),
      ),
    );
    renderComponent();
    const input = await screen.findByPlaceholderText(/Escribí un comentario/i);
    fireEvent.change(input, { target: { value: "Algo" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() => {
      expect(screen.getByText("Mucho texto")).toBeInTheDocument();
    });
  });
});
