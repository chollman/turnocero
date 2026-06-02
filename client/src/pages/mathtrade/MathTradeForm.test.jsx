import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

const navigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigate,
}));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../torneos/components/ImageDropzone", () => ({
  default: () => <div data-testid="dropzone" />,
}));
vi.mock("../../components/shared/DateTimePicker", () => ({
  default: ({ value, onChange }) => (
    <input
      aria-label="deadline"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import MathTradeForm from "./MathTradeForm";
import { useNotifications } from "../../context/NotificationContext";

let addToast;
beforeEach(() => {
  navigate.mockClear();
  addToast = vi.fn();
  useNotifications.mockReturnValue({ addToast });
});

const renderForm = (props) =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <MathTradeForm {...props} />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("MathTradeForm", () => {
  it("avisa por toast si falta el título", () => {
    renderForm({ mode: "create" });
    fireEvent.click(screen.getByText("Crear intercambio"));
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("ofrece el modo Automática como opción", () => {
    renderForm({ mode: "create" });
    expect(screen.getByText(/Automática/)).toBeInTheDocument();
  });

  it("muestra el input de máx. cadena solo en modo acotado", () => {
    renderForm({ mode: "create" });
    expect(
      screen.queryByLabelText("Máximo de personas por cadena"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Cadena acotada"));
    expect(
      screen.getByLabelText("Máximo de personas por cadena"),
    ).toBeInTheDocument();
  });

  it("crea el intercambio y navega al detalle", async () => {
    server.use(
      http.post("/api/mathtrade", () =>
        HttpResponse.json({ _id: "m9" }, { status: 201 }),
      ),
    );
    renderForm({ mode: "create" });
    fireEvent.change(screen.getByPlaceholderText(/Math Trade de fin/), {
      target: { value: "Mi trade" },
    });
    fireEvent.click(screen.getByText("Crear intercambio"));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/math-trade/m9"),
    );
  });
});
