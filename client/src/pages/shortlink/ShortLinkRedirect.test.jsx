import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import ShortLinkRedirect from "./ShortLinkRedirect";

vi.mock("../error/NotFound", () => ({
  default: () => <div>NOT FOUND STUB</div>,
}));

function renderAt(code) {
  return render(
    <MemoryRouter initialEntries={[`/s/${code}`]}>
      <Routes>
        <Route path="/s/:code" element={<ShortLinkRedirect />} />
        <Route
          path="/compartidas/:id"
          element={<div>COMPARTIDA PAGE</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<ShortLinkRedirect>", () => {
  it("resolves the code and navigates to the canonical path", async () => {
    server.use(
      http.get("/api/shortlinks/:code", () =>
        HttpResponse.json({
          type: "compartida",
          ref: "abc",
          path: "/compartidas/abc",
        }),
      ),
    );
    renderAt("Ab3xK9");
    await waitFor(() =>
      expect(screen.getByText("COMPARTIDA PAGE")).toBeInTheDocument(),
    );
  });

  it("shows NotFound when the code does not resolve", async () => {
    server.use(
      http.get(
        "/api/shortlinks/:code",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    renderAt("bad");
    await waitFor(() =>
      expect(screen.getByText("NOT FOUND STUB")).toBeInTheDocument(),
    );
  });
});
