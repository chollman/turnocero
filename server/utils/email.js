const { Resend } = require('resend');
const logger = require('./logger');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    logger.warn('Resend not configured; skipping email', { to, subject });
    return { skipped: true };
  }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html, text });
    if (result?.error) {
      logger.error('Resend returned error', { to, subject, error: result.error });
      throw new Error(result.error.message || 'Resend error');
    }
    return result;
  } catch (err) {
    logger.error('Email send failed', { to, subject, msg: err.message });
    throw err;
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared wrapper: dark TurnoCero look (Blizzard-style navy + amber accent).
// Inline styles only — most mail clients strip <style> tags.
function wrap({ heading, body, footer }) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>TurnoCero</title></head>
<body style="margin:0;padding:0;background:#0e1a2b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5edf5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e1a2b;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#172538;border:1px solid #243a55;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #243a55;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f5b400;color:#0e1a2b;font-weight:800;font-size:20px;width:40px;height:40px;text-align:center;border-radius:8px;">T</td>
              <td style="padding-left:12px;">
                <div style="font-size:18px;font-weight:700;color:#f5b400;letter-spacing:0.3px;">TurnoCero</div>
                <div style="font-size:11px;color:#8aa1bd;letter-spacing:1px;">BOARD GAME MEETUPS</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <h1 style="margin:0 0 16px 0;font-size:22px;color:#ffffff;font-weight:700;">${escapeHtml(heading)}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #243a55;font-size:12px;color:#8aa1bd;line-height:1.5;">
          ${footer || 'Si no esperabas este mail, ignoralo. Nadie podrá acceder a tu cuenta sin él.'}
        </td></tr>
      </table>
      <div style="margin-top:16px;font-size:11px;color:#5d7895;">TurnoCero · La comunidad argentina de juegos de mesa</div>
    </td></tr>
  </table>
</body>
</html>`;
}

function verificationEmail({ username, code }) {
  const safeUser = escapeHtml(username || 'jugador');
  const safeCode = escapeHtml(code);
  const html = wrap({
    heading: `¡Hola, ${  safeUser  }! 🎲`,
    body: `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#d5dfeb;">
        Gracias por sumarte a TurnoCero. Para activar tu cuenta, ingresá este código en la app:
      </p>
      <div style="margin:24px 0;padding:20px;background:#0e1a2b;border:1px solid #f5b400;border-radius:10px;text-align:center;">
        <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#f5b400;">${safeCode}</div>
      </div>
      <p style="margin:0;font-size:13px;color:#8aa1bd;">El código expira en 15 minutos.</p>
    `,
    footer: 'Si no creaste esta cuenta, ignorá este mail.',
  });
  const text = `¡Hola, ${username || 'jugador'}!\n\nTu código de verificación de TurnoCero es: ${code}\n\nEl código expira en 15 minutos.\n\nSi no creaste esta cuenta, ignorá este mail.`;
  return {
    subject: 'Tu código para activar TurnoCero',
    html,
    text,
  };
}

function passwordResetEmail({ username, resetUrl }) {
  const safeUser = escapeHtml(username || 'jugador');
  const safeUrl = escapeHtml(resetUrl);
  const html = wrap({
    heading: 'Recuperá tu contraseña',
    body: `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#d5dfeb;">
        Hola ${safeUser}, recibimos un pedido para restablecer tu contraseña en TurnoCero. Hacé click en el botón para elegir una nueva:
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${safeUrl}" style="display:inline-block;background:#f5b400;color:#0e1a2b;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:15px;">Restablecer contraseña</a>
      </div>
      <p style="margin:0 0 8px 0;font-size:13px;color:#8aa1bd;">¿No funciona el botón? Copiá y pegá este link en tu navegador:</p>
      <p style="margin:0 0 16px 0;font-size:12px;color:#8aa1bd;word-break:break-all;"><a href="${safeUrl}" style="color:#f5b400;">${safeUrl}</a></p>
      <p style="margin:0;font-size:13px;color:#8aa1bd;">El link expira en 1 hora.</p>
    `,
    footer: 'Si no pediste restablecer tu contraseña, ignorá este mail. Tu cuenta sigue segura.',
  });
  const text = `Hola ${username || 'jugador'},\n\nRecibimos un pedido para restablecer tu contraseña en TurnoCero. Abrí este link para elegir una nueva:\n\n${resetUrl}\n\nEl link expira en 1 hora.\n\nSi no pediste esto, ignorá este mail.`;
  return {
    subject: 'Recuperá tu contraseña en TurnoCero',
    html,
    text,
  };
}

module.exports = {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
};
