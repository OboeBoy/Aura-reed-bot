import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["fakemsg", "fake", "fmsg"],
  category: "group",
  description: "Falsifica la cita de un mensaje inyectando texto personalizado.",

  async execute(sock, m, args, isOwner) {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      // Extraer el contexto del mensaje
      const contextInfo = m?.message?.extendedTextMessage?.contextInfo || m?.message?.imageMessage?.contextInfo || {};
      const targetParticipant = contextInfo.participant;
      const stanzaId = contextInfo.stanzaId;
      
      if (!targetParticipant || !stanzaId) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MENSAJE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a un mensaje para usarlo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      const text = Array.isArray(args) ? args.join(' ') : String(args || '');
      if (!text.trim()) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA TEXTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona el texto falso que quieres inyectar.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      // MAGIA PURA: Inyección forzada en el payload para sobrescribir la memoria de Baileys
      await sock.sendMessage(
        chatId, 
        { 
          text: '\u200E', // Carácter invisible para que parezca que el bot no dijo nada, solo la cita
          contextInfo: {
            participant: targetParticipant,
            stanzaId: stanzaId,
            quotedMessage: {
              extendedTextMessage: {
                text: text // ¡Aquí entra el texto falso forzado!
              }
            }
          }
        }
      );

    } catch (error) {
      console.error('[fakemsg]', error);
      if (sock && m) {
        await sock.sendMessage(m?.key?.remoteJid, {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`
        }, { quoted: m }).catch(() => {});
      }
    }
  }
};
