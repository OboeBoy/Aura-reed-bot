import { saveDB, getDB } from "../../models/db.js";
import { fytBold } from "../../models/TextStyle.js";

function getWarnDate() {
  return new Date().toLocaleDateString("es-CR", {
    timeZone: "America/Costa_Rica",
  });
}

async function registerStatusWarning(sock, remoteJid, userJid, db) {
  const groupData = db.groups[remoteJid];

  // Aseguramos que existan las estructuras necesarias en la BD del grupo
  if (!groupData.warns) groupData.warns = {};
  if (!groupData.warnLimit) groupData.warnLimit = 3; // Límite por defecto si no está definido

  // Compatibilidad con la estructura anterior, que guardaba las advertencias
  // directamente como un arreglo por usuario.
  const storedWarns = groupData.warns[userJid];
  const userWarns = Array.isArray(storedWarns)
    ? { count: storedWarns.length, history: storedWarns }
    : storedWarns || { count: 0, history: [] };

  userWarns.count = Number.isFinite(userWarns.count)
    ? userWarns.count
    : userWarns.history.length;
  if (!Array.isArray(userWarns.history)) userWarns.history = [];
  groupData.warns[userJid] = userWarns;
  userWarns.count += 1;
  userWarns.history.push({
    reason: "Publicar estado mencionando el grupo (Anti-Estado)",
    date: getWarnDate(),
  });

  const limit = groupData.warnLimit;
  const currentCount = userWarns.count;
  const adminText =
    "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n" +
    "┃ 🚫 𝐄𝐒𝐓𝐀𝐃𝐎 𝐍𝐎 𝐏𝐄𝐑𝐌𝐈𝐓𝐈𝐃𝐎\n" +
    "╰━━━━━━━━━━━━⬣\n\n" +
    `┃ 👤 Usuario: @${userJid.split("@")[0]}\n` +
    `┃ 📊 Warns: [ ${currentCount}/${limit} ]\n` +
    "┃ 🛡️ Razón: Estado mencionando el grupo\n" +
    `┃ ⏰ Fecha: ${getWarnDate()}\n\n` +
    "╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣";

  await sock.sendMessage(remoteJid, {
    text: adminText,
    mentions: [userJid],
  });

  if (currentCount >= limit) {
    try {
      await sock.groupParticipantsUpdate(remoteJid, [userJid], "remove");
      // Limpiamos las advertencias del usuario tras el baneo/expulsión
      delete groupData.warns[userJid];
    } catch (e) {
      console.error("No se pudo expulsar al usuario (¿El bot es admin?):", e);
    }
  }

  // Guardamos cambios en la base de datos
  await saveDB(db);
}

// Borra la notificación intrusa que llegó al chat del grupo
async function deleteGroupStatusNotice(sock, message) {
  try {
    const remoteJid = message.key.remoteJid;
    const statusKey =
      message.message.groupStatusMentionMessage?.statusKey ||
      message.message.groupStatusMessageV2?.statusKey;
    const participant =
      message.key.participant || message.participant || statusKey?.remoteJid;

    if (!remoteJid || !message.key.id) return;

    await sock.sendMessage(remoteJid, {
      delete: {
        remoteJid: remoteJid,
        id: message.key.id,
        fromMe: Boolean(message.key.fromMe),
        ...(participant ? { participant } : {}),
      },
    });
  } catch (error) {
    console.error(
      "No se pudo eliminar el aviso del estado en el grupo:",
      error,
    );
  }
}

// Manejador que se ejecuta perfectamente desde tu bucle 'for (const m of messages)'
export async function handleAntiStatus(sock, message, getDBFn = getDB) {
  if (!message || !message.key || !message.message) return;

  const remoteJid = message.key.remoteJid;

  // Validamos si es un mensaje de grupo
  if (!remoteJid || !remoteJid.endsWith("@g.us")) return;

  const groupStatusMention = message.message.groupStatusMentionMessage;
  const groupStatusV2 = message.message.groupStatusMessageV2;

  // Baileys puede entregar el aviso o directamente el contenido del estado.
  if (!groupStatusMention && !groupStatusV2) return;

  const db = await getDBFn();
  if (!db?.groups || !db.groups[remoteJid]) return;

  // Verificar si la función está encendida en la Base de Datos para este grupo
  if (!db.groups[remoteJid].antiStatus) return;

  // Dependiendo de la versión de Baileys, el autor puede venir en statusKey
  // o directamente en el participante del mensaje de notificación.
  const statusKey = groupStatusMention?.statusKey || groupStatusV2?.statusKey;
  const userJid = [
    statusKey?.participant,
    message.key.participant,
    message.participant,
    statusKey?.remoteJid,
  ].find((jid) => jid && !jid.endsWith("@broadcast"));
  if (!userJid) return;

  // CORREGIDO: Sanitización estricta del ID del propio bot para evitar bucles o auto-baneos
  const myOwnJid = sock.user?.id
    ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
    : null;
  if (myOwnJid && userJid.split(":")[0] + "@s.whatsapp.net" === myOwnJid)
    return;

  try {
    // 1. Desaparecer el mensaje del grupo (Requiere Admin)
    await deleteGroupStatusNotice(sock, message);

    // 2. Procesar advertencia / kick
    await registerStatusWarning(sock, remoteJid, userJid, db);
  } catch (error) {
    console.error("Error en la ejecución de handleAntiStatus:", error);
  }
}

export default {
  name: ["antistatus", "antiestado", "statusblock", "antistat"],
  category: "group",
  description: "Bloquea estados que mencionen grupos.",
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

    if (!db.groups[remoteJid]) {
      db.groups[remoteJid] = {
        antilink: false,
        warnLimit: 3,
        warns: {},
        activity: {},
        onlyAdmin: false,
        antitoxic: false,
        antiCalls: false,
        antiStatus: false,
        botOn: true,
      };
    }

    const status = args[0]?.toLowerCase();

    if (
      status === "on" ||
      status === "1" ||
      status === "true" ||
      status === "activar" ||
      status === "enable"
    ) {
      db.groups[remoteJid].antiStatus = true;
      saveDB(db);

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🚫 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈-𝐄𝐒𝐓𝐀𝐃𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El bloqueo de estados ha\n`;
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
      db.groups[remoteJid].antiStatus = false;
      saveDB(db);

      let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🚫 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈-𝐄𝐒𝐓𝐀𝐃𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El bloqueo de estados ha\n`;
      text += `┃ > sido desactivado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      const currentStatus = db.groups[remoteJid]?.antiStatus
        ? "✅ Activado"
        : "❌ Desactivado";

      let text = `╭〔 🚫 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐀𝐍𝐓𝐈-𝐄𝐒𝐓𝐀𝐃𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .antistatus on\n`;
      text += `┃ ✦ Activar bloqueo de estados\n\n`;
      text += `┃ ➪ .antistatus off\n`;
      text += `┃ ✦ Desactivar bloqueo de estados\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
