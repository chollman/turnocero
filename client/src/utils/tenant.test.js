import { describe, it, expect, afterEach, vi } from "vitest";
import { detectTenant } from "./tenant";

describe("detectTenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("?tenant= dev override", () => {
    it("returns the slug from the query param", () => {
      expect(detectTenant({ hostname: "localhost", search: "?tenant=patagonia" })).toEqual({
        slug: "patagonia",
      });
    });

    it("lowercases and trims the override", () => {
      expect(detectTenant({ hostname: "localhost", search: "?tenant=ROSARIO" })).toEqual({
        slug: "rosario",
      });
    });

    it("ignores reserved slugs", () => {
      expect(detectTenant({ hostname: "localhost", search: "?tenant=www" })).toBeNull();
      expect(detectTenant({ hostname: "localhost", search: "?tenant=turnocero" })).toBeNull();
    });

    it("takes precedence over the hostname", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(
        detectTenant({ hostname: "rosario.turnocero.com", search: "?tenant=patagonia" }),
      ).toEqual({ slug: "patagonia" });
    });
  });

  describe("*.localhost (dev)", () => {
    it("extracts the slug before .localhost", () => {
      expect(detectTenant({ hostname: "patagonia.localhost", search: "" })).toEqual({
        slug: "patagonia",
      });
    });

    it("returns null for bare localhost", () => {
      expect(detectTenant({ hostname: "localhost", search: "" })).toBeNull();
    });
  });

  describe("production <slug>.<VITE_TENANT_DOMAIN>", () => {
    it("extracts the slug from the subdomain", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "patagonia.turnocero.com", search: "" })).toEqual({
        slug: "patagonia",
      });
    });

    it("supports hyphenated slugs", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "rosario-juega.turnocero.com", search: "" })).toEqual({
        slug: "rosario-juega",
      });
    });

    it("returns null for the apex domain", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "turnocero.com", search: "" })).toBeNull();
    });

    it("returns null for reserved subdomains", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "www.turnocero.com", search: "" })).toBeNull();
      expect(detectTenant({ hostname: "app.turnocero.com", search: "" })).toBeNull();
      expect(detectTenant({ hostname: "api.turnocero.com", search: "" })).toBeNull();
    });

    it("returns null for multi-level subdomains", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "a.b.turnocero.com", search: "" })).toBeNull();
    });

    it("returns null for a host that does not match the apex", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "turnocero.com");
      expect(detectTenant({ hostname: "evil.com", search: "" })).toBeNull();
      expect(detectTenant({ hostname: "patagonia.evil.com", search: "" })).toBeNull();
    });

    it("returns null when VITE_TENANT_DOMAIN is unset", () => {
      vi.stubEnv("VITE_TENANT_DOMAIN", "");
      expect(detectTenant({ hostname: "patagonia.turnocero.com", search: "" })).toBeNull();
    });
  });
});
