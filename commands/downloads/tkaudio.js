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
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customTemp = fs.existsSync("/dev/shm") ? path.join("/dev/shm", "aura_tmp") : path.join(__dirname, "../../tmp");

process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

const execAsync = promisify(exec);
const pipelineAsync = promisify(stream.pipeline);
const tmp = customTemp;

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
    throw new Error("El enlace proporcionado no es un enlace válido de TikTok.");
  }

  try {
    const { data } = await apiAxios.post(
      "https://www.tikwm.com/api/",
      { url: targetUrl, count: 12, cursor: 0, web: 1, hd: 1 },
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Accept": "application/json, text/javascript, */*; q=0.01"
        },
        timeout: 15000
      }
    );

    if (data.code === 0 && data.data) {
      const r = data.data;
      return {
        video_dl: r.wmplay || r.play,
        cover: r.cover || r.origin_cover,
        title: r.title || "Audio de TikTok",
        authorNick: r.author?.nickname || r.author?.unique_id || "Desconocido",
        likes: formatter(r.digg_count || 0),
        views: formatter(r.play_count || 0),
        shares: formatter(r.share_count || 0),
        collect: formatter(r.collect_count || 0),
        comments: formatter(r.comment_count || 0),
        time: new Date(Number(r.create_time) * 1000).toLocaleDateString("es-ES"),
        tk_url: `https://www.tiktok.com/@${r.author?.unique_id || "video"}/video/${r.id}`
      };
    }
    
    throw new Error("La API no devolvió el archivo multimedia.");
  } catch (error) {
    throw new Error(`Fallo en la extracción: ${error.message}`);
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await apiAxios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Connection": "keep-alive"
    }
  });
  await pipelineAsync(response.data, fs.createWriteStream(destPath));
}

async function processAudioFile(inputP, outP) {
  await execAsync(
    `ffmpeg -y -i "${inputP}" -vn -c:a libmp3lame -b:a 320k -threads 0 "${outP}"`,
    { maxBuffer: 1024 * 1024 * 50 }
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

    try {
      const result = await DL_TIKTOK(text);
      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        try {
          fs.unlinkSync(inputP);
        } catch {}
        return await socket.sendMessage(
          remoteJid,
          {
            text: `😦 ¡Mae ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.`,
          },
          { quoted: message },
        );
      }

      await processAudioFile(inputP, outP);

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

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: result.cover },
          caption: caption,
        },
        { quoted: message },
      );

      const safeFileName = `${result.authorNick} - ${result.title}.mp3`.replace(/[\r\n/\\?%*:|"<>]/g, "");

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
    }
  },
};
