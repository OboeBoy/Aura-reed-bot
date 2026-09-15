import { fytBold } from "../../models/TextStyle.js";

const handler = async (m, { conn, text, isOwner }) => {
	if (!isOwner) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!m.quoted) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MENSAJE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a un mensaje para usarlo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!text) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA TEXTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona el texto falso que quieres ponerle.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!m.chat || !m.chat.endsWith('@g.us')) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("SOLO GRUPOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	// Extraemos el JID real de la víctima
	const targetParticipant = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;

	if (!targetParticipant) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("ERROR")} \n╰━━━━━━━━━━━━⬣\n\n┃ > No se pudo identificar al objetivo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	try {
		// MAGIA: El bot envía un carácter invisible (o el texto que quieras), 
		// pero falsifica por completo el mensaje citado para que diga lo que tú ordenaste.
		// Esto engaña la interfaz gráfica de WhatsApp a la perfección en Web y Celular.
		
		await conn.sendMessage(
			m.chat, 
			{ text: `👀` }, // El mensaje del bot (puedes cambiarlo a un carácter invisible '‎' si quieres)
			{
				quoted: {
					key: {
						fromMe: false,
						participant: targetParticipant,
						id: m.quoted.id // Conservamos el ID original para que parezca 100% real
					},
					message: {
						conversation: text // Aquí inyectamos el texto falso
					}
				}
			}
		);

	} catch (e) {
		console.error('[fakemsg]', e);
		await m.reply(`╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${e?.message || e}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}
};

handler.help = ['fakemsg', 'fake', 'fmsg'];
handler.tags = ['owner'];
handler.command = /^(fakemsg|fake|fmsg)$/i;
handler.group = true;
handler.owner = true;

export default handler;
