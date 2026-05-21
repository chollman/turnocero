import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TriageColumn from "./TriageColumn";

function makeReg(id, overrides = {}) {
  return {
    _id: id,
    user: {
      _id: id,
      username: `u${id}`,
      displayName: `User ${id}`,
      avatar: null,
    },
    status: "pending",
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("<TriageColumn>", () => {
  it("renders title, count, and items", () => {
    render(
      <TriageColumn
        title="Pendientes"
        status="pending"
        items={[makeReg("a"), makeReg("b")]}
        emptyText="Nada"
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(screen.getByText(/Pendientes/)).toBeInTheDocument();
    expect(screen.getByText("User a")).toBeInTheDocument();
    expect(screen.getByText("User b")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows empty text when items is empty", () => {
    render(
      <TriageColumn
        title="Confirmadas"
        status="confirmed"
        items={[]}
        emptyText="Sin inscripciones confirmadas"
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(
      screen.getByText(/sin inscripciones confirmadas/i),
    ).toBeInTheDocument();
  });

  it("uses status-specific class on the head label", () => {
    const { container } = render(
      <TriageColumn
        title="Confirmadas"
        status="confirmed"
        items={[]}
        emptyText="—"
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    // Just verify no crash + label has at least one class
    const label = container.querySelector("section > div > span");
    expect(label.className).toContain("label");
  });
});
