import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

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
});
