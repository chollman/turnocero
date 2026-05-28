import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import TableMap from "./TableMap";

const HOST = {
  _id: "h1",
  username: "thehost",
  avatar: { url: "", publicId: "" },
};
const P1 = {
  _id: "p1",
  username: "player1",
  avatar: { url: "", publicId: "" },
};
const ME = { _id: "me", username: "meself", avatar: { url: "", publicId: "" } };

describe("<TableMap>", () => {
  it("renders an SVG container with the table elipse", () => {
    const { container } = render(
      <TableMap host={HOST} players={[]} maxPlayers={3} game="Catán" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // The center tile rect must exist.
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders one seat per total slot (host + maxPlayers)", () => {
    const { container } = render(
      <TableMap host={HOST} players={[P1]} maxPlayers={3} game="Catán" />,
    );
    // 4 seats expected (host + 1 player + 2 empty).
    const initials = container.querySelectorAll('[class*="seatInitial"]');
    expect(initials.length).toBe(4);
  });

  it("renders the host with a crown label", () => {
    const { container } = render(
      <TableMap host={HOST} players={[]} maxPlayers={2} game="Catán" />,
    );
    expect(container.textContent).toContain("♦ HOST");
  });

  it("renders 'lugar libre' labels for unfilled seats", () => {
    const { container } = render(
      <TableMap host={HOST} players={[]} maxPlayers={2} game="Catán" />,
    );
    // host + 2 empty seats — 2 "lugar libre" labels.
    const occurrences = container.textContent.match(/lugar libre/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it("renders a halo (animate element) when currentUser is at the table", () => {
    const { container } = render(
      <TableMap
        host={HOST}
        players={[ME]}
        maxPlayers={3}
        game="Catán"
        currentUserId="me"
      />,
    );
    const animate = container.querySelector("animate");
    expect(animate).not.toBeNull();
  });

  it("does NOT render a halo when currentUser is not at the table", () => {
    const { container } = render(
      <TableMap
        host={HOST}
        players={[P1]}
        maxPlayers={3}
        game="Catán"
        currentUserId="me"
      />,
    );
    expect(container.querySelector("animate")).toBeNull();
  });

  it("uses '@' prefix for non-empty seat labels", () => {
    const { container } = render(
      <TableMap host={HOST} players={[]} maxPlayers={2} game="Catán" />,
    );
    expect(container.textContent).toContain("@thehost");
  });

  it("renders the bgg image clipped at the center when imageUrl is provided", () => {
    const { container } = render(
      <TableMap
        host={HOST}
        players={[]}
        maxPlayers={2}
        game="Catán"
        imageUrl="https://example.com/catan.jpg"
      />,
    );
    const img = container.querySelector("image");
    expect(img).not.toBeNull();
    expect(img.getAttribute("href")).toBe("https://example.com/catan.jpg");
    // clipPath def must exist alongside it.
    expect(container.querySelector("clipPath")).not.toBeNull();
  });

  it("does NOT render an <image> tag when no imageUrl is provided", () => {
    const { container } = render(
      <TableMap host={HOST} players={[]} maxPlayers={2} game="Catán" />,
    );
    expect(container.querySelector("image")).toBeNull();
  });

  it("renders the user's avatar clipped to the seat circle when available", () => {
    const HOST_WITH_AVATAR = {
      _id: "h2",
      username: "withavatar",
      avatar: {
        url: "https://example.com/avatar.webp",
        publicId: "users/h2/avatar",
      },
    };
    const { container } = render(
      <TableMap host={HOST_WITH_AVATAR} players={[]} maxPlayers={2} />,
    );
    const avatarImg = container.querySelector(
      'image[href="https://example.com/avatar.webp"]',
    );
    expect(avatarImg).not.toBeNull();
    // clipPath that matches the seat radius (7) must exist.
    const clipCircle = container.querySelector('clipPath circle[r="7"]');
    expect(clipCircle).not.toBeNull();
  });

  it("hides the seat initial text when the user has a custom avatar", () => {
    const HOST_WITH_AVATAR = {
      _id: "h2",
      username: "withavatar",
      avatar: {
        url: "https://example.com/avatar.webp",
        publicId: "users/h2/avatar",
      },
    };
    const { container } = render(
      <TableMap host={HOST_WITH_AVATAR} players={[]} maxPlayers={2} />,
    );
    // 1 host seat with avatar + 2 empty seats with "?" initials = 2 initials.
    const initials = container.querySelectorAll('[class*="seatInitial"]');
    expect(initials.length).toBe(2);
  });
});
