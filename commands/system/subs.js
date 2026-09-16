import {
  createSubBot,
  canRegisterSubBot,
  resolveSubBotSenderId,
  SUB_LIMIT_MESSAGE,
} from "../../models/subbotManager.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["code", "qr"],
  category: "system",
  description: "Vincula sub-bot con código o QR.",
  execute: async (
    socket,
    message,
    args,
    { db, saveDB, numeroReal, jidRemitente, senderRaw },
  ) => {
    const remoteJid = message.key.remoteJid;
    const sender = jidRemitente;

    const text =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";
    const command = text.trim().split(/\s+/)[0]?.slice(1) || "";

    const isCode = command === "code";

    // 1. Extraer el argumento de forma segura
    const rawArg = Array.isArray(args) ? args.join("") : "";
    const manualNumber = normalizePhoneNumber(rawArg);
    const senderJid = jidNormalizedUser(senderRaw || jidRemitente || "");
    const senderIsLid =
      senderJid.endsWith("@lid") || senderJid.includes("@hosted.lid");
    const resolvedSenderJid = jidNormalizedUser(jidRemitente || "");
    const unresolvedLid =
      resolvedSenderJid.endsWith("@lid") ||
      resolvedSenderJid.includes("@hosted.lid");
    const detectedNumber = unresolvedLid
      ? ""
      : normalizePhoneNumber(jidRemitente || numeroReal || senderJid);
    const inputNum =
      manualNumber || detectedNumber || normalizePhoneNumber(numeroReal);

    // 2. Validar que se incluya el número en .code
    if (
      (isCode && (!inputNum || inputNum.length < 8)) ||
      (senderIsLid &&
        unresolvedLid &&
        (!manualNumber || manualNumber.length < 8))
    ) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ No pude detectar tu número automáticamente. Ingresa tu número con código de país.\n\nEjemplo: ".${isCode ? "code" : "qr"} 50612345678"`,
        },
        { quoted: message },
      );
    }

    const targetNumber = normalizePhoneNumber(inputNum || numeroReal);
    const senderId = resolveSubBotSenderId(targetNumber, jidRemitente);

    // 3. Límite de sub-bots
    if (!canRegisterSubBot(senderId)) {
      return await socket.sendMessage(
        remoteJid,
        { text: SUB_LIMIT_MESSAGE },
        { quoted: message },
      );
    }

    if (!db.users[sender]) {
      db.users[sender] = { Subs: 0 };
    }

    // 4. Cooldown de 2 minutos
    let lastSub = db.users[sender].Subs || 0;
    let now = Date.now();
    if (now - lastSub < 120000) {
      let timeLeft = msToTime(120000 - (now - lastSub));
      return await socket.sendMessage(
        remoteJid,
        {
          text: `ꕥ Debes esperar *${timeLeft}* para volver a intentar vincular un sub-bot.`,
        },
        { quoted: message },
      );
    }

    // Instrucciones
    const rtx =
      "╭〔 🔗 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🤖 𝐕𝐈𝐍𝐂𝐔𝐋𝐀𝐂𝐈𝐎́𝐍 𝐃𝐄 𝐃𝐈𝐒𝐏𝐎𝐒𝐈𝐓𝐈𝐕𝐎\n╰━━━━━━━━━━━━⬣\n\n╭〔 ⚡ 𝐏𝐑𝐄𝐏𝐀𝐑𝐀𝐂𝐈𝐎́𝐍 〕⬣\n┃ 📱 𝐄𝐥 𝐛𝐨𝐭 𝐞𝐬𝐭𝐚́ 𝐥𝐢𝐬𝐭𝐨 𝐩𝐚𝐫𝐚 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐫𝐬𝐞\n┃ 🔐 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 𝐚𝐜𝐭𝐢𝐯𝐨\n┃ ⚡ 𝐄𝐬𝐩𝐞𝐫𝐚𝐧𝐝𝐨 𝐜𝐨𝐧𝐟𝐢𝐫𝐦𝐚𝐜𝐢𝐨́𝐧\n╰━━━━━━━━━━━━⬣\n\n╭〔 📲 𝐈𝐍𝐒𝐓𝐑𝐔𝐂𝐂𝐈𝐎𝐍𝐄𝐒 〕⬣\n┃ ➪ 𝐀𝐛𝐫𝐞 “𝐝𝐢𝐬𝐩𝐨𝐬𝐢𝐭𝐢𝐯𝐨 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨”\n┃ ➪ 𝐏𝐫𝐞𝐬𝐢𝐨𝐧𝐚 𝐥𝐨𝐬 𝐭𝐫𝐞𝐬 𝐩𝐮𝐧𝐭𝐨𝐬\n┃ ➪ 𝐈𝐧𝐠𝐫𝐞𝐬𝐚 𝐞𝐥 𝐜𝐨́𝐝𝐢𝐠𝐨\n┃ ➪ 𝐂𝐨𝐧𝐟𝐢𝐫𝐦𝐚 𝐥𝐚 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐜𝐢𝐨́𝐧\n╰━━━━━━━━━━━━⬣\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣";
    const rtx2 =
      "╭〔 🔗 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🤖 𝐕𝐈𝐍𝐂𝐔𝐋𝐀𝐂𝐈𝐎́𝐍 𝐃𝐄 𝐃𝐈𝐒𝐏𝐎𝐒𝐈𝐓𝐈𝐕𝐎\n╰━━━━━━━━━━━━⬣\n\n╭〔 ⚡ 𝐏𝐑𝐄𝐏𝐀𝐑𝐀𝐂𝐈𝐎́𝐍 〕⬣\n┃ 📱 𝐄𝐥 𝐛𝐨𝐭 𝐞𝐬𝐭𝐚́ 𝐥𝐢𝐬𝐭𝐨 𝐩𝐚𝐫𝐚 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐫𝐬𝐞\n┃ 🔐 𝐒𝐢𝐬𝐭𝐞𝐦𝐚 𝐚𝐜𝐭𝐢𝐯𝐨\n┃ ⚡ 𝐄𝐬𝐩𝐞𝐫𝐚𝐧𝐝𝐨 𝐜𝐨𝐧𝐟𝐢𝐫𝐦𝐚𝐜𝐢𝐨́𝐧\n╰━━━━━━━━━━━━⬣\n\n╭〔 📲 𝐈𝐍𝐒𝐓𝐑𝐔𝐂𝐂𝐈𝐎𝐍𝐄𝐒 〕⬣\n┃ ➪ 𝐀𝐛𝐫𝐞 “𝐝𝐢𝐬𝐩𝐨𝐬𝐢𝐭𝐢𝐯𝐨 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨”\n┃ ➪ 𝐏𝐫𝐞𝐬𝐢𝐨𝐧𝐚 𝐥𝐨𝐬 𝐭𝐫𝐞𝐬 𝐩𝐮𝐧𝐭𝐨𝐬\n┃ ➪ 𝐈𝐧𝐠𝐫𝐞𝐬𝐚 𝐞𝐥 𝐜𝐨́𝐝𝐢𝐠𝐨\n┃ ➪ 𝐂𝐨𝐧𝐟𝐢𝐫𝐦𝐚 𝐥𝐚 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐜𝐢𝐨́𝐧\n╰━━━━━━━━━━━━⬣\n\n";

    const caption = isCode ? rtx : rtx2;

    await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

    db.users[sender].Subs = now;
    saveDB(db);

    try {
      if (isCode) {
        await createSubBot(socket, message, "code", targetNumber);
      } else {
        await createSubBot(socket, message, "qr", targetNumber);
      }
    } catch (error) {
      console.error("Error en comando subs:", error);
      await socket.sendMessage(
        remoteJid,
        { text: "❌ Ocurrió un error al procesar tu solicitud." },
        { quoted: message },
      );
    }
  },
};

function normalizePhoneNumber(value = "") {
  return String(value)
    .replace(/[()\s-]/g, "")
    .replace(/[+]/g, "")
    .replace(/[^\d]/g, "");
}

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes > 0 ? minutes : "";
  seconds = seconds < 10 && minutes > 0 ? "0" + seconds : seconds;

  if (minutes) {
    return `${minutes} minuto${minutes > 1 ? "s" : ""}, ${seconds} segundo${seconds > 1 ? "s" : ""}`;
  } else {
    return `${seconds} segundo${seconds > 1 ? "s" : ""}`;
  }
}
