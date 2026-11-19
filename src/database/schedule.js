import { getDatabase } from './mongodb.js';

const TOKEN_COLLECTION = 'schedule_credentials';
const CONFIG_COLLECTION = 'schedule_config';

export async function initScheduleIndexes() {
  const db = getDatabase();
  await Promise.all([
    db.collection(TOKEN_COLLECTION).createIndex({ discordUserId: 1 }, { unique: true }),
    db.collection(CONFIG_COLLECTION).createIndex({ guildId: 1 }, { unique: true })
  ]);
}

export async function getScheduleCredentials(discordUserId) {
  return getDatabase().collection(TOKEN_COLLECTION).findOne({ discordUserId });
}

export async function saveScheduleCredentials(discordUserId, credentials) {
  const now = new Date();
  await getDatabase().collection(TOKEN_COLLECTION).updateOne(
    { discordUserId },
    {
      $set: { ...credentials, updatedAt: now },
      $setOnInsert: { discordUserId, createdAt: now }
    },
    { upsert: true }
  );
}

export async function deleteScheduleCredentials(discordUserId) {
  await getDatabase().collection(TOKEN_COLLECTION).deleteOne({ discordUserId });
}

export async function getScheduleAuthorizedRoles(guildId) {
  const config = await getDatabase().collection(CONFIG_COLLECTION).findOne({ guildId });
  return config?.authorizedRoles ?? [];
}

export async function addScheduleAuthorizedRole(guildId, roleId) {
  await getDatabase().collection(CONFIG_COLLECTION).updateOne(
    { guildId },
    { $addToSet: { authorizedRoles: roleId }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeScheduleAuthorizedRole(guildId, roleId) {
  const result = await getDatabase().collection(CONFIG_COLLECTION).updateOne(
    { guildId },
    { $pull: { authorizedRoles: roleId }, $set: { updatedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

export async function setScheduleNotificationTime(guildId, time) {
  await getDatabase().collection(CONFIG_COLLECTION).updateOne(
    { guildId },
    { 
      $set: { 
        notificationTime: time, 
        timezone: 'Asia/Ho_Chi_Minh',
        updatedAt: new Date() 
      } 
    },
    { upsert: true }
  );
}

export async function getScheduleNotificationTime(guildId) {
  const config = await getDatabase().collection(CONFIG_COLLECTION).findOne({ guildId });
  return config?.notificationTime ?? null;
}

export async function getAllScheduleNotificationConfigs() {
  return getDatabase()
    .collection(CONFIG_COLLECTION)
    .find({ notificationTime: { $exists: true, $ne: null } })
    .toArray();
}
