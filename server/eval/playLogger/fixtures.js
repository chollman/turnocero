// Datos de prueba fijos para evaluar el agente de carga de partidas sin Mongo
// ni BGG. Simulan la cuenta de un usuario ("claudio") con su lista de juegos,
// sus compañeros habituales y las variantes/facciones que ya usó.
//
// Los ids de juego son los reales de BGG, para que los casos se lean igual que
// en producción. Si agregás un caso que menciona un juego o una persona nueva,
// agregalos acá primero.

const TODAY = "2026-10-30"; // viernes

const OWNER = { name: "Claudio", username: "claudio" };

// "Mis juegos": lo que devuelve search_games con source "my_games".
const MY_GAMES = [
  { id: "13", name: "CATAN", year: 1995, timesPlayed: 40, owned: true, minPlayers: 3, maxPlayers: 4 },
  { id: "266192", name: "Wingspan", year: 2019, timesPlayed: 22, owned: true, minPlayers: 1, maxPlayers: 5 },
  { id: "237182", name: "Root", year: 2018, timesPlayed: 15, owned: true, minPlayers: 2, maxPlayers: 4 },
  { id: "230802", name: "Azul", year: 2017, timesPlayed: 30, owned: true, minPlayers: 2, maxPlayers: 4 },
  { id: "30549", name: "Pandemic", year: 2008, timesPlayed: 12, owned: true, minPlayers: 2, maxPlayers: 4 },
  { id: "178900", name: "Codenames", year: 2015, timesPlayed: 9, owned: true, minPlayers: 2, maxPlayers: 8 },
  { id: "162886", name: "Spirit Island", year: 2017, timesPlayed: 7, owned: true, minPlayers: 1, maxPlayers: 4 },
  { id: "822", name: "Carcassonne", year: 2000, timesPlayed: 18, owned: true, minPlayers: 2, maxPlayers: 5 },
  { id: "167791", name: "Terraforming Mars", year: 2016, timesPlayed: 11, owned: true, minPlayers: 1, maxPlayers: 5 },
  { id: "173346", name: "7 Wonders Duel", year: 2015, timesPlayed: 25, owned: true, minPlayers: 2, maxPlayers: 2 },
  { id: "98778", name: "Hanabi", year: 2010, timesPlayed: 6, owned: true, minPlayers: 2, maxPlayers: 5 },
  { id: "284083", name: "The Crew: The Quest for Planet Nine", year: 2019, timesPlayed: 14, owned: true, minPlayers: 2, maxPlayers: 5 },
  { id: "9209", name: "Ticket to Ride", year: 2004, timesPlayed: 10, owned: true, minPlayers: 2, maxPlayers: 5 },
  { id: "224517", name: "Brass: Birmingham", year: 2018, timesPlayed: 5, owned: true, minPlayers: 2, maxPlayers: 4 },
  { id: "295947", name: "Cascadia", year: 2021, timesPlayed: 8, owned: true, minPlayers: 1, maxPlayers: 4 },
  { id: "6249", name: "Hearts", year: 1850, timesPlayed: 3, owned: false, minPlayers: 3, maxPlayers: 6, lowScoreWins: true },
];

// Catálogo de BGG (lo que search_games completa cuando "Mis juegos" no alcanza).
const BGG_CATALOG = [
  { id: "359871", name: "Arcs", year: 2024, minPlayers: 2, maxPlayers: 4 },
  { id: "342942", name: "Ark Nova", year: 2021, minPlayers: 1, maxPlayers: 4 },
  { id: "325", name: "Catan: Seafarers", year: 1997, minPlayers: 3, maxPlayers: 4 },
  { id: "174430", name: "Gloomhaven", year: 2017, minPlayers: 1, maxPlayers: 4 },
];

// Compañeros de juego (find_players).
const CO_PLAYERS = [
  { name: "Juan Pérez", username: "juanp", numPlays: 60, lastPlayedDate: "2026-10-25" },
  { name: "Melina Gómez", username: "meli_g", numPlays: 35, lastPlayedDate: "2026-10-20" },
  { name: "Melisa Ruiz", username: "", numPlays: 4, lastPlayedDate: "2026-07-02" },
  { name: "Pedro", username: "pedrito", numPlays: 22, lastPlayedDate: "2026-10-11" },
  { name: "Lucía Chávez", username: "lu_ch", numPlays: 18, lastPlayedDate: "2026-10-18" },
  { name: "Martín (Tincho)", username: "tincho", numPlays: 15, lastPlayedDate: "2026-09-30" },
  { name: "Sofía", username: "sofiar", numPlays: 9, lastPlayedDate: "2026-09-12" },
];

// get_game_variants por juego.
const VARIANTS = {
  237182: {
    variants: ["Mapa de invierno", "Mapa de otoño", "Mapa del lago"],
    factions: ["Marquesa", "Águilas", "Alianza", "Vagabundo", "Lagartos", "Nutrias"],
    expansions: [
      { id: "241386", name: "Root: The Riverfolk Expansion" },
      { id: "330174", name: "Root: The Underworld Expansion" },
    ],
  },
  266192: {
    variants: [],
    factions: [],
    expansions: [
      { id: "290837", name: "Wingspan: European Expansion" },
      { id: "300580", name: "Wingspan: Oceania Expansion" },
    ],
  },
  13: {
    variants: ["Mapa aleatorio"],
    factions: ["Rojo", "Azul", "Blanco", "Naranja"],
    expansions: [
      { id: "325", name: "Catan: Seafarers" },
      { id: "926", name: "Catan: Cities & Knights" },
    ],
  },
  30549: {
    variants: ["Heroico", "Normal", "Introductorio"],
    factions: ["Médico", "Científica", "Investigador", "Experta en operaciones"],
    expansions: [{ id: "40849", name: "Pandemic: On the Brink" }],
  },
  162886: {
    variants: ["Adversario Inglaterra nivel 3", "Adversario Prusia nivel 2"],
    factions: ["Relámpago", "Río", "Sombras", "Vital Strength of the Earth"],
    expansions: [{ id: "220393", name: "Spirit Island: Branch & Claw" }],
  },
  284083: {
    variants: ["Misión 12", "Misión 25"],
    factions: [],
    expansions: [],
  },
};

function gameById(id) {
  const all = [...MY_GAMES, ...BGG_CATALOG];
  return all.find((g) => g.id === String(id)) || null;
}

module.exports = { TODAY, OWNER, MY_GAMES, BGG_CATALOG, CO_PLAYERS, VARIANTS, gameById };
