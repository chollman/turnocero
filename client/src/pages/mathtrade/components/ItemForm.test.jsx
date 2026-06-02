import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../../components/shared/BggGameSearch", () => ({
  default: ({ onPick, placeholder }) => (
    <button
      type="button"
      onClick={() => onPick({ id: 7, name: "Azul", thumbnail: "" })}
    >
      pick:{placeholder}
    </button>
  ),
}));

import ItemForm from "./ItemForm";
import { useNotifications } from "../../../context/NotificationContext";

let addToast;
beforeEach(() => {
  addToast = vi.fn();
  useNotifications.mockReturnValue({ addToast });
});

describe("ItemForm", () => {
  it("avisa por toast si falta el juego ofrecido", () => {
    render(<ItemForm mathtradeId="m1" />);
    fireEvent.click(screen.getByText("Agregar oferta"));
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("avisa si la want list está vacía", () => {
    render(<ItemForm mathtradeId="m1" />);
    // elegir juego ofrecido (primer picker)
    fireEvent.click(screen.getByText(/pick:Buscá el juego/));
    fireEvent.click(screen.getByText("Agregar oferta"));
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("postea la oferta y llama onSaved", async () => {
    server.use(
      http.post("/api/mathtrade/m1/items", async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ _id: "i1", ...body }, { status: 201 });
      }),
    );
    const onSaved = vi.fn();
    render(<ItemForm mathtradeId="m1" onSaved={onSaved} />);

    // ofrecido
    fireEvent.click(screen.getByText(/pick:Buscá el juego/));
    // want
    fireEvent.click(screen.getByText(/pick:Agregá un juego/));
    fireEvent.click(screen.getByText("Agregar oferta"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][0]._id).toBe("i1");
  });
});
