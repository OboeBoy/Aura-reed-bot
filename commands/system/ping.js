import fs from "fs";
import { fytBold } from "../../models/TextStyle.js";

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
  description: "Velocidad de procesamiento interno del bot.",
  category: "system",

  async execute(sock, m, args) {
    const start = performance.now();

    
    const { key } = await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `⚡ ${fytBold("CALCULANDO VELOCIDAD")} ⚡\n\n╭━━〔 ${fytBold("AURA REED SYSTEM")} 〕━━⬣\n┃ ⚙️ Midiendo procesamiento...\n╰━━━━━━━━━━━━━━━━⬣\n`,
      },
      { quoted: m },
    );

    const processTime = Math.round(performance.now() - start);

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
    if (processTime < 50) {
      status = "🟢 Instantáneo";
      system = "Estable";
    } else if (processTime < 150) {
      status = "🟢 Excelente";
      system = "Estable";
    } else {
      status = "🟠 Normal";
      system = "Estable";
    }

    await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `⚡ ${fytBold("RESULTADO DE LA PRUEBA")} ⚡\n\n╭━━〔 ${fytBold("AURA REED SYSTEM")} 〕━━⬣\n┃ ⚡ ${fytBold("Velocidad Bot:")} *${processTime}ms*\n┃ 📶 ${fytBold("Estado:")} *${status}*\n┃ 📊 ${fytBold("Estado RAM:")} ${ramStatus}\n┃ 🔥 ${fytBold("Sistema:")} *${system}*\n╰━━━━━━━━━━━━━━━━⬣`,
        edit: key,
      },
      { quoted: m },
    );
  },
};
