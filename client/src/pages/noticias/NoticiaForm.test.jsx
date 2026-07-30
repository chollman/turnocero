import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { AllProviders } from "../../test/wrappers/AllProviders";

const addToast = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "admin", isAdmin: true, displayName: "Admin" },
  }),
}));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));
vi.mock("../../components/shared/CommunitySelect", () => ({
  default: () => null,
}));

import NoticiaForm from "./NoticiaForm";

function renderForm(props = {}) {
  return render(
    <AllProviders initialEntries={["/noticias/crear"]}>
      <Routes>
        <Route path="/noticias/crear" element={<NoticiaForm {...props} />} />
        <Route path="/noticias/:id" element={<div>detalle</div>} />
      </Routes>
    </AllProviders>,
  );
}

describe("<NoticiaForm>", () => {
  beforeEach(() => addToast.mockClear());

  it("renders the core fields", () => {
    renderForm();
    expect(screen.getByText("Nueva noticia")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/el titular/i)).toBeInTheDocument();
    expect(screen.getByText("Cuerpo")).toBeInTheDocument();
  });

  it("adds and removes tag chips", () => {
    renderForm();
    const tagInput = screen.getByPlaceholderText(/torneo, reseña/i);
    fireEvent.change(tagInput, { target: { value: "torneo" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    expect(screen.getByText("#torneo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /quitar torneo/i }));
    expect(screen.queryByText("#torneo")).not.toBeInTheDocument();
  });

  it("toggles the live preview", () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/el titular/i), {
      target: { value: "Mi titular" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }));
    expect(
      screen.getByRole("heading", { name: "Mi titular" }),
    ).toBeInTheDocument();
  });

  it("validates that something was entered before publishing", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
  });

  it("publishes a noticia (POST) and toasts success", async () => {
    server.use(
      http.post("/api/noticias", () => HttpResponse.json({ _id: "nNEW" })),
    );
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/el titular/i), {
      target: { value: "Una nota publicada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
  });

  it("saves a draft via the secondary button", async () => {
    let body = null;
    server.use(
      http.post("/api/noticias", async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ _id: "nDRAFT" });
      }),
    );
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/el titular/i), {
      target: { value: "Borrador" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar borrador/i }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body.get("status")).toBe("draft");
  });

  it("prefills fields in edit mode", () => {
    renderForm({
      mode: "edit",
      id: "n1",
      initial: {
        title: "Editando esto",
        dek: "Bajada previa",
        category: "evento",
        tags: ["x"],
        body: "cuerpo",
      },
    });
    expect(screen.getByDisplayValue("Editando esto")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bajada previa")).toBeInTheDocument();
    expect(screen.getByText("#x")).toBeInTheDocument();
    expect(screen.getByText("Editar noticia")).toBeInTheDocument();
  });
});
