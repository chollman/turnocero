import { describe, it, expect } from "vitest";
import { STORAGE_KEYS } from "./storageKeys";

describe("STORAGE_KEYS", () => {
  it("expone las keys conocidas como strings", () => {
    expect(STORAGE_KEYS.TOKEN).toBe("token");
    expect(STORAGE_KEYS.VIEW_AS_USER).toBe("viewAsUser");
    expect(STORAGE_KEYS.THEME).toBe("turnocero_theme");
    expect(STORAGE_KEYS.SIDEBAR_COLLAPSED).toBe("turnocero_sidebar_collapsed");
    expect(STORAGE_KEYS.BANNED_MESSAGE).toBe("bannedMessage");
    expect(STORAGE_KEYS.FLASH_MESSAGE).toBe("flashMessage");
    expect(STORAGE_KEYS.PENDING_VERIFY_EMAIL).toBe(
      "turnocero_pending_verify_email",
    );
  });

  it("está frozen para que un consumidor no pueda mutarlo", () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true);
    expect(() => {
      "use strict";
      STORAGE_KEYS.TOKEN = "x";
    }).toThrow();
  });
});
