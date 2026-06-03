import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
import { useCommunity } from "../../context/CommunityContext";
import CommunitySelect from "./CommunitySelect";

const two = [
  { community: { _id: "base1", name: "TurnoCero" } },
  { community: { _id: "beta1", name: "Beta" } },
];

beforeEach(() => vi.clearAllMocks());

describe("<CommunitySelect>", () => {
  it("renders nothing with a single membership", () => {
    useCommunity.mockReturnValue({
      memberships: [two[0]],
      skin: "base1",
    });
    const { container } = render(
      <CommunitySelect value="" onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists memberships and defaults the selection to the skin", () => {
    useCommunity.mockReturnValue({ memberships: two, skin: "beta1" });
    render(<CommunitySelect value="" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    expect(select.value).toBe("beta1");
    expect(screen.getByText("TurnoCero")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("reflects an explicit value over the skin", () => {
    useCommunity.mockReturnValue({ memberships: two, skin: "beta1" });
    render(<CommunitySelect value="base1" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox").value).toBe("base1");
  });

  it("calls onChange with the picked community id", () => {
    const onChange = vi.fn();
    useCommunity.mockReturnValue({ memberships: two, skin: "base1" });
    render(<CommunitySelect value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "beta1" },
    });
    expect(onChange).toHaveBeenCalledWith("beta1");
  });
});
