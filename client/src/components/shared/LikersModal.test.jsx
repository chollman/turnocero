import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { RouterOnly } from "../../test/wrappers/AllProviders";
import LikersModal from "./LikersModal";

const URL = "/api/compartidas/c1/likes";

const renderModal = (props = {}) =>
  render(
    <LikersModal
      isOpen
      onClose={vi.fn()}
      title="A quién le gustó"
      fetchUrl={URL}
      {...props}
    />,
    { wrapper: RouterOnly },
  );

describe("<LikersModal>", () => {
  it("no renderiza nada cuando isOpen es false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lista los likers tras el fetch", async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({
          users: [
            { _id: "u1", username: "ana", displayName: "Ana", avatar: {} },
            { _id: "u2", username: "beto", displayName: "", avatar: {} },
          ],
        }),
      ),
    );
    renderModal();
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("beto")).toBeInTheDocument();
    // Link al perfil público.
    expect(screen.getByText("Ana").closest("a")).toHaveAttribute(
      "href",
      "/usuarios/u1",
    );
  });

  it("muestra el estado vacío cuando no hay likers", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ users: [] })));
    renderModal();
    expect(
      await screen.findByText(/todavía no le gustó a nadie/i),
    ).toBeInTheDocument();
  });

  it("muestra error si el fetch falla", async () => {
    server.use(http.get(URL, () => new HttpResponse(null, { status: 500 })));
    renderModal();
    expect(
      await screen.findByText(/no pudimos cargar la lista/i),
    ).toBeInTheDocument();
  });

  it("dispara onClose al clickear el botón cerrar", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ users: [] })));
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
