// groupDb.js
import { getDBSync } from "./db.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export const DEFAULT_GROUP = {
  antilink: false,
  warnLimit: 3,
  warns: {},
  activity: {},
  onlyAdmin: false,
  antitoxic: false,
  antiCalls: false,
  antiStatus: false,
  welcome: false,
  disabledCategories: ["nsfw"],
  botOn: true,
  prefix: null,
  users: {},
};

const ECONOMY_FIELDS = new Set([
  "coins",
  "bank",
  "lastWork",
  "lastDaily",
  "lastWeekly",
  "lastMonthly",
  "lastCrime",
  "lastSlut",
  "lastHunt",
  "lastMine",
  "lastPpt",
  "lastSteal",
  "lastAdventure",
]);

export function stripEconomyFromUsers(users = {}) {
  const cleaned = {};
  for (const [jid, data] of Object.entries(users)) {
    if (!data || typeof data !== "object") continue;
    const globalData = {};
    for (const [key, value] of Object.entries(data)) {
      if (!ECONOMY_FIELDS.has(key)) globalData[key] = value;
    }
    if (Object.keys(globalData).length > 0) cleaned[jid] = globalData;
  }
  return cleaned;
}

export function ensureGroup(db, remoteJid) {
  if (!db.groups) db.groups = {};

  const group = db.groups[remoteJid];
  if (!group) {
    db.groups[remoteJid] = {
      ...DEFAULT_GROUP,
      warns: {},
      activity: {},
      users: {},
    };
    return db.groups[remoteJid];
  }

  for (const [key, value] of Object.entries(DEFAULT_GROUP)) {
    if (group[key] === undefined) group[key] = structuredClone(value);
  }

  if (!group.activity || typeof group.activity !== "object")
    group.activity = {};
  if (!group.users || typeof group.users !== "object") group.users = {};
  if (!group.warns || typeof group.warns !== "object") group.warns = {};

  return group;
}

export function getGroupUsers(db, remoteJid) {
  return ensureGroup(db, remoteJid).users;
}

export function getGroupUser(
  db,
  remoteJid,
  jid,
  defaults = { coins: 0, bank: 0 },
) {
  const normalizedJid = jidNormalizedUser(jid);
  const users = getGroupUsers(db, remoteJid);

  if (!users[normalizedJid] && jid !== normalizedJid && users[jid]) {
    users[normalizedJid] = users[jid];
    delete users[jid];
  }

  if (!users[normalizedJid]) users[normalizedJid] = { ...defaults };
  return users[normalizedJid];
}

export function trackGroupActivity(db, remoteJid, jid) {
  if (!remoteJid?.endsWith("@g.us") || !jid?.endsWith("@s.whatsapp.net"))
    return false;

  const group = ensureGroup(db, remoteJid);
  const monthKey = new Date().toISOString().slice(0, 7);

  if (
    !group.activity[monthKey] ||
    typeof group.activity[monthKey] !== "object"
  ) {
    group.activity[monthKey] = {};
  }

  const monthly = group.activity[monthKey];
  monthly[jid] = (monthly[jid] || 0) + 1;

  const globalDb = getDBSync();
  if (!globalDb.users) globalDb.users = {};
  if (!globalDb.users[jid]) {
    globalDb.users[jid] = { xp: 0, level: 1 };
  }

  const user = globalDb.users[jid];
  user.xp = (user.xp || 0) + 1;
  user.level = Math.floor(user.xp / 150) + 1;

  return true;
}
