import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsPromises from "fs/promises";
import crypto from "crypto";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customTemp = path.join(__dirname, "../../tmp");

process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

const execAsync = promisify(exec);
const tmp = customTemp;

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

// ✨ NUEVA FUNCIÓN: Ping para verificar que el host responda antes de gastar procesos
async function pingApi() {
  try {
    const startTime = Date.now();
    // Petición ligera de solo 3 segundos de tolerancia
    await axios.get("https://api.alyacore.xyz", { timeout: 3000 });
    const pingMs = Date.now() - startTime;
    return { isAlive: true, ms: pingMs };
  } catch (error) {
    // Si da un error HTTP (ej. 404) significa que el servidor SÍ está vivo, solo la ruta no existe.
    // Si da error de red (timeout, ECONNREFUSED), está completamente muerto.
    if (error.response) return { isAlive: true, ms: 0 }; 
    return { isAlive: false, error: error.message };
  }
}

async function DL_TIKTOK(input) {
  try {
    let targetUrl = validateTikTokUrl(input);
    const APIKEY = global.Apis.apiAiya.apikey;

    // 1. Fase de Búsqueda (Si no pasaron un enlace directo)
    if (!targetUrl) {
      const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${APIKEY}`;
      const { data: alyaData } = await axios.get(alyaUrl, { timeout: 15000 });

      // Verificamos si la API misma bloqueó la solicitud
      if (!alyaData.status && alyaData.message) {
        throw new Error(`API Error (Búsqueda): ${alyaData.message}`);
      }

      if (alyaData.status && Array.isArray(alyaData.data) && alyaData.data.length > 0) {
        targetUrl = alyaData.data[0].url;
      }
    }

    if (!targetUrl) throw new Error("No se encontró ningún enlace válido para la búsqueda.");

    // 2. Fase de Extracción del Video
    const URL_TIKTOK = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${APIKEY}`;
    const dateCreate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString("es-ES");

    const { data } = await axios.get(URL_TIKTOK, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
      },
      timeout: 15000,
    });

    // Filtro estricto: Si la API responde OK pero el "status" interno es falso (ej. rate-overlimit)
    if (!data.status && data.message) {
        throw new Error(`API Error (Descarga): ${data.message}`);
    }

    if (data.status && Array.isArray(data.data) && data.data.length > 0) {
      const r = data;
      return {
        video_dl: r.data[2].url,
        title: r.title || "Video de TikTok",
        authorNick: r.author?.nickname || r.author?.fullname || "Desconocido",
        likes: formatter(r.stats?.likes || r.digg_count || 0),
        views: formatter(r.stats?.views || r.play_count || 0),
        shares: formatter(r.stats?.share || r.share_count || 0),
        collect: formatter(r.stats?.download || r.collect_count || 0),
        comments: formatter(r.stats?.comment || r.comment_count || 0),
        time: r.taken_at || dateCreate(r.create_time || 0),
        tk_url: `https://www.tiktok.com/@${r.author?.nickname || "video"}/video/${r.id}`,
      };
    }
    throw new Error("No se pudieron extraer los datos del video con la API.");
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
  });

  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function processVideoFile(inputP, outP) {
  await execAsync(
    `ffmpeg -y -i "${inputP}" -vf "scale='min(1920,iw)':-2" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 128k "${outP}"`,
    { maxBuffer: 1024 * 1024 * 10 },
  );
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
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una búsqueda o\n┃ > un enlace válido de TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
      }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    // ✨ PING PREVENTIVO ANTES DE HACER CUALQUIER OTRA COSA
    const pingStatus = await pingApi();
    if (!pingStatus.isAlive) {
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("API DESCONECTADA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El servidor de descargas no responde.\n┃ > Ping fallido: ${pingStatus.error}\n┃ > Intenta nuevamente en unos minutos.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
      }, { quoted: message });
    }

    const id = crypto.randomBytes(8).toString("hex");
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const outP = path.join(tmp, `tt_${id}_out.mp4`);
    const whatsappReadyPath = path.join(tmp, `tt_${id}_wa.mp4`);

    try {
      const result = await DL_TIKTOK(text);
      await descargarAArchivo(result.video_dl, inputP);

      const stats = await fsPromises.stat(inputP);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
        return await socket.sendMessage(remoteJid, {
          text: `😦 ¡Mae Ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.`,
        }, { quoted: message });
      }

      let finalPath = inputP;

      if (sizeMB > 60) {
        await socket.sendMessage(remoteJid, { react: { text: "⚠️", key: message.key } });
        await socket.sendMessage(remoteJid, {
          text: `¡Uy mae! Este video pesa mucho, voy a tener que hacerlo más liviano.\nDame chance ....`,
        }, { quoted: message });

        try {
          await processVideoFile(inputP, outP);
          finalPath = outP;
        } catch (e) {
          console.error("No se pudo procesar el video, se manda el original:", e.message);
        }
      }

      // Reempaquetado inteligente
      try {
        const { stdout: codecInfo } = await execAsync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${finalPath}"`
        );

        const codec = codecInfo.trim().toLowerCase();

        if (codec === "h264") {
          await execAsync(`ffmpeg -y -i "${finalPath}" -c copy -movflags +faststart "${whatsappReadyPath}"`, { maxBuffer: 1024 * 1024 * 10 });
        } else {
          await execAsync(`ffmpeg -y -i "${finalPath}" -c:v libx264 -preset ultrafast -c:a aac "${whatsappReadyPath}"`, { maxBuffer: 1024 * 1024 * 10 });
        }
        finalPath = whatsappReadyPath;
      } catch (e) {
        console.error("Reempaquetado fallido:", e.message);
      }

      let caption = `╭〔 🎥 ${fytBold("TIKTOK VIDEO")} 〕━⬣\n\n`;
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

      await socket.sendMessage(remoteJid, {
        video: { url: finalPath },
        caption: caption,
        mimetype: "video/mp4",
        fileName: "tiktok.mp4",
      }, { quoted: message });

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (error) {
      console.error("Error detallado en tiktok:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });

      const errorMsg = error.message || "Ocurrió un error inesperado.";
      await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
      }, { quoted: message });

    } finally {
      const filesToDelete = [inputP, outP, whatsappReadyPath];
      await Promise.allSettled(
        filesToDelete.map(file => fsPromises.unlink(file).catch(() => {}))
      );
    }
  },
};
