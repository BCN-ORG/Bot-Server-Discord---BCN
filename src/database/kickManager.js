import { getDatabase } from './mongodb.js';
import { ObjectId } from 'mongodb';

const ALLOWED_ROLES_COLLECTION = 'kick_allowed_roles';
const LOG_CHANNELS_COLLECTION = 'kick_log_channels';
const KICK_HISTORY_COLLECTION = 'kick_history';
let indexesPromise;

function getAllowedRolesCollection() {
  return getDatabase().collection(ALLOWED_ROLES_COLLECTION);
}

function getKickHistoryCollection() {
  return getDatabase().collection(KICK_HISTORY_COLLECTION);
}

function getLogChannelsCollection() {
  return getDatabase().collection(LOG_CHANNELS_COLLECTION);
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      getAllowedRolesCollection().createIndex({ guildId: 1, roleId: 1 }, { unique: true }),
      getLogChannelsCollection().createIndex({ guildId: 1, channelId: 1 }, { unique: true }),
      getKickHistoryCollection().createIndex({ guildId: 1, targetUserId: 1, kickedAt: -1 }),
      getKickHistoryCollection().createIndex({ guildId: 1, targetUserId: 1, rollbackAllowedUntil: 1 })
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  await indexesPromise;
}

export async function addKickLogChannel(guildId, channelId, addedBy) {
  await ensureIndexes();
  const now = new Date();
  await getLogChannelsCollection().updateOne(
    { guildId, channelId },
    { $set: { addedBy, addedAt: now, updatedAt: now } },
    { upsert: true }
  );
}

export async function removeKickLogChannel(guildId, channelId) {
  await ensureIndexes();
  const result = await getLogChannelsCollection().deleteOne({ guildId, channelId });
  return result.deletedCount > 0;
}

export async function listKickLogChannels(guildId) {
  await ensureIndexes();
  return getLogChannelsCollection().find({ guildId }).sort({ addedAt: 1 }).toArray();
}

export async function addKickAllowedRole(guildId, roleId, addedBy) {
  await ensureIndexes();
  const now = new Date();
  await getAllowedRolesCollection().updateOne(
    { guildId, roleId },
    { $set: { addedBy, addedAt: now, updatedAt: now } },
    { upsert: true }
  );
}

export async function removeKickAllowedRole(guildId, roleId) {
  await ensureIndexes();
  const result = await getAllowedRolesCollection().deleteOne({ guildId, roleId });
  return result.deletedCount > 0;
}

export async function listKickAllowedRoles(guildId) {
  await ensureIndexes();
  return getAllowedRolesCollection().find({ guildId }).sort({ addedAt: 1 }).toArray();
}

export async function isKickAllowedMember(guildId, roleIds) {
  await ensureIndexes();
  if (!roleIds.length) {
    return false;
  }
  return Boolean(await getAllowedRolesCollection().findOne({
    guildId,
    roleId: { $in: roleIds }
  }));
}

export async function saveKickRecord({
  guildId,
  targetUserId,
  kickedByUserId,
  reason,
  rolesSnapshot,
  kickedAt = new Date(),
  rollbackAllowedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
}) {
  await ensureIndexes();
  const result = await getKickHistoryCollection().insertOne({
    guildId,
    targetUserId,
    kickerUserId: kickedByUserId,
    reason: reason || null,
    rolesSnapshot: Array.isArray(rolesSnapshot) ? rolesSnapshot : [],
    kickedAt,
    rollbackAllowedUntil,
    rolledBack: false,
    rolledBackAt: null,
    rolledBackBy: null,
    createdAt: new Date()
  });
  return { ...result, insertedId: result.insertedId };
}

export async function getLatestKickRecord(guildId, targetUserId) {
  await ensureIndexes();
  return getKickHistoryCollection()
    .find({ guildId, targetUserId, rolledBack: false })
    .sort({ kickedAt: -1 })
    .limit(1)
    .next();
}

export async function getKickHistoryByTarget(guildId, targetUserId) {
  await ensureIndexes();
  return getKickHistoryCollection()
    .find({ guildId, targetUserId })
    .sort({ kickedAt: -1 })
    .toArray();
}

export async function getKickRecordById(guildId, recordId) {
  await ensureIndexes();
  if (!ObjectId.isValid(recordId)) {
    return null;
  }
  return getKickHistoryCollection().findOne({
    _id: new ObjectId(recordId),
    guildId
  });
}

export async function markKickRolledBack(recordId, rolledBackByUserId, rolledBackAt = new Date()) {
  await ensureIndexes();
  await getKickHistoryCollection().updateOne(
    { _id: recordId },
    {
      $set: {
        rolledBack: true,
        rolledBackBy: rolledBackByUserId,
        rolledBackAt
      }
    }
  );
}
