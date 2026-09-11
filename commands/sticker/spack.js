import axios from "axios";
import sharp from "sharp";
import { crc32 } from "zlib";
import {
  MEDIA_PATH_MAP,
  MEDIA_HKDF_KEY_MAPPING,
  encryptedStream,
  generateWAMessageFromContent,
  generateMessageIDV2,
  unixTimestampSeconds,
  sha256,
  proto,
} from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";

// Configuración de endpoints MMS nativos de WhatsApp
MEDIA_PATH_MAP["sticker-pack"] = "/mms/document";
MEDIA_HKDF_KEY_MAPPING["sticker-pack"] = "Sticker Pack";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toBuffer = async (url) =>
  Buffer.from((await axios.get(url, { responseType: "arraybuffer" })).data);

const isWebp = (b) =>
  b.length >= 12 &&
  b.toString("ascii", 0, 4) === "RIFF" &&
  b.toString("ascii", 8, 12) === "WEBP";

const isAnimatedWebp = (b) => {
  if (!isWebp(b)) return false;
  let o = 12;
  while (o < b.length - 8) {
    const tag = b.toString("ascii", o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (tag === "VP8X" && b[o + 8] & 0x02) return true;
    if (tag === "ANIM" || tag === "ANMF") return true;
    o += 8 + sz + (sz % 2);
  }
  return false;
};

const toWebp = async (buffer, animated = false) =>
  sharp(buffer, animated ? { animated: true } : {})
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80, ...(animated ? { loop: 0 } : {}) })
    .toBuffer();

const makeZip = (files) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + n.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    n.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + n.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    n.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
};

const withRetry = async (fn, attempt = 1) => {
  try {
    return await fn();
  } catch (e) {
    if (e.response?.status === 429 && attempt <= 3) {
      await delay((e.response.headers["retry-after"] || 5) * 1000);
      return withRetry(fn, attempt + 1);
    }
    throw e;
  }
};

const searchStickerly = (query) =>
  withRetry(async () => {
    const { data } = await axios.get(
      "https://api.alyacore.xyz/stickerly/search",
      {
        params: { query, key: "oboe" },
      },
    );
    return data;
  });

const getPackDetail = (url) =>
  withRetry(async () => {
    const { data } = await axios.get(
      "https://api.alyacore.xyz/stickerly/detail",
      {
        params: { url, key: "oboe" },
      },
    );
    return data;
  });

const sendStickerPack = async (
  socket,
  remoteJid,
  { name, publisher, description, stickers, cover, quoted },
) => {
  if (!stickers.length) throw new Error("Pack vacío");
  if (stickers.length > 60) throw new Error("Máximo 60 stickers por pack");

  const packId = generateMessageIDV2();
  const files = {};

  const meta = stickers.map((s) => {
    if (s.sticker.length > 1024 * 1024)
      throw new Error("Un sticker supera 1MB");
    const fileName =
      sha256(s.sticker).toString("base64").replace(/\//g, "-") + ".webp";
    files[fileName] = s.sticker;
    return {
      fileName,
      mimetype: "image/webp",
      isAnimated: !!s.isAnimated,
      emojis: s.emojis?.length ? s.emojis : ["🎭"],
      accessibilityLabel: "",
    };
  });

  const trayIconFileName = `${packId}.webp`;
  files[trayIconFileName] = cover;

  const zipBuffer = makeZip(files);

  const up = await encryptedStream(zipBuffer, "sticker-pack", {
    logger: socket.logger,
  });
  const { directPath } = await socket.waUploadToServer(up.encFilePath, {
    fileEncSha256B64: up.fileEncSha256.toString("base64"),
    mediaType: "sticker-pack",
  });

  const content = {
    stickerPackMessage: {
      name,
      publisher,
      packDescription: description,
      stickerPackId: packId,
      stickerPackOrigin:
        proto.Message.StickerPackMessage.StickerPackOrigin.THIRD_PARTY,
      stickerPackSize: zipBuffer.length,
      stickers: meta,
      fileSha256: up.fileSha256,
      fileEncSha256: up.fileEncSha256,
      mediaKey: up.mediaKey,
      directPath,
      fileLength: up.fileLength,
      mediaKeyTimestamp: unixTimestampSeconds(),
      trayIconFileName,
    },
  };

  const userJid = socket.user?.id || socket.user?.jid;
  const m = generateWAMessageFromContent(remoteJid, content, {
    quoted,
    userJid,
  });
  await socket.relayMessage(remoteJid, m.message, { messageId: m.key.id });
  return m;
};

export default {
  name: ["stickersearch", "buscars", "spack"],
  description: "Busca e instala packs de stickers desde Sticker.ly.",
  adminOnly: false,

  execute: async (socket, message, args, { db, prefix }) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ");

    if (!query) {
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("SINTAXIS INCORRECTA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes ingresar el nombre del pack a buscar.\n`;
      text += `┃ > Ejemplo: ${prefix || "."}spack gatos\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const search = await searchStickerly(query);
      const resultados = search.resultados || search.result || [];
      const freePacks = resultados.filter((p) => !p.isPaid);

      if (!freePacks.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se encontraron packs para: "${query}".\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      const senderNum =
        message.key.participant ||
        message.key.remoteJid.replace(/@s.whatsapp.net|@g.us/, "");
      const user = db?.users?.[senderNum] || {};
      const pushName = message.pushName || "Usuario";

      const packName = user.text1 || global.packname || "Aura Reed";
      const authorName = user.text2 || global.author || `@${pushName}`;

      const bestPack = freePacks[0];
      const detail = await getPackDetail(bestPack.url);

      if (!detail.status || !detail.detalles?.stickers?.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("ERROR DE LECTURA")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se pudo obtener el contenido del paquete.\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      const { detalles } = detail;
      const rawStickers = detalles.stickers.slice(0, 50);

      let infoText = `╭〔 📦 ${fytBold("AURA REED")} 〕⬣\n`;
      infoText += `┃ 🏷️ ${fytBold("PROCESANDO PACK")}\n`;
      infoText += `╰━━━━━━━━━━━━⬣\n\n`;
      infoText += `┃ 📌 Pack: ${detalles.name}\n`;
      infoText += `┃ 🖼️ Stickers: ${rawStickers.length}\n`;
      infoText += `┃ ⏳ Obteniendo Paquete...\n\n`;
      infoText += `╰〔 ⚡${fytBold("SYSTEM INFO")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        { text: infoText },
        { quoted: message },
      );

      const stickers = (
        await Promise.allSettled(
          rawStickers.map(async (s) => {
            const buf = await toBuffer(s.imageUrl);
            const animated = s.isAnimated || isAnimatedWebp(buf);
            const webp = isWebp(buf) ? buf : await toWebp(buf, animated);
            return { sticker: webp, isAnimated: animated, emojis: ["🎭"] };
          }),
        )
      )
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      if (!stickers.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("ERROR DE PROCESAMIENTO")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se pudo convertir ningún sticker del paquete.\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      const cover = await sharp(await toBuffer(detalles.thumbnailUrl))
        .resize(96, 96, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      await sendStickerPack(socket, remoteJid, {
        name: packName,
        publisher: authorName,
        description: `${detalles.name} • Aura Reed Bot`,
        stickers,
        cover,
        quoted: message,
      });

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error(error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚠️ ${fytBold("ERROR DE SISTEMA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > ${error.message}\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
