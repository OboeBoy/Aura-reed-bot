import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";
import { TikTokClient } from "../../src/libs/tiktok-api/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customTemp = path.join(__dirname, "../../tmp");

process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

const execAsync = promisify(exec);
const tmp = customTemp;

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

const tiktokClient = new TikTokClient({ region: "US" });

const TIKTOK_URL_REGEX =
  /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  Referer: "https://www.tiktok.com/",
};

function extractTiktokUrl(text) {
  const match = text.match(TIKTOK_URL_REGEX);
  return match ? match[0] : null;
}

function pickBestFormat(video) {
  const formats = video.formats || [];

  if (formats.length > 0) {
    const withoutWatermark = formats.filter(
      (f) => f.has_watermark === false && f.url
    );
    const pool = withoutWatermark.length > 0 ? withoutWatermark : formats.filter((f) => f.url);

    if (pool.length > 0) {
      const sorted = [...pool].sort((a, b) => {
        const areaA = (a.width || 0) * (a.height || 0);
        const areaB = (b.width || 0) * (b.height || 0);
        return areaB - areaA;
      });

      return {
        url: sorted[0].url,
        hasWatermark: sorted[0].has_watermark ?? true,
      };
    }
  }

  const fallbackUrl = video.downloadAddr?.[0] || video.playAddr?.[0];
  return fallbackUrl ? { url: fallbackUrl, hasWatermark: true } : null;
}

async function resolveTiktokUrl(rawText) {
  const directUrl = extractTiktokUrl(rawText);
  if (directUrl) return directUrl;

  const APIKEY = global.Apis?.apiAiya?.apikey;
  if (APIKEY) {
    try {
      const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(rawText)}&key=${APIKEY}`;
      const { data: alyaData } = await axios.get(alyaUrl, { timeout: 15000 });
      if (alyaData.status && Array.isArray(alyaData.data) && alyaData.data.length > 0) {
        return alyaData.data[0].url;
      }
    } catch (e) {}
  }

  const search = await tiktokClient.search(rawText, { resultLimit: 1 });
  if (search.error || !search.data || !search.data.length) {
    throw new Error(`No encontré ningún video de TikTok para "${rawText}".`);
  }

  const best = search.data[0];
  const uniqueId = best.author?.uniqueId || "tiktok";
  return `https://www.tiktok.com/@${uniqueId}/video/${best.id}`;
}

async function DL_TIKTOK(input) {
  try {
    const targetUrl = await resolveTiktokUrl(input);
    const download = await tiktokClient.downloadVideo(targetUrl);

    if (download.status !== "success" || !download.result) {
      throw new Error(download.message || "No se pudieron extraer los datos del video.");
    }

    const r = download.result;
    if (r.type !== "video") {
      throw new Error("El resultado obtenido es una galería de fotos, no un video.");
    }

    const format = pickBestFormat(r.video);
    if (!format || !format.url) {
      throw new Error("El video no trajo ninguna URL descargable.");
    }

    const dateCreate = (ts) =>
      ts ? new Date(Number(ts) * 1000).toLocaleDateString("es-ES") : "Desconocida";

    return {
      video_dl: format.url,
      title: r.desc || "Video de TikTok",
      authorNick: r.author?.uniqueId || "Desconocido",
      likes: formatter(r.statistics?.likeCount || 0),
      views: formatter(r.statistics?.playCount || 0),
      shares: formatter(r.statistics?.shareCount || 0),
      collect: formatter(r.statistics?.downloadCount || 0),
      comments: formatter(r.statistics?.commentCount || 0),
      time: dateCreate(r.createTime),
      tk_url: targetUrl,
      hasWatermark: format.hasWatermark,
    };
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: FETCH_HEADERS,
    timeout: 60000,
  });

  const writer = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("error", reject);
    writer.on("finish", resolve);
  });
}

async function processVideoFile(inputP, outP) {
  await execAsync(
    `ffmpeg -y -fflags +genpts -i "${inputP}" -map 0:v:0 -map 0:a:0? -vf "scale='min(1080,iw)':-2" -c:v libx264 -preset ultrafast -crf 17 -profile:v main -level 4.0 -pix_fmt yuv420p -threads 0 -c:a aac -b:a 192k -shortest -movflags +faststart "${outP}"`,
    { maxBuffer: 1024 * 1024 * 10 },
  );
}

function limpiarArchivosTemporales(paths = []) {
  for (const filePath of paths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

const MAX_INPUT_MB = 500;

export default {
  name: ["tk", "tt", "ttv", "tiktok", "tkmp4"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una búsqueda o\n┃ > un enlace válido de TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const id = crypto.randomBytes(8).toString("hex");
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const outP = path.join(tmp, `tt_${id}_out.mp4`);
    const whatsappReadyPath = path.join(tmp, `tt_${id}_wa.mp4`);

    try {
      const result = await DL_TIKTOK(text);

      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        limpiarArchivosTemporales([inputP]);
        return await socket.sendMessage(
          remoteJid,
          {
            text: `😦 ¡Mae Ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.`,
          },
          { quoted: message },
        );
      }

      let finalPath = inputP;

      if (sizeMB > 60) {
        await socket.sendMessage(remoteJid, {
          react: { text: "⚠️", key: message.key },
        });
        await socket.sendMessage(
          remoteJid,
          {
            text: `¡Uy mae! Este video pesa mucho, exprimiendo el procesador para procesarlo sin perder calidad.\nDame chance ....`,
          },
          { quoted: message },
        );

        try {
          await processVideoFile(inputP, outP);
          finalPath = outP;
        } catch (e) {
          finalPath = inputP;
        }
      }

      try {
        const { stdout: codecInfo } = await execAsync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${finalPath}"`
        );

        const codec = codecInfo.trim().toLowerCase();

        if (codec === 'h264') {
          await execAsync(
            `ffmpeg -y -fflags +genpts -i "${finalPath}" -map 0:v:0 -map 0:a:0? -c copy -movflags +faststart "${whatsappReadyPath}"`,
            { maxBuffer: 1024 * 1024 * 10 }
          );
        } else {
          await execAsync(
            `ffmpeg -y -fflags +genpts -i "${finalPath}" -map 0:v:0 -map 0:a:0? -c:v libx264 -preset ultrafast -crf 17 -profile:v main -level 4.0 -pix_fmt yuv420p -threads 0 -c:a aac -b:a 192k -shortest -movflags +faststart "${whatsappReadyPath}"`,
            { maxBuffer: 1024 * 1024 * 10 }
          );
        }

        finalPath = whatsappReadyPath;
      } catch (e) {}

      let caption = `╭〔 🎥 ${fytBold("TIKTOK VIDEO")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(result.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Autor")} › @${result.authorNick}\n`;
      caption += `┃ > ${fytBold("Fecha")} › ${result.time}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${result.views}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${result.likes}\n`;
      caption += `┃ > ${fytBold("Comentarios")} › ${result.comments}\n`;
      caption += `┃ > ${fytBold("Favoritos")} › ${result.collect}\n`;
      caption += `┃ > ${fytBold("Compartidos")} › ${result.shares}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Url")} › ${result.tk_url}\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      if (result.hasWatermark) {
        caption += `\n\n⚠️ ${fytBold("Incluye marca de agua")}`;
      }

      await socket.sendMessage(
        remoteJid,
        {
          video: { url: finalPath },
          caption: caption,
          mimetype: "video/mp4",
          fileName: "tiktok.mp4",
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      const errorMsg =
        error.message ||
        "Ocurrió un error inesperado.";

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      limpiarArchivosTemporales([inputP, outP, whatsappReadyPath]);
    }
  },
};
