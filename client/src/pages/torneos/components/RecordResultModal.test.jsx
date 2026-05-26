import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RecordResultModal from "./RecordResultModal";

const PLAYER_A = {
  _id: "a",
  username: "alice",
  avatar: { url: "", publicId: "" },
};
const PLAYER_B = {
  _id: "b",
  username: "bob",
  avatar: { url: "", publicId: "" },
};

function renderModal({
  match,
  format = "single_elim",
  onConfirm = vi.fn(),
  onClose = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter>
      <RecordResultModal
        match={match}
        format={format}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </MemoryRouter>,
  );
}

describe("<RecordResultModal>", () => {
  it("renders nothing when match is null", () => {
    const { container } = renderModal({ match: null });
    expect(container.firstChild).toBeNull();
  });

  it("renders both player buttons + Confirm (disabled until choice)", () => {
    renderModal({ match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B } });
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it('does NOT show "Empate" option for single_elim format', () => {
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      format: "single_elim",
    });
    expect(screen.queryByText(/empate/i)).not.toBeInTheDocument();
  });

  it('shows "Empate" option for league format', () => {
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      format: "league",
    });
    expect(screen.getByText(/empate/i)).toBeInTheDocument();
  });

  it("selecting a winner enables Confirm + calls onConfirm with { winnerId }", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      onConfirm,
    });
    // Click "alice"
    fireEvent.click(screen.getByText("alice").closest("button"));
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({ winnerId: "a" }),
    );
  });

  it("selecting Empate (league) calls onConfirm with { draw: true }", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      format: "league",
      onConfirm,
    });
    fireEvent.click(screen.getByText(/empate/i).closest("button"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ draw: true }));
  });

  it("Cancel button calls onClose", () => {
    const onClose = vi.fn();
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      onClose,
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    renderModal({
      match: { _id: "m1", playerA: PLAYER_A, playerB: PLAYER_B },
      onClose,
    });
    // The backdrop is a child of ModalPortal; the close X is also available.
    const closeX = screen.getByLabelText("Cerrar");
    fireEvent.click(closeX);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
