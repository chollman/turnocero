import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ListFilters from "./ListFilters";

const CHIPS = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "mine", label: "Mis cosas", requiresAuth: true },
  { value: "draft", label: "Borradores", adminOnly: true },
];

function renderFilters(props = {}) {
  return render(
    <MemoryRouter>
      <ListFilters
        chips={CHIPS}
        activeChip="open"
        onChipChange={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

function openPopover() {
  fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
}

describe("<ListFilters>", () => {
  describe("trigger + popover state", () => {
    it("does not render the popover content by default", () => {
      renderFilters({ isAuthenticated: true });
      expect(
        screen.queryByRole("dialog", { name: /filtros de la lista/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /abiertos/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking the trigger opens the popover", () => {
      renderFilters({ isAuthenticated: true });
      openPopover();
      expect(
        screen.getByRole("dialog", { name: /filtros de la lista/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /abiertos/i }),
      ).toBeInTheDocument();
    });

    it("clicking the trigger again closes the popover (toggle)", () => {
      renderFilters({ isAuthenticated: true });
      openPopover();
      openPopover();
      expect(
        screen.queryByRole("dialog", { name: /filtros de la lista/i }),
      ).not.toBeInTheDocument();
    });

    it("pressing Escape closes the popover", () => {
      renderFilters({ isAuthenticated: true });
      openPopover();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: /filtros de la lista/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking outside the wrapper closes the popover", () => {
      renderFilters({ isAuthenticated: true });
      openPopover();
      fireEvent.mouseDown(document.body);
      expect(
        screen.queryByRole("dialog", { name: /filtros de la lista/i }),
      ).not.toBeInTheDocument();
    });

    it("aria-expanded reflects open state", () => {
      renderFilters({ isAuthenticated: true });
      const trigger = screen.getByRole("button", { name: /^filtros/i });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("active-filter badge", () => {
    it("does not render the badge when the chip matches defaultChip and radius is 0", () => {
      renderFilters({
        isAuthenticated: true,
        defaultChip: "open",
        activeChip: "open",
        showDistance: true,
        hasDireccion: true,
        radiusKm: 0,
      });
      expect(
        screen.queryByLabelText(/filtros activos/i),
      ).not.toBeInTheDocument();
    });

    it("counts a non-default chip as 1 active filter", () => {
      renderFilters({
        isAuthenticated: true,
        defaultChip: "open",
        activeChip: "closed",
      });
      expect(screen.getByLabelText(/1 filtros activos/i)).toHaveTextContent(
        "1",
      );
    });

    it("counts a non-zero radius as 1 active filter (in addition to chip)", () => {
      renderFilters({
        isAuthenticated: true,
        defaultChip: "open",
        activeChip: "closed",
        showDistance: true,
        hasDireccion: true,
        radiusKm: 25,
      });
      expect(screen.getByLabelText(/2 filtros activos/i)).toHaveTextContent(
        "2",
      );
    });

    it("ignores radius for the count when hasDireccion is false", () => {
      renderFilters({
        isAuthenticated: true,
        defaultChip: "open",
        activeChip: "open",
        showDistance: true,
        hasDireccion: false,
        radiusKm: 25,
      });
      expect(
        screen.queryByLabelText(/filtros activos/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("chips visibility (inside popover)", () => {
    it("hides adminOnly chips for non-admin users", () => {
      renderFilters({ isAdmin: false, isAuthenticated: true });
      openPopover();
      expect(
        screen.queryByRole("button", { name: /borradores/i }),
      ).not.toBeInTheDocument();
    });

    it("shows adminOnly chips for admin users", () => {
      renderFilters({ isAdmin: true, isAuthenticated: true });
      openPopover();
      expect(
        screen.getByRole("button", { name: /borradores/i }),
      ).toBeInTheDocument();
    });

    it("hides requiresAuth chips for unauthenticated visitors", () => {
      renderFilters({ isAdmin: false, isAuthenticated: false });
      openPopover();
      expect(
        screen.queryByRole("button", { name: /mis cosas/i }),
      ).not.toBeInTheDocument();
    });

    it("shows requiresAuth chips for authenticated users", () => {
      renderFilters({ isAdmin: false, isAuthenticated: true });
      openPopover();
      expect(
        screen.getByRole("button", { name: /mis cosas/i }),
      ).toBeInTheDocument();
    });
  });

  describe("chip interaction", () => {
    it("calls onChipChange with the chip value when clicked", () => {
      const onChipChange = vi.fn();
      renderFilters({ onChipChange, isAuthenticated: true });
      openPopover();
      fireEvent.click(screen.getByRole("button", { name: /todos/i }));
      expect(onChipChange).toHaveBeenCalledWith("all");
    });

    it("marks the active chip with aria-pressed=true", () => {
      renderFilters({ activeChip: "open", isAuthenticated: true });
      openPopover();
      expect(screen.getByRole("button", { name: /abiertos/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: /todos/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("popover stays open after picking a chip (so the user can keep tuning filters)", () => {
      const onChipChange = vi.fn();
      renderFilters({ onChipChange, isAuthenticated: true });
      openPopover();
      fireEvent.click(screen.getByRole("button", { name: /todos/i }));
      expect(
        screen.getByRole("dialog", { name: /filtros de la lista/i }),
      ).toBeInTheDocument();
    });
  });

  describe("distance section visibility", () => {
    it("does not render the distance section when showDistance is false", () => {
      renderFilters({ showDistance: false });
      openPopover();
      expect(screen.queryByLabelText(/radio máximo/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /aumentar radio/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the distance section when showDistance is true", () => {
      renderFilters({ showDistance: true, hasDireccion: true });
      openPopover();
      expect(screen.getByLabelText(/radio máximo/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /aumentar radio/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /disminuir radio/i }),
      ).toBeInTheDocument();
    });
  });

  describe("distance section — no direccion", () => {
    it("shows the 'Agregá tu dirección' CTA linking to /perfil", () => {
      renderFilters({ showDistance: true, hasDireccion: false });
      openPopover();
      expect(screen.getByText(/agregá tu dirección/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /tu perfil/i })).toHaveAttribute(
        "href",
        "/perfil",
      );
    });

    it("disables slider and ± buttons", () => {
      renderFilters({ showDistance: true, hasDireccion: false });
      openPopover();
      expect(screen.getByLabelText(/radio máximo/i)).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /disminuir radio/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /aumentar radio/i }),
      ).toBeDisabled();
    });
  });

  describe("distance section — with direccion", () => {
    it("calls onRadiusChange when the slider moves", () => {
      const onRadiusChange = vi.fn();
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 0,
        onRadiusChange,
      });
      openPopover();
      fireEvent.change(screen.getByLabelText(/radio máximo/i), {
        target: { value: "25" },
      });
      expect(onRadiusChange).toHaveBeenCalledWith(25);
    });

    it("the + button increments radiusKm by 1 km", () => {
      const onRadiusChange = vi.fn();
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 5,
        onRadiusChange,
      });
      openPopover();
      fireEvent.click(screen.getByRole("button", { name: /aumentar radio/i }));
      expect(onRadiusChange).toHaveBeenCalledWith(6);
    });

    it("the − button decrements radiusKm by 1 km", () => {
      const onRadiusChange = vi.fn();
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 5,
        onRadiusChange,
      });
      openPopover();
      fireEvent.click(screen.getByRole("button", { name: /disminuir radio/i }));
      expect(onRadiusChange).toHaveBeenCalledWith(4);
    });

    it("− button is disabled at the lower bound (0) and clamps", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 0,
      });
      openPopover();
      expect(
        screen.getByRole("button", { name: /disminuir radio/i }),
      ).toBeDisabled();
    });

    it("+ button is disabled at the upper bound (maxRadiusKm)", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 100,
        maxRadiusKm: 100,
      });
      openPopover();
      expect(
        screen.getByRole("button", { name: /aumentar radio/i }),
      ).toBeDisabled();
    });

    it("respects a custom maxRadiusKm", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 50,
        maxRadiusKm: 50,
      });
      openPopover();
      expect(
        screen.getByRole("button", { name: /aumentar radio/i }),
      ).toBeDisabled();
    });
  });

  describe("radius value display", () => {
    it("shows 'Sin límite' when radiusKm is 0", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 0,
      });
      openPopover();
      expect(screen.getByText(/sin límite/i)).toBeInTheDocument();
    });

    it("shows 'X km' when radiusKm is > 0", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 25,
      });
      openPopover();
      expect(screen.getByText("25 km")).toBeInTheDocument();
    });

    it("label shows the current radius when hasDireccion and radiusKm > 0", () => {
      renderFilters({
        showDistance: true,
        hasDireccion: true,
        radiusKm: 42,
      });
      openPopover();
      expect(screen.getByText(/menos de 42 km/i)).toBeInTheDocument();
    });
  });
});
