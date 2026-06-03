import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityContext } from "../../context/CommunityContext";
import ItemCommunityTag from "./ItemCommunityTag";

const rosario = {
  _id: "c1",
  name: "Rosario Juega",
  slug: "rosario-juega",
  skin: {},
};
const base = { _id: "c0", name: "TurnoCero", slug: "turnocero", skin: {} };

function renderWithCtx(ctxValue, props) {
  return render(
    <CommunityContext.Provider value={ctxValue}>
      <ItemCommunityTag {...props} />
    </CommunityContext.Provider>,
  );
}

const ctx = (overrides = {}) => ({
  effectiveViewing: ["c0", "c1"],
  communityById: new Map([
    ["c0", base],
    ["c1", rosario],
  ]),
  ...overrides,
});

describe("<ItemCommunityTag>", () => {
  it("renders nothing without a CommunityProvider (null-safe in tests)", () => {
    const { container } = render(<ItemCommunityTag communityId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no communityId is given", () => {
    const { container } = renderWithCtx(ctx(), {});
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when viewing a single community", () => {
    const { container } = renderWithCtx(
      ctx({ effectiveViewing: ["c1"] }),
      { communityId: "c1" },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the community name when viewing multiple communities", () => {
    renderWithCtx(ctx(), { communityId: "c1" });
    expect(screen.getByText("Rosario Juega")).toBeInTheDocument();
  });

  it("tags base community items too", () => {
    renderWithCtx(ctx(), { communityId: "c0" });
    expect(screen.getByText("TurnoCero")).toBeInTheDocument();
  });

  it("accepts a populated community object as communityId", () => {
    renderWithCtx(ctx(), { communityId: { _id: "c1" } });
    expect(screen.getByText("Rosario Juega")).toBeInTheDocument();
  });

  it("renders nothing when the community id is not resolvable", () => {
    const { container } = renderWithCtx(ctx(), { communityId: "ghost" });
    expect(container).toBeEmptyDOMElement();
  });
});
