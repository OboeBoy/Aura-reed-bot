import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Apuntamos a la misma carpeta tmp que usa tu comando de TikTok
const customTemp = path.join(__dirname, "../../tmp");

export default {
  name: ["cleartmp", "limpiartmp", "deltmp", "cleartemp"],
  category: "system",
  description: "Limpia la carpeta temporal del bot para liberar memoria interna.",

  execute: async (sock, m, args, isOwner) => {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      await sock.sendMessage(chatId, { react: { text: "🧹", key: m.key } });

      if (!fs.existsSync(customTemp)) {
         return await sock.sendMessage(chatId, { text: `╭〔 🧹 ${fytBold("AURA SYSTEM")} 〕⬣\n┃ ✅ ${fytBold("CARPETA VACÍA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > La carpeta temporal ya está limpia o no existe.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      let deletedFiles = 0;
      let freedSpace = 0;

      // Leemos todos los archivos huérfanos que estén atorados en la carpeta tmp
      const files = fs.readdirSync(customTemp);

      for (const file of files) {
        const filePath = path.join(customTemp, file);
        try {
          const stat = fs.statSync(filePath);
          freedSpace += stat.size; // Sumamos el peso del archivo
          
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          deletedFiles++;
        } catch (err) {
          console.log(`[cleartmp] Archivo bloqueado o en uso ignorado: ${filePath}`);
        }
      }

      const freedMB = (freedSpace / 1024 / 1024).toFixed(2);

      let caption = `╭〔 🧹 ${fytBold("AURA SYSTEM")} 〕⬣\n`;
      caption += `┃ ✅ ${fytBold("LIMPIEZA COMPLETADA")}\n`;
      caption += `╰━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > ${fytBold("Archivos eliminados:")} ${deletedFiles}\n`;
      caption += `┃ > ${fytBold("Memoria liberada:")} ${freedMB} MB\n\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });

    } catch (error) {
      console.error('[cleartmp]', error);
      if (sock && m) {
        await sock.sendMessage(m?.key?.remoteJid, {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL LIMPIAR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`
        }, { quoted: m }).catch(() => {});
      }
    }
  }
};

