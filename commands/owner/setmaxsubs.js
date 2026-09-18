import { getDBSync, saveDB } from "../../models/db.js";

export default {
  name: ["setmaxsubs", "maxsubs", "cuposubs", "setcuposubs"],
  category: "owner",
  description: "Cambia el máximo de sub-bots permitidos por la base de datos.",
  ownerOnly: true,
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const rawValue = args[0];

    if (!rawValue) {
      const db = getDBSync();
      const maxAllowed = Number(db.maxSubBots ?? 30);
      const activeCount = Number(
        (
          await import("../../models/subbotManager.js")
        ).countActiveSubBots?.() ?? 0,
      );

      return await socket.sendMessage(
        remoteJid,
        {
          text:
            `╭〔 🔧 AURA REED 〕⬣\n` +
            `┃ 🧩 CUPOS DE SUB-BOTS\n` +
            `╰━━━━━━━━━━━━⬣\n\n` +
            `┃ 📊 Máximo permitido: *${Number.isFinite(maxAllowed) ? (maxAllowed === 0 ? "Sin cupos" : maxAllowed) : 30}*\n` +
            `┃ 🔌 Activos ahora: *${activeCount}*\n\n` +
            `┃ Usa: *${prefix}setmaxsubs 10*\n` +
            `┃ 0 = sin cupos | 500 = máximo permitido\n\n` +
            `╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: message },
      );
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 0 || value > 500) {
      return await socket.sendMessage(
        remoteJid,
        {
          text:
            `╭〔 ⚠️ AURA REED 〕⬣\n` +
            `┃ ❌ CUPOS INVÁLIDOS\n` +
            `╰━━━━━━━━━━━━⬣\n\n` +
            `┃ > Ingresa un número válido entre 0 y 500.\n\n` +
            `┃ Ejemplo: *${prefix}setmaxsubs 10*\n\n` +
            `╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: message },
      );
    }

    const db = getDBSync();
    db.maxSubBots = value;
    await saveDB(db, { immediate: true });

    return await socket.sendMessage(
      remoteJid,
      {
        text:
          `╭〔 ✅ AURA REED 〕⬣\n` +
          `┃ 🧩 CUPOS DE SUB-BOTS\n` +
          `╰━━━━━━━━━━━━⬣\n\n` +
          `┃ > El máximo permitido quedó en: *${value}*\n\n` +
          `╰〔 ⚡ SYSTEM 〕⬣`,
      },
      { quoted: message },
    );
  },
};
