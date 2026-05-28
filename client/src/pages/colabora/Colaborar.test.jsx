import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import Colaborar from "./Colaborar";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

let addToast;

function setUser(u) {
  useAuth.mockReturnValue({ user: u });
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Colaborar />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  addToast = vi.fn();
  useNotifications.mockReturnValue({ addToast });
  setUser(null);
});

describe("<Colaborar>", () => {
  it("renders the hero, cafecito CTA and ideas form", () => {
    renderPage();
    // El título contiene "Turnocero" envuelto en un <em>, así que matcheamos
    // por el <h1> en lugar de buscar el string completo (que se rompe por
    // los nodos hijos).
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/bancá a turnocero/i);
    const cafecitoLink = screen.getByRole("link", { name: /cafecito/i });
    expect(cafecitoLink).toHaveAttribute("target", "_blank");
    expect(cafecitoLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(cafecitoLink).toHaveAttribute("href", expect.stringContaining("cafecito.app"));
    expect(screen.getByLabelText(/tu idea/i)).toBeInTheDocument();
  });

  it("shows the optional email field for guests", () => {
    setUser(null);
    renderPage();
    expect(screen.getByLabelText(/email \(opcional\)/i)).toBeInTheDocument();
  });

  it("hides the email field for authed users", () => {
    setUser({ _id: "u1", username: "pepe" });
    renderPage();
    expect(screen.queryByLabelText(/email \(opcional\)/i)).not.toBeInTheDocument();
  });

  it("submits the form when content is long enough", async () => {
    let received = null;
    server.use(
      http.post("/api/ideas", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ message: "ok" }, { status: 201 });
      }),
    );

    renderPage();
    fireEvent.change(screen.getByLabelText(/tu idea/i), {
      target: { value: "Estaría genial que la app pudiera filtrar por categoría." },
    });
    fireEvent.click(screen.getByRole("button", { name: /mandar idea/i }));

    await waitFor(() => expect(received).not.toBeNull());
    expect(received.content).toContain("Estaría genial");
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
    // Reset del form tras éxito
    expect(screen.getByLabelText(/tu idea/i)).toHaveValue("");
  });

  it("does not submit when content is shorter than the minimum", () => {
    const onPost = vi.fn();
    server.use(
      http.post("/api/ideas", async () => {
        onPost();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderPage();
    fireEvent.change(screen.getByLabelText(/tu idea/i), {
      target: { value: "hola" },
    });
    const btn = screen.getByRole("button", { name: /mandar idea/i });
    // El botón está disabled — el guard por longitud lo cubre, no se llama el endpoint.
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPost).not.toHaveBeenCalled();
  });

  it("shows an error toast when the server fails", async () => {
    server.use(
      http.post("/api/ideas", () =>
        HttpResponse.json({ message: "Algo se rompió." }, { status: 500 }),
      ),
    );

    renderPage();
    fireEvent.change(screen.getByLabelText(/tu idea/i), {
      target: { value: "Una idea suficientemente larga para mandar." },
    });
    fireEvent.click(screen.getByRole("button", { name: /mandar idea/i }));

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
  });

  it("sends the email field when guest provides one", async () => {
    let received = null;
    server.use(
      http.post("/api/ideas", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ message: "ok" }, { status: 201 });
      }),
    );

    renderPage();
    fireEvent.change(screen.getByLabelText(/tu idea/i), {
      target: { value: "Idea con email asociado para que me respondan." },
    });
    fireEvent.change(screen.getByLabelText(/email \(opcional\)/i), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mandar idea/i }));

    await waitFor(() => expect(received).not.toBeNull());
    expect(received.email).toBe("alice@example.com");
  });
});
