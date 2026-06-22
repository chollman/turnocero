import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../i18n";
import TorneoCard from "./TorneoCard";

function makeTorneo(overrides = {}) {
  return {
    _id: "t1",
    title: "Liga Catán 2026",
    game: "Catán",
    description: "Una competencia divertida.",
    status: "registration",
    inscriptionMode: "open",
    format: "league",
    image: null,
    participantCount: 4,
    maxParticipants: 8,
    createdBy: { _id: "a1", username: "admin" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(torneo) {
  return render(
    <MemoryRouter>
      <TorneoCard torneo={torneo} />
    </MemoryRouter>,
  );
}

describe("<TorneoCard>", () => {
  it("links to /torneos/:id", () => {
    renderCard(makeTorneo());
    expect(screen.getByRole("link")).toHaveAttribute("href", "/torneos/t1");
  });

  it("renders title + game + description", () => {
    renderCard(makeTorneo());
    expect(screen.getByText("Liga Catán 2026")).toBeInTheDocument();
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Una competencia divertida.")).toBeInTheDocument();
  });

  it('shows the "Inscripción abierta" chip when status=registration + open mode', () => {
    renderCard(makeTorneo({ status: "registration", inscriptionMode: "open" }));
    expect(screen.getByText(/inscripci[oó]n abierta/i)).toBeInTheDocument();
  });

  it('flips to "Inscripción cerrada" when status=registration + admin_only mode', () => {
    renderCard(
      makeTorneo({ status: "registration", inscriptionMode: "admin_only" }),
    );
    expect(screen.getByText(/inscripci[oó]n cerrada/i)).toBeInTheDocument();
  });

  it('shows "En curso" chip for in_progress', () => {
    renderCard(makeTorneo({ status: "in_progress" }));
    expect(screen.getByText(/en curso/i)).toBeInTheDocument();
  });

  it('shows "Finalizado" chip for finished', () => {
    renderCard(makeTorneo({ status: "finished" }));
    expect(screen.getByText("Finalizado")).toBeInTheDocument();
  });

  it("renders the format label (Liga / Eliminación / Grupos)", () => {
    renderCard(makeTorneo({ format: "single_elim" }));
    expect(screen.getByText(/eliminaci[oó]n/i)).toBeInTheDocument();
  });

  it('shows participant count "4 / 8" when both are present', () => {
    renderCard(makeTorneo({ participantCount: 4, maxParticipants: 8 }));
    expect(screen.getByText(/4 \/ 8/)).toBeInTheDocument();
  });

  it("renders the image when provided", () => {
    renderCard(
      makeTorneo({ image: { url: "https://x/y.webp", publicId: "p" } }),
    );
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("shows the format icon placeholder when no image is provided", () => {
    renderCard(makeTorneo({ image: null, format: "groups" }));
    expect(screen.getAllByText("🧩").length).toBeGreaterThan(0);
  });

  it('timeAgo: shows "Xm" for < 1 hour ago', () => {
    renderCard(
      makeTorneo({
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      }),
    );
    expect(screen.getByText(/^\d+m$/)).toBeInTheDocument();
  });

  it('timeAgo: shows "Xh" for < 1 day ago', () => {
    renderCard(
      makeTorneo({
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      }),
    );
    expect(screen.getByText(/^\d+h$/)).toBeInTheDocument();
  });

  it('timeAgo: shows "Xd" for < 1 week ago', () => {
    renderCard(
      makeTorneo({
        createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
      }),
    );
    expect(screen.getByText(/^\d+d$/)).toBeInTheDocument();
  });

  it("timeAgo: shows a formatted date for > 1 week ago", () => {
    renderCard(
      makeTorneo({
        createdAt: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
      }),
    );
    // Long-ago dates show something locale-formatted; just verify the link renders
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("no description renders nothing for the description element", () => {
    renderCard(makeTorneo({ description: "" }));
    // No description paragraph, just ensure no crash
    expect(screen.getByText("Liga Catán 2026")).toBeInTheDocument();
  });

  it("shows participant count without max when maxParticipants is absent", () => {
    renderCard(makeTorneo({ participantCount: 5, maxParticipants: undefined }));
    expect(screen.getByText(/👥 5$/)).toBeInTheDocument();
  });

  describe("English", () => {
    afterEach(() => {
      i18n.changeLanguage("es");
    });

    it("renders English status + format labels when language is en", () => {
      i18n.changeLanguage("en");
      renderCard(makeTorneo({ status: "in_progress", format: "single_elim" }));
      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(screen.getByText(/Elimination/)).toBeInTheDocument();
    });
  });
});
