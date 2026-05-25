import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Mock de vis.gl ───────────────────────────────────────────────────
const mockFetchSuggestions = vi.fn();
const mockFetchFields = vi.fn();
const mockToPlace = vi.fn();

vi.mock("@vis.gl/react-google-maps", () => {
  const APIProvider = ({ children }) => <>{children}</>;
  const useMapsLibrary = () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: mockFetchSuggestions,
    },
  });
  return { APIProvider, useMapsLibrary };
});

import PlaceAutocomplete from "./PlaceAutocomplete";

// Helper para armar una "suggestion" tipo Google.
function suggestion({ placeId, main, secondary, lat, lng, formatted }) {
  return {
    placePrediction: {
      placeId,
      mainText: { text: main },
      secondaryText: { text: secondary },
      text: { text: `${main}, ${secondary}` },
      toPlace: () => {
        mockToPlace();
        return {
          fetchFields: async (...args) => {
            mockFetchFields(...args);
            return null;
          },
          location: { lat: () => lat, lng: () => lng },
          formattedAddress: formatted,
          id: placeId,
        };
      },
    },
  };
}

// Avanzar timers + flush microtasks. Sin esto, las promesas del fetch
// quedan pendientes y waitFor / findBy se cuelgan.
async function tick(ms = 350) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-browser-key");
  mockFetchSuggestions.mockReset();
  mockFetchFields.mockReset();
  mockToPlace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("<PlaceAutocomplete>", () => {
  it("renders the input with the controlled value", () => {
    render(<PlaceAutocomplete value="Hola" onChange={() => {}} />);
    expect(screen.getByDisplayValue("Hola")).toBeInTheDocument();
  });

  it("calls onChange on every keystroke", () => {
    const onChange = vi.fn();
    render(<PlaceAutocomplete value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Av" } });
    expect(onChange).toHaveBeenCalledWith("Av");
  });

  it("does NOT fetch suggestions for queries shorter than 3 chars", async () => {
    render(<PlaceAutocomplete value="" onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ab" } });
    await tick(500);
    expect(mockFetchSuggestions).not.toHaveBeenCalled();
  });

  it("debounces fetchAutocompleteSuggestions (300ms)", async () => {
    mockFetchSuggestions.mockResolvedValue({ suggestions: [] });
    render(<PlaceAutocomplete value="" onChange={() => {}} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Av Corrientes" },
    });
    await tick(100);
    expect(mockFetchSuggestions).not.toHaveBeenCalled();

    await tick(300);
    expect(mockFetchSuggestions).toHaveBeenCalledTimes(1);
    expect(mockFetchSuggestions.mock.calls[0][0]).toMatchObject({
      input: "Av Corrientes",
      includedRegionCodes: ["ar"],
      language: "es",
    });
  });

  it("renders suggestions in a dropdown after fetch", async () => {
    mockFetchSuggestions.mockResolvedValue({
      suggestions: [
        suggestion({
          placeId: "a",
          main: "Av. Corrientes 1234",
          secondary: "CABA",
          lat: -34.6,
          lng: -58.4,
          formatted: "Av. Corrientes 1234, CABA",
        }),
        suggestion({
          placeId: "b",
          main: "Av. Corrientes 5678",
          secondary: "CABA",
          lat: -34.7,
          lng: -58.5,
          formatted: "Av. Corrientes 5678, CABA",
        }),
      ],
    });
    render(<PlaceAutocomplete value="" onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Av Corrientes" },
    });
    await tick();

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes 5678")).toBeInTheDocument();
  });

  it("calls onSelect with coords + formattedAddress when a suggestion is picked", async () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    mockFetchSuggestions.mockResolvedValue({
      suggestions: [
        suggestion({
          placeId: "a",
          main: "Florida 100",
          secondary: "CABA",
          lat: -34.6,
          lng: -58.4,
          formatted: "Florida 100, CABA",
        }),
      ],
    });
    render(
      <PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Florida" },
    });
    await tick();

    fireEvent.mouseDown(screen.getByText("Florida 100"));
    // El handler de pick es async (await fetchFields) — flush microtasks.
    await tick(0);

    expect(onSelect).toHaveBeenCalledWith({
      lat: -34.6,
      lng: -58.4,
      formattedAddress: "Florida 100, CABA",
      placeId: "a",
    });
    expect(onChange).toHaveBeenLastCalledWith("Florida 100, CABA");
    expect(mockFetchFields).toHaveBeenCalledWith({
      fields: ["location", "formattedAddress", "id"],
    });
  });

  it("closes the dropdown after picking", async () => {
    mockFetchSuggestions.mockResolvedValue({
      suggestions: [
        suggestion({
          placeId: "a",
          main: "X",
          secondary: "Y",
          lat: 1,
          lng: 2,
          formatted: "X, Y",
        }),
      ],
    });
    render(
      <PlaceAutocomplete value="" onChange={() => {}} onSelect={() => {}} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    await tick();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("X"));
    await tick(0);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("handles fetch errors silently (no dropdown, no crash)", async () => {
    mockFetchSuggestions.mockRejectedValue(new Error("network"));
    render(<PlaceAutocomplete value="" onChange={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    await tick();
    expect(mockFetchSuggestions).toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders a plain input when API key is missing", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const onChange = vi.fn();
    render(
      <PlaceAutocomplete value="hola" onChange={onChange} placeholder="Ej" />,
    );
    const input = screen.getByDisplayValue("hola");
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "chau" } });
    expect(onChange).toHaveBeenCalledWith("chau");
  });
});
