const {
  sanitizeCompartidaHtml,
  stripHtml,
} = require("../../../utils/sanitizeHtml");

describe("sanitizeCompartidaHtml", () => {
  it("strips <script> tags", () => {
    const out = sanitizeCompartidaHtml(
      '<p>Hola</p><script>alert("xss")</script>',
    );
    expect(out).toContain("<p>Hola</p>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
  });

  it("strips event handler attributes (onerror)", () => {
    const out = sanitizeCompartidaHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    // <img> no está en el allow-list → se elimina por completo.
    expect(out).not.toContain("<img");
  });

  it("strips <iframe>", () => {
    const out = sanitizeCompartidaHtml('<iframe src="evil"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("keeps allowed formatting tags", () => {
    const html =
      "<h2>Título</h2><h3>Sub</h3><p><strong>negrita</strong> <em>ita</em></p><ul><li>uno</li></ul><blockquote>cita</blockquote>";
    const out = sanitizeCompartidaHtml(html);
    expect(out).toContain("<h2>");
    expect(out).toContain("<h3>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>");
    expect(out).toContain("<blockquote>");
  });

  it("hardens links with rel/target", () => {
    const out = sanitizeCompartidaHtml('<a href="https://x.com">link</a>');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("drops javascript: protocol links", () => {
    const out = sanitizeCompartidaHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("returns empty string for falsy input", () => {
    expect(sanitizeCompartidaHtml("")).toBe("");
    expect(sanitizeCompartidaHtml(null)).toBe("");
    expect(sanitizeCompartidaHtml(undefined)).toBe("");
  });
});

describe("stripHtml", () => {
  it("returns plain text from HTML", () => {
    expect(stripHtml("<h2>Hola</h2><p>mundo</p>")).toBe("Hola mundo");
  });

  it("strips script content entirely", () => {
    const out = stripHtml("<p>texto</p><script>alert(1)</script>");
    expect(out).not.toContain("alert");
    expect(out).toContain("texto");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>a</p>\n\n  <p>b</p>")).toBe("a b");
  });

  it("returns empty for falsy", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml(null)).toBe("");
  });
});
