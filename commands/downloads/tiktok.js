import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
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

if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

class MediaProcessor {
  constructor(timeout) {
    this.timeout = timeout || 30000000000;
    this.threads = "3";
  }

  execute(args) {
    return new Promise((resolve, reject) => {
      const process = spawn("ffmpeg", args, { stdio: "ignore" });
      const timer = setTimeout(() => {
        process.kill("SIGKILL");
        reject(new Error("FFmpeg timeout"));
      }, this.timeout);

      process.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg finalizó con código ${code}`));
      });
      process.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  verifyIntegrity(input) {
    return new Promise((resolve) => {
      const proc = spawn("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,pix_fmt,level",
        "-of", "csv=p=0",
        input
      ]);
      let out = "";
      proc.stdout.on("data", (d) => out += d.toString());
      proc.on("close", () => {
        const res = out.trim().toLowerCase().replace(/\s+/g, '');
        const isH264 = res.includes("h264");
        const isSafeColor = res.includes("yuv420p") || res.includes("yuvj420p");
        const isSafeLevel = !res.includes("50") && !res.includes("51") && !res.includes("52");
        resolve(isH264 && isSafeColor && isSafeLevel);
      });
      proc.on("error", () => resolve(false));
    });
  }

  async remux(input, output) {
    const params = [
      "-y", "-fflags", "+genpts", "-i", input,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-c", "copy",
      "-movflags", "+faststart",
      output
    ];
    await this.execute(params);
  }

  async patchStream(input, output) {
    const params = [
      "-y", "-fflags", "+genpts", "-i", input,
      "-vf", "scale='min(1080,iw)':-2",
      "-map", "0:v:0", "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "17",
      "-profile:v", "main",
      "-level", "4.1",
      "-pix_fmt", "yuv420p",
      "-threads", this.threads,
      "-max_muxing_queue_size", "2048",
      "-c:a", "copy",
      "-shortest",
      "-movflags", "+faststart",
      output
    ];
    await this.execute(params);
  }

  async transcode(input, output) {
    const params = [
      "-y", "-fflags", "+genpts", "-i", input,
      "-vf", "scale='min(1080,iw)':-2",
      "-map", "0:v:0", "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "17",
      "-profile:v", "main",
      "-level", "4.1",
      "-pix_fmt", "yuv420p",
      "-threads", this.threads,
      "-max_muxing_queue_size", "2048",
      "-c:a", "copy",
      "-shortest",
      "-movflags", "+faststart",
      output
    ];
    await this.execute(params);
  }
}

const mediaProcessor = new MediaProcessor();

async function getTikTokData(input) {
  try {
    let targetUrl = validateTikTokUrl(input);
    const apiKey = global.Apis.apiAiya.apikey;

    if (!targetUrl) {
      const searchUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${apiKey}`;
      const { data: searchData } = await axios.get(searchUrl, { timeout: 15000 });

      if (!searchData.status && searchData.message) {
        throw new Error(`API Error (Búsqueda): ${searchData.message}`);
      }

      if (searchData.status && Array.isArray(searchData.data) && searchData.data.length > 0) {
        targetUrl = searchData.data[0].url;
      }
    }

    if (!targetUrl) throw new Error("No se encontró ningún enlace válido para la búsqueda.");

    const downloadUrl = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${apiKey}`;
    const formatDate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString("es-ES");

    const { data } = await axios.get(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
      },
      timeout: 15000,
    });

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
        time: r.taken_at || formatDate(r.create_time || 0),
        tk_url: `https://www.tiktok.com/@${r.author?.nickname || "video"}/video/${r.id}`,
      };
    }
    throw new Error("No se pudieron extraer los datos del video con la API.");
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }
}

async function downloadToFile(url, destPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
  });

  const writer = fs.createWriteStream(destPath, { highWaterMark: 1024 * 1024 });
  await pipeline(response.data, writer); 
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

    socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } }).catch(() => {});

    const id = crypto.randomBytes(8).toString("hex");
    const inputP = path.join(customTemp, `tt_${id}.mp4`);
    const outP = path.join(customTemp, `tt_${id}_out.mp4`);

    try {
      const result = await getTikTokData(text);
      await downloadToFile(result.video_dl, inputP);

      const stats = await fsPromises.stat(inputP);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } }).catch(() => {});
        return await socket.sendMessage(remoteJid, {
          text: `😦 ¡Mae Ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.`,
        }, { quoted: message });
      }

      let finalPath = inputP;

      if (sizeMB > 60) {
        socket.sendMessage(remoteJid, { react: { text: "⚠️", key: message.key } }).catch(() => {});
        await socket.sendMessage(remoteJid, {
          text: `¡Uy mae! Este video pesa mucho, lo estoy optimizando sin perder calidad...\nDame chance.`,
        }, { quoted: message });

        try {
          await mediaProcessor.transcode(inputP, outP);
          finalPath = outP;
        } catch (e) {
          try {
            await mediaProcessor.remux(inputP, outP);
            finalPath = outP;
          } catch (err) {
            console.log(err.message);
          }
        }
      } else {
        try {
          const isSafe = await mediaProcessor.verifyIntegrity(inputP);
          if (isSafe) {
            await mediaProcessor.remux(inputP, outP);
          } else {
            await mediaProcessor.patchStream(inputP, outP);
          }
          finalPath = outP;
        } catch (e) {
          console.log(e.message);
        }
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
        contextInfo: {
          isForwarded: true,
          forwardingScore: 999
        }
      }, { quoted: message });

      socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } }).catch(() => {});

    } catch (error) {
      socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } }).catch(() => {});
      const errorMsg = error.message || "Ocurrió un error inesperado.";
      await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
      }, { quoted: message });

    } finally {
      const filesToDelete = [inputP, outP];
      await Promise.allSettled(
        filesToDelete.map(file => fsPromises.unlink(file).catch(() => {}))
      );
    }
  },
};