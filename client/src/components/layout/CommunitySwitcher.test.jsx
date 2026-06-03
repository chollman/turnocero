import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import CommunitySwitcher from "./CommunitySwitcher";
import { useCommunity } from "../../context/CommunityContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";

const MEMBERSHIPS = [
  {
    community: { _id: "a", name: "Rosario Juega", slug: "rosario-juega" },
    role: "member",
  },
  {
    community: { _id: "b", name: "Club Ñandú", slug: "club-nandu" },
    role: "member",
  },
];

function setup({
  community = {},
  sectionEnabled = true,
  onNavigate,
} = {}) {
  useSiteConfig.mockReturnValue({
    isSectionEnabled: () => sectionEnabled,
  });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
  useCommunity.mockReturnValue({
    memberships: MEMBERSHIPS,
    viewing: [],
    skin: "a",
    skinCommunity: MEMBERSHIPS[0].community,
    setViewingPref: vi.fn().mockResolvedValue({}),
    setSkinPref: vi.fn().mockResolvedValue({}),
    loaded: true,
    ...community,
  });
  return render(
    <MemoryRouter>
      <CommunitySwitcher onNavigate={onNavigate} />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("<CommunitySwitcher>", () => {
  it("renders nothing when the comunidades section is disabled", () => {
    const { container } = setup({ sectionEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing before the context has loaded", () => {
    const { container } = setup({ community: { loaded: false } });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the user has no memberships", () => {
    const { container } = setup({ community: { memberships: [] } });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the user belongs to a single community", () => {
    const { container } = setup({
      community: {
        memberships: [MEMBERSHIPS[0]],
        skinCommunity: MEMBERSHIPS[0].community,
        skin: "a",
      },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the active skin community name on the trigger", () => {
    setup();
    expect(screen.getByLabelText("Cambiar de comunidad")).toBeInTheDocument();
    expect(screen.getByText("Rosario Juega")).toBeInTheDocument();
  });

  it("opens the panel and lists the user's communities", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Cambiar de comunidad"));
    expect(screen.getByText("Club Ñandú")).toBeInTheDocument();
    // The skin community shows "Aspecto activo"; the other shows "Usar aspecto".
    expect(screen.getByText("Aspecto activo")).toBeInTheDocument();
    expect(screen.getByText("Usar aspecto")).toBeInTheDocument();
  });

  it("changing the skin calls setSkinPref with the chosen community", async () => {
    const setSkinPref = vi.fn().mockResolvedValue({});
    setup({ community: { setSkinPref } });
    fireEvent.click(screen.getByLabelText("Cambiar de comunidad"));
    fireEvent.click(screen.getByRole("button", { name: "Usar aspecto" }));
    await waitFor(() => expect(setSkinPref).toHaveBeenCalledWith("b"));
  });

  it("unchecking a community calls setViewingPref without it", async () => {
    const setViewingPref = vi.fn().mockResolvedValue({});
    setup({ community: { setViewingPref } });
    fireEvent.click(screen.getByLabelText("Cambiar de comunidad"));
    // viewing=[] => all checked; uncheck the second (Club Ñandú).
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    await waitFor(() => expect(setViewingPref).toHaveBeenCalledWith(["a"]));
  });

  it('the "Ver todas" link points to /comunidades and calls onNavigate', () => {
    const onNavigate = vi.fn();
    setup({ onNavigate });
    fireEvent.click(screen.getByLabelText("Cambiar de comunidad"));
    const link = screen.getByRole("menuitem", {
      name: /ver todas las comunidades/i,
    });
    expect(link).toHaveAttribute("href", "/comunidades");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });

  it("closes the panel on Escape", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Cambiar de comunidad"));
    expect(screen.getByText("Club Ñandú")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Club Ñandú")).not.toBeInTheDocument();
  });
});
