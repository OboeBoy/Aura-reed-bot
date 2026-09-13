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
  try {
    let targetUrl = validateTikTokUrl(input);

    if (!targetUrl) {
      const APIKEY = global.Apis.apiAiya.apikey;
      const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${APIKEY}`;
      const { data: alyaData } = await axios.get(alyaUrl, { timeout: 15000 });

      if (alyaData.status && alyaData.data?.length > 0) {
        targetUrl = alyaData.data[0].url;
      }
    }

    if (!targetUrl) throw new Error("No se encontró ningún enlace válido.");

    const URL_TIKTOK = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${global.Apis.apiAiya.apikey}`;
    
    const { data } = await axios.get(URL_TIKTOK, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    if (data.status && data.data?.length > 0) {
  
      return {
        video_dl: data.data[2]?.url || data.data[0]?.url, 
        title: data.title || "TikTok Video",
        authorNick: data.author?.nickname || "Desconocido",
        tk_url: `https://www.tiktok.com/@${data.author?.nickname}/video/${data.id}`,
      };
    }
    throw new Error("No se pudieron extraer los datos del video.");
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }

async function descargarAArchivo(url, destPath) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  });
  
  await pipeline(response.data, fs.createWriteStream(destPath));
}

const MAX_INPUT_MB = 500;

export default {
  name: ["tk", "tt", "ttv", "tiktok", "tkmp4"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok rápidamente.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona un enlace de TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const id = crypto.randomBytes(4).toString("hex");
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const whatsappReadyPath = path.join(tmp, `tt_${id}_wa.mp4`);
    let finalPath = inputP;

    try {
      const result = await DL_TIKTOK(text);
      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        fs.unlinkSync(inputP);
        return await socket.sendMessage(
          remoteJid,
          { text: `😦 ¡Mae, ponete serio! 💀🙏\nEste video pesa más que una vieja de Kilos Mortales (${sizeMB.toFixed(1)}MB).` },
          { quoted: message }
        );
      }

  
      let codec = "h264";
      try {
        const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${inputP}"`);
        codec = stdout.trim().toLowerCase();
      } catch (e) {  }

      const needsCompression = sizeMB > 60;
      const needsTranscode = codec !== "h264" || needsCompression;

      if (needsTranscode) {
        if (needsCompression) {
          await socket.sendMessage(remoteJid, { text: "Pesadito el video... lo ajusto sin perder calidad ⚡", react: { text: "🔥", key: message.key }});
        }
        
      
        const crf = needsCompression ? 24 : 21; 
        await execAsync(`ffmpeg -y -i "${inputP}" -c:v libx264 -preset superfast -crf ${crf} -maxrate 6M -bufsize 12M -c:a aac -b:a 192k -movflags +faststart "${whatsappReadyPath}"`, { maxBuffer: 1024 * 1024 * 10 });
        finalPath = whatsappReadyPath;
      } else {
      
        await execAsync(`ffmpeg -y -i "${inputP}" -c copy -movflags +faststart "${whatsappReadyPath}"`, { maxBuffer: 1024 * 1024 * 10 });
        finalPath = whatsappReadyPath;
      }

      const shortTitle = result.title.length > 50 ? result.title.substring(0, 50) + "..." : result.title;
      let caption = `╭〔 🎥 ${fytBold("TIKTOK")} 〕⬣\n`;
      caption += `┃ 👤 ${fytBold("Autor:")} ${result.authorNick}\n`;
      caption += `┃ 📝 ${fytBold("Desc:")} ${shortTitle}\n`;
      caption += `╰━━━━━━━━━━━━━━⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          video: { url: finalPath },
          caption: caption,
          mimetype: "video/mp4",
          fileName: "tiktok_aura.mp4",
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (error) {
      console.error("Error detallado en tiktok:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(
        remoteJid,
        { text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` },
        { quoted: message }
      );
    } finally {
      [inputP, whatsappReadyPath].forEach((file) => {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch (e) {}
        }
      });
    }
  },
};
