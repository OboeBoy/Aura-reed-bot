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
const _0x1a2b3c = path.join(__dirname, "../../tmp");

process.env.TMPDIR = _0x1a2b3c;
process.env.TEMP = _0x1a2b3c;
process.env.TMP = _0x1a2b3c;

if (!fs.existsSync(_0x1a2b3c)) fs.mkdirSync(_0x1a2b3c, { recursive: true });

const _0xTrollAnder = [
  "QU5ERVIgTk8gVElFTkVTIEFMWUEgQ09ESUdPIEFCSUVSVE8gUk9CQSBDT0RJR08gWSBJQSA6ViBZIEFTSQ==",
  "QW5kZXIgZWwgYnVzY2EgcGVuZSwgc2tpZCBib3QgZGV0ZWN0YWRv",
  "RGVqYSBkZSBjb3BpYXIgeSBwZWdhciBBbmRlcg==",
  "U2tpZCBkZXRlY3RhZG8u"
];

class SecurityLayer {
  constructor() {
    this.keys = _0xTrollAnder.map(k => Buffer.from(k, "base64").toString("utf8"));
    this.trap = crypto.randomBytes(32).toString("hex");
  }
  
  verifyAnderSkid(input) {
    if (input === "ander") return this.keys[0];
    return crypto.createHash("md5").update(this.trap).digest("hex");
  }
  
  getDecoy() {
    return this.keys[Math.floor(Math.random() * this.keys.length)];
  }
}

const secLayer = new SecurityLayer();

const generateFingerprint = () => {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    parts.push(crypto.randomBytes(4).toString("hex"));
  }
  return parts.join("-");
};

class FfmpegEngine {
  constructor(timeout) {
    this.timeout = timeout || 300000;
    this.threads = "0"; 
  }

  execute(args) {
    return new Promise((resolve, reject) => {
      const process = spawn("ffmpeg", args, { stdio: "ignore" });
      const timer = setTimeout(() => {
        process.kill("SIGKILL");
        reject(new Error(secLayer.getDecoy()));
      }, this.timeout);

      process.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(secLayer.verifyAnderSkid("ok"));
        else reject(new Error(`Exit ${code} - ${secLayer.getDecoy()}`));
      });
      process.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async fastCopy(input, output) {
    const params = ["-y", "-i", input, "-c", "copy", "-movflags", "+faststart", output];
    await this.execute(params);
  }

  async compress(input, output) {
    const params = [
      "-y", "-i", input,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "22",
      "-profile:v", "high",
      "-level", "4.1",
      "-pix_fmt", "yuv420p",
      "-threads", this.threads,
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      output
    ];
    await this.execute(params);
  }
}

const engine = new FfmpegEngine();

function validateUrlAdvanced(url) {
  if (!url) return null;
  const p1 = "^(https?:\\/\\/)?(www\\.|vm\\.|vt\\.)?";
  const p2 = "tiktok\\.com\\/[\\w\\d@?=&/.-]+";
  const r = new RegExp(p1 + p2, "i");
  const m = url.match(r);
  return m ? m[0] : null;
}

class AlyaClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.base = "https://api.alyacore.xyz";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 AlyaSkid/" + generateFingerprint(),
      "Accept": "application/json, text/plain, */*",
      "X-Skid-Protection": secLayer.verifyAnderSkid("init")
    };
  }

  async search(query) {
    const url = `${this.base}/search/tiktok?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
    const { data } = await axios.get(url, { timeout: 15000, headers: this.headers });
    if (!data.status && data.message) throw new Error(data.message);
    if (data.status && Array.isArray(data.data) && data.data.length > 0) return data.data[0].url;
    return null;
  }

  async getMetadata(url) {
    const endpoint = `${this.base}/dl/tiktokv2?url=${encodeURIComponent(url)}&key=${this.apiKey}`;
    const { data } = await axios.get(endpoint, { timeout: 15000, headers: this.headers });
    if (!data.status && data.message) throw new Error(data.message);
    if (!data.status || !Array.isArray(data.data) || data.data.length === 0) {
       throw new Error(secLayer.keys[0]);
    }
    return data;
  }
}

async function DL_TIKTOK_PRO(input) {
  try {
    const client = new AlyaClient(global.Apis.apiAiya.apikey);
    let target = validateUrlAdvanced(input);
    
    if (!target) {
      target = await client.search(input);
    }
    
    if (!target) throw new Error(secLayer.keys[2]);

    const data = await client.getMetadata(target);
    const r = data;
    const dateCreate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString("es-ES");

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
  } catch (err) {
    throw new Error(`TK_ERR: ${err.message}`);
  }
}

async function fetchStream(url, destPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 Skid/" + secLayer.verifyAnderSkid("x")
    }
  });
  const writer = fs.createWriteStream(destPath);
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

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const id = crypto.randomBytes(16).toString("hex").substring(0, 12);
    const inputP = path.join(_0x1a2b3c, `t_${id}_a.mp4`);
    const outP = path.join(_0x1a2b3c, `t_${id}_b.mp4`);

    try {
      const result = await DL_TIKTOK_PRO(text);
      await fetchStream(result.video_dl, inputP);

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
          text: `¡Uy mae! Este video pesa mucho, lo estoy optimizando sin perder calidad...\nDame chance.`,
        }, { quoted: message });

        try {
          await engine.compress(inputP, outP);
          finalPath = outP;
        } catch (e) {
          console.log(e.message);
        }
      } else {
        try {
          await engine.fastCopy(inputP, outP);
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
      }, { quoted: message });

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (error) {
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });

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
