import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UserRef from "./UserRef";
import { RouterOnly } from "../../test/wrappers/AllProviders";
import { makeUser } from "../../test/factories/users";

describe("<UserRef>", () => {
  it("renders a link to /usuarios/<id> with the display name", () => {
    const user = makeUser({ _id: "abc123", displayName: "Claudio H" });
    render(<UserRef user={user} />, { wrapper: RouterOnly });
    const link = screen.getByRole("link", { name: "Claudio H" });
    expect(link).toHaveAttribute("href", "/usuarios/abc123");
  });

  it("falls back to username when displayName is empty", () => {
    const user = makeUser({ username: "cha", displayName: "" });
    render(<UserRef user={user} />, { wrapper: RouterOnly });
    expect(screen.getByRole("link", { name: "cha" })).toBeInTheDocument();
  });

  it("renders a deleted-user label when user is null", () => {
    render(<UserRef user={null} />, { wrapper: RouterOnly });
    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
    // No link rendered for deleted users
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a deleted-user label when user has no _id", () => {
    render(<UserRef user={{ username: "orphan" }} />, { wrapper: RouterOnly });
    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
  });

  it("respects noLink (renders a span instead of a link)", () => {
    const user = makeUser({ username: "cha", displayName: "Cha H" });
    render(<UserRef user={user} noLink />, { wrapper: RouterOnly });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Cha H")).toBeInTheDocument();
  });

  it("shows @username when showAt is true", () => {
    const user = makeUser({ username: "cha", displayName: "Claudio" });
    render(<UserRef user={user} showAt />, { wrapper: RouterOnly });
    expect(screen.getByRole("link", { name: "@cha" })).toBeInTheDocument();
  });
});
