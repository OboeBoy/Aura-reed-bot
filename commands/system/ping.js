import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { fytBold } from "../../models/TextStyle.js";

const execAsync = promisify(exec);

function getMemoryInfo() {
  try {
    if (
      fs.existsSync("/sys/fs/cgroup/memory.max") &&
      fs.existsSync("/sys/fs/cgroup/memory.current")
    ) {
      let total = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      let used = fs
        .readFileSync("/sys/fs/cgroup/memory.current", "utf8")
        .trim();

      if (total !== "max" && !isNaN(Number(total)) && Number(total) > 0) {
        return {
          total: Number(total) / 1024 / 1024,
          used: Number(used) / 1024 / 1024,
        };
      }
    }

    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const total = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8")
        .trim();
      const used = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8")
        .trim();

      if (
        !isNaN(Number(total)) &&
        Number(total) < 9223372036854771712 &&
        Number(total) > 0
      ) {
        return {
          total: Number(total) / 1024 / 1024,
          used: Number(used) / 1024 / 1024,
        };
      }
    }
  } catch (e) {}

  const used = process.memoryUsage().rss / 1024 / 1024;
  const total = 1750;
  return { total, used };
}

export default {
  name: ["ping", "p", "lat"],
  description: "Velocidad de red y red hacia Cloudflare.",
  category: "system",

  async execute(sock, m, args) {
    const start = performance.now();

    const { key } = await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `⚡ ${fytBold("CALCULANDO LATENCIA")} ⚡\n\n╭━━〔 ${fytBold("AURA REED SYSTEM")} 〕━━⬣\n┃ 🚀 Midiendo red (Cloudflare)...\n┃ 📡 Analizando socket\n╰━━━━━━━━━━━━━━━━⬣\n`,
      },
      { quoted: m },
    );

    let cfPing = 0;
    try {
      const { stdout } = await execAsync("ping -c 1 -W 2 1.1.1.1", { timeout: 3000 });
      const match = stdout.match(/time=([\d.]+)\s*ms/);
      if (match && match[1]) {
        cfPing = Math.round(parseFloat(match[1]));
      }
    } catch (e) {
      cfPing = Math.round(performance.now() - start);
    }

    const memory = getMemoryInfo();
    const usedRAM = memory.used;
    const totalRAM = memory.total;
    const ramPercent = (usedRAM / totalRAM) * 100;

    let ramStatus = "";
    if (ramPercent < 50) {
      ramStatus = "🟢 Óptimo";
    } else if (ramPercent < 80) {
      ramStatus = "🟠 Moderado";
    } else {
      ramStatus = "🔴 Crítico";
    }

    let status = "";
    let system = "";
    if (cfPing < 50) {
      status = "🟢 Ultra Rápido";
      system = "Estable";
    } else if (cfPing < 150) {
      status = "🟢 Excelente";
      system = "Estable";
    } else if (cfPing < 300) {
      status = "🟠 Aceptable";
      system = "Normal";
    } else {
      status = "🔴 Malo";
      system = "En problemas";
    }

    await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `⚡ ${fytBold("RESULTADO DE LA PRUEBA")} ⚡\n\n╭━━〔 ${fytBold("AURA REED SYSTEM")} 〕━━⬣\n┃ 🌐 ${fytBold("Latencia:")} *${cfPing}ms*\n┃ 📶 ${fytBold("Estado:")} *${status}*\n┃ 📊 ${fytBold("Estado RAM:")} ${ramStatus}\n┃ 🔥 ${fytBold("Sistema:")} *${system}*\n╰━━━━━━━━━━━━━━━━⬣`,
        edit: key,
      },
      { quoted: m },
    );
  },
};
