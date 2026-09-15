import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["fakemsg", "fake", "fmsg"],
  category: "owner",
  description: "Falsifica la cita de un mensaje para poner palabras en la boca de otro.",
  ownerOnly: true,

  async execute(sock, m, args, isOwner) {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      // Extraer el contexto del mensaje (Baileys puro)
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

      if (!chatId || !chatId.endsWith('@g.us')) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("SOLO GRUPOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      // MAGIA: Enviar el mensaje con la cita falsificada apuntando al objetivo real
      await sock.sendMessage(
        chatId, 
        { text: `👀` }, // Puedes cambiar estos ojitos por un carácter invisible como '‎' si quieres que el bot no diga nada arriba.
        {
          quoted: {
            key: {
              fromMe: false,
              participant: targetParticipant,
              id: stanzaId 
            },
            message: {
              conversation: text // Texto inyectado a la víctima
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
