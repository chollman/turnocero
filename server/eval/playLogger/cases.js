// Casos de evaluación del agente de carga de partidas. Hoy (fixtures.TODAY) es
// el viernes 2026-10-30: ayer = 29, anteayer = 28, el martes = 27,
// el domingo = 25, el sábado = 24.
//
// Cada caso:
//   id, lang ("es" | "en")
//   turns     mensajes del usuario en orden; el siguiente se manda solo si el
//             anterior no produjo borrador (respuesta a la pregunta del agente)
//   expect    { kind: "draft", draft } — el borrador final tiene que coincidir
//             { kind: "noDraft" }      — tras el PRIMER mensaje no debe haber
//                                         borrador (tiene que preguntar)
//
// En `draft` solo se comparan los campos presentes. Jugadores: se identifican
// por `username` (o `name` si es invitado) y el conjunto tiene que ser exacto,
// incluido el dueño ("claudio"). Equipos: se compara quién está con quién, no
// la letra. `variant` y `location` se comparan por contenido (sin tildes ni
// mayúsculas); `notesIncludes` busca en las notas.

const ME = "claudio";

module.exports = [
  {
    id: "versus-basico",
    lang: "es",
    turns: ["Ayer jugamos Catan con Juan y Pedro, gané yo con 10, Juan 8 y Pedro 7"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "13",
        playdate: "2026-10-29",
        mode: "versus",
        players: [
          { username: ME, score: 10, win: true },
          { username: "juanp", score: 8, win: false },
          { username: "pedrito", score: 7, win: false },
        ],
      },
    },
  },
  {
    id: "ganador-por-puntaje",
    lang: "es",
    turns: ["Hoy Azul con Lucía: 62 a 58 para mí"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "230802",
        playdate: "2026-10-30",
        players: [
          { username: ME, score: 62, win: true },
          { username: "lu_ch", score: 58, win: false },
        ],
      },
    },
  },
  {
    id: "ganador-sin-puntajes",
    lang: "es",
    turns: ["Anteayer 7 Wonders Duel contra Tincho, ganó él"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "173346",
        playdate: "2026-10-28",
        players: [
          { username: ME, win: false },
          { username: "tincho", win: true },
        ],
      },
    },
  },
  {
    id: "coop-ganada",
    lang: "es",
    turns: ["El sábado Pandemic con Juan, Melina y Pedro, ganamos"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "30549",
        playdate: "2026-10-24",
        mode: "coop",
        coopResult: "won",
        players: [{ username: ME }, { username: "juanp" }, { username: "meli_g" }, { username: "pedrito" }],
      },
    },
  },
  {
    id: "coop-perdida-con-variante",
    lang: "es",
    turns: ["Ayer perdimos en Pandemic modo heroico con Lucía"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "30549",
        playdate: "2026-10-29",
        mode: "coop",
        coopResult: "lost",
        variant: "heroico",
        players: [{ username: ME }, { username: "lu_ch" }],
      },
    },
  },
  {
    id: "equipos",
    lang: "es",
    turns: ["Codenames hoy: Juan y yo contra Pedro y Sofía, ganamos nosotros"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "178900",
        playdate: "2026-10-30",
        mode: "equipos",
        players: [
          { username: ME, team: "A", win: true },
          { username: "juanp", team: "A", win: true },
          { username: "pedrito", team: "B", win: false },
          { username: "sofiar", team: "B", win: false },
        ],
      },
    },
  },
  {
    id: "facciones-root",
    lang: "es",
    turns: [
      "Root el domingo con Juan y Lucía. Yo Marquesa, Juan Águilas, Lucía Alianza. Ganó Juan con 30, yo 25, Lucía 22",
    ],
    expect: {
      kind: "draft",
      draft: {
        gameId: "237182",
        playdate: "2026-10-25",
        mode: "versus",
        players: [
          { username: ME, score: 25, win: false, faction: "Marquesa" },
          { username: "juanp", score: 30, win: true, faction: "Águilas" },
          { username: "lu_ch", score: 22, win: false, faction: "Alianza" },
        ],
      },
    },
  },
  {
    id: "variante-mapa",
    lang: "es",
    turns: ["Ayer Root en el mapa de invierno con Pedro, ganó Pedro"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "237182",
        playdate: "2026-10-29",
        variant: "invierno",
        players: [
          { username: ME, win: false },
          { username: "pedrito", win: true },
        ],
      },
    },
  },
  {
    id: "expansion-wingspan",
    lang: "es",
    turns: ["Wingspan con la expansión europea, hoy, con Lucía y Sofi: yo 87, Lucía 92, Sofi 70"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "266192",
        playdate: "2026-10-30",
        expansions: ["290837"],
        players: [
          { username: ME, score: 87, win: false },
          { username: "lu_ch", score: 92, win: true },
          { username: "sofiar", score: 70, win: false },
        ],
      },
    },
  },
  {
    id: "jugador-ambiguo-pregunta",
    lang: "es",
    turns: ["Ayer Azul con Meli, ganó ella"],
    expect: { kind: "noDraft" },
  },
  {
    id: "jugador-ambiguo-respuesta",
    lang: "es",
    turns: ["Ayer Azul con Meli, ganó ella", "Melina"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "230802",
        playdate: "2026-10-29",
        players: [
          { username: ME, win: false },
          { username: "meli_g", win: true },
        ],
      },
    },
  },
  {
    id: "invitado-nuevo",
    lang: "es",
    turns: ["Hoy Carcassonne con Rocío, gané yo", "Sí, agregala"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "822",
        playdate: "2026-10-30",
        players: [
          { username: ME, win: true },
          { name: "Rocío", win: false },
        ],
      },
    },
  },
  {
    id: "duracion-y-lugar",
    lang: "es",
    turns: [
      "Terraforming Mars anteayer en lo de Juan, duró 2 horas y media, con Juan y Pedro. Ganó Juan 78, yo 70, Pedro 65",
    ],
    expect: {
      kind: "draft",
      draft: {
        gameId: "167791",
        playdate: "2026-10-28",
        length: 150,
        location: "juan",
        players: [
          { username: ME, score: 70, win: false },
          { username: "juanp", score: 78, win: true },
          { username: "pedrito", score: 65, win: false },
        ],
      },
    },
  },
  {
    id: "solitario",
    lang: "es",
    turns: ["Hoy jugué solo al Cascadia, hice 92 puntos"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "295947",
        playdate: "2026-10-30",
        players: [{ username: ME, score: 92 }],
      },
    },
  },
  {
    id: "ingles-versus",
    lang: "en",
    turns: ["Played Ticket to Ride yesterday with Juan and Pedro. I won with 120, Juan 98, Pedro 101"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "9209",
        playdate: "2026-10-29",
        players: [
          { username: ME, score: 120, win: true },
          { username: "juanp", score: 98, win: false },
          { username: "pedrito", score: 101, win: false },
        ],
      },
    },
  },
  {
    id: "gana-el-menor",
    lang: "es",
    turns: [
      "Hearts ayer con Juan, Pedro y Lucía. Ganó Lucía con 12 puntos, yo 45, Juan 60 y Pedro 83 (gana el que menos tiene)",
    ],
    expect: {
      kind: "draft",
      draft: {
        gameId: "6249",
        playdate: "2026-10-29",
        players: [
          { username: ME, score: 45, win: false },
          { username: "juanp", score: 60, win: false },
          { username: "pedrito", score: 83, win: false },
          { username: "lu_ch", score: 12, win: true },
        ],
      },
    },
  },
  {
    id: "spirit-island-coop-espiritus",
    lang: "es",
    turns: ["Spirit Island el sábado con Juan, ganamos contra Inglaterra nivel 3. Yo Relámpago y Juan Río"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "162886",
        playdate: "2026-10-24",
        mode: "coop",
        coopResult: "won",
        variant: "inglaterra",
        players: [
          { username: ME, faction: "Relámpago" },
          { username: "juanp", faction: "Río" },
        ],
      },
    },
  },
  {
    id: "the-crew-mision",
    lang: "es",
    turns: ["The Crew ayer con Juan, Pedro y Lucía, pasamos la misión 25"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "284083",
        playdate: "2026-10-29",
        mode: "coop",
        coopResult: "won",
        variant: "25",
        players: [{ username: ME }, { username: "juanp" }, { username: "pedrito" }, { username: "lu_ch" }],
      },
    },
  },
  {
    id: "sin-juego-pregunta",
    lang: "es",
    turns: ["Ayer jugamos con Juan y gané"],
    expect: { kind: "noDraft" },
  },
  {
    id: "dia-de-la-semana",
    lang: "es",
    turns: ["El martes Brass Birmingham con Juan y Tincho, ganó Tincho con 160, yo 145 y Juan 132"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "224517",
        playdate: "2026-10-27",
        players: [
          { username: ME, score: 145, win: false },
          { username: "juanp", score: 132, win: false },
          { username: "tincho", score: 160, win: true },
        ],
      },
    },
  },
  {
    id: "apodos",
    lang: "es",
    turns: ["Hoy Azul con Tincho y Sofi, gané yo"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "230802",
        playdate: "2026-10-30",
        players: [
          { username: ME, win: true },
          { username: "tincho", win: false },
          { username: "sofiar", win: false },
        ],
      },
    },
  },
  {
    id: "juego-de-bgg",
    lang: "es",
    turns: ["Ayer probamos Arcs con Juan, ganó Juan"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "359871",
        playdate: "2026-10-29",
        players: [
          { username: ME, win: false },
          { username: "juanp", win: true },
        ],
      },
    },
  },
  {
    id: "expansion-nombre-en-castellano",
    lang: "es",
    turns: ["Catan con Navegantes ayer con Juan, Pedro y Lucía. Ganó Pedro"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "13",
        playdate: "2026-10-29",
        expansions: ["325"],
        players: [
          { username: ME, win: false },
          { username: "juanp", win: false },
          { username: "pedrito", win: true },
          { username: "lu_ch", win: false },
        ],
      },
    },
  },
  {
    id: "empate",
    lang: "es",
    turns: ["Azul ayer con Juan, empatamos en 70"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "230802",
        playdate: "2026-10-29",
        players: [
          { username: ME, score: 70, win: true },
          { username: "juanp", score: 70, win: true },
        ],
      },
    },
  },
  {
    id: "dueño-nombrado",
    lang: "es",
    turns: ["Ayer Claudio, Juan y Pedro jugamos Carcassonne, ganó Pedro"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "822",
        playdate: "2026-10-29",
        players: [
          { username: ME, win: false },
          { username: "juanp", win: false },
          { username: "pedrito", win: true },
        ],
      },
    },
  },
  {
    id: "ingles-coop-perdida",
    lang: "en",
    turns: ["We lost at Hanabi tonight, me, Sofía and Lucía, only 18 points"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "98778",
        playdate: "2026-10-30",
        mode: "coop",
        coopResult: "lost",
        players: [{ username: ME }, { username: "sofiar" }, { username: "lu_ch" }],
      },
    },
  },
  {
    id: "notas",
    lang: "es",
    turns: ["Hoy Wingspan con Juan, gané 95 a 80. Anotá que fue la revancha del sábado"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "266192",
        playdate: "2026-10-30",
        notesIncludes: "revancha",
        players: [
          { username: ME, score: 95, win: true },
          { username: "juanp", score: 80, win: false },
        ],
      },
    },
  },
  {
    id: "dos-partidas-en-un-mensaje",
    lang: "es",
    turns: ["Ayer jugamos dos de Azul con Juan: la primera gané yo 70 a 60, la segunda ganó Juan 75 a 66"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "230802",
        playdate: "2026-10-29",
        players: [
          { username: ME, score: 70, win: true },
          { username: "juanp", score: 60, win: false },
        ],
      },
    },
  },
  {
    id: "fecha-futura",
    lang: "es",
    turns: ["Mañana jugamos Catan con Juan"],
    expect: { kind: "noDraft" },
  },
  {
    id: "ingles-equipos",
    lang: "en",
    turns: ["Codenames today, Lucía and I beat Pedro and Tincho"],
    expect: {
      kind: "draft",
      draft: {
        gameId: "178900",
        playdate: "2026-10-30",
        mode: "equipos",
        players: [
          { username: ME, team: "A", win: true },
          { username: "lu_ch", team: "A", win: true },
          { username: "pedrito", team: "B", win: false },
          { username: "tincho", team: "B", win: false },
        ],
      },
    },
  },
];
