import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["amigo", "trampa", "sorpresa"],
  category: "fun",
  description: "Trampa con botones nativos de respuesta rápida.",

  execute: async (sock, m, args, isOwner) => {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(chatId, { text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣` }, { quoted: m });
      }

      await sock.sendMessage(chatId, { delete: m.key }).catch(() => {});

      const interactiveMsg = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                title: "🎁 *SORPRESA MISTERIOSA* 🎁",
                hasMediaAttachment: false
              },
              body: {
                text: "¡Felicidades! Tienes una caja sorpresa pendiente por abrir. Elige una de las opciones abajo para revelar tu premio en el grupo."
              },
              footer: {
                text: "Aura System - Sistema Interactivo"
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "YO AMO EL PENE 🍆",
                      id: "btn_trampa_1"
                    })
                  },
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "ME ENCANTA EL PENE 🤤",
                      id: "btn_trampa_2"
                    })
                  }
                ]
              }
            }
          }
        }
      };

      await sock.relayMessage(chatId, interactiveMsg, {});

    } catch (error) {
      if (sock && m) {
        await sock.sendMessage(m?.key?.remoteJid, { text: `Error: ${error?.message}` }).catch(() => {});
      }
    }
  }
};
