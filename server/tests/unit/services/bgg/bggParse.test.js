const {
  parser,
  parseGameItem,
  gameDocToObject,
  parseCollectionXml,
  parsePlay,
  parsePlaysXml,
  playToApi,
} = require("../../../../services/bgg/bggParse");

// ── parser XML config ────────────────────────────────────────────────

describe("parser (XMLParser config)", () => {
  // Regression: BGG envía apóstrofes / comillas / símbolos como entidades
  // numéricas (&#039;, &#x27;). El parser tenía processEntities=true pero
  // htmlEntities=false, así que esas entidades pasaban literales al cliente
  // y aparecían como "It&#039;s..." en el autocomplete de juegos.
  it("decodifica entidades numéricas decimales (&#039;) a sus caracteres", () => {
    const xml =
      '<items><item id="1"><name type="primary" value="It&#039;s a Wonderful World"/></item></items>';
    const parsed = parser.parse(xml);
    expect(parsed.items.item["name"]["@_value"]).toBe(
      "It's a Wonderful World",
    );
  });

  it("decodifica entidades numéricas hex (&#x27;) también", () => {
    const xml =
      '<items><item id="1"><name type="primary" value="Spirit&#x27;s Island"/></item></items>';
    const parsed = parser.parse(xml);
    expect(parsed.items.item["name"]["@_value"]).toBe("Spirit's Island");
  });

  it("sigue decodificando entidades named básicas (&amp;, &apos;)", () => {
    const xml =
      '<items><item id="1"><name type="primary" value="Hearts &amp; Minds"/></item></items>';
    const parsed = parser.parse(xml);
    expect(parsed.items.item["name"]["@_value"]).toBe("Hearts & Minds");
  });
});

// ── parseGameItem ────────────────────────────────────────────────────

describe("parseGameItem", () => {
  it("extrae shape básico (id, name, thumbnail, image, year, players)", () => {
    const item = {
      "@_id": "42",
      name: [
        { "@_type": "primary", "@_value": "Catan" },
        { "@_type": "alternate", "@_value": "Settlers" },
      ],
      thumbnail: "https://x/thumb.jpg",
      image: "https://x/big.jpg",
      yearpublished: { "@_value": "1995" },
      minplayers: { "@_value": "3" },
      maxplayers: { "@_value": "4" },
    };
    expect(parseGameItem(item)).toEqual({
      id: 42,
      name: "Catan",
      thumbnail: "https://x/thumb.jpg",
      image: "https://x/big.jpg",
      year: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    });
  });

  it("acepta name como objeto único (no array)", () => {
    const item = {
      "@_id": "1",
      name: { "@_type": "primary", "@_value": "Solo" },
    };
    expect(parseGameItem(item).name).toBe("Solo");
  });

  it("acepta thumbnail/image como objeto con #text (sintaxis XML alternativa)", () => {
    const item = {
      "@_id": "1",
      name: { "@_value": "X" },
      thumbnail: { "#text": "obj-thumb" },
      image: { "#text": "obj-img" },
    };
    expect(parseGameItem(item).thumbnail).toBe("obj-thumb");
    expect(parseGameItem(item).image).toBe("obj-img");
  });

  it("devuelve null en campos opcionales ausentes", () => {
    const item = { "@_id": "1", name: { "@_value": "X" } };
    expect(parseGameItem(item)).toEqual({
      id: 1,
      name: "X",
      thumbnail: null,
      image: null,
      year: null,
      minPlayers: null,
      maxPlayers: null,
    });
  });

  it("fallback al primer name si no hay primary", () => {
    const item = {
      "@_id": "1",
      name: [{ "@_type": "alternate", "@_value": "Alt" }],
    };
    expect(parseGameItem(item).name).toBe("Alt");
  });
});

// ── gameDocToObject ──────────────────────────────────────────────────

describe("gameDocToObject", () => {
  it("convierte doc Mongo a la misma shape que parseGameItem", () => {
    const doc = {
      gameId: 42,
      name: "Catan",
      thumbnail: "t",
      image: "i",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    };
    expect(gameDocToObject(doc)).toEqual({
      id: 42,
      name: "Catan",
      thumbnail: "t",
      image: "i",
      year: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    });
  });

  it("preserva nulls del doc", () => {
    const doc = {
      gameId: 1,
      name: "X",
      thumbnail: null,
      image: null,
      yearPublished: null,
      minPlayers: null,
      maxPlayers: null,
    };
    const out = gameDocToObject(doc);
    expect(out.thumbnail).toBeNull();
    expect(out.year).toBeNull();
  });
});

// ── parseCollectionXml ───────────────────────────────────────────────

describe("parseCollectionXml", () => {
  it("devuelve null cuando no hay <items> root", () => {
    expect(parseCollectionXml("<other/>")).toBeNull();
  });

  it("parsea una colección con un solo item", () => {
    const xml = `<?xml version="1.0"?>
      <items>
        <item objectid="42">
          <name>Catan</name>
          <thumbnail>thumb.jpg</thumbnail>
          <image>big.jpg</image>
          <yearpublished>1995</yearpublished>
          <numplays>5</numplays>
          <stats>
            <rating value="8">
              <average value="7.5"/>
            </rating>
          </stats>
        </item>
      </items>`;
    const result = parseCollectionXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "42",
      name: "Catan",
      thumbnail: "thumb.jpg",
      image: "big.jpg",
      yearPublished: 1995,
      userRating: 8,
      bggRating: 7.5,
      numPlays: 5,
    });
  });

  it("normaliza single item vs array (XML quirk)", () => {
    const xmlSingle = `<items><item objectid="1"><name>A</name></item></items>`;
    const xmlMulti = `<items>
      <item objectid="1"><name>A</name></item>
      <item objectid="2"><name>B</name></item>
    </items>`;
    expect(parseCollectionXml(xmlSingle)).toHaveLength(1);
    expect(parseCollectionXml(xmlMulti)).toHaveLength(2);
  });

  it("rating 'N/A' devuelve userRating null", () => {
    const xml = `<items><item objectid="1"><name>X</name><stats><rating value="N/A"/></stats></item></items>`;
    expect(parseCollectionXml(xml)[0].userRating).toBeNull();
  });

  it("default numPlays a 0 si no hay <numplays>", () => {
    const xml = `<items><item objectid="1"><name>X</name></item></items>`;
    expect(parseCollectionXml(xml)[0].numPlays).toBe(0);
  });
});

// ── parsePlay ────────────────────────────────────────────────────────

describe("parsePlay", () => {
  it("extrae shape básico de una play sin players", () => {
    const play = {
      "@_id": "123",
      "@_date": "2026-01-01",
      "@_quantity": "1",
      "@_length": "60",
      "@_location": "Casa",
      item: { "@_name": "Catan", "@_objectid": "42" },
      comments: "Buena partida",
    };
    const out = parsePlay(play);
    expect(out).toMatchObject({
      playId: "123",
      date: "2026-01-01",
      gameName: "Catan",
      gameId: "42",
      quantity: 1,
      duration: 60,
      location: "Casa",
      comments: "Buena partida",
      players: [],
    });
  });

  it("parsea players como array con orden preservado", () => {
    const play = {
      "@_id": "1",
      item: { "@_name": "X", "@_objectid": "1" },
      players: {
        player: [
          { "@_username": "alice", "@_win": "1", "@_score": "10" },
          { "@_username": "bob", "@_win": "0", "@_score": "5" },
        ],
      },
    };
    const out = parsePlay(play);
    expect(out.players).toHaveLength(2);
    expect(out.players[0]).toMatchObject({
      username: "alice",
      win: true,
      score: "10",
    });
    expect(out.players[1]).toMatchObject({
      username: "bob",
      win: false,
      score: "5",
    });
  });

  it("normaliza single player a array", () => {
    const play = {
      "@_id": "1",
      item: { "@_name": "X", "@_objectid": "1" },
      players: { player: { "@_username": "solo", "@_win": "1" } },
    };
    expect(parsePlay(play).players).toHaveLength(1);
    expect(parsePlay(play).players[0].username).toBe("solo");
  });

  it("flags incomplete/nowinstats parsean '1' como true", () => {
    const play = {
      "@_id": "1",
      "@_incomplete": "1",
      "@_nowinstats": "1",
      item: { "@_name": "X", "@_objectid": "1" },
    };
    const out = parsePlay(play);
    expect(out.incomplete).toBe(true);
    expect(out.nowinstats).toBe(true);
  });

  it("default quantity a 1 si no viene", () => {
    const play = { "@_id": "1", item: { "@_name": "X", "@_objectid": "1" } };
    expect(parsePlay(play).quantity).toBe(1);
  });

  it("comments como objeto con #text (XML quirk)", () => {
    const play = {
      "@_id": "1",
      item: { "@_name": "X", "@_objectid": "1" },
      comments: { "#text": "hidden as object" },
    };
    expect(parsePlay(play).comments).toBe("hidden as object");
  });

  it("player con score='0' lo preserva como string", () => {
    const play = {
      "@_id": "1",
      item: { "@_name": "X", "@_objectid": "1" },
      players: { player: { "@_username": "u", "@_score": "0" } },
    };
    expect(parsePlay(play).players[0].score).toBe("0");
  });

  it("rating='0' del player se considera null (sentinel BGG)", () => {
    const play = {
      "@_id": "1",
      item: { "@_name": "X", "@_objectid": "1" },
      players: { player: { "@_username": "u", "@_rating": "0" } },
    };
    expect(parsePlay(play).players[0].rating).toBeNull();
  });
});

// ── parsePlaysXml ────────────────────────────────────────────────────

describe("parsePlaysXml", () => {
  it("devuelve null si no hay <plays> root", () => {
    expect(parsePlaysXml("<other/>")).toBeNull();
  });

  it("retorna { plays: [], total: 0 } para user sin partidas (existente)", () => {
    const xml = `<plays total="0"></plays>`;
    expect(parsePlaysXml(xml)).toEqual({ plays: [], total: 0 });
  });

  it("retorna plays + total del attribute", () => {
    const xml = `<plays total="42">
      <play id="1" date="2026-01-01"><item name="X" objectid="100"/></play>
    </plays>`;
    const out = parsePlaysXml(xml);
    expect(out.total).toBe(42);
    expect(out.plays).toHaveLength(1);
    expect(out.plays[0].playId).toBe("1");
  });

  it("normaliza single play vs array", () => {
    const xmlSingle = `<plays total="1"><play id="1"><item name="X" objectid="1"/></play></plays>`;
    const xmlMulti = `<plays total="2">
      <play id="1"><item name="A" objectid="1"/></play>
      <play id="2"><item name="B" objectid="2"/></play>
    </plays>`;
    expect(parsePlaysXml(xmlSingle).plays).toHaveLength(1);
    expect(parsePlaysXml(xmlMulti).plays).toHaveLength(2);
  });
});

// ── playToApi ────────────────────────────────────────────────────────

describe("playToApi", () => {
  it("renombra playId → id pero preserva el resto", () => {
    const p = {
      playId: "123",
      date: "2026-01-01",
      gameName: "X",
      gameId: "1",
      gameThumbnail: "t",
      quantity: 2,
      duration: 60,
      location: "Casa",
      incomplete: false,
      nowinstats: false,
      comments: "c",
      players: [{ username: "u" }],
    };
    expect(playToApi(p)).toEqual({
      id: "123",
      date: "2026-01-01",
      gameName: "X",
      gameId: "1",
      gameThumbnail: "t",
      quantity: 2,
      duration: 60,
      location: "Casa",
      incomplete: false,
      nowinstats: false,
      comments: "c",
      players: [{ username: "u" }],
    });
  });
});

// ── parser ───────────────────────────────────────────────────────────

describe("parser (instance)", () => {
  it("preserva atributos con prefix @_", () => {
    const out = parser.parse(`<x a="1" b="2"/>`);
    expect(out.x["@_a"]).toBe("1");
    expect(out.x["@_b"]).toBe("2");
  });
});
