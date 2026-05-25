// Stub for `server/utils/email`. Apply in tests with:
//   vi.mock('../../utils/email', () => require('../mocks/email'));
// `vi` is provided as a global via vitest's `globals: true`.

const sentEmails = [];

const sendEmail = vi.fn(async (params) => {
  sentEmails.push(params);
  return { id: `mock-email-${sentEmails.length}` };
});

const verificationEmail = vi.fn((code) => ({
  subject: `Verificá tu cuenta — ${code}`,
  html: `<p>Tu código es: <strong>${code}</strong></p>`,
}));

const passwordResetEmail = vi.fn((url) => ({
  subject: "Recuperar contraseña",
  html: `<a href="${url}">${url}</a>`,
}));

module.exports = {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
  __sentEmails: sentEmails,
  __resetMocks() {
    sentEmails.length = 0;
    sendEmail.mockClear();
    verificationEmail.mockClear();
    passwordResetEmail.mockClear();
  },
};
