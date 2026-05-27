import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

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
  return render(<TableGallery {...defaults} {...props} />);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("<TableGallery>", () => {
  it("renderiza empty state cuando no hay imágenes y puede subir", () => {
    renderGallery();
    expect(
      screen.getByText(/Todavía no hay fotos. ¡Subí la primera!/i),
    ).toBeInTheDocument();
  });

  it("renderiza empty state distinto cuando NO puede subir", () => {
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
