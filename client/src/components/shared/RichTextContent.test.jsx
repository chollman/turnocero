import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RichTextContent from "./RichTextContent";

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
      <RichTextContent html='<img src="x" onerror="alert(1)">hola' />,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("renders nothing for empty html", () => {
    const { container } = render(<RichTextContent html="" />);
    expect(container.firstChild).toBeNull();
  });
});
