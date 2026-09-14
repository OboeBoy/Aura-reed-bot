import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  fetchJson,
  downloadStreamToFile,
} from "../../controllers/downloadUtils.js";
import { fytBold } from "../../models/TextStyle.js";

const customTemp = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../tmp",
);
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

async function firstSuccessfulPromise(promises) {
  return new Promise((resolve, reject) => {
    let errors = [];
    let completed = 0;
    if (promises.length === 0) {
      reject(new Error("No hay servidores disponibles."));
      return;
    }
    promises.forEach((p) => {
      Promise.resolve(p)
        .then((res) => {
          if (res) resolve(res);
          else throw new Error("Respuesta vacía o inválida");
        })
        .catch((err) => {
          errors.push(err);
        })
        .finally(() => {
          completed++;
          if (completed === promises.length) {
            reject(
              new Error(
                "Todos los servidores fallaron: " +
                  errors.map((e) => e.message).join(" | "),
              ),
            );
          }
        });
    });
  });
}

function normalizeDelirius(res) {
  if (!res || !res.status || !res.list || res.list.length === 0) {
    throw new Error("Delirius no devolvió datos válidos");
  }
  const validVideos = res.list.filter((v) => v.url && v.url !== "/");
  if (validVideos.length === 0)
    throw new Error("Delirius: No se encontraron videos válidos");

  const hdVideo = validVideos.find(
    (v) =>
      v.quality &&
      (v.quality.includes("HD") ||
        v.quality.includes("720p") ||
        v.quality.includes("1080p")),
  );
  const video = hdVideo || validVideos[0];

  return {
    url: video.url,
    quality: video.quality || "N/A",
    thumbnail: res.thumb || null,
    motor: "Delirius",
  };
}

function normalizeAlyacore(res) {
  if (!res || !res.status || !res.resultados || res.resultados.length === 0) {
    throw new Error("Alyacore no devolvió resultados válidos");
  }
  const validVideos = res.resultados.filter((v) => v.url && v.url !== "/");
  if (validVideos.length === 0)
    throw new Error("Alyacore: No se encontraron videos válidos");

  const hdVideo = validVideos.find(
    (v) =>
      v.quality &&
      (v.quality.includes("HD") ||
        v.quality.includes("720p") ||
        v.quality.includes("1080p")),
  );
  const video = hdVideo || validVideos[0];

  return {
    url: video.url,
    quality: video.quality || "N/A",
    thumbnail: null,
    motor: "Alyacore",
  };
}

function normalizeStellar(res) {
  if (!res || !res.status || !res.resultados || res.resultados.length === 0) {
    throw new Error("StellarWA no devolvió resultados válidos");
  }
  const validVideos = res.resultados.filter((v) => v.url && v.url !== "/");
  if (validVideos.length === 0)
    throw new Error("StellarWA: No se encontraron videos válidos");

  const hdVideo = validVideos.find(
    (v) =>
      v.quality &&
      (v.quality.includes("HD") ||
        v.quality.includes("720p") ||
        v.quality.includes("1080p")),
  );
  const video = hdVideo || validVideos[0];

  return {
    url: video.url,
    quality: video.quality || "N/A",
    thumbnail: null,
    motor: "StellarWA",
  };
}

export default {
  name: ["fb", "facebook", "fbdl", "facebookdl", "fbvideo", "fbv", "fbreels"],
  category: "downloads",
  description: "Descarga videos de Facebook / Reels.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const url = args[0] ? args[0].trim() : "";

    if (!url) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA ENLACE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > de Facebook o Facebook Reels.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    socket
      .sendMessage(remoteJid, { react: { text: "⏳", key: message.key } })
      .catch(() => {});

    const fileId = crypto.randomBytes(8).toString("hex");
    const tempPath = path.join(customTemp, `fb_${fileId}.mp4`);

    try {
      const fbTasks = [
        (async () => {
          const res = await fetchJson(
            `https://api.delirius.store/download/facebook?url=${encodeURIComponent(url)}`,
          );
          return normalizeDelirius(res);
        })(),
        (async () => {
          const res = await fetchJson(
            `https://api.alyacore.xyz/dl/facebook?url=${encodeURIComponent(url)}&key=${global.Apis?.apiAiya?.apikey || "oboe"}`,
          );
          return normalizeAlyacore(res);
        })(),
        (async () => {
          const res = await fetchJson(
            `https://api.stellarwa.xyz/dl/facebook?url=${encodeURIComponent(url)}&key=api-7dSKm`,
          );
          return normalizeStellar(res);
        })(),
      ];

      const metadata = await firstSuccessfulPromise(fbTasks);
      const { url: videoUrl, quality, thumbnail, motor } = metadata;

      await downloadStreamToFile(videoUrl, tempPath, { timeout: 120000 });

      let caption = `╭〔 🎥 ${fytBold("FACEBOOK VIDEO")} 〕━⬣\n\n`;
      caption += `┃ > ${fytBold("Calidad")} › ${quality}\n`;
      caption += `┃ > ${fytBold("Motor")} › ${motor}\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      if (thumbnail) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: thumbnail }, caption },
          { quoted: message },
        );
      }

      await socket.sendMessage(
        remoteJid,
        {
          video: { url: tempPath },
          mimetype: "video/mp4",
          fileName: "facebook.mp4",
          caption: caption,
          contextInfo: {
            isForwarded: true,
            forwardingScore: 999,
          },
        },
        { quoted: message },
      );

      socket
        .sendMessage(remoteJid, { react: { text: "✅", key: message.key } })
        .catch(() => {});
    } catch (error) {
      socket
        .sendMessage(remoteJid, { react: { text: "❌", key: message.key } })
        .catch(() => {});
      const errorMsg = error.message || "Ocurrió un error inesperado.";
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  },
};
