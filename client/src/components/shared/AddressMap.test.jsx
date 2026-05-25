import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock vis.gl ANTES de importar AddressMap.
// El test no carga el script real de Google — simulamos los componentes
// como divs que exponen sus props a través de data-* y triggers manuales.
vi.mock("@vis.gl/react-google-maps", () => {
  const APIProvider = ({ children, apiKey }) => (
    <div data-testid="api-provider" data-api-key={apiKey}>
      {children}
    </div>
  );
  const Map = ({ children, mapId, defaultCenter, defaultZoom, onClick }) => (
    <div
      data-testid="map"
      data-map-id={mapId}
      data-default-center={JSON.stringify(defaultCenter)}
      data-default-zoom={defaultZoom}
      onClick={() =>
        onClick?.({ detail: { latLng: { lat: -34.5, lng: -58.5 } } })
      }
    >
      {children}
    </div>
  );
  const AdvancedMarker = ({ children, position, draggable, onDragEnd }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      data-draggable={String(!!draggable)}
      onClick={() =>
        onDragEnd?.({ latLng: { lat: () => -34.7, lng: () => -58.7 } })
      }
    >
      {children}
    </div>
  );
  const useMap = () => ({
    panTo: vi.fn(),
    setZoom: vi.fn(),
    getZoom: () => 13,
  });
  return { APIProvider, Map, AdvancedMarker, useMap };
});

// Mock ThemeContext.
vi.mock("../../context/ThemeContext", () => ({ useTheme: vi.fn() }));

import AddressMap from "./AddressMap";
import { useTheme } from "../../context/ThemeContext";

beforeEach(() => {
  useTheme.mockReturnValue({ theme: "dark", setTheme: vi.fn() });
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-browser-key");
  vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID_DARK", "dark-map-id");
  vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID_LIGHT", "light-map-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("<AddressMap>", () => {
  it("renders the API provider and map", () => {
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.getByTestId("api-provider")).toHaveAttribute(
      "data-api-key",
      "test-browser-key",
    );
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("uses the dark Map ID when theme is dark", () => {
    useTheme.mockReturnValue({ theme: "dark", setTheme: vi.fn() });
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-map-id",
      "dark-map-id",
    );
  });

  it("uses the light Map ID when theme is light", () => {
    useTheme.mockReturnValue({ theme: "light", setTheme: vi.fn() });
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-map-id",
      "light-map-id",
    );
  });

  it("does NOT render a marker when lat/lng are null", () => {
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
  });

  it("renders a draggable marker at the given coords", () => {
    render(<AddressMap lat={-34.6} lng={-58.4} />);
    const marker = screen.getByTestId("marker");
    expect(marker).toHaveAttribute(
      "data-position",
      JSON.stringify({ lat: -34.6, lng: -58.4 }),
    );
    expect(marker).toHaveAttribute("data-draggable", "true");
  });

  it("zooms in when the map has a marker (defaultZoom 15)", () => {
    render(<AddressMap lat={-34.6} lng={-58.4} />);
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-default-zoom",
      "15",
    );
  });

  it("zooms out when there is no marker (defaultZoom 13)", () => {
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-default-zoom",
      "13",
    );
  });

  it("calls onChange when the map is clicked", () => {
    const onChange = vi.fn();
    render(<AddressMap lat={null} lng={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("map"));
    expect(onChange).toHaveBeenCalledWith(-34.5, -58.5);
  });

  it("calls onChange when the marker is dragged", () => {
    const onChange = vi.fn();
    render(<AddressMap lat={-34.6} lng={-58.4} onChange={onChange} />);
    // Nuestro mock dispara onDragEnd al hacer click en el marker.
    fireEvent.click(screen.getByTestId("marker"));
    expect(onChange).toHaveBeenCalledWith(-34.7, -58.7);
  });

  it("renders an error when API key is missing", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    render(<AddressMap lat={null} lng={null} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/VITE_GOOGLE_MAPS_API_KEY/)).toBeInTheDocument();
  });
});
