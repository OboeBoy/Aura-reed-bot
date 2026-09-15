import crypto from "crypto";
import {
  generateWAMessage,
  generateWAMessageFromContent,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

const ALBUM_ITEM_DELAY_MS = Number(process.env.ALBUM_ITEM_DELAY_MS || 900);
const MAX_ALBUM_ITEMS = Number(process.env.MAX_ALBUM_ITEMS || 6);
const MAX_RATE_LIMIT_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error) {
  const text = String(
    error?.message ||
      error?.data?.message ||
      error?.output?.payload?.message ||
      "",
  ).toLowerCase();

  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.output?.statusCode === 429 ||
    text.includes("rate-overlimit") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("429")
  );
}

function retryDelay(error, attempt) {
  const retryAfter = Number(
    error?.response?.headers?.["retry-after"] ||
      error?.headers?.["retry-after"] ||
      0,
  );

  return Math.max(retryAfter * 1000, 1500 * 2 ** (attempt - 1));
}

async function relayWithRateLimit(socket, jid, message, messageId) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await socket.relayMessage(jid, message, { messageId });
    } catch (error) {
      if (!isRateLimitError(error) || attempt > MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      await sleep(retryDelay(error, attempt));
    }
  }
}

export async function sendAlbumMessage(socket, jid, items, quoted) {
  const albumItems = items.slice(0, MAX_ALBUM_ITEMS);
  const userJid = jidNormalizedUser(
    socket.user?.id || socket.authState?.creds?.me?.id || "",
  );
  const album = await generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: {
        messageSecret: crypto.randomBytes(32),
      },
      albumMessage: {
        expectedImageCount: albumItems.filter((item) => "image" in item).length,
        expectedVideoCount: albumItems.filter((item) => "video" in item).length,
      },
    },
    { quoted, userJid },
  );

  await relayWithRateLimit(socket, jid, album.message, album.key.id);

  for (const [index, item] of albumItems.entries()) {
    if (index > 0) await sleep(ALBUM_ITEM_DELAY_MS);

    const mediaMessage = await generateWAMessage(jid, item, {
      upload: socket.waUploadToServer,
      userJid,
    });
    mediaMessage.message.messageContextInfo = {
      messageSecret: crypto.randomBytes(32),
      messageAssociation: {
        associationType: 1,
        parentMessageKey: album.key,
      },
    };

    await relayWithRateLimit(
      socket,
      jid,
      mediaMessage.message,
      mediaMessage.key.id,
    );
  }

  return album;
}
