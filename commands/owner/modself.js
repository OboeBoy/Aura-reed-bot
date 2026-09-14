import { fytBold } from "../../models/TextStyle.js";
import { getDBSync, saveDB } from "../../models/db.js";

export default {
  name: ["modself"],
  category: "owner",
  description: "Activa o desactiva el modo owner global para todos los grupos.",
  ownerOnly: true,

  async execute(sock, message, args, { prefix, db }) {
    const remoteJid = message.key.remoteJid;
    const globalDb = getDBSync();
    const action = args[0]?.toLowerCase();

    if (!action) {
      const status = globalDb.selfMode ? "activado" : "desactivado";
      const text =
        `╭〔 👑 ${fytBold("OWNER SYSTEM")} 〕⬣\n` +
        `┃ ${globalDb.selfMode ? "🔒️" : "🔓️"} ${fytBold("MODO OWNER GLOBAL")}\n` +
        `╰━━━━━━━━━━━━⬣\n\n` +
        `┃ > El modo owner global está *${status}*.\n` +
        `┃ > Afecta todos los grupos y subbots.\n` +
        `┃ > Usa *${prefix}modself on* o *${prefix}modself off*.\n\n` +
        `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return sock.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const enabled = ["on", "1", "true", "activar", "enable"].includes(action);
    const disabled = ["off", "0", "false", "desactivar", "disable"].includes(
      action,
    );

    if (!enabled && !disabled) {
      return sock.sendMessage(
        remoteJid,
        { text: `Usa *${prefix}modself on* o *${prefix}modself off*.` },
        { quoted: message },
      );
    }

    globalDb.selfMode = enabled;
    if (db && typeof db === "object") {
      db.selfMode = enabled;
    }
    await saveDB(globalDb, { immediate: true });

    const text =
      `╭〔 👑 ${fytBold("OWNER SYSTEM")} 〕⬣\n` +
      `┃ ${enabled ? "🔒️" : "🔓️"} ${fytBold("MODO OWNER GLOBAL")}\n` +
      `╰━━━━━━━━━━━━⬣\n\n` +
      `┃ > El modo owner global ha sido *${enabled ? "activado" : "desactivado"}*.\n` +
      `┃ > Se aplica a todos los grupos y subbots.\n\n` +
      `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    return sock.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
