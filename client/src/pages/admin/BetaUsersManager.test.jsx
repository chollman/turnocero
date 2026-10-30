import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { AllProviders } from "../../test/wrappers/AllProviders";

const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));

import BetaUsersManager from "./BetaUsersManager";

const LIST = "/api/admin/beta/bgwatchAgent/usuarios";
const ana = { _id: "a1", username: "ana", displayName: "Ana" };
const beto = { _id: "b2", username: "beto", displayName: "Beto" };

let enabled;
function mockApi({ listFails = false } = {}) {
  server.use(
    http.get(LIST, () =>
      listFails
        ? HttpResponse.json({ message: "boom" }, { status: 500 })
        : HttpResponse.json(enabled),
    ),
    http.put(`${LIST}/:id`, ({ params }) => {
      const u = [ana, beto].find((x) => x._id === params.id);
      enabled = [...enabled, u];
      return HttpResponse.json(u);
    }),
    http.delete(`${LIST}/:id`, ({ params }) => {
      enabled = enabled.filter((u) => u._id !== params.id);
      return HttpResponse.json({ _id: params.id });
    }),
    http.get("/api/users", ({ request }) => {
      const q = new URL(request.url).searchParams.get("search") || "";
      return HttpResponse.json(
        [ana, beto].filter((u) => u.username.includes(q.toLowerCase())),
      );
    }),
  );
}

function renderManager() {
  return render(
    <AllProviders>
      <BetaUsersManager feature="bgwatchAgent" />
    </AllProviders>,
  );
}

beforeEach(() => {
  addToast.mockClear();
  enabled = [ana];
});

describe("BetaUsersManager", () => {
  it("lists the enabled users with a count", async () => {
    mockApi();
    renderManager();
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("1 usuario")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    enabled = [];
    mockApi();
    renderManager();
    expect(
      await screen.findByText("Todavía no habilitaste a nadie."),
    ).toBeInTheDocument();
  });

  it("shows an error when the list fails to load", async () => {
    mockApi({ listFails: true });
    renderManager();
    expect(
      await screen.findByText("No se pudo cargar la lista."),
    ).toBeInTheDocument();
  });

  it("asks for 2 letters before searching", async () => {
    mockApi();
    renderManager();
    await screen.findByText("Ana");
    fireEvent.change(screen.getByLabelText("Agregar usuario"), {
      target: { value: "b" },
    });
    expect(screen.getByText("Escribí al menos 2 letras.")).toBeInTheDocument();
  });

  it("adds a user from the search and marks already-enabled ones", async () => {
    mockApi();
    renderManager();
    await screen.findByText("Ana");
    fireEvent.change(screen.getByLabelText("Agregar usuario"), {
      target: { value: "an" },
    });
    // Ana ya está habilitada: sin botón de agregar.
    expect(await screen.findByText("Habilitado")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Agregar usuario"), {
      target: { value: "be" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    await waitFor(() =>
      expect(screen.getByText("2 usuarios")).toBeInTheDocument(),
    );
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
    expect(screen.getByLabelText("Agregar usuario")).toHaveValue("");
  });

  it("removes a user", async () => {
    mockApi();
    renderManager();
    fireEvent.click(
      await screen.findByRole("button", { name: "Quitar a Ana" }),
    );
    expect(
      await screen.findByText("Todavía no habilitaste a nadie."),
    ).toBeInTheDocument();
  });
});
