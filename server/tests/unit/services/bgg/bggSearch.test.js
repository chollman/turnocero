const {
  stripLeadingArticle,
  scoreSearchMatch,
} = require("../../../../services/bgg/bggSearch");

describe("stripLeadingArticle", () => {
  it("quita 'The' al inicio (case-insensitive)", () => {
    expect(stripLeadingArticle("The LOOP")).toBe("LOOP");
    expect(stripLeadingArticle("the loop")).toBe("loop");
    expect(stripLeadingArticle("THE LOOP")).toBe("LOOP");
  });

  it("quita 'A' y 'An' al inicio", () => {
    expect(stripLeadingArticle("A Game of Thrones")).toBe("Game of Thrones");
    expect(stripLeadingArticle("an Almost Perfect")).toBe("Almost Perfect");
  });

  it("no quita si el artículo no es inicial", () => {
    expect(stripLeadingArticle("Lord of the Rings")).toBe("Lord of the Rings");
    expect(stripLeadingArticle("Hold the Line")).toBe("Hold the Line");
  });

  it("no quita 'thrones' ni 'andor' (palabras que arrancan con 'the' o 'an' pero no son artículo)", () => {
    expect(stripLeadingArticle("Thrones of Britannia")).toBe(
      "Thrones of Britannia",
    );
    expect(stripLeadingArticle("Andor")).toBe("Andor");
  });

  it("preserva el string si no hay artículo inicial", () => {
    expect(stripLeadingArticle("Catan")).toBe("Catan");
    expect(stripLeadingArticle("")).toBe("");
  });
});

describe("scoreSearchMatch", () => {
  it("0 para match exacto (case-insensitive)", () => {
    expect(scoreSearchMatch("LOOP", "loop")).toBe(0);
    expect(scoreSearchMatch("LOOP", "LOOP")).toBe(0);
  });

  it("0 también con 'The' inicial (normaliza el artículo)", () => {
    expect(scoreSearchMatch("The LOOP", "loop")).toBe(0);
  });

  it("1 para prefix con separador (espacio, ':', '-', ''', ',')", () => {
    expect(scoreSearchMatch("LOOP: The Expansion", "loop")).toBe(1);
    expect(scoreSearchMatch("LOOP - Deluxe Edition", "loop")).toBe(1);
    expect(scoreSearchMatch("LOOP's Adventure", "loop")).toBe(1);
    expect(scoreSearchMatch("LOOP, Inc.", "loop")).toBe(1);
    expect(scoreSearchMatch("LOOP and Other Games", "loop")).toBe(1);
  });

  it("2 para word-boundary en posición no inicial", () => {
    expect(scoreSearchMatch("Mega LOOP", "loop")).toBe(2);
    expect(scoreSearchMatch("Catan: The Loop Expansion", "loop")).toBe(2);
  });

  it("3 para substring que cae adentro de otra palabra", () => {
    expect(scoreSearchMatch("looping", "loop")).toBe(3);
    expect(scoreSearchMatch("hooplah", "oop")).toBe(3);
  });

  it("4 cuando no hay match", () => {
    expect(scoreSearchMatch("Catan", "loop")).toBe(4);
    expect(scoreSearchMatch("Risk", "monopoly")).toBe(4);
  });

  it("acepta queries con metacaracteres regex sin tirar (escapeRegex interno)", () => {
    // El query "loop." no debe matchear como regex
    expect(scoreSearchMatch("loopy", "loop.")).toBe(4);
    // Pero "loop." sí matchea exact si el name es exactamente "loop."
    expect(scoreSearchMatch("loop.", "loop.")).toBe(0);
  });

  it("retorna ranking estable (menor número = mejor match)", () => {
    const candidates = [
      { name: "LOOP", expected: 0 },
      { name: "LOOP: Expansion", expected: 1 },
      { name: "Mega LOOP", expected: 2 },
      { name: "looping", expected: 3 },
      { name: "Catan", expected: 4 },
    ];
    candidates.forEach((c) => {
      expect(scoreSearchMatch(c.name, "loop")).toBe(c.expected);
    });
  });
});
