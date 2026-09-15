import os from "os";
import process from "process";
import fs from "fs";
import { fytBold } from "./../../models/TextStyle.js";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === Infinity) return "0.00";
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function readNumber(filePath) {
  try {
    const value = fs.readFileSync(filePath, "utf8").trim();
    if (value === "max" || !value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
}

function getMemoryInfo() {
  try {
    // Intentar Cgroups v2 (Sistemas modernos de contenedores/Pterodactyl)
    if (
      fs.existsSync("/sys/fs/cgroup/memory.max") &&
      fs.existsSync("/sys/fs/cgroup/memory.current")
    ) {
      const total = readNumber("/sys/fs/cgroup/memory.max");
      const used = readNumber("/sys/fs/cgroup/memory.current");

      if (total > 0 && used >= 0) {
        return { total, used, source: "contenedor" };
      }
    }

    // Intentar Cgroups v1 (Sistemas clásicos)
    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const total = readNumber("/sys/fs/cgroup/memory/memory.limit_in_bytes");
      const used = readNumber("/sys/fs/cgroup/memory/memory.usage_in_bytes");

      if (total > 0 && total < 9223372036854771712 && used >= 0) {
        return { total, used, source: "contenedor" };
      }
    }
  } catch (e) {
    // Silenciar errores de lectura de archivos virtuales del sistema
  }

  // Fallback: Si el contenedor no expone sus límites, usamos la memoria del bot actual como referencia limpia
  const used = process.memoryUsage().rss;
  const total = os.totalmem(); // Mantiene el total si no hay restricción visible
  return { total, used, source: "host" };
}

function getCpuUsage(sampleMs = 100) {
  const before = os.cpus();
  const beforeTotal = before.reduce(
    (total, cpu) =>
      total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0),
    0,
  );
  const beforeIdle = before.reduce((total, cpu) => total + cpu.times.idle, 0);

  return new Promise((resolve) => {
    setTimeout(() => {
      const after = os.cpus();
      const afterTotal = after.reduce(
        (total, cpu) =>
          total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0),
        0,
      );
      const afterIdle = after.reduce((total, cpu) => total + cpu.times.idle, 0);
      const totalDelta = afterTotal - beforeTotal;
      const idleDelta = afterIdle - beforeIdle;

      resolve(
        totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0,
      );
    }, sampleMs);
  });
}

function getDiskInfo() {
  try {
    const stats = fs.statfsSync(".");
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    return { total, free, used: Math.max(total - free, 0) };
  } catch {
    return null;
  }
}

export default {
  name: ["system", "sys", "info"],
  category: "system",
  description: "Muestra componentes reales del sistema asignado.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    // ── CPU ──
    const cpus = os.cpus();
    const cpuModel =
      cpus && cpus[0]?.model ? cpus[0].model.trim() : "Desconocido";

    let cpuCores = 1;
    try {
      cpuCores =
        typeof os.availableParallelism === "function"
          ? os.availableParallelism()
          : cpus
            ? cpus.length
            : 1;
    } catch {
      cpuCores = cpus ? cpus.length : 1;
    }

    const platform = `${os.platform()} (${os.arch()})`;

    // ── MEMORIA RAM (SERVIDOR REAL) ──
    const memory = getMemoryInfo();
    const ramTotal = memory.total;
    const ramUsed = memory.used;
    const ramFree = ramTotal - ramUsed;
    const ramBot = process.memoryUsage().rss;

    const ramPercent =
      ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : "0.0";

    // ── UPTIME ──
    const botUp = process.uptime();
    const sysUp = os.uptime();
    const cpuUsage = await getCpuUsage();
    const disk = getDiskInfo();

    // ── ENTORNO ──
    const nodeVersion = process.version;
    const pid = process.pid;

    // ── CONSTRUCCIÓN DEL DISEÑO ──
    let text = `╭━〔 🖥️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐑𝐄𝐄𝐃 〕━⬣\n\n`;

    // Sección CPU
    text += `┣━━━━━ ${fytBold("CPU")} ━━━━━⬣\n`;
    text += `┃ > ${fytBold("Modelo:")} ${cpuModel}\n`;
    text += `┃ > ${fytBold("Núcleos:")} ${cpuCores}\n`;
    text += `┃ > ${fytBold("Plataforma:")} ${platform}\n\n`;

    // Sección RAM (Corregida)
    text += `┣━━━━━ ${fytBold("RAM")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Total:")} ${formatBytes(ramTotal)} GB\n`;
    text += `┃ > ${fytBold("Usada:")} ${formatBytes(ramUsed)} GB (${ramPercent}%)\n`;
    text += `┃ > ${fytBold("Libre:")} ${formatBytes(ramFree)} GB\n`;
    text += `┃ > ${fytBold("Bot usa:")} ${formatBytes(ramBot)} GB\n\n`;

    text += `┣━━━━ ${fytBold("RECURSOS")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("CPU actual:")} ${cpuUsage.toFixed(1)}%\n`;
    if (disk) {
      text += `┃ > ${fytBold("Disco usado:")} ${formatBytes(disk.used)} GB / ${formatBytes(disk.total)} GB\n`;
    }
    text += `┃ > ${fytBold("Origen RAM:")} ${memory.source}\n\n`;

    // Sección UPTIME
    text += `┣━━━━ ${fytBold("UPTIME")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Bot activo:")} ${formatTime(botUp)}\n`;
    text += `┃ > ${fytBold("Host encendido:")} ${formatTime(sysUp)}\n\n`;

    // Sección ENTORNO
    text += `┣━━━ ${fytBold("ENTORNO")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Node.js:")} ${nodeVersion}\n`;
    text += `┃ > ${fytBold("PID:")} ${pid}\n\n`;

    text += `╰━━━━━━━━━━━━⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
