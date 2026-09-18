import { fytBold } from "../../models/TextStyle.js";

const normalizeCommandName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/[^a-z0-9]/g, "");

export default {
  name: ["restrictcmd", "cmdrestrict", "blockcmd"],
  category: "group",
  description: "Bloquea o desbloquea un comando específico en el grupo.",
  adminOnly: true,
  execute: async (socket, message, args, { db, prefix, saveDB }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCIÓN INCOMPATIBLE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    db.groups ??= {};
    db.groups[remoteJid] ??= {};
    db.groups[remoteJid].restrictedCommands ??= [];

    const normalizedArgs = args.map((arg) => arg.trim()).filter(Boolean);
    const isAction = [
      "on",
      "off",
      "enable",
      "disable",
      "activar",
      "desactivar",
      "add",
      "remove",
      "list",
      "ls",
      "show",
    ].includes((normalizedArgs[0] || "").toLowerCase());

    const action = isAction ? normalizedArgs[0].toLowerCase() : "toggle";
    const targetCommand = isAction ? normalizedArgs[1] : normalizedArgs[0];

    if (!targetCommand && !["list", "ls", "show"].includes(action)) {
      const current = db.groups[remoteJid].restrictedCommands || [];
      const list =
        current.length > 0
          ? current.map((cmd) => `┃ > ${cmd}`).join("\n")
          : "┃ > Ningún comando restringido";

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚙️ ${fytBold("RESTRICTCMD")} 〕⬣\n┃ ${fytBold("COMANDOS BLOQUEADOS")}\n╰━━━━━━━━━━━━⬣\n\n${list}\n\n┃ > Ejemplo: ${prefix}restrictcmd warn\n┃ > Ejemplo: ${prefix}restrictcmd off warn\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    if (["list", "ls", "show"].includes(action)) {
      const current = db.groups[remoteJid].restrictedCommands || [];
      const list =
        current.length > 0
          ? current.map((cmd) => `┃ > ${cmd}`).join("\n")
          : "┃ > Ningún comando restringido";

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚙️ ${fytBold("RESTRICTCMD")} 〕⬣\n┃ ${fytBold("ESTADO ACTUAL")}\n╰━━━━━━━━━━━━⬣\n\n${list}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    const commandName = normalizeCommandName(targetCommand);
    if (!commandName) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("COMANDO INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Escribe el nombre del comando a bloquear.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    const current = db.groups[remoteJid].restrictedCommands || [];
    const exists = current.some(
      (cmd) => normalizeCommandName(cmd) === commandName,
    );

    if (
      ["on", "enable", "add", "activar"].includes(action) ||
      (action === "toggle" && !exists)
    ) {
      if (!exists) current.push(commandName);
      db.groups[remoteJid].restrictedCommands = [...new Set(current)];
      await saveDB(db, { immediate: true });

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 🔒 ${fytBold("COMANDO BLOQUEADO")} 〕⬣\n┃ ${fytBold("Grupo")} › ${commandName}\n╰━━━━━━━━━━━━⬣\n\n┃ > Ahora el comando *${commandName}* queda restringido en este grupo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    if (
      ["off", "disable", "remove", "desactivar"].includes(action) ||
      (action === "toggle" && exists)
    ) {
      db.groups[remoteJid].restrictedCommands = current.filter(
        (cmd) => normalizeCommandName(cmd) !== commandName,
      );
      await saveDB(db, { immediate: true });

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 🔓 ${fytBold("COMANDO HABILITADO")} 〕⬣\n┃ ${fytBold("Grupo")} › ${commandName}\n╰━━━━━━━━━━━━⬣\n\n┃ > El comando *${commandName}* ya no está restringido en este grupo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
