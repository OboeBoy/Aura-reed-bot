import { fytBold } from "../../models/TextStyle.js";

const normalizeCommandName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/[^a-z0-9]/g, "");

export default {
  name: ["restrict", "globalrestrict", "restrictall"],
  category: "owner",
  description:
    "Bloquea o desbloquea un comando globalmente para todos los sockets.",
  ownerOnly: true,
  async execute(socket, message, args, { db, prefix, saveDB }) {
    const remoteJid = message.key.remoteJid;
    const raw = args[0]?.trim();

    if (!raw) {
      const current = db.restrictedCommands || [];
      const list =
        current.length > 0
          ? current.map((cmd) => `┃ > ${cmd}`).join("\n")
          : "┃ > Ningún comando restringido globalmente";

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚙️ ${fytBold("RESTRICT GLOBAL")} 〕⬣\n┃ ${fytBold("COMANDOS BLOQUEADOS")}\n╰━━━━━━━━━━━━⬣\n\n${list}\n\n┃ > Ejemplo: ${prefix}restrict warn\n┃ > Ejemplo: ${prefix}restrict off warn\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    const actionMatch = [
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
    ].includes(raw.toLowerCase());

    const action = actionMatch ? raw.toLowerCase() : "toggle";
    const targetCommand = actionMatch ? args[1] : raw;

    if (!targetCommand) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("COMANDO INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Debes indicar el nombre del comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    db.restrictedCommands ??= [];
    const commandName = normalizeCommandName(targetCommand);
    const list = db.restrictedCommands || [];
    const exists = list.some(
      (cmd) => normalizeCommandName(cmd) === commandName,
    );

    if (
      ["on", "enable", "add", "activar"].includes(action) ||
      (action === "toggle" && !exists)
    ) {
      if (!exists) list.push(commandName);
      db.restrictedCommands = [...new Set(list)];
      await saveDB(db, { immediate: true });

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 🔒 ${fytBold("RESTRICCIÓN GLOBAL")} 〕⬣\n┃ ${fytBold("Comando")} › ${commandName}\n╰━━━━━━━━━━━━⬣\n\n┃ > El comando queda bloqueado para todos los sockets.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    if (
      ["off", "disable", "remove", "desactivar"].includes(action) ||
      (action === "toggle" && exists)
    ) {
      db.restrictedCommands = list.filter(
        (cmd) => normalizeCommandName(cmd) !== commandName,
      );
      await saveDB(db, { immediate: true });

      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 🔓 ${fytBold("RESTRICCIÓN GLOBAL")} 〕⬣\n┃ ${fytBold("Comando")} › ${commandName}\n╰━━━━━━━━━━━━⬣\n\n┃ > El comando ya no está bloqueado globalmente.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
