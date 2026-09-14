import { createCanvas, loadImage } from "@napi-rs/canvas";
import { resolveLidToRealJid } from "../../models/utils.js";
import { fytBold } from "../../models/TextStyle.js";

async function getProfilePic(socket, jid) {
  try {
    const url = await socket.profilePictureUrl(jid, "image");
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawCircleAvatar(ctx, img, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = "#6be368";
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

function drawHeart(ctx, centerX, centerY, size, fill, stroke, lineWidth) {
  const top = centerY - size * 0.45;
  const bottom = centerY + size * 0.55;
  const lobe = size * 0.42;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - size * 0.08);
  ctx.bezierCurveTo(
    centerX - size * 0.16,
    centerY - size * 0.36,
    centerX - lobe,
    top,
    centerX - lobe,
    centerY - size * 0.05,
  );
  ctx.bezierCurveTo(
    centerX - lobe,
    centerY + size * 0.28,
    centerX - size * 0.2,
    centerY + size * 0.42,
    centerX,
    bottom,
  );
  ctx.bezierCurveTo(
    centerX + size * 0.2,
    centerY + size * 0.42,
    centerX + lobe,
    centerY + size * 0.28,
    centerX + lobe,
    centerY - size * 0.05,
  );
  ctx.bezierCurveTo(
    centerX + lobe,
    top,
    centerX + size * 0.16,
    centerY - size * 0.36,
    centerX,
    centerY - size * 0.08,
  );
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx, x, y, width, height, percent) {
  const radius = height / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const fillWidth = Math.max(0, ((width - 20) * percent) / 100);
  if (fillWidth > 0) {
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, fillWidth, height - 20, radius - 5);
    ctx.fillStyle = "#ff0505";
    ctx.fill();
  }
  ctx.restore();

  const heartX = x + 10 + Math.max(0, ((width - 20) * percent) / 100);
  drawHeart(ctx, heartX, y + height / 2 - 2, 68, "#ff1010", "#050505", 5);
}

export default {
  name: ["ship"],
  description: "Genera una tarjeta de compatibilidad entre dos usuarios",
  category: "fun",

  execute: async (sock, m, args, { jidRemitente, groupMetadata }) => {
    const remoteJid = m.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    const messageContext = m.message?.extendedTextMessage?.contextInfo;
    const mentioned = messageContext?.mentionedJid || [];
    const quotedParticipant = messageContext?.participant;

    let userA = jidRemitente || m.key.participant;
    let userB = null;

    if (mentioned.length >= 2) {
      userA = mentioned[0];
      userB = mentioned[1];
    } else if (mentioned.length === 1) {
      userB = mentioned[0];
    } else if (quotedParticipant) {
      userB = quotedParticipant;
    }

    if (!userA || !userB) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: "『💘』No pude identificar a los usuarios. Mencioná a alguien (o respondé su mensaje) para hacer el ship.\n\n*Uso:* .ship @usuario",
        },
        { quoted: m },
      );
    }

    if (userA === userB) {
      return await sock.sendMessage(
        remoteJid,
        { text: "『💘』No podés hacerte ship con vos mismo, xd." },
        { quoted: m },
      );
    }

    userA = await resolveLidToRealJid(userA, sock, remoteJid);
    userB = await resolveLidToRealJid(userB, sock, remoteJid);

    const mentions = [userA, userB].filter(
      (jid) => typeof jid === "string" && jid.includes("@"),
    );
    if (mentions.length !== 2) {
      return await sock.sendMessage(
        remoteJid,
        { text: "『💘』No pude identificar correctamente a los dos usuarios." },
        { quoted: m },
      );
    }

    const width = 1024;
    const height = 740;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#b542e8";
    ctx.fillRect(0, 0, width, height);

    const avatarSize = 310;
    const avatarY = 85;
    const avatarX = 85;
    const [imgA, imgB] = await Promise.all([
      getProfilePic(sock, userA),
      getProfilePic(sock, userB),
    ]);

    drawCircleAvatar(ctx, imgA, avatarX, avatarY, avatarSize);
    drawCircleAvatar(
      ctx,
      imgB,
      width - avatarX - avatarSize,
      avatarY,
      avatarSize,
    );

    const percent = Math.floor(Math.random() * 101);
    const heartCenterX = 512;
    const heartCenterY = 240;
    
    drawHeart(ctx, heartCenterX, heartCenterY, 125, "#ff007f", "#050505", 5);
    
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#050505";
    ctx.fillText(`${percent}%`, heartCenterX, heartCenterY + 10);

    drawProgressBar(ctx, 85, 580, 854, 78, percent);

    const buffer = canvas.toBuffer("image/png");
    const numA = userA.split("@")[0];
    const numB = userB.split("@")[0];

    let result;
    if (percent >= 80) result = "¡Son el uno para el otro!";
    else if (percent >= 50) result = "Hay potencial ahí...";
    else if (percent >= 20) result = "Mejor quedan como amigos.";
    else result = "Cero compatibilidad, lo siento.";

    const caption =
      `╭〔 💘 ${fytBold("¿HAY SHIP?")} 〕⬣\n\n` +
      `┃ @${numA} 💞 @${numB}\n` +
      `┃ ${fytBold("Porcentaje:")} ${percent}%\n` +
      `┃ ${result}\n\n` +
      `╰〔 ⚡ ${fytBold("FUN")} 〕⬣`;

    await sock.sendMessage(
      remoteJid,
      {
        image: buffer,
        caption,
        mentions,
      },
      { quoted: m },
    );
  },
};