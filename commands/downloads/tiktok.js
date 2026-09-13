import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import { pipeline } from "stream/promises";
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

async function DL_TIKTOK(input) {
  let targetUrl = validateTikTokUrl(input);

  if (!targetUrl) {
    try {
      const APIKEY = global.Apis?.apiAiya?.apikey || "";
      const searchUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${APIKEY}`;
      const { data } = await axios.get(searchUrl, { timeout: 10000 });
      if (data.status && data.data?.length > 0) targetUrl = data.data[0].url;
    } catch (e) {
      throw new Error(`Fallo en la búsqueda: ${e.message}`);
    }
  }

  if (!targetUrl) throw new Error("Enlace no válido o búsqueda sin resultados.");

  const APIKEY = global.Apis?.apiAiya?.apikey || "";
  
  try {
    const { data } = await axios.get(`https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${APIKEY}`, { timeout: 12000 });
    if (data.status && data.data?.length > 0) {
      return {
        videoUrl: data.data[0]?.url || data.data[1]?.url || data.data[2]?.url,
        title: data.title || "Sin título",
        author: data.author?.nickname || "Desconocido",
      };
    }
  } catch (e) {}

  try {
    const { data } = await axios.get(`https://api.alyacore.xyz/api/tiktok?url=${encodeURIComponent(targetUrl)}&key=${APIKEY}`, { timeout: 15000 });
    if (data.status && data.data?.video) {
      return {
        videoUrl: data.data.video,
        title: data.data.title || "Sin título",
        author: data.data.author?.nickname || "Desconocido",
      };
    }
  } catch (e) {
    throw new Error(`Servidores inalcanzables: ${e.message}`);
  }

  throw new Error("No se pudo obtener el medio original.");
}

async function fastDownload(url, destPath) {
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 25000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://www.tiktok.com/"
      }
    });
    await pipeline(response.data, fs.createWriteStream(destPath));
  } catch (err) {
    throw new Error(`Descarga interrumpida: ${err.message}`);
  }
}

const MAX_INPUT_MB = 250;

export default {
  name: ["tk", "tt", "ttv", "tiktok", "tkmp4"],
  category: "downloads",
  description: "Descarga videos de TikTok optimizados ultrarrápidos.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA ENLACE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona un enlace de TikTok válido.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const id = crypto.randomBytes(3).toString("hex");
    const inputPath = path.join(tmp, `tt_${id}.mp4`);
    const finalPath = path.join(tmp, `tt_ready_${id}.mp4`);

    try {
      const result = await DL_TIKTOK(text);
      await fastDownload(result.videoUrl, inputPath);

      if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size < 10240) {
        throw new Error("Fallo al guardar o el archivo descargado está corrupto.");
      }

      const initialSizeMB = fs.statSync(inputPath).size / (1024 * 1024);

      if (initialSizeMB > MAX_INPUT_MB) {
        throw new Error(`Archivo excede límite (${initialSizeMB.toFixed(1)}MB / ${MAX_INPUT_MB}MB).`);
      }

      let needsCompression = initialSizeMB > 50;
      let finalSizeMB = initialSizeMB;
      let pathToSend = inputPath;

      if (needsCompression) {
        await socket.sendMessage(remoteJid, { text: `> ⚡ Comprimiendo (${initialSizeMB.toFixed(1)}MB)...`, react: { text: "🔥", key: message.key } });
        const cpuCmd = `ffmpeg -y -i "${inputPath}" -threads 2 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 26 -c:a aac -b:a 128k -movflags +faststart "${finalPath}"`;
        await execAsync(cpuCmd, { timeout: 60000 });
        if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1024) {
          pathToSend = finalPath;
          finalSizeMB = fs.statSync(finalPath).size / (1024 * 1024);
        }
      } else {
        const remuxCmd = `ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart "${finalPath}"`;
        try {
          await execAsync(remuxCmd, { timeout: 15000 });
          if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1024) {
            pathToSend = finalPath;
          }
        } catch (e) {
          pathToSend = inputPath;
        }
      }

      const videoBuffer = fs.readFileSync(pathToSend);

      const shortDesc = result.title.length > 40 ? result.title.substring(0, 40) + "..." : result.title;
      const weightInfo = needsCompression && (finalSizeMB < initialSizeMB) 
        ? `(${initialSizeMB.toFixed(1)}MB ➔ ${finalSizeMB.toFixed(1)}MB) ⚡` 
        : `(${initialSizeMB.toFixed(1)}MB)`;

      let caption = `╭〔 🎥 ${fytBold("TIKTOK")} 〕⬣\n`;
      caption += `┃ 👤 ${fytBold("Por:")} ${result.author}\n`;
      caption += `┃ 📝 ${fytBold("Desc:")} ${shortDesc}\n`;
      caption += `┃ 📦 ${fytBold("Peso:")} ${weightInfo}\n`;
      caption += `╰━━━━━━━━━━━━━━⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          mimetype: "video/mp4",
          fileName: "tiktok.mp4",
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (error) {
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(
        remoteJid,
        { text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL PROCESAR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` },
        { quoted: message }
      );
    } finally {
      [inputPath, finalPath].forEach((file) => {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch (e) {}
        }
      });
    }
  },
};
