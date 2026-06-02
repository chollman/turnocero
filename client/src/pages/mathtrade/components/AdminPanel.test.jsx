import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import AdminPanel from "./AdminPanel";
import { useNotifications } from "../../../context/NotificationContext";

beforeEach(() => {
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

const renderPanel = (trade, onUpdated = vi.fn()) =>
  render(
    <MemoryRouter>
      <AdminPanel trade={trade} onUpdated={onUpdated} />
    </MemoryRouter>,
  );

const baseTrade = {
  _id: "m1",
  status: "draft",
  matching: { mode: "max", maxChainLength: 4 },
};

describe("AdminPanel", () => {
  it("muestra la acción de abrir inscripción en draft", () => {
    renderPanel(baseTrade);
    expect(screen.getByText("Abrir inscripción")).toBeInTheDocument();
  });

  it("cambia de estado y llama onUpdated", async () => {
    server.use(
      http.patch("/api/mathtrade/m1/status", () =>
        HttpResponse.json({ ...baseTrade, status: "open" }),
      ),
    );
    const onUpdated = vi.fn();
    renderPanel(baseTrade, onUpdated);
    fireEvent.click(screen.getByText("Abrir inscripción"));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(onUpdated.mock.calls[0][0].status).toBe("open");
  });

  it("en locked muestra controles de matching + preview", () => {
    renderPanel({ ...baseTrade, status: "locked" });
    expect(screen.getByText("Probar matching (preview)")).toBeInTheDocument();
    expect(screen.getByText("Publicar resultados")).toBeInTheDocument();
  });

  it("al publicar corre el matching y luego cambia a results", async () => {
    const calls = [];
    server.use(
      http.post("/api/mathtrade/m1/run-matching", async () => {
        calls.push("run");
        return HttpResponse.json({ summary: {} });
      }),
      http.patch("/api/mathtrade/m1/status", () => {
        calls.push("status");
        return HttpResponse.json({ ...baseTrade, status: "results" });
      }),
    );
    const onUpdated = vi.fn();
    renderPanel({ ...baseTrade, status: "locked" }, onUpdated);
    fireEvent.click(screen.getByText("Publicar resultados"));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(calls).toEqual(["run", "status"]); // run primero, luego status
  });
});
