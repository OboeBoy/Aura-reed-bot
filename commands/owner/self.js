import { fytBold } from "../../models/TextStyle.js";
export default {
  name: ["self", "modoowner", "owneronly", "onlyowner"],
  category: "owner",
  description: "Activa o desactiva el modo solo owners.",
  ownerOnly: true,
  async execute(sock, m, args, { prefix, db, saveDB }) {
    const remoteJid = m.key.remoteJid;
    const action = args[0]?.toLowerCase();
    const isGroup = remoteJid?.endsWith("@g.us");

    if (!isGroup) {
      return sock.sendMessage(
        remoteJid,
        { text: "Este comando solo puede configurarse dentro de un grupo." },
        { quoted: m },
      );
    }

    db.groups ??= {};
    db.groups[remoteJid] ??= {};

    if (!action) {
      const status = db.groups[remoteJid].selfMode ? "activado" : "desactivado";
      const text =
        `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n` +
        `┃ ${db.groups[remoteJid].selfMode ? "🔒️" : "🔓️"} 𝐌𝐎𝐃𝐎 𝐒𝐎𝐋𝐎 𝐎𝐖𝐍𝐄𝐑𝐒\n` +
        `╰━━━━━━━━━━━━⬣\n\n` +
        `┃ > El modo solo owners está *${status}*.\n` +
        `┃ > Usa *${prefix}self on* o *${prefix}self off*.\n\n` +
        `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    const enabled = ["on", "1", "true", "activar", "enable"].includes(action);
    const disabled = ["off", "0", "false", "desactivar", "disable"].includes(
      action,
    );

    if (!enabled && !disabled) {
      return sock.sendMessage(
        remoteJid,
        { text: `Usa *${prefix}self on* o *${prefix}self off*.` },
        { quoted: m },
      );
    }

    db.groups[remoteJid].selfMode = enabled;
    await saveDB(db);

    const text =
      `╭〔 👑 ${fytBold("OWNER SYSTEM")} 〕⬣\n` +
      `┃ ${enabled ? "🔒️" : "🔓️"} ${fytBold("MODO OWNER")}\n` +
      `╰━━━━━━━━━━━━⬣\n\n` +
      `┃ > El modo solo owners ha sido *${enabled ? "activado" : "desactivado"}*.\n\n` +
      `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    return sock.sendMessage(remoteJid, { text }, { quoted: m });
  },
};
