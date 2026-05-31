import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResolvedRow from "./ResolvedRow";

const wrap = (ui) => render(<ul>{ui}</ul>);

describe("<ResolvedRow>", () => {
  it("friend_request + accept → 'Ahora sos amigo de'", () => {
    wrap(
      <ResolvedRow
        notif={{ type: "friend_request", fromUsername: "bob" }}
        action="accept"
      />,
    );
    expect(screen.getByText(/ahora sos amigo de bob/i)).toBeInTheDocument();
  });

  it("join_request + accept → 'Aceptaste a X en <mesa>'", () => {
    wrap(
      <ResolvedRow
        notif={{
          type: "join_request",
          tableName: "Catán",
          actors: [{ userId: "u1", username: "lu" }],
        }}
        action="accept"
      />,
    );
    expect(screen.getByText(/aceptaste a lu en catán/i)).toBeInTheDocument();
  });

  it("reject → 'Listo, lo descartamos'", () => {
    wrap(
      <ResolvedRow
        notif={{ type: "friend_request", fromUsername: "x" }}
        action="reject"
      />,
    );
    expect(screen.getByText(/listo, lo descartamos/i)).toBeInTheDocument();
  });

  it("exposes a polite status role", () => {
    wrap(
      <ResolvedRow
        notif={{ type: "friend_request", fromUsername: "x" }}
        action="accept"
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
