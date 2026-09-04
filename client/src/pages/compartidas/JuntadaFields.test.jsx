import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../components/shared/BggGameSearch", () => ({
  default: () => <div data-testid="bgg-game-search" />,
}));

import JuntadaFields from "./JuntadaFields";

const baseValue = {
  privacy: "public",
  games: [],
  title: "",
  body: "",
  images: [],
};

function setup(overrides = {}, props = {}) {
  const onChange = vi.fn();
  const value = { ...baseValue, ...overrides };
  render(
    <JuntadaFields value={value} onChange={onChange} {...props} />,
  );
  return { onChange, value };
}

describe("<JuntadaFields> — basic fields", () => {
  it("renders privacy buttons, title and body inputs", () => {
    setup();
    expect(screen.getByText("Público")).toBeInTheDocument();
    expect(screen.getByText("Amigos")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/contá cómo salió/i),
    ).toBeInTheDocument();
  });

  it("calls onChange with the updated title", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByPlaceholderText(/título/i), {
      target: { value: "Juntada épica" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Juntada épica" }),
    );
  });
});

describe("<JuntadaFields> — Instagram cross-post toggle", () => {
  it("renders nothing when instagramAvailable is false (default)", () => {
    setup({ privacy: "public", images: [{ file: new File([], "a.jpg") }] });
    expect(screen.queryByText(/publicar también en instagram/i)).not.toBeInTheDocument();
  });

  it("shows a hint (no checkboxes) when the post isn't public", () => {
    setup(
      { privacy: "friends", images: [{ file: new File([], "a.jpg") }] },
      { instagramAvailable: true },
    );
    expect(
      screen.getByText(/solo las juntadas públicas/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^feed$/i)).not.toBeInTheDocument();
  });

  it("shows a hint (no checkboxes) when there are no photos", () => {
    setup({ privacy: "public", images: [] }, { instagramAvailable: true });
    expect(
      screen.getByText(/agregá al menos una foto/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^feed$/i)).not.toBeInTheDocument();
  });

  it("shows Feed/Historias checkboxes when public with a photo", () => {
    setup(
      { privacy: "public", images: [{ file: new File([], "a.jpg") }] },
      { instagramAvailable: true },
    );
    expect(screen.getByText(/publicar también en instagram/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /feed/i })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /historias/i }),
    ).toBeInTheDocument();
  });

  it("toggling Feed calls onChange with crosspostInstagram.feed=true, preserving story", () => {
    const { onChange } = setup(
      {
        privacy: "public",
        images: [{ file: new File([], "a.jpg") }],
        crosspostInstagram: { feed: false, story: true },
      },
      { instagramAvailable: true },
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /^feed$/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        crosspostInstagram: { feed: true, story: true },
      }),
    );
  });

  it("toggling Historias calls onChange with crosspostInstagram.story=true", () => {
    const { onChange } = setup(
      { privacy: "public", images: [{ file: new File([], "a.jpg") }] },
      { instagramAvailable: true },
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /historias/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        crosspostInstagram: { feed: false, story: true },
      }),
    );
  });

  it("disables both checkboxes when disabled prop is set", () => {
    setup(
      { privacy: "public", images: [{ file: new File([], "a.jpg") }] },
      { instagramAvailable: true, disabled: true },
    );
    expect(screen.getByRole("checkbox", { name: /^feed$/i })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /historias/i }),
    ).toBeDisabled();
  });
});
