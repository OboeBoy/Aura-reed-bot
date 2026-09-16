import chalk from "chalk";
import { getContentType } from "@whiskeysockets/baileys";

export function cmdLog({
  numeroReal,
  rango,
  commandName,
  isGroup,
  text,
  jidRemitente,
  pushName,
  groupMetadata,
  prefix,
  sock,
  msg,
}) {
  let tipoMensajeInfo = "";
  let contenidoMensaje = text || "";
  let esMedio = false;

  if (msg?.message) {
    let innerMessage = msg.message;
    let isViewOnce = false;

    if (innerMessage.viewOnceMessage) {
      isViewOnce = true;
      innerMessage = innerMessage.viewOnceMessage.message;
    } else if (innerMessage.viewOnceMessageV2) {
      isViewOnce = true;
      innerMessage = innerMessage.viewOnceMessageV2.message;
    }

    const rawType = getContentType(innerMessage) || "desconocido";
    tipoMensajeInfo = isViewOnce ? `${rawType} (Vista Única 👁️)` : rawType;

    // Detectar si es contenido multimedia (imagen, video, audio, documento, sticker)
    const tiposMedios = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "documentMessage",
      "stickerMessage",
      "ptvMessage" // videomensaje circular
    ];

    if (tiposMedios.includes(rawType) || isViewOnce) {
      esMedio = true;
    }

    // Extraer texto o descripción si no viene en la variable text principal
    if (!contenidoMensaje) {
      contenidoMensaje =
        innerMessage.conversation ||
        innerMessage.extendedTextMessage?.text ||
        innerMessage.imageMessage?.caption ||
        innerMessage.videoMessage?.caption ||
        innerMessage.documentMessage?.caption ||
        "";
    }
  }

  // Si no hay comando, ni tipo de mensaje, ni texto, detenemos
  if (!commandName && !tipoMensajeInfo && !contenidoMensaje) return;

  const cmdPrefix = prefix || "#";

  const fecha = new Date().toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica",
  });
  const senderNumber = jidRemitente ? jidRemitente.split("@")[0] : numeroReal;

  let tipoAccion = chalk.blue.bold(" MENSAJE ");
  if (commandName) {
    tipoAccion = chalk.cyan.bold(" COMANDO ");
  } else if (esMedio) {
    tipoAccion = chalk.magenta.bold(" MEDIO 🖼️ ");
  }

  let contenido = chalk.gray("(Sin contenido)");
  if (commandName) {
    contenido = chalk.yellow.bold(`${cmdPrefix}${commandName}`);
  } else if (contenidoMensaje) {
    contenido = chalk.white(contenidoMensaje);
  } else if (esMedio) {
    contenido = chalk.italic.gray(`[Archivo Multimedia: ${tipoMensajeInfo}]`);
  }

  const chatTipo = isGroup ? chalk.green("Grupo") : chalk.magenta("Privado");
  const rolRango = rango ? rango.toUpperCase() : "USUARIO 👤";
  const nombreUsuario = pushName || "Usuario Desconocido";

  const botType = sock?.isSubBot ? `Sub-Bot (+${sock.subBotId})` : "Principal";

  let lineasDinamicas = `${chalk.blue.bold("│")} ${chalk.white("🤖 ")} ${chalk.bold("Bot:")}       ${chalk.cyan(botType)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("👤 ")} ${chalk.bold("Usuario:")}   ${chalk.white(nombreUsuario)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🎖️ ")} ${chalk.bold("Rango:")}     ${chalk.magenta(rolRango)}\n`;

  if (isGroup) {
    const nombreGrupo = groupMetadata?.subject || "Grupo Desconocido";
    lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🏠 ")} ${chalk.bold("Grupo:")}     ${chalk.white(nombreGrupo)}\n`;
  }

  if (tipoMensajeInfo) {
    lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("📦 ")} ${chalk.bold("Tipo:")}      ${chalk.cyan(tipoMensajeInfo)}\n`;
  }

  if (contenidoMensaje && !commandName) {
    const textoCortado = contenidoMensaje.length > 40 ? contenidoMensaje.substring(0, 37) + "..." : contenidoMensaje;
    lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("📝 ")} ${chalk.bold("Texto:")}     ${chalk.italic(textoCortado)}\n`;
  }

  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🕒 ")} ${chalk.bold("Fecha:")}     ${chalk.white(fecha)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("📱 ")} ${chalk.bold("Número:")}    +${chalk.white(senderNumber)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("💬 ")} ${chalk.bold("Chat:")}      ${chatTipo}\n`;

  console.log(
    chalk.blue.bold(`╭──────────────────────────────────────────────────⬣\n`) +
      lineasDinamicas +
      `${chalk.blue.bold("├──────────────────────────────────────────────────⬣\n")}` +
      `${chalk.blue.bold("│")}${tipoAccion} ➤  ${contenido}\n` +
      chalk.blue.bold(`╰──────────────────────────────────────────────────⬣`),
  );
}