import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import RichTextContent from "./RichTextContent";

// jsdom no calcula layout: forzamos naturalHeight/clientHeight para simular una
// imagen escalada (más grande que lo que se muestra).
function fakeSize(img, { natural, client }) {
  Object.defineProperty(img, "naturalHeight", {
    value: natural,
    configurable: true,
  });
  Object.defineProperty(img, "naturalWidth", {
    value: natural,
    configurable: true,
  });
  Object.defineProperty(img, "clientHeight", {
    value: client,
    configurable: true,
  });
  Object.defineProperty(img, "clientWidth", {
    value: client,
    configurable: true,
  });
}

describe("<RichTextContent>", () => {
  it("renders allowed formatting tags", () => {
    const { container } = render(
      <RichTextContent html="<h2>Título</h2><p><strong>negrita</strong></p><ul><li>uno</li></ul>" />,
    );
    expect(container.querySelector("h2")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("li")).toBeInTheDocument();
  });

  it("strips <script> payloads", () => {
    const { container } = render(
      <RichTextContent html="<p>ok</p><script>window.x=1</script>" />,
    );
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("window.x");
    expect(container.textContent).toContain("ok");
  });

  it("strips onerror handlers and disallowed tags", () => {
    const { container } = render(
      <RichTextContent html='<iframe src="evil"></iframe><p onclick="x()">hola</p>' />,
    );
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.textContent).toContain("hola");
  });

  it("keeps <img> with an http(s) src", () => {
    const { container } = render(
      <RichTextContent html='<p>foto</p><img src="https://cf.geekdo.com/x.jpg" alt="j">' />,
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("https://cf.geekdo.com/x.jpg");
  });

  it("renders nothing for empty html", () => {
    const { container } = render(<RichTextContent html="" />);
    expect(container.firstChild).toBeNull();
  });

  it("opens a lightbox when a SCALED image is clicked", () => {
    const { container } = render(
      <RichTextContent html='<img src="https://cf.geekdo.com/big.jpg">' />,
    );
    const img = container.querySelector("img");
    fakeSize(img, { natural: 1200, client: 500 }); // escalada
    fireEvent.click(img);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector("img").getAttribute("src")).toBe(
      "https://cf.geekdo.com/big.jpg",
    );
  });

  it("closes the lightbox when the enlarged image is clicked", () => {
    const { container } = render(
      <RichTextContent html='<img src="https://cf.geekdo.com/big.jpg">' />,
    );
    const img = container.querySelector("img");
    fakeSize(img, { natural: 1200, client: 500 });
    fireEvent.click(img);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector("img"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT open a lightbox for an image shown at real size", () => {
    const { container } = render(
      <RichTextContent html='<img src="https://cf.geekdo.com/small.jpg">' />,
    );
    const img = container.querySelector("img");
    fakeSize(img, { natural: 120, client: 120 }); // sin escalar
    fireEvent.click(img);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
