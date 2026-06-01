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

// Wraps a single page of comments in the paginated response shape
// { comments, total, page, pages }. Single page by default.
function setupComments(comments = [], { total, pages = 1 } = {}) {
  server.use(
    http.get("/api/compartidas/:id/comments", () =>
      HttpResponse.json({
        comments,
        total: total ?? comments.length,
        page: 1,
        pages,
      }),
    ),
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
  // Borrar comentarios pide confirmación (window.confirm). Por defecto la
  // aceptamos; los tests que prueban la cancelación la sobreescriben.
  vi.spyOn(window, "confirm").mockReturnValue(true);
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

  it("dispara onCountChange con el total del server tras el fetch inicial", async () => {
    const onCountChange = vi.fn();
    // El server reporta total=8 aunque sólo mande 2 cargados.
    setupComments(
      [
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
      ],
      { total: 8, pages: 1 },
    );
    renderComponent({ onCountChange });
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(8));
  });

  it("agrega un comentario al TOPE (prepend) y sube el contador", async () => {
    setupComments([
      {
        _id: "viejo",
        content: "comentario viejo",
        author: other,
        createdAt: new Date(2026, 0, 1).toISOString(),
      },
    ]);
    server.use(
      http.post("/api/compartidas/:id/comments", () =>
        HttpResponse.json({
          _id: "nuevo",
          content: "comentario nuevo",
          author: user,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const onCountChange = vi.fn();
    renderComponent({ onCountChange });
    await screen.findByText("comentario viejo");
    const input = screen.getByPlaceholderText(/Escribí un comentario/i);
    fireEvent.change(input, { target: { value: "comentario nuevo" } });
    fireEvent.submit(input.closest("form"));
    await screen.findByText("comentario nuevo");
    // El nuevo aparece ANTES que el viejo en el DOM (más reciente arriba).
    const texts = screen.getAllByText(/comentario (viejo|nuevo)/);
    expect(texts[0]).toHaveTextContent("comentario nuevo");
    // Total pasó de 1 → 2.
    expect(onCountChange.mock.calls.at(-1)).toEqual([2]);
  });

  it("carga incremental: 'Ver comentarios anteriores' trae y appendea la página vieja", async () => {
    server.use(
      http.get("/api/compartidas/:id/comments", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") || 1);
        if (page === 2) {
          return HttpResponse.json({
            comments: [
              {
                _id: "old1",
                content: "anterior",
                author: other,
                createdAt: new Date(2026, 0, 1).toISOString(),
              },
            ],
            total: 3,
            page: 2,
            pages: 2,
          });
        }
        return HttpResponse.json({
          comments: [
            {
              _id: "new1",
              content: "reciente A",
              author: other,
              createdAt: new Date(2026, 0, 3).toISOString(),
            },
            {
              _id: "new2",
              content: "reciente B",
              author: other,
              createdAt: new Date(2026, 0, 2).toISOString(),
            },
          ],
          total: 3,
          page: 1,
          pages: 2,
        });
      }),
    );
    renderComponent();
    await screen.findByText("reciente A");
    // Aún no se cargó la página vieja.
    expect(screen.queryByText("anterior")).not.toBeInTheDocument();
    const moreBtn = screen.getByRole("button", {
      name: /ver comentarios anteriores/i,
    });
    fireEvent.click(moreBtn);
    await screen.findByText("anterior");
    // Ya no hay más páginas → el botón desaparece.
    expect(
      screen.queryByRole("button", { name: /ver comentarios anteriores/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra el botón 'Ver comentarios anteriores' con una sola página", async () => {
    setupComments([
      {
        _id: "c1",
        content: "único",
        author: other,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderComponent();
    await screen.findByText("único");
    expect(
      screen.queryByRole("button", { name: /ver comentarios anteriores/i }),
    ).not.toBeInTheDocument();
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

  it("borra un comentario propio y baja onCountChange", async () => {
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

  it("pide confirmación antes de borrar y la respeta al cancelar", async () => {
    window.confirm.mockReturnValue(false); // el usuario cancela
    setupComments([
      {
        _id: "c1",
        content: "No me borres",
        author: user,
        createdAt: new Date().toISOString(),
      },
    ]);
    let deleteCalled = false;
    server.use(
      http.delete("/api/compartidas/:id/comments/:cid", () => {
        deleteCalled = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );
    renderComponent();
    await screen.findByText("No me borres");
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(window.confirm).toHaveBeenCalledWith("¿Eliminar tu comentario?");
    // Cancelado → no se llamó al endpoint ni se quitó el comentario.
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCalled).toBe(false);
    expect(screen.getByText("No me borres")).toBeInTheDocument();
  });

  it("confirma con el nombre del autor al borrar el comentario de otro (admin/autor)", async () => {
    window.confirm.mockReturnValue(false);
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
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(window.confirm).toHaveBeenCalledWith(
      "¿Eliminar el comentario de amigo?",
    );
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

describe("<CompartidaComments> — respuestas (hilo)", () => {
  const withReplies = [
    {
      _id: "c1",
      content: "comentario raíz",
      author: other,
      createdAt: new Date().toISOString(),
      replies: [
        {
          _id: "r1",
          content: "una respuesta",
          author: user,
          parent: "c1",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ];

  it("renderiza las respuestas anidadas bajo el comentario raíz", async () => {
    setupComments(withReplies, { total: 2 });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("comentario raíz")).toBeInTheDocument();
      expect(screen.getByText("una respuesta")).toBeInTheDocument();
    });
  });

  it("responder a un comentario postea con parent y anida la respuesta", async () => {
    setupComments([
      {
        _id: "c1",
        content: "raíz",
        author: other,
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ]);
    let sentBody = null;
    server.use(
      http.post("/api/compartidas/:id/comments", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          _id: "r1",
          content: sentBody.content,
          author: user,
          parent: "c1",
          createdAt: new Date().toISOString(),
        });
      }),
    );
    const onCountChange = vi.fn();
    renderComponent({ onCountChange });
    await screen.findByText("raíz");
    fireEvent.click(screen.getByRole("button", { name: /responder/i }));
    const replyInput = screen.getByPlaceholderText(/Escribí una respuesta/i);
    fireEvent.change(replyInput, { target: { value: "mi respuesta" } });
    fireEvent.submit(replyInput.closest("form"));
    await screen.findByText("mi respuesta");
    expect(sentBody.parent).toBe("c1");
    expect(onCountChange).toHaveBeenLastCalledWith(2);
  });

  it("borrar el comentario raíz descuenta también sus respuestas", async () => {
    setupComments(withReplies, { total: 2 });
    server.use(
      http.delete("/api/compartidas/:id/comments/:cid", () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );
    const onCountChange = vi.fn();
    renderComponent({ onCountChange, canDeleteOthers: true });
    await screen.findByText("comentario raíz");
    // El primer "Eliminar" es el del comentario raíz.
    fireEvent.click(screen.getAllByRole("button", { name: /eliminar/i })[0]);
    await waitFor(() =>
      expect(screen.queryByText("comentario raíz")).not.toBeInTheDocument(),
    );
    // 2 (raíz + respuesta) descontados → 0.
    expect(onCountChange).toHaveBeenLastCalledWith(0);
  });
});
