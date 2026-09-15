import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["modself"],
  category: "owner",
  description: "Activa o desactiva el modo owner global para todos los grupos.",
  ownerOnly: true,

  async execute(sock, message, args, { prefix, db, saveDB }) {
    const remoteJid = message.key.remoteJid;
    const action = args[0]?.toLowerCase();

    if (!action) {
      const status = db.modSelfMode ? "activado" : "desactivado";
      const text =
        `╭〔 👑 ${fytBold("OWNER SYSTEM")} 〕⬣\n` +
        `┃ ${db.modSelfMode ? "🔒️" : "🔓️"} ${fytBold("MODO OWNER GLOBAL")}\n` +
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

    db.modSelfMode = enabled;
    await saveDB(db, { immediate: true });

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
