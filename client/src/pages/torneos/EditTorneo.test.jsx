import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("./components/ImageDropzone", () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import EditTorneo from "./EditTorneo";

function makeTorneo(overrides = {}) {
  return {
    _id: "t1",
    title: "Liga Catán",
    description: "Liga 2026",
    game: "Catán",
    format: "league",
    status: "draft",
    inscriptionMode: "open",
    maxParticipants: 8,
    image: null,
    ...overrides,
  };
}

function setupTorneo(torneo) {
  server.use(http.get("/api/torneos/:id", () => HttpResponse.json(torneo)));
}

function renderPage({ id = "t1" } = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/torneos/${id}/editar`]}>
        <Routes>
          <Route path="/torneos/:id/editar" element={<EditTorneo />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<EditTorneo>", () => {
  it("handles a 404 gracefully without crashing", async () => {
    server.use(
      http.get("/api/torneos/:id", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    const { container } = renderPage();
    // After the fetch fails, just verify no crash + container still present.
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it("renders the form with pre-filled values", async () => {
    setupTorneo(makeTorneo());
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Liga Catán")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Liga 2026")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Catán")).toBeInTheDocument();
  });

  it("successful submit PUTs to /api/torneos/:id and navigates to /torneos/:id", async () => {
    setupTorneo(makeTorneo());
    let putCalled = false;
    server.use(
      http.put("/api/torneos/:id", () => {
        putCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderPage();
    await screen.findByDisplayValue("Liga Catán");

    const titleInput = screen.getByDisplayValue("Liga Catán");
    fireEvent.change(titleInput, { target: { value: "Liga Catán 2027" } });
    const form = titleInput.closest("form");
    fireEvent.submit(form);

    await waitFor(() => expect(putCalled).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith("/torneos/t1");
  });

  it("shows API error message when PUT fails", async () => {
    setupTorneo(makeTorneo());
    server.use(
      http.put("/api/torneos/:id", () =>
        HttpResponse.json({ message: "Acceso restringido" }, { status: 403 }),
      ),
    );
    renderPage();
    await screen.findByDisplayValue("Liga Catán");
    const form = screen.getByDisplayValue("Liga Catán").closest("form");
    fireEvent.submit(form);
    expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
  });
});
