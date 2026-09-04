const Compartida = require("../models/Compartida");
const User = require("../models/User");
const instagramService = require("../services/instagramService");
const { decrypt } = require("../utils/encryption");
const emitNotification = require("../utils/emitNotification");
const logger = require("../utils/logger");

// Cuántas Compartidas procesa como máximo por tick — acota la duración del
// tick aunque se acumule una cola grande (procesa el resto en el próximo).
const BATCH_SIZE = 10;

/**
 * Job: publica en Instagram las Compartidas encoladas por
 * POST /api/compartidas/:id/instagram-post (routes/compartidas.js), que solo
 * marca `instagram.feed/story.status = "pending"` y responde de inmediato —
 * el trabajo real (crear contenedor(es) → poll → publish contra la Graph API)
 * pasa acá, así nunca bloquea el request que crea/edita la Compartida.
 *
 * Diseñado para correrse cada pocos minutos (ver jobs/scheduler.js).
 *
 * @param {object} [opts]
 * @param {Date}   [opts.now]  Inyectable para tests; default = new Date().
 * @param {object} [opts.io]   Instancia de Socket.IO para notificar en tiempo
 *                             real. Opcional — sin ella, la notif igual se
 *                             persiste (degraded mode, como eventoReminders).
 * @returns {Promise<{ processed: number, succeeded: number, failed: number }>}
 */
async function runOnce({ now = new Date(), io = null } = {}) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const pending = await Compartida.find({
    $or: [
      { "instagram.feed.status": "pending" },
      { "instagram.story.status": "pending" },
    ],
  })
    .sort({ updatedAt: 1 })
    .limit(BATCH_SIZE);

  for (const compartida of pending) {
    const targets = [];
    if (compartida.instagram.feed.status === "pending") targets.push("feed");
    if (compartida.instagram.story.status === "pending") targets.push("story");
    if (targets.length === 0) continue;

    const author = await User.findById(compartida.author);
    const igCreds = author?.instagramCredentials;

    for (const target of targets) {
      processed += 1;
      const sub = compartida.instagram[target];
      try {
        if (!author || !igCreds?.encryptedPageAccessToken || igCreds.invalid) {
          throw Object.assign(
            new Error("La cuenta de Instagram ya no está conectada"),
            { status: 400 },
          );
        }

        const pageAccessToken = decrypt(
          igCreds.encryptedPageAccessToken,
          "INSTAGRAM_CREDS_KEY",
        );
        const caption = instagramService.buildCaption(compartida);
        const imageUrls = compartida.images.map((img) => img.url);

        let mediaId;
        let permalink = "";
        if (target === "feed") {
          let containerId;
          if (imageUrls.length === 1) {
            containerId = await instagramService.createImageContainer({
              igUserId: igCreds.igUserId,
              pageAccessToken,
              imageUrl: imageUrls[0],
              caption,
            });
          } else {
            const childrenIds = [];
            for (const imageUrl of imageUrls) {
              childrenIds.push(
                await instagramService.createImageContainer({
                  igUserId: igCreds.igUserId,
                  pageAccessToken,
                  imageUrl,
                  isCarouselItem: true,
                }),
              );
            }
            containerId = await instagramService.createCarouselContainer({
              igUserId: igCreds.igUserId,
              pageAccessToken,
              childrenIds,
              caption,
            });
          }
          await instagramService.pollContainerStatus(containerId, pageAccessToken);
          mediaId = await instagramService.publishContainer(
            containerId,
            igCreds.igUserId,
            pageAccessToken,
          );
          permalink = await instagramService
            .fetchPermalink(mediaId, pageAccessToken)
            .catch(() => "");
        } else {
          // Historias no soportan carrusel — se publica solo la primera foto.
          const containerId = await instagramService.createStoryContainer({
            igUserId: igCreds.igUserId,
            pageAccessToken,
            imageUrl: imageUrls[0],
          });
          await instagramService.pollContainerStatus(containerId, pageAccessToken);
          mediaId = await instagramService.publishContainer(
            containerId,
            igCreds.igUserId,
            pageAccessToken,
          );
        }

        sub.status = "posted";
        sub.mediaId = mediaId;
        sub.postedAt = now;
        sub.error = "";
        if (target === "feed") sub.permalink = permalink;
        succeeded += 1;

        await emitNotification({
          io,
          recipientId: compartida.author,
          type: "instagram_post_success",
          fields: {
            compartidaId: compartida._id.toString(),
            compartidaTitle: compartida.title,
            instagramTarget: target,
            instagramPermalink: permalink,
          },
          socketEvent: "instagram:post-success",
        });
      } catch (err) {
        sub.status = "failed";
        sub.error = err.message;
        failed += 1;
        logger.error("[instagramPublish] target failed", {
          compartidaId: compartida._id.toString(),
          target,
          error: err.message,
        });

        // Token revocado/expirado — marcar la cuenta para que /perfil pida
        // reconectar en vez de reintentar en cada tick (mismo criterio que
        // bggAuth.js con bggCredentials.invalid).
        if (err.status === 401 && author) {
          author.instagramCredentials.invalid = true;
          try {
            await author.save();
          } catch (saveErr) {
            logger.error("[instagramPublish] failed to mark account invalid", {
              userId: author._id.toString(),
              error: saveErr.message,
            });
          }
        }

        try {
          await emitNotification({
            io,
            recipientId: compartida.author,
            type: "instagram_post_failed",
            fields: {
              compartidaId: compartida._id.toString(),
              compartidaTitle: compartida.title,
              instagramTarget: target,
              instagramError: err.message,
            },
            socketEvent: "instagram:post-failed",
          });
        } catch (notifErr) {
          logger.error("[instagramPublish] emitNotification failed", {
            compartidaId: compartida._id.toString(),
            error: notifErr.message,
          });
        }
      }
    }

    try {
      await compartida.save();
    } catch (err) {
      logger.error("[instagramPublish] save compartida failed", {
        compartidaId: compartida._id.toString(),
        error: err.message,
      });
    }
  }

  return { processed, succeeded, failed };
}

module.exports = { runOnce };
