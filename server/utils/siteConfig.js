const SiteConfig = require("../models/SiteConfig");
const logger = require("./logger");

let cache = null;

function buildDefault() {
  const sections = {};
  for (const key of SiteConfig.SECTION_KEYS) {
    sections[key] = { enabled: SiteConfig.defaultFor(key) };
  }
  return { _id: "singleton", sections, updatedBy: null, updatedAt: null };
}

function toPlain(doc) {
  if (!doc) return buildDefault();
  const obj = doc.toObject ? doc.toObject() : doc;
  const sections = {};
  for (const key of SiteConfig.SECTION_KEYS) {
    // Si el doc existente no tiene el key (sección agregada después), aplicar default
    const stored = obj.sections?.[key];
    sections[key] = {
      enabled: stored ? stored.enabled !== false : SiteConfig.defaultFor(key),
    };
  }
  return {
    _id: "singleton",
    sections,
    updatedBy: obj.updatedBy || null,
    updatedAt: obj.updatedAt || null,
  };
}

async function loadSiteConfig() {
  try {
    let doc = await SiteConfig.findById("singleton");
    if (!doc) {
      doc = await SiteConfig.create({ _id: "singleton" });
      logger.info("SiteConfig singleton created with defaults");
    }
    cache = toPlain(doc);
    return cache;
  } catch (err) {
    logger.error("Failed to load SiteConfig", { error: err.message });
    cache = buildDefault();
    return cache;
  }
}

function getSiteConfig() {
  if (!cache) return buildDefault();
  return cache;
}

function isSectionEnabled(name) {
  const config = getSiteConfig();
  return config.sections?.[name]?.enabled !== false;
}

async function updateSiteConfig(patchSections, userId, io) {
  const update = { updatedBy: userId };
  for (const key of Object.keys(patchSections || {})) {
    if (!SiteConfig.SECTION_KEYS.includes(key)) continue;
    const enabled = patchSections[key]?.enabled;
    if (typeof enabled !== "boolean") continue;
    update[`sections.${key}.enabled`] = enabled;
  }
  const doc = await SiteConfig.findByIdAndUpdate(
    "singleton",
    { $set: update },
    { new: true, upsert: true },
  );
  cache = toPlain(doc);
  if (io) io.emit("site-config:updated", cache);
  return cache;
}

module.exports = {
  loadSiteConfig,
  getSiteConfig,
  isSectionEnabled,
  updateSiteConfig,
  SECTION_KEYS: SiteConfig.SECTION_KEYS,
};
