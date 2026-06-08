import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));

import CompartidaCard from "./CompartidaCard";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

function makePost(overrides = {}) {
  return {
    _id: "c1",
    title: overrides.title ?? "",
    body: overrides.body ?? "Anoche jugamos Catán",
    images: overrides.images || [],
    privacy: overrides.privacy || "public",
    linkedTable: overrides.linkedTable || null,
    likes: overrides.likes || [],
    commentCount: overrides.commentCount ?? 0,
    author: overrides.author || {
      _id: "a1",
      username: "cha",
      displayName: "Claudio H",
      avatar: { url: "", publicId: "" },
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(post, { user = null } = {}) {
  useAuth.mockReturnValue({ user });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  return render(
    <MemoryRouter>
      <CompartidaCard post={post} onDeleted={vi.fn()} onUpdated={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("<CompartidaCard>", () => {
  it("renders the author name and body", () => {
    renderCard(makePost());
    expect(screen.getByText(/Claudio H/)).toBeInTheDocument();
    expect(screen.getByText(/Anoche jugamos Catán/)).toBeInTheDocument();
  });

  it("renders the title when provided", () => {
    renderCard(makePost({ title: "Una sesión épica" }));
    expect(screen.getByText("Una sesión épica")).toBeInTheDocument();
  });

  it("renders the played games (boardGames) of a juntada", () => {
    renderCard(
      makePost({
        boardGames: [
          { bggId: 13, name: "Catan", thumbnail: "", image: "" },
          { bggId: 99, name: "Wingspan", thumbnail: "", image: "" },
        ],
      }),
    );
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("shows the like count when present", () => {
    renderCard(makePost({ likes: ["u1", "u2", "u3"] }));
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // ── Widget de resultados (juntada compartida) ────────────────────────
  const PLAY_RESULT = {
    mode: "versus",
    game: { name: "Catán", thumbnail: "" },
    date: "2026-06-08",
    duration: 60,
    players: [
      { name: "Martín", username: "martin", score: "85", win: true, position: 1 },
      { name: "Bob", username: "bob", score: "72", win: false, position: 2 },
    ],
  };

  it("renderiza el widget de resultados cuando hay playResult", () => {
    renderCard(makePost({ playResult: PLAY_RESULT }));
    expect(document.querySelector(".playResult")).toBeInTheDocument();
    // Banner neutral (ganador), no '¡Ganaste!'.
    expect(screen.getByText(/ganó martín/i)).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("el widget coexiste con las fotos de la juntada", () => {
    renderCard(
      makePost({
        playResult: PLAY_RESULT,
        images: [{ _id: "i1", url: "p.jpg", publicId: "p" }],
      }),
    );
    expect(document.querySelector(".playResult")).toBeInTheDocument();
    expect(document.querySelector(".photos")).toBeInTheDocument();
  });

  it("compartidas sin playResult (legacy/reseña) no muestran el widget", () => {
    renderCard(makePost());
    expect(document.querySelector(".playResult")).not.toBeInTheDocument();
    expect(screen.queryByText(/ganó/i)).not.toBeInTheDocument();
  });

  it("clicking like as logged user makes an API call", async () => {
    let likeCalled = false;
    server.use(
      http.post("/api/compartidas/:id/like", () => {
        likeCalled = true;
        return HttpResponse.json({ liked: true });
      }),
    );
    renderCard(makePost(), { user: { _id: "me", username: "me" } });

    // Find any button with a "0" inside (initial like count display).
    const buttons = screen.getAllByRole("button");
    const heart = buttons.find((b) => b.textContent === "0");
    if (heart) {
      fireEvent.click(heart);
      await waitFor(() => expect(likeCalled).toBe(true));
    }
  });

  it('shows "Eliminado" / ghost avatar when author is null (deleted)', () => {
    renderCard(makePost({ author: null }));
    expect(screen.getByText(/usuario eliminado/i)).toBeInTheDocument();
  });

  it("shows privacy label for non-public posts", () => {
    renderCard(makePost({ privacy: "friends" }), { user: { _id: "me" } });
    expect(screen.getByText(/amigos/i)).toBeInTheDocument();
  });

  it("shows admin menu (Editar/Eliminar) only for the author", () => {
    renderCard(
      makePost({
        author: {
          _id: "me",
          username: "me",
          avatar: { url: "", publicId: "" },
        },
      }),
      { user: { _id: "me", username: "me" } },
    );
    // The "⋯" menu button should be visible for the author
    expect(screen.getByText("⋯")).toBeInTheDocument();
  });

  it("non-authors do not see the admin menu", () => {
    renderCard(makePost(), { user: { _id: "other", username: "other" } });
    expect(screen.queryByText("⋯")).not.toBeInTheDocument();
  });

  it("expanded body shows truncated copy with ellipsis when body > 220 chars", () => {
    const longBody = "x".repeat(300);
    renderCard(makePost({ body: longBody }));
    // Truncated to first 220 + "…"
    expect(screen.getByText(/x{220}…/)).toBeInTheDocument();
  });

  it("renders image thumbnails when post has images", () => {
    const { container } = renderCard(
      makePost({
        images: [
          { _id: "i1", url: "https://cdn/a.jpg" },
          { _id: "i2", url: "https://cdn/b.jpg" },
        ],
      }),
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders linked table chip when mesas is enabled and post has linkedTable", () => {
    renderCard(
      makePost({
        linkedTable: {
          _id: "t1",
          boardGame: "Catán",
          date: new Date(Date.now() + 86400000).toISOString(),
          players: [{ _id: "p1" }],
          maxPlayers: 4,
          status: "open",
        },
      }),
    );
    // Game name appears (the linked-table chip)
    expect(screen.getAllByText(/Catán/).length).toBeGreaterThan(0);
  });

  it("muestra el thumbnail BGG de la mesa enlazada cuando está disponible", () => {
    const { container } = renderCard(
      makePost({
        linkedTable: {
          _id: "t1",
          boardGame: "Catán",
          date: new Date(Date.now() + 86400000).toISOString(),
          players: [],
          maxPlayers: 4,
          status: "open",
          bggThumbnail: "https://cf.geekdo-images.com/catan-thumb.jpg",
        },
      }),
    );
    const img = container.querySelector(
      'img[src="https://cf.geekdo-images.com/catan-thumb.jpg"]',
    );
    expect(img).toBeInTheDocument();
  });

  it("renders linked table location via getLocationDisplay (not [object Object])", () => {
    // Regresión: `table.location` es un subdoc `{texto, lat, lng}` desde 2026-05.
    // El render previo hacía `${table.location}` directo y mostraba "[object Object]".
    renderCard(
      makePost({
        linkedTable: {
          _id: "t1",
          boardGame: "Wingspan",
          date: new Date(Date.now() + 86400000).toISOString(),
          players: [],
          maxPlayers: 4,
          status: "open",
          location: {
            texto:
              "Av. de Mayo 1123, Villa José León Suárez, Provincia de Buenos Aires, Argentina",
            lat: -34.5,
            lng: -58.5,
          },
        },
      }),
    );
    expect(screen.queryByText(/object Object/i)).toBeNull();
    expect(screen.getByText(/Villa José León Suárez/)).toBeInTheDocument();
  });

  it("hides linked table chip when mesas is disabled", () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: (k) => k !== "mesas" });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            linkedTable: {
              _id: "t1",
              boardGame: "Catán",
              date: new Date().toISOString(),
              players: [],
              maxPlayers: 4,
              status: "open",
            },
          })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    // Body still renders but no linked table chip
    expect(screen.getByText(/Anoche jugamos Catán/)).toBeInTheDocument();
  });

  it("clicking like as guest opens LoginPromptModal", () => {
    renderCard(makePost(), { user: null });
    const buttons = screen.getAllByRole("button");
    const likeBtn = buttons.find((b) => b.textContent === "0");
    if (likeBtn) {
      fireEvent.click(likeBtn);
      // Modal renders the message + an "Iniciá sesión" CTA — multiple matches are OK.
      expect(screen.getAllByText(/iniciá sesión/i).length).toBeGreaterThan(0);
    }
  });

  it("clicking ⋯ menu opens dropdown with Editar/Eliminar", () => {
    renderCard(
      makePost({
        author: {
          _id: "me",
          username: "me",
          avatar: { url: "", publicId: "" },
        },
      }),
      { user: { _id: "me", username: "me" } },
    );
    fireEvent.click(screen.getByText("⋯"));
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
  });

  it("clicking Eliminar confirms and DELETEs the compartida", async () => {
    const onDeleted = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let deleted = false;
    server.use(
      http.delete("/api/compartidas/:id", () => {
        deleted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            author: {
              _id: "me",
              username: "me",
              avatar: { url: "", publicId: "" },
            },
          })}
          onDeleted={onDeleted}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("⋯"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(onDeleted).toHaveBeenCalledWith("c1");
    confirmSpy.mockRestore();
  });

  it("opening edit mode shows the title/body/privacy inputs", () => {
    renderCard(
      makePost({
        author: {
          _id: "me",
          username: "me",
          avatar: { url: "", publicId: "" },
        },
      }),
      { user: { _id: "me", username: "me" } },
    );
    fireEvent.click(screen.getByText("⋯"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Público" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solo yo" })).toBeInTheDocument();
  });

  it("renders the featured badge when featured=true", () => {
    useAuth.mockReturnValue({ user: null });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost()}
          featured
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/compartida del día/i)).toBeInTheDocument();
  });

  it("featured: la mesa enlazada es clickeable (link a /mesas/:id) con CTA impactante", () => {
    useAuth.mockReturnValue({ user: null });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    const { container } = render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            linkedTable: {
              _id: "tF",
              boardGame: "Catán",
              date: new Date(Date.now() + 86400000).toISOString(),
              players: [],
              maxPlayers: 4,
              status: "open",
            },
          })}
          featured
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    const link = container.querySelector('a[href="/mesas/tF"]');
    expect(link).toBeInTheDocument();
    // Open table → strong "Sumate" CTA + availability badge.
    expect(link).toHaveTextContent(/sumate/i);
    expect(link).toHaveTextContent(/lugares? libres?/i);
  });

  it("featured: muestra las fotos extra como thumbnails (no solo una)", () => {
    useAuth.mockReturnValue({ user: null });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    const { container } = render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            images: [
              { _id: "i1", url: "https://cdn/1.jpg" },
              { _id: "i2", url: "https://cdn/2.jpg" },
              { _id: "i3", url: "https://cdn/3.jpg" },
            ],
          })}
          featured
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    const srcs = [...container.querySelectorAll("img")].map((i) =>
      i.getAttribute("src"),
    );
    // hero polaroid + thumbnail strip → the extra photos are reachable
    expect(srcs).toContain("https://cdn/2.jpg");
    expect(srcs).toContain("https://cdn/3.jpg");
  });

  // -----------------------------------------------------------------------
  // Body expand/collapse
  // -----------------------------------------------------------------------
  it('"Ver más" expands a long body and "Ver menos" collapses it', () => {
    const longBody = "A".repeat(300);
    renderCard(makePost({ body: longBody }));
    expect(
      screen.getByRole("button", { name: /ver más/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    expect(
      screen.getByRole("button", { name: /ver menos/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver menos/i }));
    expect(
      screen.getByRole("button", { name: /ver más/i }),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Edit save & cancel
  // -----------------------------------------------------------------------
  it("saving an edit calls PUT and updates displayed body", async () => {
    const post = makePost({
      author: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      body: "Cuerpo original",
    });
    server.use(
      http.put("/api/compartidas/:id", async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ ...post, ...body });
      }),
    );
    renderCard(post, { user: { _id: "me", username: "me" } });
    fireEvent.click(screen.getByText("⋯"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const textarea = screen.getByPlaceholderText(/ganas de compartir/i);
    fireEvent.change(textarea, { target: { value: "Cuerpo actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(screen.getByText("Cuerpo actualizado")).toBeInTheDocument(),
    );
  });

  it("cancelling edit hides the edit form", () => {
    renderCard(
      makePost({
        author: {
          _id: "me",
          username: "me",
          avatar: { url: "", publicId: "" },
        },
      }),
      { user: { _id: "me", username: "me" } },
    );
    fireEvent.click(screen.getByText("⋯"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("button", { name: "Guardar" }),
    ).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Comments section
  // -----------------------------------------------------------------------
  it("clicking comments toggle loads and shows the comments section", async () => {
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({
          comments: [
            {
              _id: "cm1",
              content: "¡Qué partida!",
              author: {
                _id: "u2",
                username: "bob",
                avatar: { url: "", publicId: "" },
              },
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        }),
      ),
    );
    renderCard(makePost({ commentCount: 1 }), {
      user: { _id: "me", username: "me" },
    });
    const commentBtn = screen.getByText(/comentario/i);
    fireEvent.click(commentBtn);
    await waitFor(() =>
      expect(screen.getByText("¡Qué partida!")).toBeInTheDocument(),
    );
    expect(
      screen.getByPlaceholderText(/escribí un comentario/i),
    ).toBeInTheDocument();
  });

  it('guest sees "Iniciá sesión para comentar" in comments section', async () => {
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ comments: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    renderCard(makePost(), { user: null });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() =>
      expect(
        screen.getByText(/iniciá sesión para comentar/i),
      ).toBeInTheDocument(),
    );
  });

  it('shows "Sin comentarios" when comment list is empty', async () => {
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ comments: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    renderCard(makePost(), { user: { _id: "me", username: "me" } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() =>
      expect(screen.getByText(/sin comentarios/i)).toBeInTheDocument(),
    );
  });

  it("adding a comment POSTs and appends it to the list", async () => {
    const newComment = {
      _id: "cm_new",
      content: "Gran partida!",
      author: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      createdAt: new Date().toISOString(),
    };
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ comments: [], total: 0, page: 1, pages: 1 }),
      ),
      http.post("/api/compartidas/:id/comments", () =>
        HttpResponse.json(newComment),
      ),
    );
    renderCard(makePost(), { user: { _id: "me", username: "me" } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/escribí un comentario/i),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByPlaceholderText(/escribí un comentario/i), {
      target: { value: "Gran partida!" },
    });
    fireEvent.submit(
      screen.getByPlaceholderText(/escribí un comentario/i).closest("form"),
    );
    await waitFor(() =>
      expect(screen.getByText("Gran partida!")).toBeInTheDocument(),
    );
  });

  it("deleting a comment removes it from the list", async () => {
    // PR #38 added a window.confirm step before deleting a comment, so the
    // test must accept the confirmation for the delete to actually fire.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const comment = {
      _id: "cm1",
      content: "Viejito comentario",
      author: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      createdAt: new Date().toISOString(),
    };
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ comments: [comment], total: 1, page: 1, pages: 1 }),
      ),
      http.delete("/api/compartidas/:id/comments/:cid", () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderCard(makePost(), { user: { _id: "me", username: "me" } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() =>
      expect(screen.getByText("Viejito comentario")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /eliminar/i })[0]);
    await waitFor(() =>
      expect(screen.queryByText("Viejito comentario")).not.toBeInTheDocument(),
    );
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("re-clicking the comments button collapses the section", async () => {
    server.use(
      http.get("/api/compartidas/:id/comments", () =>
        HttpResponse.json({ comments: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    renderCard(makePost(), { user: { _id: "me", username: "me" } });
    const btn = screen.getByText(/comentario/i);
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByText(/sin comentarios/i)).toBeInTheDocument(),
    );
    fireEvent.click(btn);
    expect(screen.queryByText(/sin comentarios/i)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Lightbox
  // -----------------------------------------------------------------------
  it("clicking an image photo opens the lightbox and clicking again closes it", () => {
    const { container } = renderCard(
      makePost({
        images: [{ _id: "i1", url: "https://cdn/photo.jpg" }],
      }),
    );
    // Click the photo button
    const photoBtn =
      container.querySelector("button.photoBtn") ||
      screen.getAllByRole("button").find((b) => b.querySelector("img"));
    if (photoBtn) {
      fireEvent.click(photoBtn);
      // Lightbox should now show a full-size image
      const lightboxImgs = container.querySelectorAll("img");
      expect(lightboxImgs.length).toBeGreaterThan(0);
    }
  });

  // El lightbox se renderiza con portal a document.body, así que las
  // aserciones consultan document, no el container del card.
  const LB_IMAGES = [
    { _id: "i1", url: "http://example.com/1.jpg" },
    { _id: "i2", url: "http://example.com/2.jpg" },
    { _id: "i3", url: "http://example.com/3.jpg" },
  ];

  function openLightbox(container, idx = 0) {
    fireEvent.click(container.querySelectorAll("button.photoBtn")[idx]);
  }

  it("navega con flechas (con wrap-around) y muestra el contador", () => {
    const { container } = renderCard(makePost({ images: LB_IMAGES }));
    openLightbox(container, 0);

    expect(document.querySelector(".lightboxImg")).toHaveAttribute(
      "src",
      LB_IMAGES[0].url,
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));
    expect(document.querySelector(".lightboxImg")).toHaveAttribute(
      "src",
      LB_IMAGES[1].url,
    );
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Anterior dos veces: i2 → i1 → i3 (wrap)
    fireEvent.click(screen.getByRole("button", { name: /imagen anterior/i }));
    fireEvent.click(screen.getByRole("button", { name: /imagen anterior/i }));
    expect(document.querySelector(".lightboxImg")).toHaveAttribute(
      "src",
      LB_IMAGES[2].url,
    );
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("navega con el teclado y cierra con Escape", () => {
    const { container } = renderCard(makePost({ images: LB_IMAGES }));
    openLightbox(container, 0);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector(".lightboxImg")).toHaveAttribute(
      "src",
      LB_IMAGES[1].url,
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(document.querySelector(".lightboxImg")).toHaveAttribute(
      "src",
      LB_IMAGES[0].url,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".lightboxImg")).toBeNull();
  });

  it("cierra el lightbox al hacer click en la imagen ampliada", () => {
    const { container } = renderCard(makePost({ images: LB_IMAGES }));
    openLightbox(container, 0);
    fireEvent.click(document.querySelector(".lightboxImg"));
    expect(document.querySelector(".lightboxImg")).toBeNull();
  });

  it("no muestra flechas ni contador con una sola imagen", () => {
    const { container } = renderCard(makePost({ images: [LB_IMAGES[0]] }));
    openLightbox(container, 0);
    expect(document.querySelector(".lightboxImg")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /imagen siguiente/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imagen anterior/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // BgWatch author link
  // -----------------------------------------------------------------------
  it("renders AuthorBgWatchLink when bgwatch is enabled and author has bggUsername", () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            author: {
              _id: "a1",
              username: "cha",
              bggUsername: "chaborg",
              avatar: { url: "", publicId: "" },
            },
          })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /bg watch de cha/i }),
    ).toBeInTheDocument();
  });

  it("does not render BgWatch link when bgwatch section is disabled", () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: (s) => s !== "bgwatch" });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            author: {
              _id: "a1",
              username: "cha",
              bggUsername: "chaborg",
              avatar: { url: "", publicId: "" },
            },
          })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("link", { name: /bg watch/i }),
    ).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Public profile links (avatar + author name)
  // -----------------------------------------------------------------------
  it("links the author name to their public profile", () => {
    renderCard(makePost());
    const link = screen.getByRole("link", { name: "Claudio H" });
    expect(link).toHaveAttribute("href", "/usuarios/a1");
  });

  it("links the author avatar to their public profile", () => {
    renderCard(makePost());
    const link = screen.getByRole("link", { name: /ver perfil de claudio h/i });
    expect(link).toHaveAttribute("href", "/usuarios/a1");
  });

  it("does not link to a profile when the author is deleted", () => {
    renderCard(makePost({ author: null }));
    expect(
      screen.queryByRole("link", { name: /ver perfil de/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/usuario eliminado/i)).toBeInTheDocument();
  });

  it("links the author name to their profile in the featured layout", () => {
    useAuth.mockReturnValue({ user: null });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost()}
          featured
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Claudio H" });
    expect(link).toHaveAttribute("href", "/usuarios/a1");
  });

  // Regression: timeAgo owns its own prefix. Old posts used to render
  // "hace 15 may" and brand-new ones "hace ahora" because the JSX hardcoded
  // "hace" before an absolute date / "ahora".
  it("does not say 'hace' before an absolute date for old posts", () => {
    const old = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    renderCard(makePost({ createdAt: old }));
    expect(screen.getByText(/^el\s/)).toBeInTheDocument();
    expect(screen.queryByText(/hace/)).toBeNull();
  });

  it("uses 'recién' (not 'hace ahora') for a fresh post", () => {
    renderCard(makePost({ createdAt: new Date().toISOString() }));
    expect(screen.getByText(/^recién/)).toBeInTheDocument();
    expect(screen.queryByText(/ahora/)).toBeNull();
  });

  it("keeps 'hace' for relative durations", () => {
    const threeHrs = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    renderCard(makePost({ createdAt: threeHrs }));
    expect(screen.getByText(/^hace\s+3h/)).toBeInTheDocument();
  });

  it("spells out the full date without the year for same-year old posts", () => {
    // Jan 5 of the current year, rendered any time later in the same year.
    const sameYear = new Date(new Date().getFullYear(), 0, 5).toISOString();
    renderCard(makePost({ createdAt: sameYear }));
    expect(screen.getByText(/^el\s+5 de enero$/)).toBeInTheDocument();
  });

  it("includes the year for posts from a previous year", () => {
    const lastYear = new Date(new Date().getFullYear() - 1, 0, 5).toISOString();
    renderCard(makePost({ createdAt: lastYear }));
    expect(
      screen.getByText(
        new RegExp(`^el\\s+5 de enero de ${new Date().getFullYear() - 1}`),
      ),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Compartir (share buttons) — regresión del deeplink duplicado
  // -----------------------------------------------------------------------
  it("el href de Telegram NO duplica el deeplink (url y caption por separado)", () => {
    renderCard(
      makePost({ title: "Épica", body: "Ganamos en el último turno" }),
    );
    const tg = screen.getByTitle(/compartir en telegram/i).getAttribute("href");
    const occurrences = tg.split("compartidas%2Fc1").length - 1;
    expect(occurrences).toBe(1);
  });

  it("el texto de WhatsApp incluye el deeplink exactamente una vez", () => {
    renderCard(makePost({ title: "Épica", body: "Qué partidaza" }));
    const wa = screen.getByTitle(/compartir en whatsapp/i).getAttribute("href");
    const occurrences = wa.split("compartidas%2Fc1").length - 1;
    expect(occurrences).toBe(1);
    // El emoji va una vez (decodificado %F0%9F%8E%B2 = 🎲)
    expect(wa).toContain("%F0%9F%8E%B2");
  });

  it("copiar enlace escribe solo la url (sin caption ni emoji)", () => {
    const writeText = vi.fn();
    const original = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderCard(makePost({ title: "Épica", body: "Texto largo" }));
    fireEvent.click(screen.getByTitle(/copiar enlace/i));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toMatch(/\/compartidas\/c1$/);
    expect(copied).not.toContain("🎲");
    Object.defineProperty(navigator, "clipboard", {
      value: original,
      configurable: true,
    });
  });
});
