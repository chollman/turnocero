const {
  sanitizeCompartidaHtml,
  sanitizeNoticiaHtml,
  stripHtml,
  firstHtmlImage,
} = require("../../../utils/sanitizeHtml");

describe("firstHtmlImage", () => {
  it("returns the first http(s) image src in the HTML", () => {
    expect(
      firstHtmlImage(
        '<p>hola</p><img alt="x" src="https://cf.geekdo.com/a.jpg"><img src="https://x/b.jpg">',
      ),
    ).toBe("https://cf.geekdo.com/a.jpg");
  });

  it("returns null when there is no image (or falsy input)", () => {
    expect(firstHtmlImage("<p>sin imágenes</p>")).toBeNull();
    expect(firstHtmlImage("")).toBeNull();
    expect(firstHtmlImage(null)).toBeNull();
  });
});

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
    const out = sanitizeCompartidaHtml(
      '<img src="https://x.com/a.jpg" onerror="alert(1)">',
    );
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
    // El <img> con src http válido se conserva.
    expect(out).toContain('src="https://x.com/a.jpg"');
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

  it("keeps <img> with an http(s) src", () => {
    const out = sanitizeCompartidaHtml(
      '<p>foto</p><img src="https://cf.geekdo.com/x.jpg" alt="juego">',
    );
    expect(out).toContain("<img");
    expect(out).toContain('src="https://cf.geekdo.com/x.jpg"');
    expect(out).toContain('alt="juego"');
  });

  it("drops <img> with a non-http src (data:/javascript:)", () => {
    const data = sanitizeCompartidaHtml(
      '<img src="data:image/png;base64,AAAA">',
    );
    expect(data).not.toContain("data:");
    const js = sanitizeCompartidaHtml('<img src="javascript:alert(1)">');
    expect(js).not.toContain("javascript:");
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

describe("sanitizeNoticiaHtml", () => {
  it("keeps the extra editorial tags (h4, hr, code, pre)", () => {
    const out = sanitizeNoticiaHtml(
      "<h4>Sub</h4><hr><pre><code>x = 1</code></pre>",
    );
    expect(out).toContain("<h4>");
    expect(out).toContain("<hr>");
    expect(out).toContain("<pre>");
    expect(out).toContain("<code>");
  });

  it("reduces style to a valid text-align only", () => {
    const ok = sanitizeNoticiaHtml('<p style="text-align: center">c</p>');
    expect(ok).toContain("text-align: center");
    const evil = sanitizeNoticiaHtml(
      '<p style="text-align:center;background:url(javascript:alert(1))">x</p>',
    );
    expect(evil).toContain("text-align: center");
    expect(evil).not.toMatch(/javascript|background|url\(/i);
    const bad = sanitizeNoticiaHtml('<p style="position:fixed">x</p>');
    expect(bad).not.toContain("style");
  });

  it("keeps a valid YouTube embed and forces a sandbox", () => {
    const out = sanitizeNoticiaHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>',
    );
    expect(out).toMatch(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(out).toMatch(/sandbox=/);
    expect(out).not.toMatch(/onload|onerror/i);
  });

  it("strips iframes from any other host", () => {
    expect(
      sanitizeNoticiaHtml('<iframe src="https://evil.com/x"></iframe>'),
    ).not.toContain("<iframe");
    expect(
      sanitizeNoticiaHtml(
        '<iframe src="https://www.youtube.com/embed/x"></iframe>',
      ),
    ).not.toContain("<iframe");
  });

  it("does not leak the extended allow-list into compartidas", () => {
    const out = sanitizeCompartidaHtml(
      '<h4>no</h4><iframe src="https://www.youtube-nocookie.com/embed/abcdef"></iframe>',
    );
    expect(out).not.toContain("<h4");
    expect(out).not.toContain("<iframe");
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
