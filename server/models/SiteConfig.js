const mongoose = require("mongoose");

const SECTION_KEYS = [
  "mesas",
  "compartidas",
  "noticias",
  "torneos",
  "eventos",
  "comunidad",
  "miFeed",
  "amigos",
  "dms",
  "bgwatch",
  "utilidades",
  "colabora",
  "calendario",
];

// Defaults que preservan el comportamiento actual hardcodeado:
// mesas/torneos/miFeed estaban admin-only via hardcode → mantenemos OFF para regular users.
// Si no aparece acá, el default es true.
const DEFAULT_ENABLED = {
  mesas: false,
  torneos: false,
  miFeed: false,
};

function defaultFor(key) {
  return DEFAULT_ENABLED[key] !== false;
}

const sectionSchema = new mongoose.Schema(
  { enabled: { type: Boolean, default: true } },
  { _id: false },
);

const sectionsShape = SECTION_KEYS.reduce((acc, key) => {
  acc[key] = {
    type: sectionSchema,
    default: () => ({ enabled: defaultFor(key) }),
  };
  return acc;
}, {});

const siteConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    sections: sectionsShape,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);

SiteConfig.SECTION_KEYS = SECTION_KEYS;
SiteConfig.DEFAULT_ENABLED = DEFAULT_ENABLED;
SiteConfig.defaultFor = defaultFor;

module.exports = SiteConfig;
