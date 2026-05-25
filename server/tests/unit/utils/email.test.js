// Note: email.js reads RESEND_API_KEY at module load. The "configured" path
// is exercised in integration tests where we mock the Resend module via vi.mock
// at the top of the test file. Here we cover the pure helpers (verificationEmail,
// passwordResetEmail) and the no-key fallback branch.

describe("utils/email", () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.resetModules();
  });

  // Note: sendEmail itself is monkey-patched at tests/setup.js (the network
  // boundary). Integration tests assert it was called with the right payload.
  // Here we only test the pure template helpers below.

  describe("verificationEmail", () => {
    it("returns subject + html + text with the code embedded", () => {
      const { verificationEmail } = require("../../../utils/email");
      const e = verificationEmail({ username: "cha", code: "123456" });
      expect(e.subject).toMatch(/activar/i);
      expect(e.html).toContain("123456");
      expect(e.text).toContain("123456");
      expect(e.text).toContain("cha");
    });

    it("never lets a raw <script> tag survive through to html (XSS safe)", () => {
      const { verificationEmail } = require("../../../utils/email");
      const e = verificationEmail({
        username: "<script>alert(1)</script>",
        code: "999999",
      });
      // No raw <script> tag should appear (escapeHtml turns `<` into `&lt;`).
      expect(e.html).not.toMatch(/<script\b/i);
    });

    it('uses "jugador" fallback when username is empty', () => {
      const { verificationEmail } = require("../../../utils/email");
      const e = verificationEmail({ username: "", code: "111111" });
      expect(e.html).toContain("jugador");
      expect(e.text).toContain("jugador");
    });

    it("mentions 15-minute expiry to the user", () => {
      const { verificationEmail } = require("../../../utils/email");
      const e = verificationEmail({ username: "x", code: "000000" });
      expect(e.html).toMatch(/15 minutos/);
      expect(e.text).toMatch(/15 minutos/);
    });
  });

  describe("passwordResetEmail", () => {
    it("embeds the reset url in both html and text", () => {
      const { passwordResetEmail } = require("../../../utils/email");
      const e = passwordResetEmail({
        username: "cha",
        resetUrl: "https://turnocero.app/reset/abc",
      });
      expect(e.subject).toMatch(/contraseña/i);
      expect(e.html).toContain("https://turnocero.app/reset/abc");
      expect(e.text).toContain("https://turnocero.app/reset/abc");
    });

    it("escapes double-quotes in the reset url so attribute injection is blocked", () => {
      const { passwordResetEmail } = require("../../../utils/email");
      // Attacker tries to break out of href="..." and inject onload=
      const evil = 'https://x.com/" onload="alert(1)';
      const e = passwordResetEmail({ username: "x", resetUrl: evil });
      // The raw breakout `" ` must be encoded — &quot; is the actual mitigation.
      expect(e.html).toContain("&quot;");
      // The literal sequence `" onload="` (breakout) must not appear in the html.
      expect(e.html).not.toContain('" onload="');
    });

    it("mentions 1-hour expiry to the user", () => {
      const { passwordResetEmail } = require("../../../utils/email");
      const e = passwordResetEmail({ username: "x", resetUrl: "https://x" });
      expect(e.html).toMatch(/1 hora/);
      expect(e.text).toMatch(/1 hora/);
    });
  });
});
