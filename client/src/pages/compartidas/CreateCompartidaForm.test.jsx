import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// Tiptap rompe en jsdom → mock simple con un textarea que llama onChange.
vi.mock("../../components/shared/RichTextEditor", () => ({
  default: ({ value, onChange, placeholder }) => (
    <textarea
      aria-label="editor reseña"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock del buscador BGG: botones que eligen juegos fijos (evita debounce/MSW).
vi.mock("../../components/shared/BggGameSearch", () => ({
  default: ({ onPick }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onPick({
            id: 13,
            name: "Catan",
            thumbnail: "t.jpg",
            image: "i.jpg",
            year: 1995,
          })
        }
      >
        mock-pick-game
      </button>
      <button
        type="button"
        onClick={() =>
          onPick({
            id: 99,
            name: "Wingspan",
            thumbnail: "w.jpg",
            image: "w.jpg",
            year: 2019,
          })
        }
      >
        mock-pick-game-2
      </button>
    </>
  ),
}));

// CommunitySelect uses CommunityContext + has its own test; stub it here.
vi.mock("../../components/shared/CommunitySelect", () => ({
  default: () => null,
}));

import CreateCompartidaForm from "./CreateCompartidaForm";
import { useAuth } from "../../context/AuthContext";

const baseUser = {
  _id: "me",
  username: "me",
  avatar: { url: "", publicId: "" },
};

function renderForm(props = {}) {
  useAuth.mockReturnValue({ user: baseUser });
  return render(
    <MemoryRouter>
      <CreateCompartidaForm onCreated={vi.fn()} onCancel={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe("<CreateCompartidaForm>", () => {
  it("renders title + body inputs + the photo button", () => {
    renderForm();
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /foto/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).toBeInTheDocument();
  });

  it("ya no tiene dropdowns de vincular mesa/evento (linking es solo contextual)", () => {
    renderForm();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/vincular mesa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vincular evento/i)).not.toBeInTheDocument();
  });

  it("submit button is disabled when all fields are empty", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).toBeDisabled();
  });

  it("typing a body enables the submit button", () => {
    renderForm();
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "Anoche jugamos…" } },
    );
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).not.toBeDisabled();
  });

  it("shows validation error when submitting completely empty (defensive)", () => {
    renderForm();
    const form = screen.getByPlaceholderText(/título/i).closest("form");
    fireEvent.submit(form);
    expect(
      screen.getByText(/agreg[aá] al menos un título, texto o foto/i),
    ).toBeInTheDocument();
  });

  it("changes privacy when clicking a privacy button", () => {
    renderForm();
    const friendsBtn = screen.getByRole("button", { name: "Amigos" });
    fireEvent.click(friendsBtn);
    expect(friendsBtn.className).toMatch(/active/i);
  });

  // ── Reseña vs juntada ────────────────────────────────────────────────
  it("default es juntada (textarea de juntada presente)", () => {
    renderForm();
    expect(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("editor reseña")).not.toBeInTheDocument();
  });

  it("al elegir Reseña aparece el editor enriquecido y la puntuación", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    expect(screen.getByLabelText("editor reseña")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
    ).not.toBeInTheDocument();
    // Pills de puntuación 1..10.
    expect(screen.getByRole("radio", { name: "8" })).toBeInTheDocument();
  });

  it("a11y: las flechas navegan el radiogroup de puntuación (roving tabindex)", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    // Sin puntuación elegida, el primer pill (1) es el único tabbable.
    expect(screen.getByRole("radio", { name: "1" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "2" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    // ArrowRight desde el 1 selecciona el 2.
    fireEvent.keyDown(screen.getByRole("radio", { name: "1" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("radio", { name: "2" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("la reseña oculta el control de foto separado", () => {
    renderForm(); // juntada: el botón Foto está presente
    expect(screen.getByRole("button", { name: /foto/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    expect(
      screen.queryByRole("button", { name: /foto/i }),
    ).not.toBeInTheDocument();
  });

  it("reseña sin juego: muestra error al enviar", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    fireEvent.change(screen.getByLabelText("editor reseña"), {
      target: { value: "<p>buena</p>" },
    });
    const form = document.querySelector("form");
    fireEvent.submit(form);
    expect(screen.getByText(/elegí un juego/i)).toBeInTheDocument();
  });

  it("reseña con juego pero sin puntuación: muestra error", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.change(screen.getByLabelText("editor reseña"), {
      target: { value: "<p>buena</p>" },
    });
    const form = document.querySelector("form");
    fireEvent.submit(form);
    expect(
      screen.getByText(/elegí una puntuación de 1 a 10/i),
    ).toBeInTheDocument();
  });

  it("reseña válida: el POST incluye category, boardGame y rating", async () => {
    const onCreated = vi.fn();
    let captured = null;
    server.use(
      http.post("/api/compartidas", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ _id: "r1", category: "resena", images: [] });
      }),
    );
    renderForm({ onCreated });
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.click(screen.getByRole("radio", { name: "9" }));
    fireEvent.change(screen.getByLabelText("editor reseña"), {
      target: { value: "<p>Excelente</p>" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(captured.category).toBe("resena");
    expect(captured.rating).toBe(9);
    expect(captured.boardGame.bggId).toBe(13);
    expect(captured.body).toContain("Excelente");
  });

  it("juntada permite agregar varios juegos y el POST manda boardGames", async () => {
    const onCreated = vi.fn();
    let captured = null;
    server.use(
      http.post("/api/compartidas", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ _id: "j1", images: [] });
      }),
    );
    renderForm({ onCreated }); // default = juntada
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "noche de juegos" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game-2" }));
    // Dos chips removibles.
    expect(
      screen.getByRole("button", { name: /quitar catan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quitar wingspan/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(captured.boardGames.map((g) => g.bggId)).toEqual([13, 99]);
    expect(captured.boardGame).toBeUndefined();
  });

  it("juntada dedupea el mismo juego", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    expect(
      screen.getAllByRole("button", { name: /quitar catan/i }),
    ).toHaveLength(1);
  });

  it("reseña acepta un solo juego (oculta el buscador tras elegir)", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    // Tras elegir 1, el buscador (sus botones mock) desaparece.
    expect(
      screen.queryByRole("button", { name: "mock-pick-game" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quitar catan/i }),
    ).toBeInTheDocument();
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("on success creates a compartida and calls onCreated", async () => {
    const onCreated = vi.fn();
    server.use(
      http.post("/api/compartidas", () =>
        HttpResponse.json({ _id: "new", body: "Anoche jugamos", images: [] }),
      ),
    );
    renderForm({ onCreated });
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "Anoche jugamos" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated.mock.calls[0][0]._id).toBe("new");
  });

  it("shows an error message when POST fails", async () => {
    const onCreated = vi.fn();
    server.use(
      http.post("/api/compartidas", () =>
        HttpResponse.json(
          { message: "Error al publicar la compartida" },
          { status: 500 },
        ),
      ),
    );
    renderForm({ onCreated });
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "Algo pasó" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/error al publicar la compartida/i),
      ).toBeInTheDocument(),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("adding a file shows the image count in the Foto button", () => {
    renderForm();
    const input = document.querySelector('input[type="file"]');
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByRole("button", { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument();
  });

  it("clicking ✕ on a preview removes that image", () => {
    renderForm();
    const input = document.querySelector('input[type="file"]');
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByRole("button", { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(
      screen.queryByRole("button", { name: /foto \(1\/3\)/i }),
    ).not.toBeInTheDocument();
  });

  it("Foto button is disabled when 3 images are already selected", () => {
    renderForm();
    const input = document.querySelector('input[type="file"]');
    const files = [
      new File(["1"], "p1.jpg", { type: "image/jpeg" }),
      new File(["2"], "p2.jpg", { type: "image/jpeg" }),
      new File(["3"], "p3.jpg", { type: "image/jpeg" }),
    ];
    fireEvent.change(input, { target: { files } });
    expect(
      screen.getByRole("button", { name: /foto \(3\/3\)/i }),
    ).toBeDisabled();
  });

  it("submit enabled after adding only an image (no text)", () => {
    renderForm();
    const input = document.querySelector('input[type="file"]');
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).not.toBeDisabled();
  });

  it("initialFiles siembra las fotos en el form (preview + contador)", () => {
    const file = new File(["img"], "fromcomposer.jpg", { type: "image/jpeg" });
    renderForm({ initialFiles: [file] });
    expect(
      screen.getByRole("button", { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).not.toBeDisabled();
  });

  // ── Linking contextual (chips) ───────────────────────────────────────
  it("prefilledTableId trae la mesa y renderiza el chip quitable", async () => {
    server.use(
      http.get("/api/tables/tPRE", () =>
        HttpResponse.json({
          _id: "tPRE",
          boardGame: "Pandemic",
          date: "2027-01-01",
          status: "open",
        }),
      ),
    );
    renderForm({ prefilledTableId: "tPRE" });
    expect(await screen.findByText(/mesa enlazada/i)).toBeInTheDocument();
    expect(screen.getByText("Pandemic")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quitar mesa enlazada/i }),
    ).toBeInTheDocument();
  });

  it("✕ del chip desvincula la mesa", async () => {
    server.use(
      http.get("/api/tables/tPRE", () =>
        HttpResponse.json({
          _id: "tPRE",
          boardGame: "Pandemic",
          date: "2027-01-01",
          status: "open",
        }),
      ),
    );
    renderForm({ prefilledTableId: "tPRE" });
    await screen.findByText(/mesa enlazada/i);
    fireEvent.click(
      screen.getByRole("button", { name: /quitar mesa enlazada/i }),
    );
    expect(screen.queryByText(/mesa enlazada/i)).not.toBeInTheDocument();
  });

  it("el POST incluye linkedTable cuando hay chip, y lo excluye tras quitarlo", async () => {
    let captured = null;
    server.use(
      http.get("/api/tables/tPRE", () =>
        HttpResponse.json({
          _id: "tPRE",
          boardGame: "Pandemic",
          date: "2027-01-01",
          status: "open",
        }),
      ),
      http.post("/api/compartidas", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ _id: "new", body: "x", images: [] });
      }),
    );
    const { rerender } = renderForm({ prefilledTableId: "tPRE" });
    await screen.findByText(/mesa enlazada/i);
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "x" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured.linkedTable).toBe("tPRE");

    // Ahora quitamos el chip y reenviamos → linkedTable ausente.
    captured = null;
    rerender(
      <MemoryRouter>
        <CreateCompartidaForm
          onCreated={vi.fn()}
          onCancel={vi.fn()}
          prefilledTableId="tPRE"
        />
      </MemoryRouter>,
    );
    await screen.findByText(/mesa enlazada/i);
    fireEvent.click(
      screen.getByRole("button", { name: /quitar mesa enlazada/i }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "y" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /publicar compartida/i }),
    );
    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured.linkedTable).toBeUndefined();
  });

  it("prefilledEventoId trae el evento y renderiza el chip", async () => {
    server.use(
      http.get("/api/eventos/evPRE", () =>
        HttpResponse.json({
          _id: "evPRE",
          title: "Sábado de mesas",
          eventDate: "2027-02-02",
        }),
      ),
    );
    renderForm({ prefilledEventoId: "evPRE" });
    expect(await screen.findByText(/evento enlazado/i)).toBeInTheDocument();
    expect(screen.getByText("Sábado de mesas")).toBeInTheDocument();
  });

  it("si la mesa prefilled no es accesible (404), no muestra chip", async () => {
    server.use(
      http.get("/api/tables/tBAD", () =>
        HttpResponse.json({ message: "No encontrada" }, { status: 404 }),
      ),
    );
    renderForm({ prefilledTableId: "tBAD" });
    await screen.findByPlaceholderText(/título/i);
    await waitFor(() =>
      expect(screen.queryByText(/mesa enlazada/i)).not.toBeInTheDocument(),
    );
  });

  // ── Hint del botón deshabilitado ──────────────────────────────────────
  it("juntada vacía: muestra el hint de qué falta y se habilita al escribir", () => {
    renderForm(); // arranca en juntada
    expect(screen.getByText(/^falta:/i)).toHaveTextContent(
      /un título, un texto o una foto/i,
    );
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/título/i), {
      target: { value: "Gran noche de juegos" },
    });
    expect(screen.queryByText(/^falta:/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).toBeEnabled();
  });

  it("reseña: el hint lista lo que falta y desaparece al completar todo", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    // Falta juego + puntuación + título/cuerpo.
    expect(screen.getByText(/^falta:/i)).toHaveTextContent(/el juego/i);
    expect(screen.getByText(/^falta:/i)).toHaveTextContent(/la puntuación/i);

    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    expect(screen.getByText(/^falta:/i)).not.toHaveTextContent(/el juego/i);

    fireEvent.click(screen.getByRole("radio", { name: "8" }));
    fireEvent.change(screen.getByLabelText("editor reseña"), {
      target: { value: "Muy bueno" },
    });

    expect(screen.queryByText(/^falta:/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publicar compartida/i }),
    ).toBeEnabled();
  });

  // ── Guardas de pérdida de datos ──────────────────────────────────────
  const bodyInput = () =>
    screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i);

  it("cambiar de tipo con contenido pide confirmación; al rechazar no cambia", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderForm(); // juntada
    fireEvent.change(bodyInput(), {
      target: { value: "Anoche jugamos algo épico" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    expect(confirmSpy).toHaveBeenCalled();
    // Sigue en juntada con el texto intacto.
    expect(bodyInput()).toHaveValue("Anoche jugamos algo épico");
    expect(screen.queryByLabelText("editor reseña")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("cambiar de tipo con contenido: si se confirma, cambia y limpia", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(bodyInput(), { target: { value: "Algo escrito" } });
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByLabelText("editor reseña")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("cambiar de tipo con el form vacío no pide confirmación", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /reseña/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("Cancelar con contenido pide confirmación; al rechazar no cierra", () => {
    const onCancel = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderForm({ onCancel });
    fireEvent.change(bodyInput(), { target: { value: "borrador" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("Cancelar con el form vacío cierra sin confirmar", () => {
    const onCancel = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
