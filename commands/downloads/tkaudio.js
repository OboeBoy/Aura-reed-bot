import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import https from "https";
import stream from "stream";
import formatter from "../../controllers/functions/formatNumbers.js";
import { setDownloadCacheEnv } from "../../controllers/downloadUtils.js";
import { fytBold } from "../../models/TextStyle.js";

const tmp = setDownloadCacheEnv();

const execAsync = promisify(exec);
const pipelineAsync = promisify(stream.pipeline);

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });
const apiAxios = axios.create({ httpAgent, httpsAgent });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

async function DL_TIKTOK(input) {
  let targetUrl = validateTikTokUrl(input);

  if (!targetUrl) {
    const APIKEY = global.Apis?.apiAiya?.apikey || "oboe";
    const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${APIKEY}`;
    const { data: alyaData } = await apiAxios.get(alyaUrl, { timeout: 15000 });

    if (
      alyaData.status &&
      Array.isArray(alyaData.data) &&
      alyaData.data.length > 0
    ) {
      targetUrl = alyaData.data[0].url;
    }
  }

  if (!targetUrl) {
    throw new Error("No se encontró ningún enlace válido para la búsqueda.");
  }

  const APIKEY = global.Apis?.apiAiya?.apikey || "oboe";
  const URL_TIKTOK = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${APIKEY}`;

  const dateCreate = (ts) =>
    new Date(Number(ts) * 1000).toLocaleDateString("es-ES");

  const { data } = await apiAxios.get(URL_TIKTOK, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
    timeout: 15000,
  });

  if (data.status && Array.isArray(data.data) && data.data.length > 0) {
    const r = data;
    const videoUrl = r.data[2]?.url || r.data[1]?.url || r.data[0]?.url;
    if (!videoUrl) throw new Error("No se encontró URL de descarga en la API.");

    return {
      video_dl: videoUrl,
      cover: r.cover || "",
      title: r.title || "Audio de TikTok",
      authorNick: r.author?.nickname || r.author?.fullname || "Desconocido",
      likes: formatter(r.stats?.likes || r.digg_count || 0),
      views: formatter(r.stats?.views || r.play_count || 0),
      shares: formatter(r.stats?.share || r.share_count || 0),
      collect: formatter(r.stats?.download || r.collect_count || 0),
      comments: formatter(r.stats?.comment || r.comment_count || 0),
      time: dateCreate(r.taken_at || r.create_time || 0),
      tk_url: `https://www.tiktok.com/@${r.author?.fullname || "user"}/video/${r.id || ""}`,
    };
  }

  throw new Error("La API externa no devolvió datos válidos.");
}

async function descargarAArchivo(url, destPath) {
  const response = await apiAxios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      Referer: "https://www.tikwm.com/",
      Connection: "keep-alive",
    },
    timeout: 30000,
  });
  await pipelineAsync(response.data, fs.createWriteStream(destPath));
}

async function processAudioFile(inputP, outP) {
  await execAsync(
    `ffmpeg -y -i "${inputP}" -vn -c:a libmp3lame -b:a 320k -threads 0 "${outP}"`,
    { maxBuffer: 1024 * 1024 * 50 },
  );
}

const MAX_INPUT_MB = 500;

export default {
  name: ["tka", "ttaudio", "tkmusic", "tiktokaudio", "tta"],
  category: "downloads",
  description: "Descarga el audio de un video de TikTok.",

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
    const inputP = path.join(tmp, `tta_in_${id}.mp4`);
    const outP = path.join(tmp, `tta_out_${id}.mp3`);
    const coverP = path.join(tmp, `tta_cover_${id}.webp`);

    let hasCover = false;

    try {
      const result = await DL_TIKTOK(text);

      // Descargamos el video y la portada de forma segura saltando Cloudflare
      await descargarAArchivo(result.video_dl, inputP);

      if (result.cover) {
        try {
          await descargarAArchivo(result.cover, coverP);
          if (fs.existsSync(coverP) && fs.statSync(coverP).size > 0) {
            hasCover = true;
          } else {
            hasCover = null;
          }
        } catch (e) {
          hasCover = false;
        }
      }

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        return await socket.sendMessage(
          remoteJid,
          {
            text: `😦 ¡Mae ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.`,
          },
          { quoted: message },
        );
      }

      await processAudioFile(inputP, outP);

      let caption = `╭〔 🎵 ${fytBold("TIKTOK AUDIO")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(result.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Autor")} › ${result.authorNick}\n`;
      caption += `┃ > ${fytBold("Fecha")} › ${result.time}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${result.views}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${result.likes}\n`;
      caption += `┃ > ${fytBold("Comentarios")} › ${result.comments}\n`;
      caption += `┃ > ${fytBold("Favoritos")} › ${result.collect}\n`;
      caption += `┃ > ${fytBold("Compartidos")} › ${result.shares}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Url")} › ${result.tk_url}\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      if (hasCover) {
        await socket.sendMessage(
          remoteJid,
          {
            image: { url: coverP },
            caption: caption,
          },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          { text: caption },
          { quoted: message },
        );
      }

      const safeFileName =
        `${result.authorNick} - ${result.title}`
          .replace(/[\r\n/\\?%*:|"<>]/g, "")
          .slice(0, 100) + ".mp3";

      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: outP },
          mimetype: "audio/mpeg",
          fileName: safeFileName,
          ptt: false,
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
        JSON.stringify(error) ||
        "Ocurrió un error inesperado.";

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      try {
        if (fs.existsSync(inputP)) fs.unlinkSync(inputP);
      } catch {}
      try {
        if (fs.existsSync(outP)) fs.unlinkSync(outP);
      } catch {}
      try {
        if (fs.existsSync(coverP)) fs.unlinkSync(coverP);
      } catch {}
    }
  },
};
