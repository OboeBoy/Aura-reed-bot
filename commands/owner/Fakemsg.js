import { delay } from 'baileys';
import { fytBold } from "../../models/TextStyle.js";

const handler = async (m, { conn, text, isOwner }) => {
	if (!isOwner) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!m.quoted) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MENSAJE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a un mensaje para usarlo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!text) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA TEXTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona el texto de reemplazo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	if (!m.chat || !m.chat.endsWith('@g.us')) {
		return m.reply(`╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("SOLO GRUPOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`);
	}

	const stanzaId = m.quoted.id; 

	try {
		const tempId = await conn.relayMessage(
			m.chat,
			{
				extendedTextMessage: {
					text: '',
					contextInfo: {
						isGroupStatus: true,
					},
				},
			},
			{}
		);

		const tempId2 = await conn.relayMessage(
			m.chat,
			{
				protocolMessage: {
					key: {
						jid: m.chat,
						fromMe: true,
						id: tempId,
					},
					type: 14,
					editedMessage: {
						extendedTextMessage: {
							text,
							contextInfo: {
								isGroupStatus: false,
							},
						},
					},
				},
			},
			{
				messageId: stanzaId,
			}
		);

		await delay(100);

		await Promise.allSettled([
			conn.sendMessage(m.chat, {
				delete: {
					remoteJid: m.chat,
					id: tempId,
					fromMe: true,
				},
			}),
			conn.sendMessage(m.chat, {
				delete: {
					remoteJid: m.chat,
					id: tempId2,
					fromMe: true,
				},
			}),
		]);
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
