import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import TableRatings from "./TableRatings";

const user = {
  _id: "user1",
  username: "tester",
  avatar: { url: "", publicId: "" },
};

const other = {
  _id: "u2",
  username: "otro",
  avatar: { url: "", publicId: "" },
};

function setupRatings(payload = { ratings: [], avg: null, count: 0 }) {
  server.use(
    http.get("/api/tables/:id/ratings", () => HttpResponse.json(payload)),
  );
}

function renderRatings(props = {}) {
  return render(
    <TableRatings tableId="t1" user={user} canRate={false} {...props} />,
  );
}

beforeEach(() => {
  setupRatings();
});

describe("<TableRatings>", () => {
  it("muestra empty state cuando no hay valoraciones", async () => {
    renderRatings();
    await waitFor(() => {
      expect(
        screen.getByText(/Todavía no hay valoraciones/i),
      ).toBeInTheDocument();
    });
  });

  it("muestra el promedio y el contador cuando hay ratings", async () => {
    setupRatings({
      ratings: [
        { _id: "r1", rater: other, score: 4, comment: "Bien" },
        { _id: "r2", rater: { _id: "u3", username: "z" }, score: 5 },
      ],
      avg: 4.5,
      count: 2,
    });
    renderRatings();
    await screen.findByText("Bien");
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it("oculta el form si canRate=false", async () => {
    renderRatings({ canRate: false });
    await waitFor(() => {
      expect(screen.queryByText(/Tu puntuación/i)).not.toBeInTheDocument();
    });
  });

  it("muestra el form si canRate=true y permite seleccionar estrellas", async () => {
    renderRatings({ canRate: true });
    await screen.findByText(/Tu puntuación/i);
    const star4 = screen.getByLabelText("4 estrellas");
    fireEvent.click(star4);
    expect(
      screen.getByRole("button", { name: /enviar valoración/i }),
    ).not.toBeDisabled();
  });

  it("envía la valoración y refresca avg/count", async () => {
    server.use(
      http.post("/api/tables/:id/ratings", () =>
        HttpResponse.json({
          rating: {
            _id: "r-new",
            rater: user,
            score: 5,
            comment: "Genial",
          },
          avg: 5,
          count: 1,
        }),
      ),
    );
    renderRatings({ canRate: true });
    await screen.findByText(/Tu puntuación/i);
    fireEvent.click(screen.getByLabelText("5 estrellas"));
    fireEvent.change(screen.getByPlaceholderText(/Comentario opcional/i), {
      target: { value: "Genial" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar valoración/i }));
    await waitFor(() => {
      expect(screen.getByText("Genial")).toBeInTheDocument();
    });
  });

  it("muestra error si el POST falla", async () => {
    server.use(
      http.post("/api/tables/:id/ratings", () =>
        HttpResponse.json({ message: "Solo participantes" }, { status: 403 }),
      ),
    );
    renderRatings({ canRate: true });
    await screen.findByText(/Tu puntuación/i);
    fireEvent.click(screen.getByLabelText("3 estrellas"));
    fireEvent.click(screen.getByRole("button", { name: /enviar valoración/i }));
    await waitFor(() => {
      expect(screen.getByText("Solo participantes")).toBeInTheDocument();
    });
  });

  it("precarga score/comentario si el user ya tiene una valoración", async () => {
    setupRatings({
      ratings: [{ _id: "r1", rater: user, score: 4, comment: "Bueno" }],
      avg: 4,
      count: 1,
    });
    renderRatings({ canRate: true });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Bueno")).toBeInTheDocument();
    });
  });
});
