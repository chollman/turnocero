import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotifRow from "./NotifRow";

function renderRow(notif, handlers = {}) {
  const props = {
    onNavigate: vi.fn(),
    onMarkRead: vi.fn(),
    onDismiss: vi.fn(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    ...handlers,
  };
  render(
    <ul>
      <NotifRow notif={notif} {...props} />
    </ul>,
  );
  return props;
}

describe("<NotifRow>", () => {
  it("renders the default variant with a single actor avatar", () => {
    renderRow({
      type: "compartida_comment",
      compartidaId: "c1",
      compartidaTitle: "Post",
      lastCommenterUsername: "ana",
      actors: [{ userId: "u1", username: "ana" }],
      read: false,
      count: 1,
    });
    expect(screen.getByLabelText("ana")).toBeInTheDocument();
    expect(screen.getByText(/ana comentó «Post»/i)).toBeInTheDocument();
  });

  it("renders the grouped variant with stacked avatars + overflow", () => {
    renderRow({
      type: "compartida_like",
      compartidaId: "c1",
      count: 5,
      lastSenderUsername: "cami",
      actors: [
        { userId: "1", username: "cami" },
        { userId: "2", username: "leo" },
        { userId: "3", username: "ema" },
        { userId: "4", username: "sol" },
        { userId: "5", username: "ivo" },
      ],
      read: false,
    });
    // 3 avatars shown + "+2"
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders the system/icon variant when there is no actor", () => {
    renderRow({
      type: "table_cancelled",
      tableId: "t1",
      tableName: "Catán",
      read: false,
    });
    expect(screen.getByText(/mesa cancelada/i)).toBeInTheDocument();
    // No actor avatar.
    expect(screen.queryByLabelText("Catán")).not.toBeInTheDocument();
  });

  it("shows inline accept/reject for an actionable friend request", () => {
    const { onAccept, onReject } = renderRow({
      type: "friend_request",
      fromUserId: "u1",
      fromUsername: "bob",
      read: false,
    });
    fireEvent.click(screen.getByRole("button", { name: /aceptar/i }));
    expect(onAccept).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /rechazar/i }));
    expect(onReject).toHaveBeenCalled();
  });

  it("shows inline actions for a single-requester join request", () => {
    renderRow({
      type: "join_request",
      tableId: "t1",
      tableName: "Root",
      actors: [{ userId: "u1", username: "lu" }],
      count: 1,
      read: false,
    });
    expect(
      screen.getByRole("button", { name: /aceptar/i }),
    ).toBeInTheDocument();
  });

  it("shows a CTA (not inline actions) for a multi-requester join request", () => {
    renderRow({
      type: "join_request",
      tableId: "t1",
      tableName: "Root",
      actors: [
        { userId: "u1", username: "lu" },
        { userId: "u2", username: "ema" },
      ],
      count: 2,
      read: false,
    });
    expect(
      screen.queryByRole("button", { name: /^aceptar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ver solicitudes/i }),
    ).toBeInTheDocument();
  });

  it("renders a ghost CTA for non-actionable notifs and navigates on click", () => {
    const { onNavigate } = renderRow({
      type: "evento_confirmed",
      eventoId: "e1",
      eventoTitle: "Evento",
      read: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /ver evento/i }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("navigates when the body is clicked", () => {
    const { onNavigate } = renderRow({
      type: "chat",
      tableId: "t1",
      tableName: "Mesa",
      read: false,
    });
    fireEvent.click(screen.getByRole("link"));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("shows the mark-read affordance only when unread", () => {
    const { rerender } = render(
      <ul>
        <NotifRow
          notif={{ type: "chat", tableId: "t1", read: false }}
          onNavigate={vi.fn()}
          onMarkRead={vi.fn()}
          onDismiss={vi.fn()}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByLabelText("Marcar como leída")).toBeInTheDocument();
    rerender(
      <ul>
        <NotifRow
          notif={{ type: "chat", tableId: "t1", read: true }}
          onNavigate={vi.fn()}
          onMarkRead={vi.fn()}
          onDismiss={vi.fn()}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />
      </ul>,
    );
    expect(
      screen.queryByLabelText("Marcar como leída"),
    ).not.toBeInTheDocument();
  });

  it("dismiss button fires onDismiss and stops propagation (no navigate)", () => {
    const { onDismiss, onNavigate } = renderRow({
      type: "chat",
      tableId: "t1",
      read: true,
    });
    fireEvent.click(screen.getByLabelText("Descartar"));
    expect(onDismiss).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("shows a count badge for aggregating notifs with count > 1", () => {
    renderRow({
      type: "chat",
      tableId: "t1",
      tableName: "Mesa",
      count: 4,
      lastSenderUsername: "ana",
      lastMessagePreview: "hola",
      read: false,
    });
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
