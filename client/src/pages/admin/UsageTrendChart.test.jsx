import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UsageTrendChart from "./UsageTrendChart";

const data = [
  { day: "2026-06-16", reads: 12, syncs: 1, mutations: 3 },
  { day: "2026-06-17", reads: 30, syncs: 2, mutations: 5 },
];

describe("<UsageTrendChart>", () => {
  it("renderiza las dos series", () => {
    render(<UsageTrendChart data={data} />);
    expect(screen.getByText("Requests por día")).toBeInTheDocument();
    expect(screen.getByText("Partidas por día")).toBeInTheDocument();
  });

  it("rotula cada barra con su valor y unidad", () => {
    render(<UsageTrendChart data={data} />);
    expect(screen.getByTitle(/30 requests/)).toBeInTheDocument();
    expect(screen.getByTitle(/5 partidas/)).toBeInTheDocument();
  });

  it("no renderiza nada con data vacía", () => {
    const { container } = render(<UsageTrendChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
