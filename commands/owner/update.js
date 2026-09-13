import { exec } from "child_process";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["update", "actualizar", "fix"],
  category: "owner",
  description:
    "Actualiza el bot desde el repositorio (Git) mostrando los cambios.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    let initText = `╭〔 🚀 ${fytBold("AURA REED")} 〕⬣\n`;
    initText += `┃ ⚙️ ${fytBold("SISTEMA UPDATE")}\n`;
    initText += `╰━━━━━━━━━━━━⬣\n\n`;
    initText += `┃ > Buscando actualizaciones\n`;
    initText += `┃ > en la rama Termux...\n\n`;
    initText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

    const initMsg = await socket.sendMessage(
      remoteJid,
      { text: initText },
      { quoted: message }
    );

    const updateCmd = "git fetch origin Termux && git reset --hard origin/Termux && npm install --no-audit";

    exec(updateCmd, async (err, stdout, stderr) => {
      if (err) {
        let textErr = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        textErr += `┃ ⚠️ ${fytBold("ERROR DE UPDATE")}\n`;
        textErr += `╰━━━━━━━━━━━━⬣\n\n`;
        textErr += `┃ > Error al actualizar:\n`;
        textErr += `┃ > ${err.message}\n\n`;
        textErr += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

        return await socket.sendMessage(remoteJid, {
          text: textErr,
          edit: initMsg.key,
        });
      }

      if (stdout.includes("HEAD is now at") && stdout.includes("up to date")) {
        let textUp = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
        textUp += `┃ ✨ ${fytBold("SISTEMA UPDATE")}\n`;
        textUp += `╰━━━━━━━━━━━━⬣\n\n`;
        textUp += `┃ > El bot ya se encuentra\n`;
        textUp += `┃ > en su versión más reciente (Termux).\n\n`;
        textUp += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

        return await socket.sendMessage(remoteJid, {
          text: textUp,
          edit: initMsg.key,
        });
      }

      let textSuccess = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
      textSuccess += `┃ 🚀 ${fytBold("UPDATE COMPLETO")}\n`;
      textSuccess += `╰━━━━━━━━━━━━⬣\n\n`;
      textSuccess += `┃ > Rama: Termux\n`;
      textSuccess += `┃ > Parches y dependencias verificados.\n`;
      textSuccess += `┃ > Reinicie el bot para aplicar.\n\n`;
      textSuccess += `┣ 📝 ${fytBold("SALIDA DEL SISTEMA:")}\n`;
      textSuccess += `\`\`\`\n${stdout.slice(0, 1000).trim()}\n\`\`\`\n\n`;
      textSuccess += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      await socket.sendMessage(remoteJid, {
        text: textSuccess,
        edit: initMsg.key,
      });
    });
  },
};
