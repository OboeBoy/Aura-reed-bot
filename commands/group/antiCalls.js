import { saveDB, getDB } from "../../models/db.js";
import { ensureGroup } from "../../models/groupDb.js";
import { fytBold } from "../../models/TextStyle.js";

function getWarnDate() {
  return new Date().toLocaleDateString("es-CR", {
    timeZone: "America/Costa_Rica",
  });
}

async function registerCallWarning(sock, remoteJid, userJid, db) {
  if (!remoteJid || !remoteJid.endsWith("@g.us") || !userJid) return;

  const group = ensureGroup(db, remoteJid);

  if (!group.warns || typeof group.warns !== "object") group.warns = {};
  if (!group.warns[userJid]) group.warns[userJid] = [];

  group.warns[userJid].push({
    reason: "Intento de llamada en grupo",
    date: getWarnDate(),
  });

  const warnLimit = group.warnLimit || 3;
  const count = group.warns[userJid].length;
  const adminText =
    "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n" +
    "┃ 🚫 𝐈𝐍𝐓𝐄𝐍𝐓𝐎 𝐃𝐄 𝐋𝐋𝐀𝐌𝐀𝐃𝐀\n" +
    "╰━━━━━━━━━━━━⬣\n\n" +
    `┃ 👤 Usuario: @${userJid.split("@")[0]}\n` +
    `┃ 📊 Warns: [ ${count}/${warnLimit} ]\n` +
    "┃ 🛡️ Razón: Llamada de grupo no permitida\n" +
    `┃ ⏰ Fecha: ${getWarnDate()}\n\n` +
    "╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣";

  await sock.sendMessage(remoteJid, {
    text: adminText,
    mentions: [userJid],
  });

  saveDB(db);

  if (count >= warnLimit) {
    try {
      await sock.groupParticipantsUpdate(remoteJid, [userJid], "remove");
      group.warns[userJid] = [];
      saveDB(db);
    } catch {}
  }
}

export async function handleAntiCalls(sock, call, getDBFn = getDB) {
  if (!call) return;

  const isGroupCall =
    Boolean(call.isGroup) ||
    Boolean(call.groupJid) ||
    Boolean(call.chatId?.endsWith("@g.us")) ||
    Boolean(call.from?.endsWith("@g.us"));

  if (!isGroupCall || !call.id) return;

  // Baileys emite estos eventos como 'offer' para la llamada nueva.
  // Si no es una oferta, no es el intento que queremos bloquear.
  if (call.status && call.status !== "offer") return;

  const groupJid = call.groupJid || call.chatId || call.from;
  const db = await getDBFn();
  if (!db?.groups) return;

  const group = ensureGroup(db, groupJid);
  if (!group?.antiCalls) return;

  const userJid = call.from || call.chatId;
  if (userJid && userJid === sock.user?.id) return;

  try {
    const callFrom = call.from || groupJid;
    if (typeof sock.rejectCall === "function") {
      await sock.rejectCall(call.id, callFrom);
    }
    await registerCallWarning(sock, groupJid, userJid, db);
  } catch (error) {
    console.error("Error al manejar la llamada entrante:", error);
  }
}

export default {
  name: ["anticalls", "antillamadas", "antillamada", "callblock"],
  category: "group",
  description: "Bloquea llamadas entrantes en grupos.",
  adminOnly: true,

  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCOMPATIBLE")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const group = ensureGroup(db, remoteJid);
    group.antiCalls ??= false;
    group.antiStatus ??= false;
    group.warnLimit ??= 3;
    group.warns ??= {};
    group.activity ??= {};

    const status = args[0]?.toLowerCase();

    if (
      status === "on" ||
      status === "1" ||
      status === "true" ||
      status === "activar" ||
      status === "enable"
    ) {
      db.groups[remoteJid].antiCalls = true;
      saveDB(db);

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 📵 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈-𝐂𝐀𝐋𝐋\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El bloqueo de llamadas ha\n`;
      text += `┃ > sido activado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else if (
      status === "off" ||
      status === "0" ||
      status === "false" ||
      status === "desactivar" ||
      status === "disable"
    ) {
      db.groups[remoteJid].antiCalls = false;
      saveDB(db);

      let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 📵 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈-𝐂𝐀𝐋𝐋\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El bloqueo de llamadas ha\n`;
      text += `┃ > sido desactivado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      const currentStatus = db.groups[remoteJid]?.antiCalls
        ? "✅ Activado"
        : "❌ Desactivado";

      let text = `╭〔 📵 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐀𝐍𝐓𝐈-𝐂𝐀𝐋𝐋\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .anticalls on\n`;
      text += `┃ ✦ Activar bloqueo de llamadas\n\n`;
      text += `┃ ➪ .anticalls off\n`;
      text += `┃ ✦ Desactivar bloqueo de llamadas\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
