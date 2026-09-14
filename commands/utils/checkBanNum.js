import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";

const LEMPI_API_KEY = process.env.LEMPI_API_KEY || "OBOE-AERETHIX";
function validNumber(num) {
  return /^\d{7,15}$/.test(num);
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

async function checkBanStatus(number) {
  if (!validNumber(number)) {
    throw new Error("Número inválido. Debe contener solo dígitos.");
  }
  const API = "https://api.lempi.lat/tools/wabancheck";
  try {
    const { data } = await axios.get(API, {
      params: {
        lang: "es",
        apikey: LEMPI_API_KEY,
        number: number,
      },
      timeout: 15000,
    });
    return data;
  } catch (error) {
    throw new Error("Error al consultar el estado del número.");
  }
}

function getNumberFromMessage(message, args) {
  const mentionedJid =
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const mentionedNumber = normalizeNumber(mentionedJid?.split("@")[0]);
  const textNumber = normalizeNumber(args.join(""));

  return textNumber || mentionedNumber || null;
}

function formatBanResult(number, response) {
  const result = response?.resultado?.data;
  if (!result || typeof result.isBanned !== "boolean") {
    throw new Error("La API devolvió una respuesta inválida.");
  }

  const status = result.isBanned ? "BANEADO" : "NO BANEADO";
  const statusIcon = result.isBanned ? "🔴" : "🟢";
  const permanence = result.isPermanent
    ? "Permanente"
    : "Temporal o no confirmado";
  const violation = result.violation_info?.description || "No especificada";
  const duration = result.violation_info?.duration || "No especificada";
  const risk = result.violation_info?.risk || "No especificado";
  const statusMessage = result.status_message || "Sin detalles adicionales";

  return [
    `╭〔 ${statusIcon} ${fytBold("CHECK BAN")} 〕⬣`,
    `┃ 📱 ${fytBold("Número")} › ${number}`,
    `┃ 📌 ${fytBold("Estado")} › ${status}`,
    `┃ ⏱️ ${fytBold("Tipo")} › ${permanence}`,
    `┃ ⚠️ ${fytBold("Motivo")} › ${violation}`,
    `┃ ⌛ ${fytBold("Duración")} › ${duration}`,
    `┃ 📊 ${fytBold("Riesgo")} › ${risk}`,
    `┃ 💬 ${fytBold("Detalles")} › ${statusMessage}`,
    `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`,
  ].join("\n");
}

export default {
  name: ["checkban", "checknum"],
  category: "utils",
  description: "Verifica si un número de WhatsApp está baneado",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const number = getNumberFromMessage(message, args);

    if (!number || !validNumber(number)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("CHECK BAN")} 〕⬣\n┃ ❌ ${fytBold("NÚMERO INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Usa un número con código de país.\n┃ > Ejemplo: ${prefix}checkban 525530797879`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "🔎", key: message.key },
    });

    try {
      const response = await checkBanStatus(number);
      await socket.sendMessage(remoteJid, {
        react: {
          text: response?.resultado?.data?.isBanned ? "🔴" : "✅",
          key: message.key,
        },
      });
      return await socket.sendMessage(
        remoteJid,
        { text: formatBanResult(number, response) },
        { quoted: message },
      );
    } catch (error) {
      console.error("[checkban] Error:", error.message);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ No se pudo consultar el estado de ${number}. Intenta nuevamente más tarde.`,
        },
        { quoted: message },
      );
    }
  },
};
