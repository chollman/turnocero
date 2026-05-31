import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { RouterOnly } from "../../test/wrappers/AllProviders";

import TableGallery from "./TableGallery";

function makeImg(id, overrides = {}) {
  return {
    _id: id,
    url: `https://cdn.test/${id}.jpg`,
    publicId: id,
    uploader: { _id: "u1", username: "alguien" },
    ...overrides,
  };
}

function renderGallery(props = {}) {
  const defaults = {
    tableId: "t1",
    images: [],
    canUpload: true,
    canDeleteImage: () => true,
    onImagesChange: vi.fn(),
  };
  return render(<TableGallery {...defaults} {...props} />, {
    wrapper: RouterOnly,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("<TableGallery>", () => {
  it("muestra el tile de upload (sin texto de empty) cuando no hay imágenes y puede subir", () => {
    renderGallery();
    expect(
      screen.getByRole("button", { name: /\+ Foto/i }),
    ).toBeInTheDocument();
    // El texto "Todavía no hay fotos" ya no se renderiza cuando hay tile.
    expect(screen.queryByText(/Todavía no hay fotos/i)).not.toBeInTheDocument();
  });

  it("renderiza empty state con texto cuando NO puede subir", () => {
    renderGallery({ canUpload: false });
    expect(screen.getByText(/^Todavía no hay fotos\.$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ Foto/ }),
    ).not.toBeInTheDocument();
  });

  // El badge "X/10" vivía en el galleryHeader interno, pero ahora el header
  // de la sección lo provee el padre (TableDetail → sectionHead). El
  // componente solo se encarga de renderizar las miniaturas.
  it("renderiza las imágenes", () => {
    renderGallery({ images: [makeImg("i1"), makeImg("i2")] });
    expect(screen.getAllByAltText(/Foto de la mesa/i)).toHaveLength(2);
  });

  it("abre el lightbox al click sobre un thumbnail y cierra al click en el overlay", () => {
    renderGallery({ images: [makeImg("i1")] });
    const thumb = screen.getByAltText(/Foto de la mesa/i);
    fireEvent.click(thumb);
    expect(screen.getByAltText(/Vista ampliada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByAltText(/Vista ampliada/i).parentElement);
    expect(screen.queryByAltText(/Vista ampliada/i)).not.toBeInTheDocument();
  });

  it("cierra el lightbox al hacer click sobre la propia imagen ampliada", () => {
    renderGallery({ images: [makeImg("i1"), makeImg("i2")] });
    fireEvent.click(screen.getAllByAltText(/Foto de la mesa/i)[0]);
    expect(screen.getByAltText(/Vista ampliada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByAltText(/Vista ampliada/i));
    expect(screen.queryByAltText(/Vista ampliada/i)).not.toBeInTheDocument();
  });

  it("no muestra flechas ni contador con una sola imagen", () => {
    renderGallery({ images: [makeImg("i1")] });
    fireEvent.click(screen.getByAltText(/Foto de la mesa/i));
    expect(
      screen.queryByRole("button", { name: /imagen siguiente/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imagen anterior/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it("navega a la siguiente y anterior imagen con las flechas (con wrap-around)", () => {
    const images = [makeImg("i1"), makeImg("i2"), makeImg("i3")];
    renderGallery({ images });
    // Abre en la primera imagen
    fireEvent.click(screen.getAllByAltText(/Foto de la mesa/i)[0]);
    expect(screen.getByAltText(/Vista ampliada/i)).toHaveAttribute(
      "src",
      images[0].url,
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Siguiente → i2
    fireEvent.click(screen.getByRole("button", { name: /imagen siguiente/i }));
    expect(screen.getByAltText(/Vista ampliada/i)).toHaveAttribute(
      "src",
      images[1].url,
    );
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Anterior dos veces → i2 → i1 → i3 (wrap)
    fireEvent.click(screen.getByRole("button", { name: /imagen anterior/i }));
    fireEvent.click(screen.getByRole("button", { name: /imagen anterior/i }));
    expect(screen.getByAltText(/Vista ampliada/i)).toHaveAttribute(
      "src",
      images[2].url,
    );
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("navega con las flechas del teclado y cierra con Escape", () => {
    const images = [makeImg("i1"), makeImg("i2")];
    renderGallery({ images });
    fireEvent.click(screen.getAllByAltText(/Foto de la mesa/i)[0]);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText(/Vista ampliada/i)).toHaveAttribute(
      "src",
      images[1].url,
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByAltText(/Vista ampliada/i)).toHaveAttribute(
      "src",
      images[0].url,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByAltText(/Vista ampliada/i)).not.toBeInTheDocument();
  });

  it("cierra el lightbox con el botón de cerrar", () => {
    renderGallery({ images: [makeImg("i1"), makeImg("i2")] });
    fireEvent.click(screen.getAllByAltText(/Foto de la mesa/i)[0]);
    fireEvent.click(screen.getByRole("button", { name: /^cerrar$/i }));
    expect(screen.queryByAltText(/Vista ampliada/i)).not.toBeInTheDocument();
  });

  it("dispara onImagesChange después de DELETE exitoso", async () => {
    server.use(
      http.delete("/api/tables/:id/images/:imgId", () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );
    const onImagesChange = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const images = [makeImg("i1"), makeImg("i2")];
    renderGallery({ images, onImagesChange });

    const deleteButtons = screen.getAllByRole("button", {
      name: /eliminar imagen/i,
    });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(onImagesChange).toHaveBeenCalledWith([images[1]]);
    });
  });

  it("muestra error si el DELETE falla", async () => {
    server.use(
      http.delete("/api/tables/:id/images/:imgId", () =>
        HttpResponse.json({ message: "No autorizado" }, { status: 403 }),
      ),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderGallery({ images: [makeImg("i1")] });
    fireEvent.click(screen.getByRole("button", { name: /eliminar imagen/i }));
    await waitFor(() => {
      expect(screen.getByText("No autorizado")).toBeInTheDocument();
    });
  });

  it("no muestra el botón delete cuando canDeleteImage es false para esa imagen", () => {
    renderGallery({
      images: [makeImg("i1")],
      canDeleteImage: () => false,
    });
    expect(
      screen.queryByRole("button", { name: /eliminar imagen/i }),
    ).not.toBeInTheDocument();
  });
});
