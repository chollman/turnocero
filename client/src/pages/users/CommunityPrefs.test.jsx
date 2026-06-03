import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import CommunityPrefs from "./CommunityPrefs";

const twoMemberships = [
  {
    community: { _id: "base1", name: "TurnoCero", slug: "turnocero", isBase: true },
    role: "member",
  },
  {
    community: { _id: "beta1", name: "Beta", slug: "beta", isBase: false },
    role: "subadmin",
  },
];

const renderPrefs = () =>
  render(
    <MemoryRouter>
      <CommunityPrefs />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

describe("<CommunityPrefs>", () => {
  it("renders nothing with a single membership", () => {
    useCommunity.mockReturnValue({
      memberships: [twoMemberships[0]],
      viewing: [],
      skin: "base1",
      setViewingPref: vi.fn(),
      setSkinPref: vi.fn(),
      leaveCommunity: vi.fn(),
    });
    const { container } = renderPrefs();
    expect(container).toBeEmptyDOMElement();
  });

  it("lists memberships (with role) and persists a viewing toggle", async () => {
    const setViewingPref = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships: twoMemberships,
      viewing: [],
      skin: "beta1",
      setViewingPref,
      setSkinPref: vi.fn().mockResolvedValue({}),
      leaveCommunity: vi.fn().mockResolvedValue({}),
    });
    renderPrefs();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Subadmin")).toBeInTheDocument();

    // viewing vacío = todas tildadas → destildar la base
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(setViewingPref).toHaveBeenCalled());
    // Quedó solo beta1 seleccionada
    expect(setViewingPref).toHaveBeenCalledWith(["beta1"]);
  });

  it("changes the skin via the radio", async () => {
    const setSkinPref = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships: twoMemberships,
      viewing: [],
      skin: "beta1",
      setViewingPref: vi.fn().mockResolvedValue({}),
      setSkinPref,
      leaveCommunity: vi.fn().mockResolvedValue({}),
    });
    renderPrefs();
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]); // base
    await waitFor(() => expect(setSkinPref).toHaveBeenCalledWith("base1"));
  });

  it("leaves a non-base community after confirming in the modal", async () => {
    const leaveCommunity = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships: twoMemberships,
      viewing: [],
      skin: "beta1",
      setViewingPref: vi.fn(),
      setSkinPref: vi.fn(),
      leaveCommunity,
    });
    renderPrefs();
    // Solo Beta (no base) tiene botón Salir → abre el modal de confirmación.
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(leaveCommunity).not.toHaveBeenCalled();
    expect(screen.getByText("Salir de la comunidad")).toBeInTheDocument();
    // Confirmar en el modal.
    fireEvent.click(screen.getByRole("button", { name: "Sí, salir" }));
    await waitFor(() => expect(leaveCommunity).toHaveBeenCalledWith("beta"));
  });

  it("cancelling the leave modal does not call leaveCommunity", async () => {
    const leaveCommunity = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships: twoMemberships,
      viewing: [],
      skin: "beta1",
      setViewingPref: vi.fn(),
      setSkinPref: vi.fn(),
      leaveCommunity,
    });
    renderPrefs();
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(leaveCommunity).not.toHaveBeenCalled();
    expect(screen.queryByText("Salir de la comunidad")).not.toBeInTheDocument();
  });
});
