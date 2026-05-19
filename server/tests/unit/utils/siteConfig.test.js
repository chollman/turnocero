const SiteConfig = require('../../../models/SiteConfig');
const {
  loadSiteConfig,
  isSectionEnabled,
  updateSiteConfig,
} = require('../../../utils/siteConfig');

describe('utils/siteConfig', () => {
  it('SECTION_KEYS covers every public section the app uses', () => {
    expect(SiteConfig.SECTION_KEYS).toEqual(expect.arrayContaining([
      'mesas', 'compartidas', 'noticias', 'torneos', 'eventos',
      'comunidad', 'miFeed', 'amigos', 'dms', 'bgwatch', 'utilidades',
    ]));
  });

  it('defaultFor returns false for legacy admin-only sections, true otherwise', () => {
    expect(SiteConfig.defaultFor('mesas')).toBe(false);
    expect(SiteConfig.defaultFor('torneos')).toBe(false);
    expect(SiteConfig.defaultFor('miFeed')).toBe(false);
    expect(SiteConfig.defaultFor('compartidas')).toBe(true);
    expect(SiteConfig.defaultFor('eventos')).toBe(true);
    expect(SiteConfig.defaultFor('utilidades')).toBe(true);
  });

  describe('loadSiteConfig + getSiteConfig + isSectionEnabled', () => {
    it('creates a singleton on first load and applies defaults', async () => {
      const config = await loadSiteConfig();
      expect(config._id).toBe('singleton');
      expect(config.sections.mesas.enabled).toBe(false);
      expect(config.sections.compartidas.enabled).toBe(true);

      // Persisted in DB
      const stored = await SiteConfig.findById('singleton');
      expect(stored).not.toBeNull();
    });

    it('isSectionEnabled reflects the loaded cache', async () => {
      await loadSiteConfig();
      expect(isSectionEnabled('compartidas')).toBe(true);
      expect(isSectionEnabled('mesas')).toBe(false);
      expect(isSectionEnabled('made-up-key')).toBe(true); // unknown keys default to allowed
    });

    it('falls back to default when cache is empty (loadSiteConfig not called)', () => {
      // Reset cache by re-requiring the module
      delete require.cache[require.resolve('../../../utils/siteConfig')];
      const m = require('../../../utils/siteConfig');
      const cfg = m.getSiteConfig();
      expect(cfg.sections.compartidas.enabled).toBe(true);
      expect(cfg.sections.mesas.enabled).toBe(false);
    });
  });

  describe('updateSiteConfig', () => {
    it('flips a single section and persists', async () => {
      const adminId = '507f1f77bcf86cd799439011';
      await loadSiteConfig();

      const updated = await updateSiteConfig(
        { mesas: { enabled: true } },
        adminId,
        null,
      );
      expect(updated.sections.mesas.enabled).toBe(true);
      expect(updated.sections.compartidas.enabled).toBe(true);
      expect(isSectionEnabled('mesas')).toBe(true);
    });

    it('ignores unknown section keys', async () => {
      await loadSiteConfig();
      const updated = await updateSiteConfig({ foobar: { enabled: false } }, null, null);
      expect(updated.sections.foobar).toBeUndefined();
    });

    it('ignores non-boolean enabled values', async () => {
      await loadSiteConfig();
      const updated = await updateSiteConfig(
        { mesas: { enabled: 'yes' } },
        null,
        null,
      );
      // Still the default
      expect(updated.sections.mesas.enabled).toBe(false);
    });

    it('emits site-config:updated when io is provided', async () => {
      await loadSiteConfig();
      const emit = vi.fn();
      await updateSiteConfig({ eventos: { enabled: false } }, null, { emit });
      expect(emit).toHaveBeenCalledWith('site-config:updated', expect.any(Object));
    });
  });
});
